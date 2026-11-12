-- Esquema de la base de datos.
-- Se ejecuta en cada arranque (idempotente).

CREATE TABLE IF NOT EXISTS usuarios (
  id       TEXT PRIMARY KEY,
  usuario  TEXT NOT NULL UNIQUE,
  nombre   TEXT,
  hash     TEXT NOT NULL DEFAULT '',
  salt     TEXT NOT NULL DEFAULT '',
  creado   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sesiones_web (
  token       TEXT PRIMARY KEY,
  usuario_id  TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  expira      TEXT NOT NULL,
  creada      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS preferencias (
  usuario_id       TEXT PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
  moneda           TEXT NOT NULL DEFAULT 'PEN',
  solo_oficiales   INTEGER NOT NULL DEFAULT 1,
  tiendas          TEXT,
  notificaciones   INTEGER NOT NULL DEFAULT 1,
  pc_cpu           TEXT,
  pc_gpu           TEXT,
  pc_ram           TEXT,
  pc_so            TEXT,
  email            TEXT,
  telegram_chat_id TEXT,
  actualizado      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sesiones (
  id           TEXT PRIMARY KEY,
  usuario_id   TEXT REFERENCES usuarios(id) ON DELETE CASCADE,
  titulo       TEXT NOT NULL,
  creada       TEXT NOT NULL DEFAULT (datetime('now')),
  actualizada  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS mensajes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  sesion_id  TEXT NOT NULL REFERENCES sesiones(id) ON DELETE CASCADE,
  rol        TEXT NOT NULL CHECK (rol IN ('user', 'model')),
  texto      TEXT NOT NULL,
  widgets    TEXT,
  proveedor  TEXT,
  modelo     TEXT,
  nivel      TEXT,
  fecha      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Índice para leer el historial de una conversación sin recorrer toda la tabla.
CREATE INDEX IF NOT EXISTS idx_mensajes_sesion ON mensajes (sesion_id, id);

-- Los índices que usan usuario_id se crean después de las migraciones (db/index.js).

-- Biblioteca personal por usuario.
CREATE TABLE IF NOT EXISTS biblioteca (
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

-- Historial propio de precios (snapshots). Los precios no dependen del usuario.
CREATE TABLE IF NOT EXISTS precios_historial (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  appid      INTEGER NOT NULL,
  precio_pen REAL,
  precio_usd REAL,
  fuente     TEXT,
  fecha      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_precios_appid ON precios_historial (appid, fecha);
