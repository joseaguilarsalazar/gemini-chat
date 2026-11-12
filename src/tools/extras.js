import * as steam from "../integrations/steam.js";
import * as cheapshark from "../integrations/cheapshark.js";
import * as steamspy from "../integrations/steamspy.js";
import * as library from "../repositories/library.js";
import { tiendasPermitidas } from "../repositories/prefs.js";
import { crearMoneda } from "../services/money.js";
import { ofertasBiblioteca, detalles as fichaJuego } from "./juegos.js";

const ESTADOS_ACTIVOS = ["wishlist", "jugando"];

const horasDe = (minutos) => (minutos ? Math.max(1, Math.round(minutos / 60)) : null);

const porcentaje = (valor) => Math.round(Number(valor) || 0);

// ---------------------------------------------------------------- comparar_juegos
export const compararJuegos = async ({ appids }, contexto) => {
  const ids = [...new Set((appids ?? []).map(Number).filter(Number.isInteger))].slice(0, 3);
  if (ids.length < 2) {
    return {
      respuesta: { error: "Indica al menos dos appids de Steam para comparar." },
      widgets: [],
    };
  }

  const dinero = await crearMoneda(contexto?.moneda);
  const filas = [];

  for (const appid of ids) {
    const [ficha, info] = await Promise.all([
      steam.detalles(appid),
      steamspy.resumen(appid).catch(() => null),
    ]);

    let historicoUSD = null;
    try {
      const coincidencias = await cheapshark.buscarJuego(ficha.nombre);
      const match =
        coincidencias.find((c) => String(c.steamAppID) === String(appid)) ?? coincidencias[0];
      if (match?.gameID) {
        const detalle = await cheapshark.juego(match.gameID);
        if (detalle?.cheapestPriceEver?.price) {
          historicoUSD = Number(detalle.cheapestPriceEver.price);
        }
      }
    } catch {
      // Sin histórico disponible.
    }

    filas.push({
      appid,
      nombre: ficha.nombre,
      imagen: ficha.imagen,
      precioTexto: dinero.desdePEN((ficha.precio.final ?? 0) / 100),
      descuento: ficha.precio.descuento,
      metacritic: ficha.metacritic,
      porcentajePositivo: info?.porcentajePositivo ?? null,
      horas: horasDe(info?.medianaMinutos || info?.tiempoMedioMinutos),
      etiquetas: (info?.etiquetas ?? []).slice(0, 4),
      historicoTexto: historicoUSD ? dinero.desdeUSD(historicoUSD) : null,
      enBiblioteca: Boolean(library.obtener(contexto.usuarioId, appid)),
      fecha: ficha.fecha,
    });
  }

  return {
    respuesta: {
      juegos: filas.map((f) => ({
        nombre: f.nombre,
        precio: f.precioTexto,
        descuento: f.descuento || undefined,
        metacritic: f.metacritic ?? undefined,
        porcentajePositivo: f.porcentajePositivo ?? undefined,
        horas: f.horas ?? undefined,
        minimoHistorico: f.historicoTexto ?? undefined,
        etiquetas: f.etiquetas,
      })),
      moneda: dinero.moneda,
    },
    widgets: [{ tipo: "comparativa", datos: { juegos: filas, moneda: dinero.moneda } }],
  };
};

// ---------------------------------------------------------------- analisis_biblioteca
export const analisis = async (_args, contexto) => {
  const usuarioId = contexto.usuarioId;
  const dinero = await crearMoneda(contexto?.moneda);
  let juegos = library.listar(usuarioId);

  // Rellena etiquetas y duración de los juegos antiguos (máximo 8 por consulta).
  const faltan = juegos.filter((j) => j.etiquetas.length === 0 || !j.tiempoMedio).slice(0, 8);
  if (faltan.length > 0) {
    await Promise.all(
      faltan.map(async (juego) => {
        try {
          const info = await steamspy.resumen(juego.appid);
          library.actualizar(usuarioId, juego.appid, {
            etiquetas: info.etiquetas?.length ? info.etiquetas.slice(0, 8) : undefined,
            tiempo_medio: info.medianaMinutos || info.tiempoMedioMinutos || undefined,
          });
        } catch {
          // Se omite el juego si SteamSpy falla.
        }
      })
    );
    juegos = library.listar(usuarioId);
  }

  const resumen = library.resumen(usuarioId);

  if (juegos.length === 0) {
    return {
      respuesta: { mensaje: "La biblioteca está vacía. Agrega juegos para ver el análisis." },
      widgets: [],
    };
  }

  const valor = juegos.reduce((suma, j) => suma + (j.precioActual ?? 0), 0);
  const objetivo = juegos.reduce((suma, j) => suma + (j.precioObjetivo ?? 0), 0);
  const conPuntuacion = juegos.filter((j) => j.puntuacion);
  const promedio = conPuntuacion.length
    ? Number((conPuntuacion.reduce((s, j) => s + j.puntuacion, 0) / conPuntuacion.length).toFixed(1))
    : null;

  const backlog = juegos.filter((j) => ESTADOS_ACTIVOS.includes(j.estado));
  const minutosBacklog = backlog.reduce((suma, j) => suma + (j.tiempoMedio ?? 0), 0);

  const conteoEtiquetas = new Map();
  for (const juego of juegos) {
    for (const etiqueta of juego.etiquetas.slice(0, 6)) {
      conteoEtiquetas.set(etiqueta, (conteoEtiquetas.get(etiqueta) ?? 0) + 1);
    }
  }
  const etiquetas = [...conteoEtiquetas.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([nombre, total]) => ({ nombre, total }));

  const datos = {
    total: resumen.total,
    estados: {
      wishlist: resumen.wishlist,
      jugando: resumen.jugando,
      terminado: resumen.terminado,
      abandonado: resumen.abandonado,
    },
    valor: Number(valor.toFixed(2)),
    valorTexto: dinero.pen(valor),
    objetivo: Number(objetivo.toFixed(2)),
    objetivoTexto: dinero.pen(objetivo),
    promedio,
    backlog: backlog.length,
    horasBacklog: Math.round(minutosBacklog / 60),
    alertas: resumen.alertas.length,
    etiquetas,
    moneda: dinero.moneda,
  };

  return {
    respuesta: {
      ...datos,
      mensaje:
        `${datos.total} juegos · ${datos.horasBacklog} h estimadas de backlog · ` +
        `valor actual ${datos.valorTexto}`,
      nota:
        "El valor y los objetivos están en soles. La duración es la media de SteamSpy y puede variar.",
    },
    widgets: [{ tipo: "analisis", datos }],
  };
};

// ---------------------------------------------------------------- requisitos_pc
export const requisitosPc = async ({ appid }, contexto) => {
  const ficha = await steam.detalles(appid);
  const dinero = await crearMoneda(contexto?.moneda);
  const pc = contexto?.prefs?.pc ?? { cpu: "", gpu: "", ram: "", so: "" };

  if (!ficha.requisitos.minimo && !ficha.requisitos.recomendado) {
    return {
      respuesta: {
        nombre: ficha.nombre,
        mensaje: "Steam no publica requisitos para este juego.",
      },
      widgets: [],
    };
  }

  const tienePc = Boolean(pc.cpu || pc.gpu || pc.ram || pc.so);

  return {
    respuesta: {
      nombre: ficha.nombre,
      requisitos: ficha.requisitos,
      pcDelUsuario: pc,
      tienePc,
      edadMinima: ficha.edadMinima ?? undefined,
      clasificaciones: ficha.clasificaciones.slice(0, 2),
      nota: tienePc
        ? "Compara las especificaciones del usuario con los requisitos y da un veredicto claro."
        : "El usuario no guardó su PC; pídele que la configure en Ajustes para un veredicto exacto.",
    },
    widgets: [
      {
        tipo: "requisitos",
        datos: {
          appid: ficha.appid,
          nombre: ficha.nombre,
          imagen: ficha.imagen,
          requisitos: ficha.requisitos,
          pc,
          tienePc,
          precioTexto: dinero.desdePEN((ficha.precio.final ?? 0) / 100),
        },
      },
    ],
  };
};

// ---------------------------------------------------------------- plan_finde
export const planFinde = async ({ horas = 6, genero = null, estado = null }, contexto) => {
  const usuarioId = contexto.usuarioId;
  const dinero = await crearMoneda(contexto?.moneda);
  let juegos = library.listar(usuarioId);

  if (juegos.length === 0) {
    return {
      respuesta: {
        mensaje:
          "Tu biblioteca está vacía. Puedo recomendarte juegos cortos del catálogo si quieres.",
      },
      widgets: [],
    };
  }

  const faltan = juegos.filter((j) => !j.tiempoMedio).slice(0, 6);
  if (faltan.length > 0) {
    await Promise.all(
      faltan.map(async (juego) => {
        try {
          const info = await steamspy.resumen(juego.appid);
          if (info.medianaMinutos || info.tiempoMedioMinutos) {
            library.actualizar(usuarioId, juego.appid, {
              tiempo_medio: info.medianaMinutos || info.tiempoMedioMinutos,
              etiquetas: juego.etiquetas.length ? undefined : info.etiquetas?.slice(0, 8),
            });
          }
        } catch {
          // Sin duración: se ignora el filtro para ese juego.
        }
      })
    );
    juegos = library.listar(usuarioId);
  }

  const estados = estado ? [estado] : ESTADOS_ACTIVOS;
  const candidatos = juegos
    .filter((j) => estados.includes(j.estado))
    .filter(
      (j) =>
        !genero ||
        j.etiquetas.some((etiqueta) => etiqueta.toLowerCase().includes(genero.toLowerCase()))
    )
    .map((j) => ({ ...j, horas: horasDe(j.tiempoMedio) }))
    .filter((j) => !j.horas || j.horas <= Number(horas));

  if (candidatos.length === 0) {
    return {
      respuesta: {
        mensaje:
          "No hay juegos de tu biblioteca que entren en ese tiempo o género. " +
          "Puedo buscar juegos cortos del catálogo.",
      },
      widgets: [],
    };
  }

  const ordenados = candidatos.sort(
    (a, b) => (b.puntuacion ?? 0) - (a.puntuacion ?? 0) || (a.horas ?? 99) - (b.horas ?? 99)
  );

  const elegidos = [];
  let total = 0;
  for (const juego of ordenados) {
    const duracion = juego.horas ?? Math.min(4, Number(horas));
    if (elegidos.length > 0 && total + duracion > Number(horas) * 1.2) continue;
    elegidos.push({ ...juego, horas: duracion });
    total += duracion;
    if (elegidos.length === 3) break;
  }

  const datos = {
    horasDisponibles: Number(horas),
    totalHoras: total,
    juegos: elegidos.map((j) => ({
      appid: j.appid,
      nombre: j.nombre,
      imagen: j.imagen,
      horas: j.horas,
      estado: j.estado,
      puntuacion: j.puntuacion,
      etiquetas: j.etiquetas.slice(0, 4),
      precioTexto: j.precioActual != null ? dinero.pen(j.precioActual) : null,
    })),
  };

  return {
    respuesta: {
      ...datos,
      mensaje:
        `Plan para ${horas} horas: ` +
        elegidos.map((j) => `${j.nombre} (${j.horas} h)`).join(", ") +
        ` · total ${total} h`,
    },
    widgets: [{ tipo: "plan", datos }],
  };
};

// ---------------------------------------------------------------- ruleta_backlog
export const ruleta = async ({ estado = "wishlist" }, contexto) => {
  const candidatos = library
    .listar(contexto.usuarioId)
    .filter((juego) => juego.estado === estado);

  if (candidatos.length === 0) {
    return {
      respuesta: {
        mensaje: `No tienes juegos en estado "${estado}". Prueba con otro estado o agrega alguno.`,
      },
      widgets: [],
    };
  }

  const elegido = candidatos[Math.floor(Math.random() * candidatos.length)];
  const resultado = await fichaJuego({ appid: elegido.appid }, contexto);

  return {
    respuesta: {
      ...resultado.respuesta,
      mensaje: `La ruleta eligió "${elegido.nombre}" de tu lista.`,
      ruleta: true,
    },
    widgets: resultado.widgets,
  };
};

// ---------------------------------------------------------------- dlc_juego
export const dlcJuego = async ({ appid }, contexto) => {
  const dinero = await crearMoneda(contexto?.moneda);
  const ficha = await steam.detalles(appid);

  const dlcs = (
    await Promise.all(
      ficha.dlc.slice(0, 6).map(async (id) => {
        try {
          const dlc = await steam.detalles(id);
          return {
            appid: id,
            nombre: dlc.nombre,
            imagen: dlc.imagen,
            precioTexto: dinero.desdePEN((dlc.precio.final ?? 0) / 100),
            descuento: dlc.precio.descuento,
            fecha: dlc.fecha,
          };
        } catch {
          return null;
        }
      })
    )
  ).filter(Boolean);

  const ediciones = ficha.ediciones.map((edicion) => ({
    texto: edicion.texto,
    precioTexto: edicion.precio != null ? dinero.desdePEN(edicion.precio) : null,
  }));

  if (dlcs.length === 0 && ediciones.length === 0) {
    return {
      respuesta: { nombre: ficha.nombre, mensaje: "Este juego no tiene DLC ni ediciones registradas." },
      widgets: [],
    };
  }

  return {
    respuesta: {
      nombre: ficha.nombre,
      dlcs: dlcs.map((d) => ({ nombre: d.nombre, precio: d.precioTexto })),
      ediciones,
    },
    widgets: [
      {
        tipo: "dlc",
        datos: { appid: ficha.appid, nombre: ficha.nombre, dlcs, ediciones },
      },
    ],
  };
};

// ---------------------------------------------------------------- resumen_diario
export const resumenDiario = async (_args, contexto) => {
  const dinero = await crearMoneda(contexto?.moneda);
  const resumen = library.resumen(contexto.usuarioId);
  const alertas = resumen.alertas.map((a) => ({
    appid: a.appid,
    nombre: a.nombre,
    precioActual: dinero.pen(a.precioActual),
    precioObjetivo: dinero.pen(a.precioObjetivo),
  }));

  const ofertasResultado = await ofertasBiblioteca({ limite: 4 }, contexto);
  const widgetOfertas = ofertasResultado.widgets.find((w) => w.tipo === "lista_juegos");
  const ofertas = (widgetOfertas?.datos?.juegos ?? []).map((j) => ({
    nombre: j.nombre,
    precioTexto: j.precioTexto,
    notaPrecio: j.notaPrecio,
    enlace: j.enlace,
    appid: j.appid,
    imagen: j.imagen,
    descuento: j.descuento,
  }));

  const juegosNoticias = library
    .listar(contexto.usuarioId)
    .filter((j) => j.estado !== "abandonado")
    .slice(0, 3);

  const noticias = (
    await Promise.all(
      juegosNoticias.map(async (juego) => {
        try {
          const items = await steam.noticias(juego.appid, 2);
          return { nombre: juego.nombre, noticias: items };
        } catch {
          return null;
        }
      })
    )
  ).filter((n) => n && n.noticias.length > 0);

  let proximos = [];
  try {
    const destacados = await steam.destacados();
    proximos = destacados.proximos
      .filter((j) => !/demo|playtest|soundtrack|dlc|beta/i.test(j.nombre))
      .slice(0, 4)
      .map((j) => ({ appid: j.appid, nombre: j.nombre, imagen: j.imagen }));
  } catch {
    // Sin datos de lanzamientos.
  }

  let ofertaDelDia = null;
  try {
    const deals = await cheapshark.ofertas({
      limite: 1,
      descuentoMinimo: 50,
      precioMaximo: 20,
      tiendas: tiendasPermitidas(contexto.prefs ?? { soloOficiales: true, tiendas: [] }),
    });
    if (deals[0]) {
      const tiendas = await cheapshark.tiendas();
      ofertaDelDia = {
        nombre: deals[0].title,
        imagen: deals[0].thumb,
        precioTexto: dinero.desdeUSD(deals[0].salePrice),
        descuento: porcentaje(deals[0].savings),
        tienda: tiendas.get(String(deals[0].storeID)) ?? "Tienda",
        enlace: cheapshark.enlaceOferta(deals[0].dealID),
      };
    }
  } catch {
    // Sin oferta destacada.
  }

  return {
    respuesta: {
      alertas: alertas.length,
      ofertas: ofertas.length,
      noticias: noticias.length,
      proximos: proximos.map((p) => p.nombre),
      ofertaDelDia: ofertaDelDia
        ? { nombre: ofertaDelDia.nombre, precio: ofertaDelDia.precioTexto, tienda: ofertaDelDia.tienda }
        : null,
      mensaje: `Resumen listo: ${alertas.length} alertas, ${ofertas.length} ofertas de tu lista, ${noticias.length} juegos con novedades.`,
    },
    widgets: [
      {
        tipo: "digest",
        datos: { alertas, ofertas, noticias, proximos, ofertaDelDia },
      },
    ],
  };
};
