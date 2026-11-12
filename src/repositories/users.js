import { db } from "../db/index.js";
import { USUARIO_DEMO } from "../constants.js";

const porUsuario = db.prepare(`
  SELECT id, usuario, nombre, creado
  FROM usuarios
  WHERE usuario = ?
`);

const porId = db.prepare(`
  SELECT id, usuario, nombre, creado
  FROM usuarios
  WHERE id = ?
`);

const insertar = db.prepare(`
  INSERT INTO usuarios (id, usuario, nombre, hash, salt)
  VALUES (?, ?, ?, ?, ?)
`);

const contar = db.prepare(`
  SELECT COUNT(*) AS total
  FROM usuarios
  WHERE id <> ?
`);

/** Devuelve el usuario (sin hash) o null. */
export const buscarPorUsuario = (usuario) => porUsuario.get(usuario) ?? null;

export const buscarPorId = (id) => porId.get(id) ?? null;

export const crearUsuario = ({ id, usuario, nombre, hash, salt }) =>
  insertar.run(id, usuario, nombre, hash, salt);

export const contarUsuarios = () => contar.get(USUARIO_DEMO).total;

/**
 * Al registrarse el primer usuario, hereda los datos anónimos de la fase
 * single-user (biblioteca y conversaciones sin dueño).
 */
export const reclamarDatosAnonimos = db.transaction((usuarioId) => {
  db.prepare("UPDATE biblioteca SET usuario_id = ? WHERE usuario_id IS NULL").run(usuarioId);
  db.prepare("UPDATE sesiones SET usuario_id = ? WHERE usuario_id IS NULL").run(usuarioId);
});
