import config from "../config.js";
import { getJson } from "./http.js";

const BASE = "https://store.steampowered.com/api";

const formateadorPEN = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "PEN",
});

/** Convierte centavos de sol a "S/ 53.00". */
export const formatearPEN = (centavos) => formateadorPEN.format((centavos ?? 0) / 100);

export const limpiarHtml = (html = "") =>
  String(html)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();

const parsearIdiomas = (html) => {
  if (!html) return [];
  return limpiarHtml(html)
    .split(/[,;\n]/)
    .map((parte) => parte.trim())
    .filter((parte) => parte && !parte.startsWith("*"))
    .map((parte) => {
      const audio = parte.endsWith("*");
      return {
        idioma: parte.replace(/\*+$/g, "").trim(),
        audio,
      };
    })
    .filter((item) => item.idioma && !/idiomas con localizaci/i.test(item.idioma));
};

const EDAD_ESRB = { e: 6, e10: 10, t: 13, m: 17, ao: 18 };

const parsearClasificaciones = (ratings = {}) => {
  const clasificaciones = [];
  let edadMinima = null;

  for (const [sistema, info] of Object.entries(ratings)) {
    const valor = info?.rating ?? "";
    if (valor) {
      clasificaciones.push({
        sistema: sistema.toUpperCase().replace("_", " "),
        valor: String(valor).toUpperCase(),
        descriptores: String(info.descriptors ?? "")
          .split(/\r?\n/)
          .map((d) => d.trim())
          .filter(Boolean),
      });
    }

    if (sistema === "esrb" && EDAD_ESRB[String(valor).toLowerCase()]) {
      edadMinima = Math.max(edadMinima ?? 0, EDAD_ESRB[String(valor).toLowerCase()]);
    }
  }

  if (edadMinima == null) {
    const numerica =
      Number(ratings.pegi?.rating) ||
      Number(ratings.dejus?.rating) ||
      Number(ratings.igrs?.rating) ||
      Number(ratings.usk?.rating) ||
      null;
    if (Number.isFinite(numerica) && numerica > 0) edadMinima = numerica;
  }

  return { clasificaciones, edadMinima };
};

const parsearRequisitos = (pc = {}) => ({
  minimo: pc?.minimum ? limpiarHtml(pc.minimum) : null,
  recomendado: pc?.recommended ? limpiarHtml(pc.recommended) : null,
});

const parsearPeliculas = (movies = []) =>
  movies.slice(0, 3).map((movie) => ({
    nombre: movie.name,
    miniatura: movie.thumbnail,
    mp4: movie.mp4?.["480"] ?? movie.mp4?.max ?? null,
    webm: movie.webm?.["480"] ?? movie.webm?.max ?? null,
    hls: movie.hls_h264 ?? null,
  }));

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
  const idiomas = parsearIdiomas(d.supported_languages);
  const { clasificaciones, edadMinima } = parsearClasificaciones(d.ratings);
  const requisitos = parsearRequisitos(d.pc_requirements);

  return {
    appid: d.steam_appid,
    nombre: d.name,
    descripcion: d.short_description ?? "",
    descripcionLarga: d.about_the_game ? limpiarHtml(d.about_the_game) : "",
    imagen: d.header_image,
    capsulas: d.screenshots?.slice(0, 2).map((s) => s.path_thumbnail) ?? [],
    capturas: d.screenshots?.slice(0, 8).map((s) => s.path_full) ?? [],
    peliculas: parsearPeliculas(d.movies),
    precio: mapearPrecio(d.price_overview, d.is_free),
    generos: (d.genres ?? []).map((g) => g.description),
    categorias: (d.categories ?? []).map((c) => c.description),
    desarrollador: (d.developers ?? []).join(", "),
    editor: (d.publishers ?? []).join(", "),
    fecha: d.release_date?.date ?? null,
    proximo: Boolean(d.release_date?.coming_soon),
    metacritic: d.metacritic?.score ?? null,
    recomendaciones: d.recommendations?.total ?? null,
    resenas: d.reviews ?? null,
    plataformas: {
      windows: Boolean(d.platforms?.windows),
      mac: Boolean(d.platforms?.mac),
      linux: Boolean(d.platforms?.linux),
    },
    tipo: d.type,
    gratis: Boolean(d.is_free),
    idiomas,
    tieneEspanol: idiomas.some((i) => /^español/i.test(i.idioma)),
    audioEspanol: idiomas.some((i) => /^español/i.test(i.idioma) && i.audio),
    clasificaciones,
    edadMinima,
    requisitos,
    logros: d.achievements
      ? { total: d.achievements.total ?? 0, destacados: d.achievements.highlighted ?? [] }
      : { total: 0, destacados: [] },
    dlc: d.dlc ?? [],
    ediciones: (d.package_groups?.[0]?.subs ?? []).map((sub) => ({
      texto: sub.option_text,
      precio: sub.price_in_cents_with_discount != null ? sub.price_in_cents_with_discount / 100 : null,
    })),
    sitio: d.website ?? null,
  };
};

/**
 * Categoría de compatibilidad con Steam Deck.
 * 1 = no compatible, 2 = jugable, 3 = verificado (0 = desconocido).
 */
export const compatibilidadDeck = async (appid) => {
  try {
    const datos = await getJson(
      `https://store.steampowered.com/saleaction/ajaxgetdeckappcompatibilityreport?nAppID=${appid}`,
      { ttlSegundos: 86400 }
    );

    if (!datos?.success) return null;

    const codigo = Number(datos.results?.resolved_category ?? 0);
    const etiquetas = {
      0: "Desconocido",
      1: "No compatible",
      2: "Jugable",
      3: "Verificado",
    };

    return { codigo, etiqueta: etiquetas[codigo] ?? "Desconocido" };
  } catch {
    return null;
  }
};

/** Ofertas, más vendidos, novedades y próximos lanzamientos (precios en soles). */
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
    expira: item.discount_expiration ?? null,
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
