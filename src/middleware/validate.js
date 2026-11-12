import config from "../config.js";

// UUID v4 generado por el servidor con crypto.randomUUID()
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Valida el cuerpo de POST /api/chat.
 * Devuelve un mensaje de error o null si todo está correcto.
 */
export const validateChatBody = ({ mensaje, sesionId }) => {
  if (typeof mensaje !== "string" || mensaje.trim().length === 0) {
    return "El mensaje no puede estar vacío.";
  }

  if (mensaje.length > config.maxMessageLength) {
    return `El mensaje supera el límite de ${config.maxMessageLength} caracteres.`;
  }

  if (sesionId !== undefined && sesionId !== null) {
    if (typeof sesionId !== "string" || !UUID_RE.test(sesionId)) {
      return "El identificador de conversación no es válido.";
    }
  }

  return null;
};

export const isValidSessionId = (value) =>
  typeof value === "string" && UUID_RE.test(value);
