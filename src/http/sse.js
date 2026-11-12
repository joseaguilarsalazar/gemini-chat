/**
 * Utilidades mínimas para Server-Sent Events.
 * Cada evento es una línea `data: {json}` seguida de una línea en blanco.
 */

export const openSse = (res) => {
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  // Evita que proxies como nginx acumulen la respuesta.
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();
};

/** Devuelve false si el cliente ya cerró la conexión. */
export const sendSse = (res, payload) => {
  if (res.writableEnded || res.destroyed) return false;
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
  return true;
};
