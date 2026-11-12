import config from "../config.js";

const cache = new Map();
const MAX_ENTRADAS = 300;

/**
 * GET JSON con timeout y caché en memoria.
 * Las APIs públicas (Steam, CheapShark, SteamSpy) tienen límites de uso,
 * así que cachear es parte del diseño, no un extra.
 *
 * @param {string} url
 * @param {{ ttlSegundos?: number, timeoutMs?: number }} [opciones]
 */
export const getJson = async (url, { ttlSegundos = 0, timeoutMs = config.httpTimeoutMs } = {}) => {
  const ahora = Date.now();
  const entrada = cache.get(url);

  if (entrada && entrada.expira > ahora) return entrada.datos;
  if (entrada) cache.delete(url);

  let respuesta;
  try {
    respuesta = await fetch(url, {
      headers: {
        "User-Agent": "GameScout/1.0 (proyecto academico UNAP)",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      throw new Error("El servicio externo tardó demasiado en responder.");
    }
    throw new Error("No se pudo conectar con el servicio externo.");
  }

  if (!respuesta.ok) {
    throw new Error(`El servicio externo respondió con error ${respuesta.status}.`);
  }

  const datos = await respuesta.json();

  if (ttlSegundos > 0) {
    if (cache.size >= MAX_ENTRADAS) {
      const masVieja = cache.keys().next().value;
      cache.delete(masVieja);
    }
    cache.set(url, { datos, expira: ahora + ttlSegundos * 1000 });
  }

  return datos;
};

/** Limpia el caché (útil en pruebas). */
export const limpiarCache = () => cache.clear();
