import * as steam from "../integrations/steam.js";
import * as cheapshark from "../integrations/cheapshark.js";
import * as library from "../repositories/library.js";
import * as prices from "../repositories/prices.js";
import { tiendasPermitidas } from "../repositories/prefs.js";

/**
 * Precio actual de un juego: Steam en soles y la mejor oferta en otras tiendas.
 * Se usa tanto en el chat como en el vigilante de precios.
 */
export const obtenerPrecios = async (appid, { prefs } = {}) => {
  const ficha = await steam.detalles(appid);
  const permitidas = tiendasPermitidas(prefs ?? { soloOficiales: true, tiendas: [] });

  let mejorUSD = null;
  let tienda = null;

  try {
    const coincidencias = await cheapshark.buscarJuego(ficha.nombre);
    const match =
      coincidencias.find((c) => String(c.steamAppID) === String(appid)) ?? coincidencias[0];

    if (match?.gameID) {
      const detalle = await cheapshark.juego(match.gameID);
      const ofertas = (detalle?.deals ?? [])
        .filter((deal) => String(deal.storeID) !== "1")
        .filter((deal) => !permitidas || permitidas.includes(String(deal.storeID)))
        .map((deal) => ({ ...deal, precio: Number(deal.price) }))
        .sort((a, b) => a.precio - b.precio);

      if (ofertas.length > 0) {
        mejorUSD = ofertas[0].precio;
        tienda = ofertas[0].storeID;
      }
    }
  } catch {
    // Si CheapShark falla, seguimos con el precio de Steam.
  }

  return { ficha, mejorUSD, tienda };
};

/**
 * Revisa los precios de la biblioteca (por defecto, solo deseados), guarda
 * snapshots y detecta alertas nuevas cuando el precio cruza el objetivo.
 */
export const revisarBiblioteca = async (
  usuarioId,
  { prefs, limite = 10, soloDeseos = true } = {}
) => {
  const maximo = Math.min(Math.max(Number(limite) || 10, 1), 20);

  const juegos = library
    .listar(usuarioId)
    .filter((juego) => !soloDeseos || juego.estado === "wishlist")
    .slice(0, maximo);

  const resultados = [];
  const alertas = [];

  for (const juego of juegos) {
    try {
      const { ficha, mejorUSD } = await obtenerPrecios(juego.appid, { prefs });
      const precioPEN = ficha.precio.final != null ? ficha.precio.final / 100 : null;
      const antes = juego.precioActual;

      prices.registrarPrecio({
        appid: juego.appid,
        precioPEN,
        precioUSD: mejorUSD,
        fuente: "revision",
      });

      if (precioPEN != null) {
        library.actualizar(usuarioId, juego.appid, { precio_actual: precioPEN });
      }

      const alcanzoObjetivo =
        juego.precioObjetivo != null &&
        precioPEN != null &&
        precioPEN <= juego.precioObjetivo;

      const alertaNueva =
        alcanzoObjetivo && (antes == null || antes > juego.precioObjetivo);

      if (alertaNueva) {
        alertas.push({
          appid: juego.appid,
          nombre: juego.nombre,
          precioActual: precioPEN,
          precioObjetivo: juego.precioObjetivo,
          ahorro: Number((juego.precioObjetivo - precioPEN).toFixed(2)),
          moneda: "PEN",
        });
      }

      resultados.push({
        appid: juego.appid,
        nombre: juego.nombre,
        precioAnterior: antes,
        precioActual: precioPEN,
        mejorUSD,
        alerta: alcanzoObjetivo,
        alertaNueva,
      });
    } catch (error) {
      resultados.push({
        appid: juego.appid,
        nombre: juego.nombre,
        error: error.message,
      });
    }
  }

  return {
    revisados: resultados.length,
    alertas,
    resultados,
  };
};
