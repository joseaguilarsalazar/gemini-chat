import config from "../config.js";
import * as gemini from "./providers/gemini.js";
import * as deepseek from "./providers/deepseek.js";

const registro = { gemini, deepseek };

/**
 * Catálogo de proveedores para la UI. Incluye los no configurados para que el
 * usuario vea que existen, pero marcados como no disponibles.
 */
export const listarProveedores = () =>
  Object.values(registro).map((proveedor) => ({
    id: proveedor.id,
    nombre: proveedor.nombre,
    modelo: proveedor.modelo,
    modeloNombre: proveedor.modeloNombre,
    disponible: proveedor.disponible(),
    niveles: proveedor.niveles,
    nivelPorDefecto: proveedor.nivelPorDefecto,
  }));

export const obtenerProveedor = (id) => registro[id] ?? null;

export const responderCon = async ({ proveedor, ...parametros }) => {
  const motor = obtenerProveedor(proveedor);

  if (!motor) throw new Error(`Proveedor desconocido: ${proveedor}`);
  if (!motor.disponible()) throw new Error(`El proveedor ${proveedor} no está configurado.`);

  return motor.responder(parametros);
};

export const mensajeDeError = (error, proveedor = config.defaultProvider) => {
  const motor = obtenerProveedor(proveedor);
  return motor ? motor.mensajeDeError(error) : "El modelo no pudo responder.";
};
