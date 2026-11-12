import * as library from "../repositories/library.js";

export const ETIQUETAS_ESTADO = {
  wishlist: "En deseados",
  jugando: "Jugando",
  terminado: "Terminado",
  abandonado: "Abandonado",
};

/**
 * Datos que consume el widget de biblioteca, tanto desde el chat como desde la API.
 */
export const vistaBiblioteca = () => {
  const resumen = library.resumen();

  return {
    resumen,
    juegos: library.listar().map((juego) => ({
      ...juego,
      estadoTexto: ETIQUETAS_ESTADO[juego.estado] ?? juego.estado,
      alerta:
        juego.precioObjetivo != null &&
        juego.precioActual != null &&
        juego.precioActual <= juego.precioObjetivo,
    })),
  };
};
