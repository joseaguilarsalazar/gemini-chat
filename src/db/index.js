import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import config from "../config.js";
import { USUARIO_DEMO } from "../constants.js";

// Nos aseguramos de que exista la carpeta donde vivirá el archivo .db.
fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });

export const db = new Database(config.dbPath);

// WAL: mejor rendimiento con lecturas y escrituras concurrentes.
db.pragma("journal_mode = WAL");
// SQLite no aplica las claves foráneas por defecto; hay que activarlas en cada conexión.
db.pragma("foreign_keys = ON");

const schema = fs.readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
db.exec(schema);

/**
 * Migraciones para bases de datos creadas con versiones anteriores.
 * Son idempotentes: se pueden ejecutar en cada arranque.
 */
const columnasMensajes = db.prepare("PRAGMA table_info(mensajes)").all();
const nombresMensajes = new Set(columnasMensajes.map((columna) => columna.name));

if (!nombresMensajes.has("widgets")) {
  db.exec("ALTER TABLE mensajes ADD COLUMN widgets TEXT");
}
if (!nombresMensajes.has("proveedor")) {
  db.exec("ALTER TABLE mensajes ADD COLUMN proveedor TEXT");
}
if (!nombresMensajes.has("modelo")) {
  db.exec("ALTER TABLE mensajes ADD COLUMN modelo TEXT");
}
if (!nombresMensajes.has("nivel")) {
  db.exec("ALTER TABLE mensajes ADD COLUMN nivel TEXT");
}

const columnasSesiones = db.prepare("PRAGMA table_info(sesiones)").all();
if (!columnasSesiones.some((columna) => columna.name === "usuario_id")) {
  db.exec("ALTER TABLE sesiones ADD COLUMN usuario_id TEXT REFERENCES usuarios(id) ON DELETE CASCADE");
}

// La biblioteca antigua tenía appid como PRIMARY KEY (un solo usuario).
// La reconstruimos con id propio y unicidad por (usuario_id, appid).
const columnasBiblioteca = db.prepare("PRAGMA table_info(biblioteca)").all();
if (!columnasBiblioteca.some((columna) => columna.name === "usuario_id")) {
  db.exec(`
    ALTER TABLE biblioteca RENAME TO biblioteca_v1;

    CREATE TABLE biblioteca (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id      TEXT REFERENCES usuarios(id) ON DELETE CASCADE,
      appid           INTEGER NOT NULL,
      nombre          TEXT NOT NULL,
      imagen          TEXT,
      estado          TEXT NOT NULL DEFAULT 'wishlist'
                      CHECK (estado IN ('wishlist', 'jugando', 'terminado', 'abandonado')),
      puntuacion      INTEGER CHECK (puntuacion BETWEEN 1 AND 10),
      nota            TEXT,
      precio_objetivo REAL,
      precio_actual   REAL,
      etiquetas       TEXT,
      tiempo_medio    INTEGER,
      agregado        TEXT NOT NULL DEFAULT (datetime('now')),
      actualizado     TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (usuario_id, appid)
    );

    INSERT INTO biblioteca
      (usuario_id, appid, nombre, imagen, estado, puntuacion, nota,
       precio_objetivo, precio_actual, agregado, actualizado)
    SELECT NULL, appid, nombre, imagen, estado, puntuacion, nota,
           precio_objetivo, precio_actual, agregado, actualizado
    FROM biblioteca_v1;

    DROP TABLE biblioteca_v1;

    CREATE INDEX IF NOT EXISTS idx_biblioteca_usuario
      ON biblioteca (usuario_id, estado, actualizado DESC);
  `);
}

// Usuario interno para la fase sin autenticación. No tiene contraseña válida.
db.prepare(`
  INSERT INTO usuarios (id, usuario, nombre, hash, salt)
  VALUES (?, ?, ?, '', '')
  ON CONFLICT (id) DO NOTHING
`).run(USUARIO_DEMO, "demo", "Invitado");

// Índices que dependen de columnas agregadas por migraciones.
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_sesiones_usuario
    ON sesiones (usuario_id, actualizada DESC);
  CREATE INDEX IF NOT EXISTS idx_biblioteca_usuario
    ON biblioteca (usuario_id, estado, actualizado DESC);
`);

export const closeDb = () => db.close();
