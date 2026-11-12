import { randomBytes } from "node:crypto";
import { db } from "../db/index.js";
import config from "../config.js";

const insertar = db.prepare(`
  INSERT INTO sesiones_web (token, usuario_id, expira)
  VALUES (?, ?, datetime('now', ?))
`);

const buscar = db.prepare(`
  SELECT s.token, s.usuario_id, u.usuario, u.nombre
  FROM sesiones_web s
  JOIN usuarios u ON u.id = s.usuario_id
  WHERE s.token = ? AND s.expira > datetime('now')
`);

const eliminar = db.prepare(`DELETE FROM sesiones_web WHERE token = ?`);
const limpiar = db.prepare(`DELETE FROM sesiones_web WHERE expira <= datetime('now')`);

export const crearSesionWeb = (usuarioId) => {
  const token = randomBytes(32).toString("hex");
  insertar.run(token, usuarioId, `+${config.auth.sessionDays} days`);
  return token;
};

export const usuarioDeToken = (token) => {
  if (!token) return null;
  return buscar.get(token) ?? null;
};

export const eliminarSesionWeb = (token) => eliminar.run(token);

/** Limpieza de sesiones vencidas; se llama al arrancar, no en cada request. */
export const limpiarSesionesExpiradas = () => limpiar.run();
