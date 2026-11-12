import nodemailer from "nodemailer";
import config from "../config.js";

/** Canales globales disponibles según el .env. */
export const estadoCanales = () => ({
  telegram: Boolean(config.notifications.telegramToken),
  email: Boolean(config.notifications.smtp.host && config.notifications.smtp.from),
});

const enviarTelegram = async (chatId, texto) => {
  if (!config.notifications.telegramToken || !chatId) return false;

  const url = `${config.notifications.telegramApiBase}/bot${config.notifications.telegramToken}/sendMessage`;
  const respuesta = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: texto,
      disable_web_page_preview: true,
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!respuesta.ok) {
    throw new Error(`Telegram respondió ${respuesta.status}`);
  }

  return true;
};

const enviarEmail = async (para, asunto, texto) => {
  const smtp = config.notifications.smtp;
  if (!smtp.host || !smtp.from || !para) return false;

  const transporte = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
  });

  await transporte.sendMail({
    from: smtp.from,
    to: para,
    subject: asunto,
    text: texto,
  });

  return true;
};

/**
 * Envía una notificación por los canales que el usuario tenga configurados.
 * Devuelve la lista de canales que se usaron.
 */
export const enviarNotificacion = async ({ prefs, asunto, texto }) => {
  const enviados = [];
  const chatId = prefs?.telegramChatId || config.notifications.telegramChatId;

  try {
    if (await enviarTelegram(chatId, texto)) enviados.push("telegram");
  } catch (error) {
    console.warn("[notify] telegram:", error.message);
  }

  try {
    if (await enviarEmail(prefs?.email, asunto, texto)) enviados.push("email");
  } catch (error) {
    console.warn("[notify] email:", error.message);
  }

  return enviados;
};

/** Texto y envío de alertas de precio. */
export const notificarAlertas = async (prefs, alertas) => {
  if (!alertas.length) return [];

  const lineas = alertas.map(
    (alerta) =>
      `• ${alerta.nombre}: S/ ${Number(alerta.precioActual).toFixed(2)} ` +
      `(objetivo S/ ${Number(alerta.precioObjetivo).toFixed(2)})`
  );

  const texto =
    "GameScout · precios alcanzados\n\n" +
    `${lineas.join("\n")}\n\n${config.notifications.appUrl}`;

  return enviarNotificacion({
    prefs,
    asunto: "GameScout: un juego bajó de precio",
    texto,
  });
};
