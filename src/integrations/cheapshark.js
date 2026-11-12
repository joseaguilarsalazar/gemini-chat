import { getJson } from "./http.js";

const BASE = "https://www.cheapshark.com/api/1.0";

export const formatearUSD = (valor) => `US$ ${Number(valor ?? 0).toFixed(2)}`;

/** Catálogo de tiendas (Steam, GOG, Epic, Fanatical...). Se cachea un día. */
const tiendas = async () => {
  const datos = await getJson(`${BASE}/stores`, { ttlSegundos: 86400 });
  return new Map(datos.map((t) => [String(t.storeID), t.storeName]));
};

/** Busca un juego por título y devuelve sus coincidencias. */
export const buscarJuego = async (titulo) => {
  const datos = await getJson(
    `${BASE}/games?title=${encodeURIComponent(titulo)}&limit=6`,
    { ttlSegundos: 600 }
  );
  return datos ?? [];
};

/** Detalle de precios: ofertas actuales por tienda e histórico. */
export const juego = async (gameID) => {
  const datos = await getJson(`${BASE}/games?id=${encodeURIComponent(gameID)}`, {
    ttlSegundos: 600,
  });
  return datos;
};

/** Ofertas globales ordenadas por calidad de la oferta. */
export const ofertas = async ({ precioMaximo = 20, descuentoMinimo = 50, limite = 8 } = {}) => {
  const datos = await getJson(
    `${BASE}/deals?upperPrice=${precioMaximo}&pageSize=60&sortBy=Deal%20Rating`,
    { ttlSegundos: 300 }
  );

  return (datos ?? [])
    .filter((d) => Number(d.savings) >= descuentoMinimo && d.title)
    .slice(0, limite);
};

export const enlaceOferta = (dealID) =>
  `https://www.cheapshark.com/redirect?dealID=${dealID}`;

export { tiendas };
