import { getJson } from "./http.js";

const BASE = "https://www.cheapshark.com/api/1.0";

export const formatearUSD = (valor) => `US$ ${Number(valor ?? 0).toFixed(2)}`;

/** Catálogo de tiendas (Steam, GOG, Epic, Fanatical...). Se cachea un día. */
const tiendas = async () => {
  const datos = await getJson(`${BASE}/stores`, { ttlSegundos: 86400 });
  return new Map(datos.map((t) => [String(t.storeID), t.storeName]));
};

/** Lista de tiendas con estado, para la pantalla de preferencias. */
export const listarTiendas = async () => {
  const datos = await getJson(`${BASE}/stores`, { ttlSegundos: 86400 });
  return datos.map((t) => ({
    id: String(t.storeID),
    nombre: t.storeName,
    activa: Boolean(t.isActive),
  }));
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

/**
 * Ofertas globales ordenadas por calidad de la oferta.
 * CheapShark permite filtrar por Metacritic, rating de Steam y tiendas.
 */
export const ofertas = async ({
  precioMaximo = 20,
  descuentoMinimo = 50,
  limite = 8,
  metacriticMinimo = null,
  ratingMinimo = null,
  tiendas: idsTiendas = null,
} = {}) => {
  const params = new URLSearchParams({
    upperPrice: String(precioMaximo),
    pageSize: "60",
    sortBy: "Deal Rating",
  });

  if (metacriticMinimo) params.set("metacritic", String(metacriticMinimo));
  if (ratingMinimo) params.set("steamRating", String(ratingMinimo));
  if (idsTiendas?.length) params.set("shops", idsTiendas.join(","));

  const datos = await getJson(`${BASE}/deals?${params.toString()}`, {
    ttlSegundos: 300,
  });

  return (datos ?? [])
    .filter((d) => Number(d.savings) >= descuentoMinimo && d.title)
    .slice(0, limite);
};

export const enlaceOferta = (dealID) =>
  `https://www.cheapshark.com/redirect?dealID=${dealID}`;

export { tiendas };
