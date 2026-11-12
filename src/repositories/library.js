import { db } from "../db/index.js";

const ESTADOS = ["wishlist", "jugando", "terminado", "abandonado"];

const listarStmt = db.prepare(`
  SELECT appid, nombre, imagen, estado, puntuacion, nota,
         precio_objetivo, precio_actual, agregado, actualizado
  FROM biblioteca
  ORDER BY actualizado DESC
`);

const obtenerStmt = db.prepare(`
  SELECT appid, nombre, imagen, estado, puntuacion, nota,
         precio_objetivo, precio_actual, agregado, actualizado
  FROM biblioteca
  WHERE appid = ?
`);

const insertarStmt = db.prepare(`
  INSERT INTO biblioteca (appid, nombre, imagen, estado, precio_actual)
  VALUES (@appid, @nombre, @imagen, @estado, @precioActual)
  ON CONFLICT (appid) DO UPDATE SET
    estado = excluded.estado,
    imagen = COALESCE(excluded.imagen, biblioteca.imagen),
    nombre = excluded.nombre,
    precio_actual = COALESCE(excluded.precio_actual, biblioteca.precio_actual),
    actualizado = datetime('now')
`);

const eliminarStmt = db.prepare(`DELETE FROM biblioteca WHERE appid = ?`);

const CAMPOS_ACTUALIZABLES = new Set([
  "estado",
  "puntuacion",
  "nota",
  "precio_objetivo",
  "precio_actual",
]);

const mapear = (fila) => ({
  appid: fila.appid,
  nombre: fila.nombre,
  imagen: fila.imagen,
  estado: fila.estado,
  puntuacion: fila.puntuacion,
  nota: fila.nota,
  precioObjetivo: fila.precio_objetivo,
  precioActual: fila.precio_actual,
  agregado: fila.agregado,
  actualizado: fila.actualizado,
});

export const esEstadoValido = (estado) => ESTADOS.includes(estado);
export { ESTADOS };

export const listar = () => listarStmt.all().map(mapear);

export const obtener = (appid) => {
  const fila = obtenerStmt.get(appid);
  return fila ? mapear(fila) : null;
};

export const guardar = ({ appid, nombre, imagen = null, estado = "wishlist", precioActual = null }) =>
  insertarStmt.run({
    appid,
    nombre,
    imagen,
    estado,
    precioActual,
  });

/**
 * Actualiza solo los campos permitidos. El SQL se construye con una lista
 * blanca, nunca con las claves que llegan del cliente.
 */
export const actualizar = (appid, cambios = {}) => {
  const entradas = Object.entries(cambios).filter(
    ([campo, valor]) => CAMPOS_ACTUALIZABLES.has(campo) && valor !== undefined
  );

  if (entradas.length === 0) return obtener(appid) !== null;

  const asignaciones = entradas.map(([campo]) => `${campo} = ?`).join(", ");
  const valores = entradas.map(([, valor]) => valor);
  const sql = `UPDATE biblioteca
               SET ${asignaciones}, actualizado = datetime('now')
               WHERE appid = ?`;

  return db.prepare(sql).run(...valores, appid).changes > 0;
};

export const eliminar = (appid) => eliminarStmt.run(appid).changes > 0;

export const resumen = () => {
  const porEstado = Object.fromEntries(ESTADOS.map((estado) => [estado, 0]));
  const filas = db.prepare(`SELECT estado, COUNT(*) AS total FROM biblioteca GROUP BY estado`).all();

  for (const fila of filas) porEstado[fila.estado] = fila.total;

  const alertas = db
    .prepare(
      `SELECT appid, nombre, precio_objetivo, precio_actual
       FROM biblioteca
       WHERE precio_objetivo IS NOT NULL
         AND precio_actual IS NOT NULL
         AND precio_actual <= precio_objetivo
       ORDER BY (precio_objetivo - precio_actual) DESC`
    )
    .all()
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
