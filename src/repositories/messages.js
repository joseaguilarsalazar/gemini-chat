import { db } from "../db/index.js";

const seleccionar = db.prepare(`
  SELECT rol, texto, widgets, proveedor, modelo, nivel, fecha
  FROM mensajes
  WHERE sesion_id = ?
  ORDER BY id
`);

// Últimos N mensajes, del más antiguo al más reciente.
const seleccionarUltimos = db.prepare(`
  SELECT rol, texto
  FROM (
    SELECT id, rol, texto
    FROM mensajes
    WHERE sesion_id = ?
    ORDER BY id DESC
    LIMIT ?
  )
  ORDER BY id
`);

const insertarSesion = db.prepare(`
  INSERT INTO sesiones (id, usuario_id, titulo)
  VALUES (?, ?, ?)
  ON CONFLICT (id) DO NOTHING
`);

const actualizarSesion = db.prepare(`
  UPDATE sesiones
  SET actualizada = datetime('now')
  WHERE id = ?
`);

const insertarMensaje = db.prepare(`
  INSERT INTO mensajes (sesion_id, rol, texto, widgets, proveedor, modelo, nivel)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const parsearWidgets = (texto) => {
  if (!texto) return [];
  try {
    const datos = JSON.parse(texto);
    return Array.isArray(datos) ? datos : [];
  } catch {
    return [];
  }
};

/**
 * Guarda un turno completo (pregunta + respuesta) y crea la sesión si es nueva.
 * Los widgets y los datos del proveedor se guardan con la respuesta para poder
 * reconstruir la conversación al recargar la página.
 */
export const saveTurn = db.transaction(
  ({
    usuarioId,
    sesionId,
    titulo,
    mensaje,
    respuesta,
    widgets = [],
    proveedor = null,
    modelo = null,
    nivel = null,
  }) => {
    insertarSesion.run(sesionId, usuarioId, titulo);
    insertarMensaje.run(sesionId, "user", mensaje, null, null, null, null);
    insertarMensaje.run(
      sesionId,
      "model",
      respuesta,
      widgets.length > 0 ? JSON.stringify(widgets) : null,
      proveedor,
      modelo,
      nivel
    );
    actualizarSesion.run(sesionId);
  }
);

export const getMessages = (sesionId) =>
  seleccionar.all(sesionId).map((fila) => ({
    rol: fila.rol,
    texto: fila.texto,
    fecha: fila.fecha,
    widgets: parsearWidgets(fila.widgets),
    proveedor: fila.proveedor,
    modelo: fila.modelo,
    nivel: fila.nivel,
  }));

/**
 * Historial en el formato que espera el SDK de Gemini.
 *
 * Gemini exige que la conversación empiece con un turno del usuario, así que si
 * al recortar el historial el primer mensaje quedó siendo del modelo, lo descartamos.
 * Solo se envían los textos: los widgets son presentación, no contexto.
 */
export const getHistoryForModel = (sesionId, limit) => {
  const filas = seleccionarUltimos.all(sesionId, limit);

  while (filas.length > 0 && filas[0].rol !== "user") {
    filas.shift();
  }

  return filas.map((fila) => ({
    role: fila.rol,
    parts: [{ text: fila.texto }],
  }));
};
