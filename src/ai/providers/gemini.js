import config from "../../config.js";
import { construirSystemInstruction } from "../prompts.js";
import { getGeminiClient } from "../client.js";
import { ejecutarHerramienta, herramientas } from "../../tools/index.js";

const MAX_PASOS = 4;

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Errores temporales del lado de Google: tiene sentido reintentar. */
const esTransitorio = (error) => {
  const texto = String(error?.message ?? error);
  return /"code":\s*(429|500|502|503)|UNAVAILABLE|overloaded|high demand|deadline|ETIMEDOUT/i.test(
    texto
  );
};

export const mensajeDeError = (error) => {
  const texto = String(error?.message ?? error);

  if (esTransitorio(error)) {
    return "Gemini está saturado en este momento. Intenta de nuevo en unos segundos.";
  }
  if (/API key|api key|PERMISSION_DENIED|"code":\s*(401|403)/i.test(texto)) {
    return "La API key de Gemini no es válida o no tiene permisos para este modelo.";
  }
  if (/not found|NOT_FOUND|"code":\s*404/i.test(texto)) {
    return `El modelo "${config.gemini.modelName}" no está disponible. Revisa la variable MODEL.`;
  }
  return "Gemini no pudo responder. Intenta nuevamente.";
};

/**
 * Pide un paso al modelo y entrega los fragmentos a medida que llegan.
 * Si falla por saturación ANTES de emitir texto, reintenta con espera
 * exponencial y luego prueba los modelos de respaldo.
 */
const emitirPaso = async (contents, alFragmento, instruccion) => {
  const modelos = [config.gemini.modelName, ...config.gemini.modelFallbacks];
  let ultimoError;

  for (const modelo of modelos) {
    for (let intento = 1; intento <= 3; intento += 1) {
      let emitido = false;

      try {
        const stream = await getGeminiClient().models.generateContentStream({
          model: modelo,
          contents,
          config: {
            systemInstruction: instruccion,
            tools: [{ functionDeclarations: herramientas }],
            automaticFunctionCalling: { disable: true },
            temperature: 0.7,
          },
        });

        for await (const chunk of stream) {
          const partes = chunk.candidates?.[0]?.content?.parts ?? [];
          if (partes.length === 0) continue;
          emitido = true;
          alFragmento(partes);
        }

        return;
      } catch (error) {
        ultimoError = error;
        const puedeReintentar = !emitido && esTransitorio(error);
        if (!puedeReintentar) throw error;

        if (intento < 3) {
          const espera = 600 * 2 ** (intento - 1) + Math.round(Math.random() * 300);
          console.warn(
            `[gemini] ${modelo} no disponible (intento ${intento}/3), reintento en ${espera} ms`
          );
          await esperar(espera);
        } else if (modelo !== modelos.at(-1)) {
          console.warn(`[gemini] ${modelo} sigue saturado, probando el siguiente modelo`);
        }
      }
    }
  }

  throw ultimoError;
};

const claveLlamada = (llamada) =>
  llamada.id ?? `${llamada.name}:${JSON.stringify(llamada.args ?? {})}`;

export const responder = async ({ history, mensaje, contexto, onTexto, onWidget }) => {
  const contents = [...history, { role: "user", parts: [{ text: mensaje }] }];
  const instruccion = construirSystemInstruction(contexto?.moneda);
  const widgets = [];
  let textoCompleto = "";
  let interrumpido = false;

  for (let paso = 0; paso < MAX_PASOS; paso += 1) {
    const llamadas = [];
    const partesModelo = [];
    const claves = new Set();
    let textoPaso = "";

    await emitirPaso(
      contents,
      (partes) => {
        for (const parte of partes) {
          if (parte.functionCall) {
            const clave = claveLlamada(parte.functionCall);
            if (claves.has(clave)) continue;
            claves.add(clave);
            llamadas.push(parte.functionCall);
            partesModelo.push(parte);
            continue;
          }

          if (parte.text && !parte.thought) {
            textoPaso += parte.text;
            textoCompleto += parte.text;
            if (onTexto?.(parte.text) === false) interrumpido = true;
          }

          partesModelo.push(parte);
        }
      },
      instruccion
    );

    if (partesModelo.length > 0) {
      contents.push({ role: "model", parts: partesModelo });
    }

    if (interrumpido || llamadas.length === 0) {
      return { texto: textoCompleto, widgets };
    }

    const respuestas = [];

    for (const llamada of llamadas) {
      const { respuesta, widgets: nuevos } = await ejecutarHerramienta(
        llamada.name,
        llamada.args ?? {},
        contexto
      );

      for (const widget of nuevos) {
        widgets.push(widget);
        onWidget?.(widget);
      }

      respuestas.push({
        functionResponse: { name: llamada.name, response: respuesta },
      });
    }

    contents.push({ role: "user", parts: respuestas });
  }

  console.warn(`[gemini] se alcanzó el máximo de ${MAX_PASOS} pasos de herramientas`);
  return { texto: textoCompleto, widgets };
};

export const id = "gemini";
export const nombre = "Gemini";
export const modelo = config.gemini.modelName;
export const modeloNombre = config.gemini.modelName
  .split("-")
  .map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1))
  .join(" ");
export const niveles = [];
export const nivelPorDefecto = null;
export const disponible = () => Boolean(config.gemini.apiKey);
