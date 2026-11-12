import { db } from "../db/index.js";

const listar = db.prepare(`
  SELECT s.id,
         s.titulo,
         s.creada,
         s.actualizada,
         (SELECT COUNT(*) FROM mensajes m WHERE m.sesion_id = s.id) AS total_mensajes
  FROM sesiones s
  ORDER BY s.actualizada DESC
  LIMIT 100
`);

const buscar = db.prepare(`
  SELECT id, titulo, creada, actualizada
  FROM sesiones
  WHERE id = ?
`);

const eliminar = db.prepare(`DELETE FROM sesiones WHERE id = ?`);

export const listSessions = () =>
  listar.all().map((fila) => ({
    id: fila.id,
    titulo: fila.titulo,
    creada: fila.creada,
    actualizada: fila.actualizada,
    totalMensajes: fila.total_mensajes,
  }));

export const getSession = (id) => buscar.get(id) ?? null;

export const deleteSession = (id) => eliminar.run(id).changes > 0;
