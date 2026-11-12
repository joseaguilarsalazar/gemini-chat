-- Esquema de la base de datos.
-- Se ejecuta en cada arranque (idempotente).

CREATE TABLE IF NOT EXISTS sesiones (
  id           TEXT PRIMARY KEY,
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

-- Índice para ordenar el panel de conversaciones por actividad reciente.
CREATE INDEX IF NOT EXISTS idx_sesiones_actualizada ON sesiones (actualizada DESC);

-- Biblioteca personal del usuario.
CREATE TABLE IF NOT EXISTS biblioteca (
  appid            INTEGER PRIMARY KEY,
  nombre           TEXT NOT NULL,
  imagen           TEXT,
  estado           TEXT NOT NULL DEFAULT 'wishlist'
                   CHECK (estado IN ('wishlist', 'jugando', 'terminado', 'abandonado')),
  puntuacion       INTEGER CHECK (puntuacion BETWEEN 1 AND 10),
  nota             TEXT,
  precio_objetivo  REAL,
  precio_actual    REAL,
  agregado         TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_biblioteca_estado ON biblioteca (estado, actualizado DESC);
