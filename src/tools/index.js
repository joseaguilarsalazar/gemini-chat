import { declaracionesHerramientas } from "./definitions.js";
import * as juegos from "./juegos.js";
import * as biblioteca from "./biblioteca.js";
import * as extras from "./extras.js";

const ejecutores = {
  buscar_juegos: juegos.buscar,
  detalles_juego: juegos.detalles,
  comparar_precios: juegos.comparar,
  ofertas: juegos.ofertasDelMomento,
  tendencias: juegos.tendencias,
  descubrir_por_etiqueta: juegos.descubrir,
  noticias_juego: juegos.noticias,
  ver_biblioteca: biblioteca.ver,
  agregar_a_biblioteca: biblioteca.agregar,
  actualizar_juego_biblioteca: biblioteca.actualizar,
  quitar_de_biblioteca: biblioteca.quitar,
  resumen_biblioteca: biblioteca.resumen,
  ofertas_de_mi_biblioteca: juegos.ofertasBiblioteca,
  revisar_alertas: juegos.revisarAlertas,
  juegos_similares: juegos.similares,
  juegos_cortos: juegos.cortos,
  trailers_juego: juegos.trailers,
  filtrar_catalogo: juegos.filtrar,
  proximos_lanzamientos: juegos.proximos,
  mas_jugados: juegos.masJugados,
  comparar_juegos: extras.compararJuegos,
  analisis_biblioteca: extras.analisis,
  requisitos_pc: extras.requisitosPc,
  plan_finde: extras.planFinde,
  ruleta_backlog: extras.ruleta,
  dlc_juego: extras.dlcJuego,
  resumen_diario: extras.resumenDiario,
};

export const herramientas = declaracionesHerramientas;

/**
 * Ejecuta una herramienta por nombre.
 * Nunca lanza: los errores viajan al modelo como dato, para que pueda
 * explicar el problema al usuario en lenguaje natural.
 *
 * `contexto` incluye usuarioId, moneda y preferencias; las herramientas lo usan
 * para personalizar precios y biblioteca.
 */
export const ejecutarHerramienta = async (nombre, argumentos = {}, contexto = {}) => {
  const ejecutor = ejecutores[nombre];

  if (!ejecutor) {
    return { respuesta: { error: `Herramienta desconocida: ${nombre}` }, widgets: [] };
  }

  try {
    const resultado = await ejecutor(argumentos ?? {}, contexto);
    return {
      respuesta: resultado.respuesta ?? { ok: true },
      widgets: resultado.widgets ?? [],
    };
  } catch (error) {
    console.error(`[tool:${nombre}] ${error.message}`);
    return {
      respuesta: {
        error: `No se pudo completar la consulta (${error.message}). ` +
          "Explica al usuario que el servicio no está disponible e intenta otra cosa.",
      },
      widgets: [],
    };
  }
};
