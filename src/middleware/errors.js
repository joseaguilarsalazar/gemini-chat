/**
 * Errores controlados: llevan un código HTTP y un mensaje pensado para el cliente.
 */
export class AppError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "AppError";
    this.status = status;
  }
}

export const notFound = (req, res) => {
  res.status(404).json({ error: "Ruta no encontrada." });
};

// Express reconoce el manejador de errores por tener cuatro parámetros.
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    // Ya se está transmitiendo una respuesta (SSE); solo cerramos.
    return res.end();
  }

  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.message });
  }

  // JSON mal formado enviado por el cliente.
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "El cuerpo de la petición no es JSON válido." });
  }

  if (err.type === "entity.too.large") {
    return res.status(413).json({ error: "La petición es demasiado grande." });
  }

  console.error("[error]", err);
  return res.status(500).json({ error: "Error interno del servidor." });
};
