import { getJson } from "./http.js";

const BASE = "https://steamspy.com/api.php";

// SteamSpy tiene etiquetas duplicadas o incompletas. Si una trae muy pocos
// resultados, probamos estos alias antes de rendirnos.
const ALIAS = {
  roguelike: ["Rogue-like", "Action Roguelike"],
  "rogue lite": ["Rogue-like", "Action Roguelike"],
  roguelite: ["Rogue-like", "Action Roguelike"],
  coop: ["Co-op"],
  "co op": ["Co-op"],
  soulslike: ["Souls-like"],
  "souls like": ["Souls-like"],
  metroidvania: ["Metroidvania"],
  "open world": ["Open World"],
};

/** "5,000,000 .. 10,000,000" -> 7500000 */
export const propietariosMedios = (texto = "") => {
  const numeros = texto
    .split("..")
    .map((parte) => Number(parte.replace(/[^\d]/g, "")))
    .filter((n) => Number.isFinite(n) && n > 0);

  if (numeros.length === 0) return 0;
  if (numeros.length === 1) return numeros[0];
  return Math.round((numeros[0] + numeros[1]) / 2);
};

const normalizar = (texto = "") =>
  texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const porcentajePositivo = (juego) => {
  const positivas = Number(juego.positive) || 0;
  const negativas = Number(juego.negative) || 0;
  if (positivas + negativas === 0) return null;
  return Math.round((positivas / (positivas + negativas)) * 100);
};

/** Resumen de un juego: etiquetas, reseñas, jugadores y tiempo medio. */
export const resumen = async (appid) => {
  const datos = await getJson(`${BASE}?request=appdetails&appid=${appid}`, {
    ttlSegundos: 1800,
  });

  if (!datos || !datos.name) throw new Error("No hay datos de SteamSpy para este juego.");

  return {
    appid: datos.appid,
    nombre: datos.name,
    desarrollador: datos.developer,
    editor: datos.publisher,
    positivas: datos.positive,
    negativas: datos.negative,
    porcentajePositivo: porcentajePositivo(datos),
    propietarios: datos.owners,
    jugadoresAhora: datos.ccu,
    tiempoMedioMinutos: datos.average_forever,
    medianaMinutos: datos.median_forever,
    etiquetas: Object.entries(datos.tags ?? {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([etiqueta]) => etiqueta),
  };
};

const mapearJuego = (j) => ({
  appid: j.appid,
  nombre: j.name,
  positivas: j.positive,
  negativas: j.negative,
  porcentajePositivo: porcentajePositivo(j),
  propietarios: propietariosMedios(j.owners),
  jugadoresAhora: j.ccu,
  precioCentavosUSD: Number(j.price) || 0,
  descuento: Number(j.discount) || 0,
  tiempoMedioMinutos: Number(j.average_forever) || 0,
  medianaMinutos: Number(j.median_forever) || 0,
});

const consultarEtiqueta = async (etiqueta) => {
  const datos = await getJson(`${BASE}?request=tag&tag=${encodeURIComponent(etiqueta)}`, {
    ttlSegundos: 3600,
  });
  return Object.values(datos ?? {}).filter((j) => j?.name);
};

/** Juegos populares de una etiqueta de Steam (en inglés: "Roguelike", "Story Rich"). */
export const porEtiqueta = async (etiqueta, limite = 8) => {
  const candidatos = [etiqueta, ...(ALIAS[normalizar(etiqueta)] ?? [])];
  const vistos = new Set();
  const juegos = [];

  for (const candidato of candidatos) {
    let encontrados = [];
    try {
      encontrados = await consultarEtiqueta(candidato);
    } catch {
      // Probamos el siguiente alias.
    }

    if (candidato === etiqueta && candidatos.length > 1 && encontrados.length < 4) {
      continue;
    }

    for (const juego of encontrados) {
      if (vistos.has(juego.appid)) continue;
      vistos.add(juego.appid);
      juegos.push(mapearJuego(juego));
    }

    if (juegos.length >= limite * 3) break;
  }

  return juegos.sort((a, b) => b.propietarios - a.propietarios).slice(0, limite);
};

/** Los más jugados en las últimas dos semanas. */
export const tendencia = async (limite = 8) =>
  (await masJugados({ limite })).map((j) => ({
    appid: j.appid,
    nombre: j.nombre,
    jugadoresAhora: j.jugadoresAhora,
    positivas: j.positivas,
    negativas: j.negativas,
  }));

/** Top de jugadores concurrentes (últimas dos semanas). */
export const masJugados = async ({ limite = 8 } = {}) => {
  const datos = await getJson(`${BASE}?request=top100in2weeks`, { ttlSegundos: 1800 });

  return Object.values(datos ?? {})
    .filter((j) => j?.name)
    .map(mapearJuego)
    .sort((a, b) => b.jugadoresAhora - a.jugadoresAhora)
    .slice(0, limite);
};

/**
 * Juegos populares y cortos, a partir del top histórico.
 * `horas` se compara contra la mediana de tiempo jugado.
 */
export const juegosCortos = async ({ horas = 8, precioMaximoUSD = 20, limite = 8 } = {}) => {
  const datos = await getJson(`${BASE}?request=top100forever`, { ttlSegundos: 3600 });

  return Object.values(datos ?? {})
    .filter((j) => j?.name)
    .map(mapearJuego)
    .filter((j) => {
      const minutos = j.medianaMinutos || j.tiempoMedioMinutos;
      if (!minutos || minutos > horas * 60) return false;
      if (j.precioCentavosUSD > precioMaximoUSD * 100) return false;
      return (j.porcentajePositivo ?? 0) >= 75;
    })
    .sort((a, b) => b.propietarios - a.propietarios)
    .slice(0, limite);
};
