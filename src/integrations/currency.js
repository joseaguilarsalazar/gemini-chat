import { getJson } from "./http.js";

const RESPALDO = 3.75;

/**
 * Tipo de cambio USD -> PEN (sol peruano).
 * Se cachea 12 horas; si el servicio falla se usa un valor de respaldo.
 */
export const tipoCambioPEN = async () => {
  try {
    const datos = await getJson("https://open.er-api.com/v6/latest/USD", {
      ttlSegundos: 43200,
    });
    return Number(datos?.rates?.PEN) || RESPALDO;
  } catch {
    return RESPALDO;
  }
};

export const usdAPen = async (usd) => Number(usd ?? 0) * (await tipoCambioPEN());

export const formatearPEN = (valor) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(
    Number(valor ?? 0)
  );
