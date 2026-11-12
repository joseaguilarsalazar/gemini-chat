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
    porcentajePositivo:
      datos.positive + datos.negative > 0
        ? Math.round((datos.positive / (datos.positive + datos.negative)) * 100)
        : null,
    propietarios: datos.owners,
    jugadoresAhora: datos.ccu,
    tiempoMedioMinutos: datos.average_forever,
    etiquetas: Object.entries(datos.tags ?? {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([etiqueta]) => etiqueta),
  };
};

const mapearJuego = (j) => ({
  appid: j.appid,
  nombre: j.name,
  positivas: j.positive,
  propietarios: propietariosMedios(j.owners),
  jugadoresAhora: j.ccu,
  precioCentavosUSD: Number(j.price) || 0,
  descuento: Number(j.discount) || 0,
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

    // Si la etiqueta original trae muy pocos resultados, es data incompleta:
    // preferimos los alias (por ejemplo, "Roguelike" -> "Rogue-like").
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
export const tendencia = async (limite = 8) => {
  const datos = await getJson(`${BASE}?request=top100in2weeks`, { ttlSegundos: 1800 });

  return Object.values(datos ?? {})
    .filter((j) => j?.name)
    .map((j) => ({
      appid: j.appid,
      nombre: j.name,
      jugadoresAhora: j.ccu,
      positivas: j.positive,
      negativas: j.negative,
    }))
    .sort((a, b) => b.jugadoresAhora - a.jugadoresAhora)
    .slice(0, limite);
};
