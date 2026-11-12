import { db } from "../db/index.js";

const listar = db.prepare(`
  SELECT s.id,
         s.titulo,
         s.creada,
         s.actualizada,
         (SELECT COUNT(*) FROM mensajes m WHERE m.sesion_id = s.id) AS total_mensajes
  FROM sesiones s
  WHERE s.usuario_id = ?
  ORDER BY s.actualizada DESC
  LIMIT 100
`);

const buscar = db.prepare(`
  SELECT id, titulo, creada, actualizada
  FROM sesiones
  WHERE id = ? AND usuario_id = ?
`);

const eliminar = db.prepare(`DELETE FROM sesiones WHERE id = ? AND usuario_id = ?`);

const dueno = db.prepare(`SELECT usuario_id FROM sesiones WHERE id = ?`);

export const listSessions = (usuarioId) =>
  listar.all(usuarioId).map((fila) => ({
    id: fila.id,
    titulo: fila.titulo,
    creada: fila.creada,
    actualizada: fila.actualizada,
    totalMensajes: fila.total_mensajes,
  }));

export const getSession = (usuarioId, id) => buscar.get(id, usuarioId) ?? null;

export const deleteSession = (usuarioId, id) =>
  eliminar.run(id, usuarioId).changes > 0;

/** Dueño de una sesión, o null si no existe / no tiene dueño. */
export const getSessionOwner = (id) => dueno.get(id)?.usuario_id ?? null;
