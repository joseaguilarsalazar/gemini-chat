import { Router } from "express";
import { randomUUID } from "node:crypto";
import config from "../config.js";
import { mensajeDeError, obtenerProveedor, responderCon } from "../ai/chat.js";
import { openSse, sendSse } from "../http/sse.js";
import { isValidSessionId, validateChatBody } from "../middleware/validate.js";
import { deleteSession, getSession, listSessions } from "../repositories/sessions.js";
import { getHistoryForModel, getMessages, saveTurn } from "../repositories/messages.js";

const router = Router();

/** Primeros 60 caracteres del mensaje, en una sola línea, como título. */
const tituloDesde = (mensaje) => {
  const limpio = mensaje.replace(/\s+/g, " ").trim();
  return limpio.length > 60 ? `${limpio.slice(0, 57)}…` : limpio;
};

// ---------------------------------------------------------------- POST /api/chat
// Crea o continúa una conversación. El modelo puede invocar herramientas y cada
// resultado se emite como widget. Al terminar, se guarda el turno completo.
router.post("/chat", async (req, res) => {
  const { mensaje, sesionId } = req.body ?? {};

  const errorValidacion = validateChatBody({ mensaje, sesionId });
  if (errorValidacion) {
    return res.status(400).json({ error: errorValidacion });
  }

  // Proveedor y nivel de razonamiento (el nivel solo aplica a DeepSeek).
  const proveedorId =
    typeof req.body?.proveedor === "string" ? req.body.proveedor : config.defaultProvider;
  const motor = obtenerProveedor(proveedorId);

  if (!motor) {
    return res.status(400).json({ error: "Proveedor de IA inválido." });
  }
  if (!motor.disponible()) {
    return res
      .status(400)
      .json({ error: `${motor.nombre} no está configurado. Agrega su API key en el archivo .env.` });
  }

  let nivel = null;
  if (motor.niveles.length > 0) {
    nivel = req.body?.nivel ?? motor.nivelPorDefecto;
    if (!motor.niveles.includes(nivel)) {
      return res.status(400).json({
        error: `Nivel inválido. Usa uno de: ${motor.niveles.join(", ")}.`,
      });
    }
  }

  const mensajeUsuario = mensaje.trim();
  const id = sesionId ?? randomUUID();

  // Si la conversación aún no existe, el historial simplemente viene vacío.
  const history = getHistoryForModel(id, config.historyLimit);

  openSse(res);
  sendSse(res, {
    type: "meta",
    sesionId: id,
    proveedor: motor.id,
    model: motor.modelo,
    modeloNombre: motor.modeloNombre,
    nivel,
  });

  try {
    const resultado = await responderCon({
      proveedor: motor.id,
      history,
      mensaje: mensajeUsuario,
      nivel,
      onTexto: (parte) => sendSse(res, { type: "chunk", texto: parte }),
      onWidget: (widget) => sendSse(res, { type: "widget", widget }),
    });

    let texto = resultado.texto;
    const { widgets } = resultado;

    if (!texto.trim() && widgets.length === 0) {
      sendSse(res, {
        type: "error",
        error: "El modelo no devolvió contenido. Intenta reformular tu pregunta.",
      });
      return;
    }

    // Si solo hubo herramientas, damos una frase de cierre para que el mensaje
    // no quede vacío ni en pantalla ni en la base de datos.
    if (!texto.trim()) {
      texto = "Estos son los datos que encontré:";
      sendSse(res, { type: "chunk", texto });
    }

    const titulo = tituloDesde(mensajeUsuario);

    try {
      saveTurn({
        sesionId: id,
        titulo,
        mensaje: mensajeUsuario,
        respuesta: texto,
        widgets,
        proveedor: motor.id,
        modelo: motor.modelo,
        nivel,
      });
    } catch (error) {
      console.error("[chat] no se pudo guardar la conversación:", error);
      sendSse(res, {
        type: "error",
        error: "La respuesta se generó pero no se pudo guardar.",
      });
      return;
    }

    sendSse(res, { type: "done", sesionId: id, titulo });
  } catch (error) {
    console.error("[chat] error:", error.message);
    sendSse(res, { type: "error", error: mensajeDeError(error, motor.id) });
  } finally {
    res.end();
  }
});

// ----------------------------------------------------------- GET /api/sesiones
router.get("/sesiones", (req, res) => {
  res.json({ sesiones: listSessions() });
});

// ------------------------------------------------ GET /api/sesiones/:id/mensajes
router.get("/sesiones/:id/mensajes", (req, res) => {
  const { id } = req.params;

  if (!isValidSessionId(id)) {
    return res.status(400).json({ error: "Identificador de conversación inválido." });
  }

  const sesion = getSession(id);
  if (!sesion) {
    return res.status(404).json({ error: "La conversación no existe." });
  }

  res.json({ sesion, mensajes: getMessages(id) });
});

// ------------------------------------------------------ DELETE /api/sesiones/:id
router.delete("/sesiones/:id", (req, res) => {
  const { id } = req.params;

  if (!isValidSessionId(id)) {
    return res.status(400).json({ error: "Identificador de conversación inválido." });
  }

  if (!deleteSession(id)) {
    return res.status(404).json({ error: "La conversación no existe." });
  }

  res.status(204).end();
});

export default router;
