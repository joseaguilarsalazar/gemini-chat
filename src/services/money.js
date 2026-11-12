import { getJson } from "../integrations/http.js";

const formato = (moneda, valor) =>
  new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: moneda,
    maximumFractionDigits: 2,
  }).format(Number(valor ?? 0));

/** Tasas relativas a USD: { USD: 1, PEN: 3.42, EUR: 0.90 }. */
export const tasas = async () => {
  try {
    const datos = await getJson("https://open.er-api.com/v6/latest/USD", {
      ttlSegundos: 43200,
    });
    return {
      USD: 1,
      PEN: Number(datos?.rates?.PEN) || 3.75,
      EUR: Number(datos?.rates?.EUR) || 0.92,
    };
  } catch {
    return { USD: 1, PEN: 3.75, EUR: 0.92 };
  }
};

/**
 * Formateadores para la moneda preferida del usuario.
 * - desdePEN: recibe soles (Steam).
 * - desdeUSD: recibe dólares (CheapShark).
 * Los precios de la biblioteca se mantienen en soles.
 */
export const crearMoneda = async (moneda = "PEN") => {
  const t = await tasas();
  const destino = t[moneda] ? moneda : "PEN";

  return {
    moneda: destino,
    tasaPEN: t.PEN,
    desdePEN: (valor) => formato(destino, (Number(valor) / t.PEN) * t[destino]),
    desdeUSD: (valor) => formato(destino, Number(valor) * t[destino]),
    pen: (valor) => formato("PEN", Number(valor)),
    formatear: (valor) => formato(destino, Number(valor)),
    esPEN: destino === "PEN",
  };
};

export const formatearPEN = (valor) => formato("PEN", valor);
