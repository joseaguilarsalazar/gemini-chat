import { db } from "../db/index.js";
import { ESTADOS_BIBLIOTECA } from "../constants.js";

const listarStmt = db.prepare(`
  SELECT id, usuario_id, appid, nombre, imagen, estado, puntuacion, nota,
         precio_objetivo, precio_actual, etiquetas, tiempo_medio, agregado, actualizado
  FROM biblioteca
  WHERE usuario_id = ?
  ORDER BY actualizado DESC
`);

const obtenerStmt = db.prepare(`
  SELECT id, usuario_id, appid, nombre, imagen, estado, puntuacion, nota,
         precio_objetivo, precio_actual, etiquetas, tiempo_medio, agregado, actualizado
  FROM biblioteca
  WHERE usuario_id = ? AND appid = ?
`);

const insertarStmt = db.prepare(`
  INSERT INTO biblioteca
    (usuario_id, appid, nombre, imagen, estado, precio_actual, etiquetas, tiempo_medio)
  VALUES
    (@usuarioId, @appid, @nombre, @imagen, @estado, @precioActual, @etiquetas, @tiempoMedio)
  ON CONFLICT (usuario_id, appid) DO UPDATE SET
    nombre = excluded.nombre,
    imagen = COALESCE(excluded.imagen, biblioteca.imagen),
    estado = excluded.estado,
    precio_actual = COALESCE(excluded.precio_actual, biblioteca.precio_actual),
    etiquetas = COALESCE(excluded.etiquetas, biblioteca.etiquetas),
    tiempo_medio = COALESCE(excluded.tiempo_medio, biblioteca.tiempo_medio),
    actualizado = datetime('now')
`);

const eliminarStmt = db.prepare(`DELETE FROM biblioteca WHERE usuario_id = ? AND appid = ?`);

const CAMPOS_ACTUALIZABLES = new Set([
  "estado",
  "puntuacion",
  "nota",
  "precio_objetivo",
  "precio_actual",
  "etiquetas",
  "tiempo_medio",
]);

const parsearEtiquetas = (texto) => {
  if (!texto) return [];
  try {
    const datos = JSON.parse(texto);
    return Array.isArray(datos) ? datos : [];
  } catch {
    return [];
  }
};

const mapear = (fila) => ({
  appid: fila.appid,
  nombre: fila.nombre,
  imagen: fila.imagen,
  estado: fila.estado,
  puntuacion: fila.puntuacion,
  nota: fila.nota,
  precioObjetivo: fila.precio_objetivo,
  precioActual: fila.precio_actual,
  etiquetas: parsearEtiquetas(fila.etiquetas),
  tiempoMedio: fila.tiempo_medio,
  agregado: fila.agregado,
  actualizado: fila.actualizado,
});

export const esEstadoValido = (estado) => ESTADOS_BIBLIOTECA.includes(estado);
export { ESTADOS_BIBLIOTECA as ESTADOS };

export const listar = (usuarioId) => listarStmt.all(usuarioId).map(mapear);

export const obtener = (usuarioId, appid) => {
  const fila = obtenerStmt.get(usuarioId, appid);
  return fila ? mapear(fila) : null;
};

export const guardar = (usuarioId, {
  appid,
  nombre,
  imagen = null,
  estado = "wishlist",
  precioActual = null,
  etiquetas = null,
  tiempoMedio = null,
}) =>
  insertarStmt.run({
    usuarioId,
    appid,
    nombre,
    imagen,
    estado,
    precioActual,
    etiquetas: etiquetas ? JSON.stringify(etiquetas) : null,
    tiempoMedio,
  });

/**
 * Actualiza solo los campos permitidos. El SQL se construye con una lista
 * blanca, nunca con las claves que llegan del cliente.
 */
export const actualizar = (usuarioId, appid, cambios = {}) => {
  const entradas = Object.entries(cambios).filter(
    ([campo, valor]) => CAMPOS_ACTUALIZABLES.has(campo) && valor !== undefined
  );

  if (entradas.length === 0) return obtener(usuarioId, appid) !== null;

  const asignaciones = entradas.map(([campo]) => `${campo} = ?`).join(", ");
  const valores = entradas.map(([campo, valor]) =>
    campo === "etiquetas" && valor !== null ? JSON.stringify(valor) : valor
  );

  const sql = `UPDATE biblioteca
               SET ${asignaciones}, actualizado = datetime('now')
               WHERE usuario_id = ? AND appid = ?`;

  return db.prepare(sql).run(...valores, usuarioId, appid).changes > 0;
};

export const eliminar = (usuarioId, appid) =>
  eliminarStmt.run(usuarioId, appid).changes > 0;

export const resumen = (usuarioId) => {
  const porEstado = Object.fromEntries(ESTADOS_BIBLIOTECA.map((estado) => [estado, 0]));
  const filas = db
    .prepare(
      `SELECT estado, COUNT(*) AS total
       FROM biblioteca
       WHERE usuario_id = ?
       GROUP BY estado`
    )
    .all(usuarioId);

  for (const fila of filas) porEstado[fila.estado] = fila.total;

  const alertas = db
    .prepare(
      `SELECT appid, nombre, precio_objetivo, precio_actual
       FROM biblioteca
       WHERE usuario_id = ?
         AND precio_objetivo IS NOT NULL
         AND precio_actual IS NOT NULL
         AND precio_actual <= precio_objetivo
       ORDER BY (precio_objetivo - precio_actual) DESC`
    )
    .all(usuarioId)
    .map((fila) => ({
      appid: fila.appid,
      nombre: fila.nombre,
      precioObjetivo: fila.precio_objetivo,
      precioActual: fila.precio_actual,
    }));

  return {
    total: Object.values(porEstado).reduce((suma, n) => suma + n, 0),
    ...porEstado,
    alertas,
  };
};

export const todosLosUsuariosConDeseos = () =>
  db
    .prepare(
      `SELECT DISTINCT usuario_id
       FROM biblioteca
       WHERE usuario_id IS NOT NULL AND estado = 'wishlist'`
    )
    .all()
    .map((fila) => fila.usuario_id);
