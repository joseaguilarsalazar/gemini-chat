import * as steam from "../integrations/steam.js";
import * as steamspy from "../integrations/steamspy.js";
import * as library from "../repositories/library.js";
import { vistaBiblioteca } from "../services/libraryView.js";
import { crearMoneda } from "../services/money.js";

const ESTADOS = ["wishlist", "jugando", "terminado", "abandonado"];

const widget = (contexto) => ({ tipo: "biblioteca", datos: vistaBiblioteca(contexto.usuarioId) });

const respuestaBiblioteca = (usuarioId, dinero) => {
  const resumen = library.resumen(usuarioId);
  return {
    total: resumen.total,
    porEstado: {
      wishlist: resumen.wishlist,
      jugando: resumen.jugando,
      terminado: resumen.terminado,
      abandonado: resumen.abandonado,
    },
    alertas: resumen.alertas.map((a) => ({
      appid: a.appid,
      nombre: a.nombre,
      precioActual: dinero.pen(a.precioActual),
      precioObjetivo: dinero.pen(a.precioObjetivo),
    })),
    juegos: library.listar(usuarioId).slice(0, 30).map((j) => ({
      appid: j.appid,
      nombre: j.nombre,
      estado: j.estado,
      puntuacion: j.puntuacion ?? undefined,
      precioObjetivo: j.precioObjetivo != null ? dinero.pen(j.precioObjetivo) : undefined,
      precioActual: j.precioActual != null ? dinero.pen(j.precioActual) : undefined,
      tiempoMedioHoras: j.tiempoMedio ? Math.round(j.tiempoMedio / 60) : undefined,
      etiquetas: j.etiquetas.slice(0, 5),
    })),
  };
};

// ---------------------------------------------------------------- ver_biblioteca
export const ver = async (_args, contexto) => {
  const dinero = await crearMoneda(contexto?.moneda);
  return {
    respuesta: {
      ...respuestaBiblioteca(contexto.usuarioId, dinero),
      nota:
        "Estados: wishlist (deseados), jugando, terminado, abandonado. " +
        "Los precios objetivo y actuales están en soles.",
    },
    widgets: [widget(contexto)],
  };
};

// ---------------------------------------------------------------- resumen_biblioteca
export const resumen = async (_args, contexto) => {
  const dinero = await crearMoneda(contexto?.moneda);
  const datos = library.resumen(contexto.usuarioId);
  const totalTexto = datos.total === 1 ? "1 juego" : `${datos.total} juegos`;
  const mensaje =
    datos.total === 0
      ? "La biblioteca está vacía."
      : `${totalTexto}: ${datos.jugando} jugando, ${datos.terminado} terminados, ` +
        `${datos.wishlist} en deseados y ${datos.abandonado} abandonados.`;

  return {
    respuesta: {
      mensaje,
      total: datos.total,
      porEstado: {
        wishlist: datos.wishlist,
        jugando: datos.jugando,
        terminado: datos.terminado,
        abandonado: datos.abandonado,
      },
      alertas: datos.alertas.map((a) => ({
        nombre: a.nombre,
        precioActual: dinero.pen(a.precioActual),
        precioObjetivo: dinero.pen(a.precioObjetivo),
      })),
    },
    widgets: [widget(contexto)],
  };
};

// ---------------------------------------------------------------- agregar
export const agregar = async (
  { appid, estado, precioObjetivo = null, nota = null },
  contexto
) => {
  const usuarioId = contexto.usuarioId;
  const existente = library.obtener(usuarioId, appid);
  const estadoFinal = estado ?? existente?.estado ?? "wishlist";

  if (!ESTADOS.includes(estadoFinal)) {
    return {
      respuesta: { error: `Estado inválido. Usa uno de: ${ESTADOS.join(", ")}.` },
      widgets: [],
    };
  }

  let ficha = null;
  let info = null;

  if (!existente) {
    [ficha, info] = await Promise.all([
      steam.detalles(appid),
      steamspy.resumen(appid).catch(() => null),
    ]);
  }

  const precioActual =
    ficha?.precio?.final != null ? ficha.precio.final / 100 : existente?.precioActual ?? null;

  library.guardar(usuarioId, {
    appid,
    nombre: ficha?.nombre ?? existente.nombre,
    imagen: ficha?.imagen ?? existente.imagen,
    estado: estadoFinal,
    precioActual,
    etiquetas: info?.etiquetas?.slice(0, 8) ?? existente?.etiquetas ?? null,
    tiempoMedio:
      info?.medianaMinutos || info?.tiempoMedioMinutos || existente?.tiempoMedio || null,
  });

  if (precioObjetivo != null) {
    library.actualizar(usuarioId, appid, { precio_objetivo: Number(precioObjetivo) });
  }
  if (nota != null) {
    library.actualizar(usuarioId, appid, { nota: String(nota).slice(0, 500) });
  }

  const guardado = library.obtener(usuarioId, appid);
  const dinero = await crearMoneda(contexto?.moneda);

  return {
    respuesta: {
      ok: true,
      mensaje: existente
        ? `"${guardado.nombre}" ya estaba en la biblioteca; se actualizó.`
        : `"${guardado.nombre}" se agregó a la biblioteca.`,
      juego: {
        appid: guardado.appid,
        nombre: guardado.nombre,
        estado: guardado.estado,
        precioActual: guardado.precioActual != null ? dinero.pen(guardado.precioActual) : undefined,
        precioObjetivo:
          guardado.precioObjetivo != null ? dinero.pen(guardado.precioObjetivo) : undefined,
      },
      resumen: library.resumen(usuarioId),
    },
    widgets: [widget(contexto)],
  };
};

// ---------------------------------------------------------------- actualizar
export const actualizar = async (
  { appid, estado, puntuacion, nota, precioObjetivo },
  contexto
) => {
  const usuarioId = contexto.usuarioId;
  const existente = library.obtener(usuarioId, appid);

  if (!existente) {
    return {
      respuesta: {
        error: "Ese juego no está en la biblioteca. Agrégalo primero con agregar_a_biblioteca.",
      },
      widgets: [],
    };
  }

  if (estado !== undefined && !ESTADOS.includes(estado)) {
    return {
      respuesta: { error: `Estado inválido. Usa uno de: ${ESTADOS.join(", ")}.` },
      widgets: [],
    };
  }

  const puntuacionNumero = puntuacion === undefined ? undefined : Number(puntuacion);
  if (puntuacionNumero !== undefined && (puntuacionNumero < 1 || puntuacionNumero > 10)) {
    return { respuesta: { error: "La puntuación debe estar entre 1 y 10." }, widgets: [] };
  }

  const cambios = {};
  if (estado !== undefined) cambios.estado = estado;
  if (puntuacionNumero !== undefined) cambios.puntuacion = Math.round(puntuacionNumero);
  if (nota !== undefined) cambios.nota = String(nota).slice(0, 500);
  if (precioObjetivo !== undefined) cambios.precio_objetivo = Number(precioObjetivo);

  library.actualizar(usuarioId, appid, cambios);
  const actualizado = library.obtener(usuarioId, appid);
  const dinero = await crearMoneda(contexto?.moneda);

  return {
    respuesta: {
      ok: true,
      mensaje: `Se actualizó "${actualizado.nombre}".`,
      juego: {
        appid: actualizado.appid,
        nombre: actualizado.nombre,
        estado: actualizado.estado,
        puntuacion: actualizado.puntuacion ?? undefined,
        nota: actualizado.nota ?? undefined,
        precioObjetivo:
          actualizado.precioObjetivo != null ? dinero.pen(actualizado.precioObjetivo) : undefined,
        precioActual:
          actualizado.precioActual != null ? dinero.pen(actualizado.precioActual) : undefined,
      },
    },
    widgets: [widget(contexto)],
  };
};

// ---------------------------------------------------------------- quitar
export const quitar = async ({ appid }, contexto) => {
  const existente = library.obtener(contexto.usuarioId, appid);
  if (!existente) {
    return { respuesta: { error: "Ese juego no está en la biblioteca." }, widgets: [] };
  }

  library.eliminar(contexto.usuarioId, appid);

  return {
    respuesta: {
      ok: true,
      mensaje: `"${existente.nombre}" se eliminó de la biblioteca.`,
      resumen: library.resumen(contexto.usuarioId),
    },
    widgets: [widget(contexto)],
  };
};
