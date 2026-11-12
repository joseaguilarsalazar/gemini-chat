import "dotenv/config";

/**
 * Lee una variable de entorno numérica y falla al arrancar si no es válida.
 */
const number = (name, fallback) => {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`La variable de entorno ${name} debe ser un número mayor a 0.`);
  }
  return value;
};

const geminiKey = process.env.GEMINI_API_KEY?.trim() || "";
const deepseekKey = process.env.DEEPSEEK_API_KEY?.trim() || "";

if (!geminiKey && !deepseekKey) {
  throw new Error(
    "Falta una API key. Configura GEMINI_API_KEY o DEEPSEEK_API_KEY en el archivo .env."
  );
}

// Proveedor por defecto: el que pida AI_PROVIDER, o DeepSeek si está configurado.
const solicitado = process.env.AI_PROVIDER?.trim().toLowerCase();
const disponibles = [deepseekKey && "deepseek", geminiKey && "gemini"].filter(Boolean);
const defaultProvider = disponibles.includes(solicitado)
  ? solicitado
  : deepseekKey
    ? "deepseek"
    : "gemini";

const config = Object.freeze({
  defaultProvider,

  gemini: {
    apiKey: geminiKey,
    modelName: process.env.MODEL?.trim() || "gemini-3.1-flash-lite",
    // Si el modelo principal está saturado, se prueban estos en orden.
    modelFallbacks: (process.env.MODEL_FALLBACKS ?? "gemini-3.6-flash,gemini-3.7-flash")
      .split(",")
      .map((modelo) => modelo.trim())
      .filter(Boolean),
  },

  deepseek: {
    apiKey: deepseekKey,
    baseUrl: process.env.DEEPSEEK_BASE_URL?.trim() || "https://api.deepseek.com",
    model: process.env.DEEPSEEK_MODEL?.trim() || "deepseek-flash",
    effort: process.env.DEEPSEEK_EFFORT?.trim() || "medium",
    maxTokens: number("DEEPSEEK_MAX_TOKENS", 4096),
    timeoutMs: number("DEEPSEEK_TIMEOUT_MS", 120000),
  },

  host: process.env.HOST?.trim() || "0.0.0.0",
  port: number("PORT", 3000),
  dbPath: process.env.DB_PATH?.trim() || "data/chat.db",
  historyLimit: number("HISTORY_LIMIT", 20),
  maxMessageLength: number("MAX_MESSAGE_LENGTH", 4000),

  // Región e idioma usados contra la tienda de Steam (precios locales).
  steamCC: process.env.STEAM_CC?.trim() || "pe",
  steamLang: process.env.STEAM_LANG?.trim() || "spanish",

  // Tiempo máximo de espera para APIs externas (Steam, CheapShark, SteamSpy).
  httpTimeoutMs: number("HTTP_TIMEOUT_MS", 20000),
});

export default config;
