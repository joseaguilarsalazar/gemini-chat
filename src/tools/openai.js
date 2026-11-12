import { declaracionesHerramientas } from "./definitions.js";

/**
 * Nuestras declaraciones usan el formato de Gemini (`Type.OBJECT`, etc.).
 * DeepSeek (compatible con OpenAI) espera JSON Schema en minúsculas.
 */
const convertirEsquema = (esquema) => {
  if (!esquema || typeof esquema !== "object") return esquema;

  const salida = { ...esquema };

  if (salida.type) salida.type = String(salida.type).toLowerCase();
  if (salida.items) salida.items = convertirEsquema(salida.items);
  if (salida.properties) {
    salida.properties = Object.fromEntries(
      Object.entries(salida.properties).map(([clave, valor]) => [clave, convertirEsquema(valor)])
    );
  }

  return salida;
};

export const herramientasOpenAI = declaracionesHerramientas.map((declaracion) => ({
  type: "function",
  function: {
    name: declaracion.name,
    description: declaracion.description,
    parameters: convertirEsquema(declaracion.parameters),
  },
}));
