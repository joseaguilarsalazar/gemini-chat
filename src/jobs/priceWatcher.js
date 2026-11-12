import config from "../config.js";
import { todosLosUsuariosConDeseos } from "../repositories/library.js";
import { getPrefs } from "../repositories/prefs.js";
import { revisarBiblioteca } from "../services/pricing.js";
import { notificarAlertas } from "../services/notifications.js";

/**
 * Revisa los precios de todos los usuarios con deseados y notifica las
 * alertas nuevas por los canales configurados.
 */
export const ejecutarRevisionPrecios = async ({ limite = config.priceCheck.limit } = {}) => {
  const usuarios = todosLosUsuariosConDeseos();
  const resultados = [];

  for (const usuarioId of usuarios) {
    const prefs = getPrefs(usuarioId);

    try {
      const revision = await revisarBiblioteca(usuarioId, { prefs, limite });

      let notificados = [];
      if (prefs.notificaciones && revision.alertas.length > 0) {
        notificados = await notificarAlertas(prefs, revision.alertas);
      }

      resultados.push({
        usuarioId,
        revisados: revision.revisados,
        alertas: revision.alertas.length,
        notificados,
      });
    } catch (error) {
      console.error(`[precios] usuario ${usuarioId}:`, error.message);
      resultados.push({ usuarioId, error: error.message });
    }
  }

  return resultados;
};

/**
 * Vigilante en segundo plano: primera pasada a los 5 minutos y luego cada
 * PRICE_CHECK_INTERVAL_MS. No bloquea el cierre del proceso.
 */
export const iniciarVigilantePrecios = () => {
  if (!config.priceCheck.enabled) {
    console.log("Vigilante de precios: desactivado");
    return null;
  }

  const ejecutar = () => {
    ejecutarRevisionPrecios().catch((error) =>
      console.error("[precios] error en la revisión periódica:", error.message)
    );
  };

  const inicial = setTimeout(ejecutar, 5 * 60 * 1000);
  const intervalo = setInterval(ejecutar, config.priceCheck.intervalMs);

  inicial.unref?.();
  intervalo.unref?.();

  console.log(
    `Vigilante de precios: cada ${Math.round(config.priceCheck.intervalMs / 60000)} min`
  );

  return { inicial, intervalo };
};
