import { GoogleGenAI } from "@google/genai";
import config from "../config.js";

let cliente;

/**
 * Cliente de Gemini creado de forma perezosa: si el usuario solo configura
 * DeepSeek, la aplicación debe poder arrancar igual.
 */
export const getGeminiClient = () => {
  if (!cliente) {
    cliente = new GoogleGenAI({ apiKey: config.gemini.apiKey });
  }
  return cliente;
};
