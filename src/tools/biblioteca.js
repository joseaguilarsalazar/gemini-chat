import * as steam from "../integrations/steam.js";
import * as library from "../repositories/library.js";
import { vistaBiblioteca } from "../services/libraryView.js";

const ESTADOS = ["wishlist", "jugando", "terminado", "abandonado"];

const widget = () => ({ tipo: "biblioteca", datos: vistaBiblioteca() });

const respuestaBiblioteca = () => {
  const resumen = library.resumen();
  return {
    total: resumen.total,
    porEstado: {
      wishlist: resumen.wishlist,
      jugando: resumen.jugando,
      terminado: resumen.terminado,
      abandonado: resumen.abandonado,
    },
    alertas: resumen.alertas,
    juegos: library.listar().slice(0, 30).map((j) => ({
      appid: j.appid,
      nombre: j.nombre,
      estado: j.estado,
      puntuacion: j.puntuacion ?? undefined,
      precioObjetivo: j.precioObjetivo ?? undefined,
      precioActual: j.precioActual ?? undefined,
    })),
  };
};

// ---------------------------------------------------------------- ver_biblioteca
export const ver = async () => ({
  respuesta: {
    ...respuestaBiblioteca(),
    nota:
      "Estados: wishlist (deseados), jugando, terminado, abandonado. " +
      "El precio objetivo está en soles.",
  },
  widgets: [widget()],
});

// ---------------------------------------------------------------- resumen_biblioteca
export const resumen = async () => {
  const datos = library.resumen();
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
      alertas: datos.alertas,
    },
    widgets: [widget()],
  };
};

// ---------------------------------------------------------------- agregar
export const agregar = async ({ appid, estado = "wishlist", precioObjetivo = null, nota = null }) => {
  if (!ESTADOS.includes(estado)) {
    return {
      respuesta: { error: `Estado inválido. Usa uno de: ${ESTADOS.join(", ")}.` },
      widgets: [],
    };
  }

  const existente = library.obtener(appid);
  const ficha = existente ? null : await steam.detalles(appid);
  const precioActual =
    ficha?.precio?.final != null ? ficha.precio.final / 100 : existente?.precioActual ?? null;

  library.guardar({
    appid,
    nombre: ficha?.nombre ?? existente.nombre,
    imagen: ficha?.imagen ?? existente.imagen,
    estado,
    precioActual,
  });

  if (precioObjetivo != null) {
    library.actualizar(appid, { precio_objetivo: Number(precioObjetivo) });
  }
  if (nota != null) {
    library.actualizar(appid, { nota: String(nota).slice(0, 500) });
  }

  const guardado = library.obtener(appid);

  return {
    respuesta: {
      ok: true,
      mensaje: existente
        ? `"${guardado.nombre}" ya estaba en la biblioteca; se actualizó el estado.`
        : `"${guardado.nombre}" se agregó a la biblioteca.`,
      juego: {
        appid: guardado.appid,
        nombre: guardado.nombre,
        estado: guardado.estado,
        precioActual: guardado.precioActual ?? undefined,
        precioObjetivo: guardado.precioObjetivo ?? undefined,
      },
      resumen: library.resumen(),
    },
    widgets: [widget()],
  };
};

// ---------------------------------------------------------------- actualizar
export const actualizar = async ({ appid, estado, puntuacion, nota, precioObjetivo }) => {
  const existente = library.obtener(appid);
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

  library.actualizar(appid, cambios);
  const actualizado = library.obtener(appid);

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
        precioObjetivo: actualizado.precioObjetivo ?? undefined,
        precioActual: actualizado.precioActual ?? undefined,
      },
    },
    widgets: [widget()],
  };
};

// ---------------------------------------------------------------- quitar
export const quitar = async ({ appid }) => {
  const existente = library.obtener(appid);
  if (!existente) {
    return { respuesta: { error: "Ese juego no está en la biblioteca." }, widgets: [] };
  }

  library.eliminar(appid);

  return {
    respuesta: {
      ok: true,
      mensaje: `"${existente.nombre}" se eliminó de la biblioteca.`,
      resumen: library.resumen(),
    },
    widgets: [widget()],
  };
};
