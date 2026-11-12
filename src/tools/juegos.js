import * as steam from "../integrations/steam.js";
import * as cheapshark from "../integrations/cheapshark.js";
import * as steamspy from "../integrations/steamspy.js";
import * as library from "../repositories/library.js";
import * as prices from "../repositories/prices.js";
import { tiendasPermitidas } from "../repositories/prefs.js";
import { crearMoneda } from "../services/money.js";
import { revisarBiblioteca } from "../services/pricing.js";
import { vistaBiblioteca } from "../services/libraryView.js";

const porcentaje = (valor) => Math.round(Number(valor) || 0);

const permitidasDe = (contexto) =>
  tiendasPermitidas(contexto?.prefs ?? { soloOficiales: true, tiendas: [] });

/** Actualiza el precio guardado si el juego ya está en la biblioteca. */
const refrescarPrecioBiblioteca = (usuarioId, appid, precio) => {
  if (!usuarioId || !library.obtener(usuarioId, appid)) return;
  if (precio?.final == null) return;
  library.actualizar(usuarioId, appid, { precio_actual: precio.final / 100 });
};

/** Tarjeta compacta para las listas de juegos. */
const tarjeta = (
  { appid, nombre, imagen, precio, precioValor, descuento, puntuacion, notaPrecio, enlace },
  usuarioId
) => ({
  appid,
  nombre,
  imagen: imagen ?? null,
  precioTexto: precio ?? null,
  precioValor: precioValor ?? null,
  descuento: descuento ?? 0,
  puntuacion: puntuacion ?? null,
  notaPrecio: notaPrecio ?? null,
  enlace: enlace ?? null,
  enBiblioteca: appid && usuarioId ? Boolean(library.obtener(usuarioId, appid)) : false,
});

const paraModelo = (juego) => ({
  appid: juego.appid,
  nombre: juego.nombre,
  precio: juego.precioTexto,
  descuento: juego.descuento || undefined,
  nota: juego.notaPrecio ?? undefined,
});

const notaSteam = (dinero, centavos) => {
  const texto = dinero.desdePEN((centavos ?? 0) / 100);
  return dinero.esPEN ? "Steam · precio en Perú" : `Steam Perú · ${dinero.pen((centavos ?? 0) / 100)}`;
};

// ---------------------------------------------------------------- buscar_juegos
export const buscar = async ({ consulta }, contexto) => {
  const dinero = await crearMoneda(contexto?.moneda);
  const encontrados = await steam.buscar(consulta);

  if (encontrados.length === 0) {
    return {
      respuesta: {
        encontrados: 0,
        mensaje: `No se encontraron juegos en Steam para "${consulta}".`,
      },
      widgets: [],
    };
  }

  const juegos = encontrados.map((j) =>
    tarjeta(
      {
        appid: j.appid,
        nombre: j.nombre,
        imagen: j.imagen,
        precio: dinero.desdePEN((j.precio.final ?? 0) / 100),
        precioValor: j.precio.final != null ? j.precio.final / 100 : null,
        descuento: j.precio.descuento,
        puntuacion: j.metacritic,
        notaPrecio: notaSteam(dinero, j.precio.final),
      },
      contexto?.usuarioId
    )
  );

  return {
    respuesta: {
      encontrados: juegos.length,
      juegos: juegos.map(paraModelo),
      moneda: dinero.moneda,
      nota: "Los precios son de Steam en Perú. Para comparar con otras tiendas usa comparar_precios.",
    },
    widgets: [
      {
        tipo: "lista_juegos",
        datos: {
          titulo: `Resultados para "${consulta}"`,
          subtitulo: "Precios de Steam en Perú",
          juegos,
        },
      },
    ],
  };
};

// ---------------------------------------------------------------- detalles_juego
export const detalles = async ({ appid }, contexto) => {
  const [ficha, resumen, deck] = await Promise.all([
    steam.detalles(appid),
    steamspy.resumen(appid).catch(() => null),
    steam.compatibilidadDeck(appid),
  ]);
  const dinero = await crearMoneda(contexto?.moneda);

  refrescarPrecioBiblioteca(contexto?.usuarioId, ficha.appid, ficha.precio);
  prices.registrarPrecio({
    appid: ficha.appid,
    precioPEN: ficha.precio.final != null ? ficha.precio.final / 100 : null,
    fuente: "detalle",
  });

  const enBiblioteca = contexto?.usuarioId
    ? Boolean(library.obtener(contexto.usuarioId, ficha.appid))
    : false;
  const etiquetas = resumen?.etiquetas?.slice(0, 6) ?? [];
  const positivo = resumen?.porcentajePositivo ?? null;
  const precioTexto = dinero.desdePEN((ficha.precio.final ?? 0) / 100);

  return {
    respuesta: {
      appid: ficha.appid,
      nombre: ficha.nombre,
      precio: precioTexto,
      descuento: ficha.precio.descuento || undefined,
      generos: ficha.generos,
      etiquetas,
      porcentajePositivo: positivo ?? undefined,
      metacritic: ficha.metacritic ?? undefined,
      fecha: ficha.fecha,
      desarrollador: ficha.desarrollador,
      tieneEspanol: ficha.tieneEspanol,
      audioEspanol: ficha.audioEspanol,
      edadMinima: ficha.edadMinima ?? undefined,
      categorias: ficha.categorias.slice(0, 8),
      logros: ficha.logros.total,
      dlc: ficha.dlc.length,
      steamDeck: deck?.etiqueta ?? undefined,
      descripcion: ficha.descripcion,
      enBiblioteca,
    },
    widgets: [
      {
        tipo: "tarjeta_juego",
        datos: {
          appid: ficha.appid,
          nombre: ficha.nombre,
          imagen: ficha.imagen,
          descripcion: ficha.descripcion,
          precioTexto,
          precioValor: ficha.precio.final != null ? ficha.precio.final / 100 : null,
          precioOriginal:
            ficha.precio.descuento > 0 && ficha.precio.inicial != null
              ? dinero.desdePEN(ficha.precio.inicial / 100)
              : null,
          descuento: ficha.precio.descuento,
          generos: ficha.generos,
          etiquetas,
          porcentajePositivo: positivo,
          metacritic: ficha.metacritic,
          fecha: ficha.fecha,
          desarrollador: ficha.desarrollador,
          enBiblioteca,
          tieneEspanol: ficha.tieneEspanol,
          audioEspanol: ficha.audioEspanol,
          edadMinima: ficha.edadMinima,
          clasificaciones: ficha.clasificaciones.slice(0, 2),
          categorias: ficha.categorias.slice(0, 6),
          logros: ficha.logros.total,
          dlcs: ficha.dlc.length,
          deck: deck ?? null,
          moneda: dinero.moneda,
        },
      },
    ],
  };
};

// ---------------------------------------------------------------- comparar_precios
export const comparar = async ({ appid }, contexto) => {
  const dinero = await crearMoneda(contexto?.moneda);
  const permitidas = permitidasDe(contexto);
  const ficha = await steam.detalles(appid);

  const coincidencias = await cheapshark.buscarJuego(ficha.nombre);
  const coincidencia =
    coincidencias.find((c) => String(c.steamAppID) === String(appid)) ?? coincidencias[0];

  const precioSteamTexto = dinero.desdePEN((ficha.precio.final ?? 0) / 100);

  if (!coincidencia?.gameID) {
    return {
      respuesta: {
        appid: ficha.appid,
        nombre: ficha.nombre,
        precioSteam: precioSteamTexto,
        mensaje: "No hay otras tiendas registradas para este juego.",
      },
      widgets: [
        {
          tipo: "tabla_precios",
          datos: {
            appid: ficha.appid,
            nombre: ficha.nombre,
            imagen: ficha.imagen,
            precioSteam: precioSteamTexto,
            descuentoSteam: ficha.precio.descuento,
            historico: null,
            tiendas: [],
            mejor: null,
            semaforo: null,
            tipoCambio: dinero.tasaPEN,
            moneda: dinero.moneda,
          },
        },
      ],
    };
  }

  const [detalle, mapaTiendas] = await Promise.all([
    cheapshark.juego(coincidencia.gameID),
    cheapshark.tiendas(),
  ]);

  const ofertas = (detalle?.deals ?? [])
    .map((deal) => {
      const precioUSD = Number(deal.price);
      return {
        tienda: mapaTiendas.get(String(deal.storeID)) ?? `Tienda ${deal.storeID}`,
        storeID: String(deal.storeID),
        precioUSD,
        precioTexto: dinero.desdeUSD(precioUSD),
        descuento: porcentaje(deal.savings),
        enlace: cheapshark.enlaceOferta(deal.dealID),
        steam: String(deal.storeID) === "1",
      };
    })
    .filter((oferta) => !oferta.steam)
    .filter((oferta) => !permitidas || permitidas.includes(oferta.storeID))
    .sort((a, b) => a.precioUSD - b.precioUSD);

  const historicoUSD = detalle?.cheapestPriceEver
    ? Number(detalle.cheapestPriceEver.price)
    : null;

  const historico = historicoUSD
    ? {
        precioUSD: historicoUSD,
        precioTexto: dinero.desdeUSD(historicoUSD),
        fecha: new Date(detalle.cheapestPriceEver.date * 1000).toISOString(),
      }
    : null;

  // Semáforo: compara el precio Steam (convertido a USD) con el mínimo histórico.
  let semaforo = null;
  const steamUSD = ficha.precio.final != null ? ficha.precio.final / 100 / dinero.tasaPEN : null;
  if (historicoUSD && steamUSD) {
    const ratio = steamUSD / historicoUSD;
    if (ratio <= 1.05) {
      semaforo = { nivel: "minimo", texto: "Está en su mínimo histórico" };
    } else if (ratio <= 1.3) {
      semaforo = { nivel: "bueno", texto: "Buen precio frente a su mínimo histórico" };
    } else {
      semaforo = { nivel: "espera", texto: "Está lejos de su mínimo histórico" };
    }
  }

  refrescarPrecioBiblioteca(contexto?.usuarioId, ficha.appid, ficha.precio);

  const mejor = ofertas[0] ?? null;

  prices.registrarPrecio({
    appid: ficha.appid,
    precioPEN: ficha.precio.final != null ? ficha.precio.final / 100 : null,
    precioUSD: mejor?.precioUSD ?? null,
    fuente: "comparacion",
  });

  return {
    respuesta: {
      appid: ficha.appid,
      nombre: ficha.nombre,
      precioSteam: precioSteamTexto,
      descuentoSteam: ficha.precio.descuento || undefined,
      mejorOferta: mejor
        ? { tienda: mejor.tienda, precio: mejor.precioTexto, descuento: mejor.descuento }
        : null,
      historico,
      semaforo,
      tiendas: ofertas.map((o) => ({ tienda: o.tienda, precio: o.precioTexto, descuento: o.descuento })),
      moneda: dinero.moneda,
      aclaracion:
        "Steam está en soles peruanos; las demás tiendas en dólares convertidos a la moneda elegida. La conversión es referencial.",
    },
    widgets: [
      {
        tipo: "tabla_precios",
        datos: {
          appid: ficha.appid,
          nombre: ficha.nombre,
          imagen: ficha.imagen,
          precioSteam: precioSteamTexto,
          descuentoSteam: ficha.precio.descuento,
          historico,
          tiendas: ofertas,
          mejor,
          semaforo,
          tipoCambio: dinero.tasaPEN,
          moneda: dinero.moneda,
        },
      },
    ],
  };
};

// ---------------------------------------------------------------- ofertas
export const ofertasDelMomento = async (
  { descuentoMinimo = 50, precioMaximo = 20, limite = 8, metacriticMinimo = 0, ratingMinimo = 0 },
  contexto
) => {
  const dinero = await crearMoneda(contexto?.moneda);
  const permitidas = permitidasDe(contexto);
  const maximo = Math.min(Math.max(Number(limite) || 8, 1), 10);

  const deals = await cheapshark.ofertas({
    descuentoMinimo,
    precioMaximo,
    limite: maximo,
    metacriticMinimo: Number(metacriticMinimo) || null,
    ratingMinimo: Number(ratingMinimo) || null,
    tiendas: permitidas,
  });

  if (deals.length === 0) {
    return {
      respuesta: {
        encontrados: 0,
        mensaje: `No hay ofertas con esos filtros (más de ${descuentoMinimo}% y hasta US$ ${precioMaximo}).`,
      },
      widgets: [],
    };
  }

  const mapaTiendas = await cheapshark.tiendas();
  const juegos = deals.map((deal) => {
    const tienda = mapaTiendas.get(String(deal.storeID)) ?? "Tienda";
    return tarjeta(
      {
        appid: Number(deal.steamAppID) || null,
        nombre: deal.title,
        imagen: deal.thumb,
        precio: dinero.desdeUSD(deal.salePrice),
        descuento: porcentaje(deal.savings),
        puntuacion: Number(deal.steamRatingPercent) || null,
        notaPrecio: `${tienda} · ${dinero.desdeUSD(deal.normalPrice)} antes`,
        enlace: cheapshark.enlaceOferta(deal.dealID),
      },
      contexto?.usuarioId
    );
  });

  return {
    respuesta: {
      encontrados: juegos.length,
      ofertas: juegos.map((j) => ({
        appid: j.appid ?? undefined,
        nombre: j.nombre,
        precio: j.precioTexto,
        descuento: j.descuento,
        tienda: j.notaPrecio.split(" · ")[0],
      })),
      moneda: dinero.moneda,
    },
    widgets: [
      {
        tipo: "lista_juegos",
        datos: {
          titulo: "Ofertas del momento",
          subtitulo: `Más de ${descuentoMinimo}% · hasta ${dinero.desdeUSD(precioMaximo)}`,
          juegos,
        },
      },
    ],
  };
};

// ---------------------------------------------------------------- tendencias
export const tendencias = async (_args, contexto) => {
  const dinero = await crearMoneda(contexto?.moneda);
  const destacados = await steam.destacados();
  const juegos = [...destacados.masVendidos.slice(0, 5), ...destacados.novedades.slice(0, 5)].map(
    (j) =>
      tarjeta(
        {
          appid: j.appid,
          nombre: j.nombre,
          imagen: j.imagen,
          precio: dinero.desdePEN((j.precio.final ?? 0) / 100),
          precioValor: j.precio.final != null ? j.precio.final / 100 : null,
          descuento: j.precio.descuento,
          notaPrecio: notaSteam(dinero, j.precio.final),
        },
        contexto?.usuarioId
      )
  );

  return {
    respuesta: {
      masVendidos: destacados.masVendidos.slice(0, 5).map((j) => ({
        appid: j.appid,
        nombre: j.nombre,
        precio: dinero.desdePEN((j.precio.final ?? 0) / 100),
      })),
      novedades: destacados.novedades.slice(0, 5).map((j) => ({
        appid: j.appid,
        nombre: j.nombre,
        precio: dinero.desdePEN((j.precio.final ?? 0) / 100),
      })),
    },
    widgets: [
      {
        tipo: "lista_juegos",
        datos: {
          titulo: "Lo más vendido y las novedades",
          subtitulo: "Steam · precios en Perú",
          juegos,
        },
      },
    ],
  };
};

// ---------------------------------------------------------------- descubrir_por_etiqueta
export const descubrir = async ({ etiqueta, limite = 8 }, contexto) => {
  const dinero = await crearMoneda(contexto?.moneda);
  const maximo = Math.min(Math.max(Number(limite) || 8, 1), 10);
  const encontrados = await steamspy.porEtiqueta(etiqueta, maximo);

  const juegos = encontrados.map((j) =>
    tarjeta(
      {
        appid: j.appid,
        nombre: j.nombre,
        precio: j.precioCentavosUSD > 0 ? dinero.desdeUSD(j.precioCentavosUSD / 100) : "Gratis o sin precio",
        descuento: j.descuento,
        notaPrecio: j.propietarios
          ? `${(j.propietarios / 1_000_000).toFixed(1)} M jugadores · ${j.porcentajePositivo ?? "?"}%`
          : null,
      },
      contexto?.usuarioId
    )
  );

  return {
    respuesta: {
      etiqueta,
      encontrados: encontrados.length,
      juegos: encontrados.map((j) => ({
        appid: j.appid,
        nombre: j.nombre,
        propietarios: j.propietarios,
        jugadoresAhora: j.jugadoresAhora,
        tiempoMedioHoras: j.tiempoMedioMinutos
          ? Math.round(j.tiempoMedioMinutos / 60)
          : undefined,
      })),
      nota: "Datos de SteamSpy. Los precios son aproximados y pueden variar.",
    },
    widgets: [
      {
        tipo: "lista_juegos",
        datos: {
          titulo: `Juegos populares: ${etiqueta}`,
          subtitulo: "Seleccionados por popularidad en Steam",
          juegos,
        },
      },
    ],
  };
};

// ---------------------------------------------------------------- noticias_juego
export const noticias = async ({ appid, cantidad = 4 }) => {
  const maximo = Math.min(Math.max(Number(cantidad) || 4, 1), 5);
  const [ficha, lista] = await Promise.all([
    steam.detalles(appid),
    steam.noticias(appid, maximo),
  ]);

  return {
    respuesta: {
      appid: ficha.appid,
      nombre: ficha.nombre,
      noticias: lista.map((n) => ({ titulo: n.titulo, url: n.url, fecha: n.fecha })),
    },
    widgets: lista.length
      ? [
          {
            tipo: "noticias",
            datos: { appid: ficha.appid, nombre: ficha.nombre, noticias: lista },
          },
        ]
      : [],
  };
};

// ---------------------------------------------------------------- ofertas_de_mi_biblioteca
export const ofertasBiblioteca = async ({ limite = 6, soloDeseos = true }, contexto) => {
  const dinero = await crearMoneda(contexto?.moneda);
  const permitidas = permitidasDe(contexto);
  const maximo = Math.min(Math.max(Number(limite) || 6, 1), 8);

  const juegos = library
    .listar(contexto.usuarioId)
    .filter((j) => !soloDeseos || j.estado === "wishlist")
    .slice(0, maximo);

  if (juegos.length === 0) {
    return {
      respuesta: {
        mensaje: soloDeseos
          ? "No tienes juegos en deseados. Agrega alguno y vuelvo a revisar."
          : "Tu biblioteca está vacía.",
      },
      widgets: [{ tipo: "biblioteca", datos: vistaBiblioteca(contexto.usuarioId) }],
    };
  }

  const mapaTiendas = await cheapshark.tiendas();
  const tarjetas = [];
  const sinOferta = [];

  for (const juego of juegos) {
    try {
      const coincidencias = await cheapshark.buscarJuego(juego.nombre);
      const match =
        coincidencias.find((c) => String(c.steamAppID) === String(juego.appid)) ??
        coincidencias[0];
      if (!match?.gameID) {
        sinOferta.push(juego.nombre);
        continue;
      }

      const detalle = await cheapshark.juego(match.gameID);
      const ofertas = (detalle?.deals ?? [])
        .filter((d) => String(d.storeID) !== "1")
        .filter((d) => !permitidas || permitidas.includes(String(d.storeID)))
        .map((d) => ({ ...d, precio: Number(d.price) }))
        .sort((a, b) => a.precio - b.precio);

      if (ofertas.length === 0) {
        sinOferta.push(juego.nombre);
        continue;
      }

      const mejor = ofertas[0];
      const tienda = mapaTiendas.get(String(mejor.storeID)) ?? "Tienda";
      const precioPENOferta = mejor.precio * dinero.tasaPEN;

      // Solo mostramos la oferta si realmente es más barata que Steam.
      if (juego.precioActual != null && precioPENOferta >= juego.precioActual) {
        sinOferta.push(juego.nombre);
        continue;
      }

      const ahorro =
        juego.precioActual != null ? juego.precioActual - precioPENOferta : null;
      const objetivo = juego.precioObjetivo
        ? ` · objetivo ${dinero.pen(juego.precioObjetivo)}`
        : "";

      tarjetas.push(
        tarjeta(
          {
            appid: juego.appid,
            nombre: juego.nombre,
            imagen: juego.imagen,
            precio: dinero.desdeUSD(mejor.precio),
            descuento: porcentaje(mejor.savings),
            notaPrecio:
              `${tienda} · Steam ${dinero.pen(juego.precioActual ?? 0)}` +
              (ahorro && ahorro > 0 ? ` · ahorras ${dinero.pen(ahorro)}` : "") +
              objetivo,
            enlace: cheapshark.enlaceOferta(mejor.dealID),
          },
          contexto.usuarioId
        )
      );
    } catch {
      sinOferta.push(juego.nombre);
    }
  }

  if (tarjetas.length === 0) {
    return {
      respuesta: {
        mensaje: "Ninguno de tus juegos tiene ofertas en otras tiendas en este momento.",
        sinOferta,
      },
      widgets: [],
    };
  }

  return {
    respuesta: {
      conOferta: tarjetas.map(paraModelo),
      sinOferta,
      moneda: dinero.moneda,
      nota: "Se comparan otras tiendas; el precio de Steam se muestra como referencia en soles.",
    },
    widgets: [
      {
        tipo: "lista_juegos",
        datos: {
          titulo: "Ofertas de tu biblioteca",
          subtitulo: "Juegos guardados con mejor precio en otras tiendas",
          juegos: tarjetas,
        },
      },
    ],
  };
};

// ---------------------------------------------------------------- revisar_alertas
export const revisarAlertas = async ({ limite = 10 }, contexto) => {
  const resultado = await revisarBiblioteca(contexto.usuarioId, {
    prefs: contexto.prefs,
    limite,
  });
  const dinero = await crearMoneda(contexto?.moneda);

  return {
    respuesta: {
      revisados: resultado.revisados,
      alertas: resultado.alertas.map((a) => ({
        appid: a.appid,
        nombre: a.nombre,
        precioActual: dinero.pen(a.precioActual),
        precioObjetivo: dinero.pen(a.precioObjetivo),
      })),
      juegos: resultado.resultados.map((j) => ({
        appid: j.appid,
        nombre: j.nombre,
        precioActual: j.precioActual != null ? dinero.pen(j.precioActual) : undefined,
        alerta: j.alerta || undefined,
        error: j.error,
      })),
      mensaje: resultado.revisados
        ? `Revisé ${resultado.revisados} juegos y encontré ${resultado.alertas.length} alertas.`
        : "No tienes juegos para revisar.",
    },
    widgets: [{ tipo: "biblioteca", datos: vistaBiblioteca(contexto.usuarioId) }],
  };
};

// ---------------------------------------------------------------- juegos_similares
export const similares = async ({ appid, limite = 6 }, contexto) => {
  const dinero = await crearMoneda(contexto?.moneda);
  const ficha = await steam.detalles(appid);
  const resumen = await steamspy.resumen(appid);

  if (!resumen.etiquetas.length) {
    return {
      respuesta: { mensaje: "No hay suficientes etiquetas para buscar juegos similares." },
      widgets: [],
    };
  }

  const etiquetas = resumen.etiquetas.slice(0, 3);
  const vistos = new Set([Number(appid)]);
  const candidatos = [];

  for (const etiqueta of etiquetas) {
    const lista = await steamspy.porEtiqueta(etiqueta, 12);
    for (const juego of lista) {
      if (vistos.has(juego.appid)) continue;
      if (contexto.usuarioId && library.obtener(contexto.usuarioId, juego.appid)) continue;
      vistos.add(juego.appid);
      candidatos.push({ ...juego, etiqueta });
    }
    if (candidatos.length >= limite * 3) break;
  }

  const juegos = candidatos.slice(0, limite).map((j) =>
    tarjeta(
      {
        appid: j.appid,
        nombre: j.nombre,
        precio: j.precioCentavosUSD > 0 ? dinero.desdeUSD(j.precioCentavosUSD / 100) : null,
        descuento: j.descuento,
        notaPrecio: `${j.etiqueta} · ${j.porcentajePositivo ?? "?"}% positivas`,
      },
      contexto.usuarioId
    )
  );

  return {
    respuesta: {
      base: ficha.nombre,
      etiquetas,
      encontrados: juegos.length,
      juegos: juegos.map(paraModelo),
    },
    widgets: [
      {
        tipo: "lista_juegos",
        datos: {
          titulo: `Juegos similares a ${ficha.nombre}`,
          subtitulo: `Etiquetas: ${etiquetas.join(", ")}`,
          juegos,
        },
      },
    ],
  };
};

// ---------------------------------------------------------------- juegos_cortos
export const cortos = async ({ horas = 8, precioMaximo = 20, limite = 8 }, contexto) => {
  const dinero = await crearMoneda(contexto?.moneda);
  const maximo = Math.min(Math.max(Number(limite) || 8, 1), 10);
  const encontrados = await steamspy.juegosCortos({
    horas,
    precioMaximoUSD: Number(precioMaximo) || 20,
    limite: maximo,
  });

  const juegos = encontrados.map((j) => {
    const minutos = j.medianaMinutos || j.tiempoMedioMinutos;
    return tarjeta(
      {
        appid: j.appid,
        nombre: j.nombre,
        precio: j.precioCentavosUSD > 0 ? dinero.desdeUSD(j.precioCentavosUSD / 100) : "Gratis",
        descuento: j.descuento,
        notaPrecio: `≈ ${Math.max(1, Math.round(minutos / 60))} h · ${j.porcentajePositivo ?? "?"}% positivas`,
      },
      contexto.usuarioId
    );
  });

  return {
    respuesta: {
      filtro: { horasMaximas: horas, precioMaximoUSD: precioMaximo },
      encontrados: juegos.length,
      juegos: juegos.map(paraModelo),
    },
    widgets: [
      {
        tipo: "lista_juegos",
        datos: {
          titulo: `Juegos de ${horas} horas o menos`,
          subtitulo: `Populares, bien valorados y hasta ${dinero.desdeUSD(precioMaximo)}`,
          juegos,
        },
      },
    ],
  };
};

// ---------------------------------------------------------------- trailers_juego
export const trailers = async ({ appid }) => {
  const ficha = await steam.detalles(appid);

  return {
    respuesta: {
      appid: ficha.appid,
      nombre: ficha.nombre,
      trailers: ficha.peliculas.map((p) => p.nombre),
      capturas: ficha.capturas.length,
    },
    widgets: [
      {
        tipo: "media",
        datos: {
          appid: ficha.appid,
          nombre: ficha.nombre,
          peliculas: ficha.peliculas,
          capturas: ficha.capturas,
        },
      },
    ],
  };
};

// ---------------------------------------------------------------- filtrar_catalogo
export const filtrar = async (
  { etiqueta, idioma = "español", edadMaxima = null, precioMaximo = null, limite = 5 },
  contexto
) => {
  const dinero = await crearMoneda(contexto?.moneda);
  const maximo = Math.min(Math.max(Number(limite) || 5, 1), 6);

  const candidatos = etiqueta
    ? await steamspy.porEtiqueta(etiqueta, 20)
    : await steamspy.masJugados({ limite: 20 });

  const revisados = await Promise.all(
    candidatos.slice(0, 8).map(async (candidato) => {
      try {
        return { candidato, ficha: await steam.detalles(candidato.appid) };
      } catch {
        return null;
      }
    })
  );

  const cumpleIdioma = (ficha) => {
    if (!idioma) return true;
    if (/audio/i.test(idioma)) return ficha.audioEspanol;
    if (/español|espanol/i.test(idioma)) return ficha.tieneEspanol;
    return true;
  };

  const filtrados = revisados
    .filter(Boolean)
    .filter(({ ficha }) => cumpleIdioma(ficha))
    .filter(({ ficha }) => edadMaxima == null || (ficha.edadMinima != null && ficha.edadMinima <= Number(edadMaxima)))
    .filter(({ ficha }) => precioMaximo == null || (ficha.precio.final != null && ficha.precio.final / 100 <= Number(precioMaximo)))
    .slice(0, maximo);

  if (filtrados.length === 0) {
    return {
      respuesta: {
        mensaje: "No encontré juegos que cumplan esos filtros. Prueba con otra etiqueta o un límite más amplio.",
      },
      widgets: [],
    };
  }

  const juegos = filtrados.map(({ ficha }) =>
    tarjeta(
      {
        appid: ficha.appid,
        nombre: ficha.nombre,
        imagen: ficha.imagen,
        precio: dinero.desdePEN((ficha.precio.final ?? 0) / 100),
        precioValor: ficha.precio.final != null ? ficha.precio.final / 100 : null,
        descuento: ficha.precio.descuento,
        notaPrecio: [
          ficha.tieneEspanol ? (ficha.audioEspanol ? "Español con audio" : "Español con subtítulos") : "Sin español",
          ficha.edadMinima ? `+${ficha.edadMinima}` : null,
        ]
          .filter(Boolean)
          .join(" · "),
      },
      contexto.usuarioId
    )
  );

  return {
    respuesta: {
      filtros: { etiqueta: etiqueta ?? "populares", idioma, edadMaxima, precioMaximoPEN: precioMaximo },
      encontrados: juegos.length,
      juegos: juegos.map(paraModelo),
    },
    widgets: [
      {
        tipo: "lista_juegos",
        datos: {
          titulo: etiqueta ? `Juegos de ${etiqueta}` : "Juegos populares",
          subtitulo: `Filtro: ${idioma}${edadMaxima ? ` · +${edadMaxima}` : ""}${precioMaximo ? ` · hasta ${dinero.pen(precioMaximo)}` : ""}`,
          juegos,
        },
      },
    ],
  };
};

// ---------------------------------------------------------------- proximos_lanzamientos
export const proximos = async ({ limite = 6 }, contexto) => {
  const dinero = await crearMoneda(contexto?.moneda);
  const maximo = Math.min(Math.max(Number(limite) || 6, 1), 8);
  const destacados = await steam.destacados();

  const base = destacados.proximos
    .filter((j) => !/demo|playtest|soundtrack|dlc|beta/i.test(j.nombre))
    .slice(0, maximo);
  const conFecha = await Promise.all(
    base.map(async (j) => {
      try {
        const ficha = await steam.detalles(j.appid);
        return { ...j, fecha: ficha.fecha, generos: ficha.generos };
      } catch {
        return { ...j, fecha: null, generos: [] };
      }
    })
  );

  const juegos = conFecha.map((j) =>
    tarjeta(
      {
        appid: j.appid,
        nombre: j.nombre,
        imagen: j.imagen,
        precio: j.precio.final ? dinero.desdePEN(j.precio.final / 100) : null,
        notaPrecio: j.fecha ? `Sale: ${j.fecha}` : "Próximamente",
      },
      contexto.usuarioId
    )
  );

  return {
    respuesta: {
      encontrados: juegos.length,
      juegos: conFecha.map((j) => ({ appid: j.appid, nombre: j.nombre, fecha: j.fecha })),
    },
    widgets: [
      {
        tipo: "lista_juegos",
        datos: {
          titulo: "Próximos lanzamientos",
          subtitulo: "Lo que viene en Steam",
          juegos,
        },
      },
    ],
  };
};

// ---------------------------------------------------------------- mas_jugados
export const masJugados = async ({ limite = 8 }, contexto) => {
  const dinero = await crearMoneda(contexto?.moneda);
  const maximo = Math.min(Math.max(Number(limite) || 8, 1), 10);
  const encontrados = await steamspy.masJugados({ limite: maximo });

  const juegos = encontrados.map((j) =>
    tarjeta(
      {
        appid: j.appid,
        nombre: j.nombre,
        precio: j.precioCentavosUSD > 0 ? dinero.desdeUSD(j.precioCentavosUSD / 100) : "Gratis",
        descuento: j.descuento,
        notaPrecio: `${(j.jugadoresAhora / 1000).toFixed(0)}k jugando ahora · ${j.porcentajePositivo ?? "?"}%`,
      },
      contexto.usuarioId
    )
  );

  return {
    respuesta: {
      encontrados: juegos.length,
      juegos: encontrados.map((j) => ({
        appid: j.appid,
        nombre: j.nombre,
        jugadoresAhora: j.jugadoresAhora,
      })),
    },
    widgets: [
      {
        tipo: "lista_juegos",
        datos: {
          titulo: "Más jugados ahora",
          subtitulo: "Jugadores concurrentes en Steam (últimas 2 semanas)",
          juegos,
        },
      },
    ],
  };
};
