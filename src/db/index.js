import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import config from "../config.js";

// Nos aseguramos de que exista la carpeta donde vivirá el archivo .db.
fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });

export const db = new Database(config.dbPath);

// WAL: mejor rendimiento con lecturas y escrituras concurrentes.
db.pragma("journal_mode = WAL");
// SQLite no aplica las claves foráneas por defecto; hay que activarlas en cada conexión.
db.pragma("foreign_keys = ON");

const schema = fs.readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
db.exec(schema);

// Migraciones para bases de datos creadas con versiones anteriores.
const columnasMensajes = db.prepare("PRAGMA table_info(mensajes)").all();
const nombresColumnas = new Set(columnasMensajes.map((columna) => columna.name));

if (!nombresColumnas.has("widgets")) {
  db.exec("ALTER TABLE mensajes ADD COLUMN widgets TEXT");
}
if (!nombresColumnas.has("proveedor")) {
  db.exec("ALTER TABLE mensajes ADD COLUMN proveedor TEXT");
}
if (!nombresColumnas.has("modelo")) {
  db.exec("ALTER TABLE mensajes ADD COLUMN modelo TEXT");
}
if (!nombresColumnas.has("nivel")) {
  db.exec("ALTER TABLE mensajes ADD COLUMN nivel TEXT");
}

export const closeDb = () => db.close();
