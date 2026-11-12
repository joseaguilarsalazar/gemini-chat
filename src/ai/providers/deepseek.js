import config from "../../config.js";
import { systemInstruction } from "../prompts.js";
import { ejecutarHerramienta } from "../../tools/index.js";
import { herramientasOpenAI } from "../../tools/openai.js";

const MAX_PASOS = 4;

// La API anuncia low/high/max, pero acepta "medium" como nivel intermedio.
const NIVELES = ["low", "medium", "high", "max"];
const NOMBRES_MODELO = {
  "deepseek-flash": "DeepSeek V4.1 Flash",
  "deepseek-v4-pro": "DeepSeek V4 Pro",
};

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const esTransitorio = (error) => {
  const status = Number(error?.status);
  if ([429, 500, 502, 503, 504].includes(status)) return true;
  return /overloaded|high demand|timeout|ETIMEDOUT|fetch failed|socket hang up/i.test(
    String(error?.message ?? error)
  );
};

export const mensajeDeError = (error) => {
  const status = Number(error?.status);

  if (status === 401 || status === 403) {
    return "La API key de DeepSeek no es válida o no tiene permisos.";
  }
  if (status === 402) {
    return "La cuenta de DeepSeek no tiene saldo disponible.";
  }
  if (status === 429) {
    return "DeepSeek está limitando las solicitudes. Intenta de nuevo en unos segundos.";
  }
  if (status >= 500 || esTransitorio(error)) {
    return "DeepSeek está saturado en este momento. Intenta de nuevo en unos segundos.";
  }
  return "DeepSeek no pudo responder. Intenta nuevamente.";
};

const parsearArgumentos = (texto) => {
  try {
    return JSON.parse(texto || "{}");
  } catch {
    return {};
  }
};

/** Convierte el historial interno (formato Gemini) a mensajes OpenAI. */
const aMensajes = (history, mensaje) => [
  { role: "system", content: systemInstruction },
  ...history.map((turno) => ({
    role: turno.role === "model" ? "assistant" : "user",
    content: turno.parts.map((parte) => parte.text).join("\n"),
  })),
  { role: "user", content: mensaje },
];

const errorHttp = async (respuesta) => {
  let detalle = `HTTP ${respuesta.status}`;
  try {
    const cuerpo = await respuesta.json();
    detalle = cuerpo?.error?.message || detalle;
  } catch {
    // Sin cuerpo JSON: nos quedamos con el código.
  }
  const error = new Error(detalle);
  error.status = respuesta.status;
  return error;
};

/**
 * Una llamada de streaming a DeepSeek.
 * Devuelve el texto del paso y las funciones que pidió el modelo.
 */
const unaVez = async ({ messages, nivel, onTexto }) => {
  let emitido = false;

  try {
    const respuesta = await fetch(`${config.deepseek.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.deepseek.apiKey}`,
      },
      body: JSON.stringify({
        model: config.deepseek.model,
        messages,
        tools: herramientasOpenAI,
        tool_choice: "auto",
        stream: true,
        effort: nivel,
        temperature: 0.7,
        max_tokens: config.deepseek.maxTokens,
      }),
      signal: AbortSignal.timeout(config.deepseek.timeoutMs),
    });

    if (!respuesta.ok) throw await errorHttp(respuesta);
    if (!respuesta.body) throw new Error("DeepSeek devolvió una respuesta vacía.");

    const lector = respuesta.body.pipeThrough(new TextDecoderStream()).getReader();
    const llamadas = new Map();
    let buffer = "";
    let texto = "";
    let interrumpido = false;

    const procesarLinea = (linea) => {
      if (!linea.startsWith("data:")) return;

      const payload = linea.slice(5).trim();
      if (!payload || payload === "[DONE]") return;

      let evento;
      try {
        evento = JSON.parse(payload);
      } catch {
        return;
      }

      const choice = evento.choices?.[0];
      const delta = choice?.delta ?? {};

      if (delta.content) {
        emitido = true;
        texto += delta.content;
        if (onTexto?.(delta.content) === false) interrumpido = true;
      }

      for (const fragmento of delta.tool_calls ?? []) {
        emitido = true;
        const indice = fragmento.index ?? 0;
        const actual = llamadas.get(indice) ?? { id: "", name: "", argsRaw: "" };

        if (fragmento.id) actual.id = fragmento.id;
        if (fragmento.function?.name) actual.name = fragmento.function.name;
        if (fragmento.function?.arguments) actual.argsRaw += fragmento.function.arguments;

        llamadas.set(indice, actual);
      }
    };

    while (!interrumpido) {
      const { value, done } = await lector.read();
      if (done) break;

      buffer += value;
      const lineas = buffer.split("\n");
      buffer = lineas.pop() ?? "";

      for (const linea of lineas) procesarLinea(linea);
    }

    if (buffer) procesarLinea(buffer);
    if (interrumpido) await lector.cancel().catch(() => {});

    const peticiones = [...llamadas.values()]
      .filter((llamada) => llamada.name)
      .map((llamada, indice) => ({
        id: llamada.id || `call_${Date.now()}_${indice}`,
        name: llamada.name,
        argsRaw: llamada.argsRaw || "{}",
        args: parsearArgumentos(llamada.argsRaw),
      }));

    return { texto, llamadas: peticiones, interrumpido };
  } catch (error) {
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      const timeout = new Error("DeepSeek tardó demasiado en responder.");
      timeout.status = 504;
      timeout.emitido = emitido;
      throw timeout;
    }
    error.emitido = emitido;
    throw error;
  }
};

const emitirPaso = async (parametros) => {
  let ultimoError;

  for (let intento = 1; intento <= 3; intento += 1) {
    try {
      return await unaVez(parametros);
    } catch (error) {
      ultimoError = error;
      if (error.emitido || intento === 3 || !esTransitorio(error)) throw error;

      const espera = 600 * 2 ** (intento - 1) + Math.round(Math.random() * 250);
      console.warn(`[deepseek] error transitorio (intento ${intento}/3), reintento en ${espera} ms`);
      await esperar(espera);
    }
  }

  throw ultimoError;
};

export const responder = async ({
  history,
  mensaje,
  nivel = config.deepseek.effort,
  onTexto,
  onWidget,
}) => {
  const messages = aMensajes(history, mensaje);
  const widgets = [];
  let textoCompleto = "";
  let interrumpido = false;

  for (let paso = 0; paso < MAX_PASOS; paso += 1) {
    const resultado = await emitirPaso({ messages, nivel, onTexto });
    textoCompleto += resultado.texto;
    if (resultado.interrumpido) interrumpido = true;

    if (interrumpido || resultado.llamadas.length === 0) {
      return { texto: textoCompleto, widgets };
    }

    messages.push({
      role: "assistant",
      content: resultado.texto || null,
      tool_calls: resultado.llamadas.map((llamada) => ({
        id: llamada.id,
        type: "function",
        function: { name: llamada.name, arguments: llamada.argsRaw },
      })),
    });

    for (const llamada of resultado.llamadas) {
      const { respuesta, widgets: nuevos } = await ejecutarHerramienta(
        llamada.name,
        llamada.args
      );

      for (const widget of nuevos) {
        widgets.push(widget);
        onWidget?.(widget);
      }

      messages.push({
        role: "tool",
        tool_call_id: llamada.id,
        content: JSON.stringify(respuesta),
      });
    }
  }

  console.warn(`[deepseek] se alcanzó el máximo de ${MAX_PASOS} pasos de herramientas`);
  return { texto: textoCompleto, widgets };
};

export const id = "deepseek";
export const nombre = "DeepSeek";
export const modelo = config.deepseek.model;
export const modeloNombre = NOMBRES_MODELO[config.deepseek.model] ?? config.deepseek.model;
export const niveles = NIVELES;
export const nivelPorDefecto = NIVELES.includes(config.deepseek.effort)
  ? config.deepseek.effort
  : "medium";
export const disponible = () => Boolean(config.deepseek.apiKey);
