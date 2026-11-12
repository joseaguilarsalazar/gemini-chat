import * as steam from "../integrations/steam.js";
import * as cheapshark from "../integrations/cheapshark.js";
import * as steamspy from "../integrations/steamspy.js";
import * as currency from "../integrations/currency.js";
import * as library from "../repositories/library.js";

const porcentaje = (valor) => Math.round(Number(valor) || 0);

/** Actualiza el precio guardado si el juego ya está en la biblioteca. */
const refrescarPrecioBiblioteca = (appid, precio) => {
  if (!library.obtener(appid)) return;
  if (precio?.final == null) return;
  library.actualizar(appid, { precio_actual: precio.final / 100 });
};

/** Tarjeta compacta para las listas de juegos. */
const tarjeta = ({
  appid,
  nombre,
  imagen,
  precio,
  precioValor,
  descuento,
  puntuacion,
  notaPrecio,
  enlace,
}) => ({
  appid,
  nombre,
  imagen: imagen ?? null,
  precioTexto: precio ?? null,
  precioValor: precioValor ?? null,
  descuento: descuento ?? 0,
  puntuacion: puntuacion ?? null,
  notaPrecio: notaPrecio ?? null,
  enlace: enlace ?? null,
  enBiblioteca: appid ? Boolean(library.obtener(appid)) : false,
});

/** Formato corto de un juego para el contexto del modelo (sin imágenes). */
const paraModelo = (juego) => ({
  appid: juego.appid,
  nombre: juego.nombre,
  precio: juego.precioTexto,
  descuento: juego.descuento || undefined,
  nota: juego.notaPrecio ?? undefined,
});

// ---------------------------------------------------------------- buscar_juegos
export const buscar = async ({ consulta }) => {
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
    tarjeta({
      appid: j.appid,
      nombre: j.nombre,
      imagen: j.imagen,
      precio: j.precio.texto,
      precioValor: j.precio.final != null ? j.precio.final / 100 : null,
      descuento: j.precio.descuento,
      puntuacion: j.metacritic,
      notaPrecio: "Steam · precio en Perú",
    })
  );

  return {
    respuesta: {
      encontrados: juegos.length,
      juegos: juegos.map(paraModelo),
      moneda: "PEN",
      nota: "Los precios son de Steam en Perú, en soles. Para comparar con otras tiendas usa comparar_precios.",
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
export const detalles = async ({ appid }) => {
  const [ficha, resumen] = await Promise.all([
    steam.detalles(appid),
    steamspy.resumen(appid).catch(() => null),
  ]);

  refrescarPrecioBiblioteca(ficha.appid, ficha.precio);

  const enBiblioteca = Boolean(library.obtener(ficha.appid));
  const etiquetas = resumen?.etiquetas?.slice(0, 6) ?? [];
  const positivo = resumen?.porcentajePositivo ?? null;

  return {
    respuesta: {
      appid: ficha.appid,
      nombre: ficha.nombre,
      precio: ficha.precio.texto,
      descuento: ficha.precio.descuento || undefined,
      generos: ficha.generos,
      etiquetas,
      porcentajePositivo: positivo ?? undefined,
      metacritic: ficha.metacritic ?? undefined,
      fecha: ficha.fecha,
      desarrollador: ficha.desarrollador,
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
          precioTexto: ficha.precio.texto,
          precioValor: ficha.precio.final != null ? ficha.precio.final / 100 : null,
          precioOriginal:
            ficha.precio.descuento > 0 && ficha.precio.inicial != null
              ? steam.formatearPEN(ficha.precio.inicial)
              : null,
          descuento: ficha.precio.descuento,
          generos: ficha.generos,
          etiquetas,
          porcentajePositivo: positivo,
          metacritic: ficha.metacritic,
          fecha: ficha.fecha,
          desarrollador: ficha.desarrollador,
          enBiblioteca,
        },
      },
    ],
  };
};

// ---------------------------------------------------------------- comparar_precios
export const comparar = async ({ appid }) => {
  const ficha = await steam.detalles(appid);

  const coincidencias = await cheapshark.buscarJuego(ficha.nombre);
  const coincidencia =
    coincidencias.find((c) => String(c.steamAppID) === String(appid)) ?? coincidencias[0];

  if (!coincidencia?.gameID) {
    return {
      respuesta: {
        appid: ficha.appid,
        nombre: ficha.nombre,
        precioSteam: ficha.precio.texto,
        mensaje: "No hay otras tiendas registradas para este juego.",
      },
      widgets: [
        {
          tipo: "tabla_precios",
          datos: {
            appid: ficha.appid,
            nombre: ficha.nombre,
            imagen: ficha.imagen,
            precioSteam: ficha.precio.texto,
            descuentoSteam: ficha.precio.descuento,
            historico: null,
            tiendas: [],
            mejor: null,
            tipoCambio: await currency.tipoCambioPEN(),
          },
        },
      ],
    };
  }

  const [detalle, mapaTiendas, tipoCambio] = await Promise.all([
    cheapshark.juego(coincidencia.gameID),
    cheapshark.tiendas(),
    currency.tipoCambioPEN(),
  ]);

  const ofertasTodas = (detalle?.deals ?? [])
    .map((deal) => {
      const precioUSD = Number(deal.price);
      return {
        tienda: mapaTiendas.get(String(deal.storeID)) ?? `Tienda ${deal.storeID}`,
        precioUSD,
        precioTexto: cheapshark.formatearUSD(precioUSD),
        precioPen: currency.formatearPEN(precioUSD * tipoCambio),
        descuento: porcentaje(deal.savings),
        enlace: cheapshark.enlaceOferta(deal.dealID),
        steam: String(deal.storeID) === "1",
      };
    })
    .sort((a, b) => a.precioUSD - b.precioUSD);

  // La fila de Steam de CheapShark usa precios de EE. UU., que no coinciden con
  // el precio local en soles. Para evitar comparaciones confusas, solo mostramos
  // las demás tiendas y dejamos el precio de Steam Perú aparte.
  const ofertas = ofertasTodas.filter((oferta) => !oferta.steam);

  const historico = detalle?.cheapestPriceEver
    ? {
        precioUSD: Number(detalle.cheapestPriceEver.price),
        precioTexto: cheapshark.formatearUSD(detalle.cheapestPriceEver.price),
        precioPen: currency.formatearPEN(
          Number(detalle.cheapestPriceEver.price) * tipoCambio
        ),
        fecha: new Date(detalle.cheapestPriceEver.date * 1000).toISOString(),
      }
    : null;

  refrescarPrecioBiblioteca(ficha.appid, ficha.precio);

  const mejor = ofertas[0] ?? null;

  return {
    respuesta: {
      appid: ficha.appid,
      nombre: ficha.nombre,
      precioSteamPEN: ficha.precio.texto,
      descuentoSteam: ficha.precio.descuento || undefined,
      mejorOferta: mejor
        ? { tienda: mejor.tienda, precioUSD: mejor.precioTexto, precioPen: mejor.precioPen }
        : null,
      historico,
      tiendas: ofertas.map((o) => ({ tienda: o.tienda, precioUSD: o.precioTexto, descuento: o.descuento })),
      tipoCambioPENporUSD: tipoCambio,
      aclaracion:
        "Steam está en soles peruanos; CheapShark en dólares. Los valores en soles de otras tiendas son una conversión aproximada.",
    },
    widgets: [
      {
        tipo: "tabla_precios",
        datos: {
          appid: ficha.appid,
          nombre: ficha.nombre,
          imagen: ficha.imagen,
          precioSteam: ficha.precio.texto,
          descuentoSteam: ficha.precio.descuento,
          historico,
          tiendas: ofertas,
          mejor,
          tipoCambio,
        },
      },
    ],
  };
};

// ---------------------------------------------------------------- ofertas
export const ofertasDelMomento = async ({ descuentoMinimo = 50, precioMaximo = 20, limite = 8 }) => {
  const maximo = Math.min(Math.max(Number(limite) || 8, 1), 10);
  const [deals, mapaTiendas, tipoCambio] = await Promise.all([
    cheapshark.ofertas({ descuentoMinimo, precioMaximo, limite: maximo }),
    cheapshark.tiendas(),
    currency.tipoCambioPEN(),
  ]);

  if (deals.length === 0) {
    return {
      respuesta: {
        encontrados: 0,
        mensaje: `No hay ofertas con más de ${descuentoMinimo}% de descuento por debajo de US$ ${precioMaximo}.`,
      },
      widgets: [],
    };
  }

  const juegos = deals.map((deal) => {
    const tienda = mapaTiendas.get(String(deal.storeID)) ?? "Tienda";
    const precioPen = currency.formatearPEN(Number(deal.salePrice) * tipoCambio);
    return {
      appid: Number(deal.steamAppID) || null,
      nombre: deal.title,
      imagen: deal.thumb,
      precioTexto: cheapshark.formatearUSD(deal.salePrice),
      descuento: porcentaje(deal.savings),
      puntuacion: Number(deal.steamRatingPercent) || null,
      notaPrecio: `${tienda} · ${precioPen}`,
      enlace: cheapshark.enlaceOferta(deal.dealID),
      _tienda: tienda,
      _precioPen: precioPen,
    };
  });

  return {
    respuesta: {
      encontrados: juegos.length,
      ofertas: juegos.map((j) => ({
        appid: j.appid ?? undefined,
        nombre: j.nombre,
        precioUSD: j.precioTexto,
        precioPen: j._precioPen,
        descuento: j.descuento,
        tienda: j._tienda,
      })),
      nota: "Precios en dólares; la conversión a soles es aproximada.",
    },
    widgets: [
      {
        tipo: "lista_juegos",
        datos: {
          titulo: "Ofertas del momento",
          subtitulo: `Más de ${descuentoMinimo}% de descuento · hasta US$ ${precioMaximo}`,
          juegos: juegos.map(({ _tienda, _precioPen, ...juego }) => juego),
        },
      },
    ],
  };
};

// ---------------------------------------------------------------- tendencias
export const tendencias = async () => {
  const destacados = await steam.destacados();
  const juegos = [...destacados.masVendidos.slice(0, 5), ...destacados.novedades.slice(0, 5)].map(
    (j) =>
      tarjeta({
        appid: j.appid,
        nombre: j.nombre,
        imagen: j.imagen,
        precio: j.precio.texto,
        precioValor: j.precio.final != null ? j.precio.final / 100 : null,
        descuento: j.precio.descuento,
        notaPrecio: "Steam · precio en Perú",
      })
  );

  return {
    respuesta: {
      masVendidos: destacados.masVendidos.slice(0, 5).map((j) => ({
        appid: j.appid,
        nombre: j.nombre,
        precio: j.precio.texto,
      })),
      novedades: destacados.novedades.slice(0, 5).map((j) => ({
        appid: j.appid,
        nombre: j.nombre,
        precio: j.precio.texto,
      })),
    },
    widgets: [
      {
        tipo: "lista_juegos",
        datos: {
          titulo: "Lo más vendido y las novedades",
          subtitulo: "Steam · precios en soles",
          juegos,
        },
      },
    ],
  };
};

// ---------------------------------------------------------------- descubrir_por_etiqueta
export const descubrir = async ({ etiqueta, limite = 8 }) => {
  const maximo = Math.min(Math.max(Number(limite) || 8, 1), 10);
  const encontrados = await steamspy.porEtiqueta(etiqueta, maximo);

  const juegos = encontrados.map((j) =>
    tarjeta({
      appid: j.appid,
      nombre: j.nombre,
      precio:
        j.precioCentavosUSD > 0
          ? `US$ ${(j.precioCentavosUSD / 100).toFixed(2)}`
          : "Gratis o sin precio",
      descuento: j.descuento,
      notaPrecio: j.propietarios
        ? `${(j.propietarios / 1_000_000).toFixed(1)} M jugadores`
        : null,
    })
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
