import config from "../config.js";
import { getJson } from "./http.js";

const BASE = "https://store.steampowered.com/api";

const formateadorPEN = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "PEN",
});

/** Convierte centavos de sol a "S/ 53.00". */
export const formatearPEN = (centavos) => formateadorPEN.format((centavos ?? 0) / 100);

/** Steam devuelve precios en centavos de la moneda del país configurado. */
const mapearPrecio = (priceOverview, esGratis) => {
  if (esGratis) {
    return { texto: "Gratis", final: 0, inicial: 0, descuento: 100, moneda: "PEN" };
  }
  if (!priceOverview) {
    return { texto: "No disponible en tu región", final: null, inicial: null, descuento: 0, moneda: null };
  }
  return {
    texto: formatearPEN(priceOverview.final),
    final: priceOverview.final,
    inicial: priceOverview.initial,
    descuento: priceOverview.discount_percent ?? 0,
    moneda: priceOverview.currency,
  };
};

/** Busca juegos por título en la tienda de Steam (precios en soles). */
export const buscar = async (termino) => {
  const datos = await getJson(
    `${BASE}/storesearch/?term=${encodeURIComponent(termino)}&l=${config.steamLang}&cc=${config.steamCC}`,
    { ttlSegundos: 300 }
  );

  return (datos.items ?? [])
    .filter((item) => item.type === "app")
    .slice(0, 8)
    .map((item) => ({
      appid: item.id,
      nombre: item.name,
      imagen: item.tiny_image,
      precio: mapearPrecio(item.price, item.price === undefined),
      metacritic: item.metascore || null,
    }));
};

/** Ficha completa de un juego. */
export const detalles = async (appid) => {
  const datos = await getJson(
    `${BASE}/appdetails?appids=${appid}&cc=${config.steamCC}&l=${config.steamLang}`,
    { ttlSegundos: 600 }
  );

  const entrada = datos?.[String(appid)];
  if (!entrada?.success || !entrada.data) {
    throw new Error("El juego no está disponible en la tienda de Steam.");
  }

  const d = entrada.data;

  return {
    appid: d.steam_appid,
    nombre: d.name,
    descripcion: d.short_description ?? "",
    imagen: d.header_image,
    capsulas: d.screenshots?.slice(0, 2).map((s) => s.path_thumbnail) ?? [],
    precio: mapearPrecio(d.price_overview, d.is_free),
    generos: (d.genres ?? []).map((g) => g.description),
    desarrollador: (d.developers ?? []).join(", "),
    editor: (d.publishers ?? []).join(", "),
    fecha: d.release_date?.date ?? null,
    proximo: Boolean(d.release_date?.coming_soon),
    metacritic: d.metacritic?.score ?? null,
    recomendaciones: d.recommendations?.total ?? null,
    plataformas: {
      windows: Boolean(d.platforms?.windows),
      mac: Boolean(d.platforms?.mac),
      linux: Boolean(d.platforms?.linux),
    },
    tipo: d.type,
    gratis: Boolean(d.is_free),
  };
};

/** Ofertas, más vendidos y novedades destacadas (precios en soles). */
export const destacados = async () => {
  const datos = await getJson(
    `${BASE}/featuredcategories?cc=${config.steamCC}&l=${config.steamLang}`,
    { ttlSegundos: 600 }
  );

  const mapear = (item) => ({
    appid: item.id,
    nombre: item.name,
    imagen: item.large_capsule_image ?? item.header_image,
    precio: {
      texto: formatearPEN(item.final_price),
      final: item.final_price,
      inicial: item.original_price,
      descuento: item.discount_percent ?? 0,
      moneda: item.currency,
    },
    metacritic: null,
  });

  return {
    ofertas: (datos.specials?.items ?? []).map(mapear),
    masVendidos: (datos.top_sellers?.items ?? []).map(mapear),
    novedades: (datos.new_releases?.items ?? []).map(mapear),
    proximos: (datos.coming_soon?.items ?? []).map(mapear),
  };
};

const limpiarTexto = (texto = "") =>
  texto
    .replace(/\[\/?[^\]]+\]/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Noticias recientes de un juego. */
export const noticias = async (appid, cantidad = 4) => {
  const datos = await getJson(
    `https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=${appid}&count=${cantidad}&maxlength=500&format=json`,
    { ttlSegundos: 1800 }
  );

  return (datos.appnews?.newsitems ?? []).map((n) => ({
    titulo: n.title,
    url: n.url,
    fecha: new Date(n.date * 1000).toISOString(),
    resumen: limpiarTexto(n.contents).slice(0, 240),
  }));
};
