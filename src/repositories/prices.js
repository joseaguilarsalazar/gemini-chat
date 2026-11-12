import { db } from "../db/index.js";

const insertar = db.prepare(`
  INSERT INTO precios_historial (appid, precio_pen, precio_usd, fuente)
  VALUES (?, ?, ?, ?)
`);

const ultimo = db.prepare(`
  SELECT appid, precio_pen, precio_usd, fecha
  FROM precios_historial
  WHERE appid = ?
  ORDER BY id DESC
  LIMIT 1
`);

const listar = db.prepare(`
  SELECT precio_pen, precio_usd, fuente, fecha
  FROM precios_historial
  WHERE appid = ? AND fecha >= datetime('now', ?)
  ORDER BY fecha
`);

const SEIS_HORAS = 6 * 60 * 60 * 1000;

const fechaDe = (texto) => {
  if (!texto) return null;
  const fecha = new Date(`${texto.replace(" ", "T")}Z`);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
};

/**
 * Guarda un snapshot de precio. Evita duplicados si el último registro es
 * reciente y tiene los mismos valores.
 */
export const registrarPrecio = ({ appid, precioPEN = null, precioUSD = null, fuente = "consulta" }) => {
  const anterior = ultimo.get(appid);
  const fecha = fechaDe(anterior?.fecha);

  if (
    anterior &&
    fecha &&
    Date.now() - fecha.getTime() < SEIS_HORAS &&
    anterior.precio_pen === precioPEN &&
    anterior.precio_usd === precioUSD
  ) {
    return false;
  }

  insertar.run(appid, precioPEN, precioUSD, fuente);
  return true;
};

export const historial = (appid, dias = 90) =>
  listar.all(appid, `-${Number(dias) || 90} days`).map((fila) => ({
    precioPEN: fila.precio_pen,
    precioUSD: fila.precio_usd,
    fuente: fila.fuente,
    fecha: fila.fecha,
  }));
