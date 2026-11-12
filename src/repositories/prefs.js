import { db } from "../db/index.js";
import { MONEDAS, TIENDAS_OFICIALES } from "../constants.js";

const asegurar = db.prepare(`
  INSERT INTO preferencias (usuario_id)
  VALUES (?)
  ON CONFLICT (usuario_id) DO NOTHING
`);

const obtener = db.prepare(`
  SELECT usuario_id, moneda, solo_oficiales, tiendas, notificaciones,
         pc_cpu, pc_gpu, pc_ram, pc_so, email, telegram_chat_id, actualizado
  FROM preferencias
  WHERE usuario_id = ?
`);

const actualizar = db.prepare(`
  UPDATE preferencias
  SET moneda = ?, solo_oficiales = ?, tiendas = ?, notificaciones = ?,
      pc_cpu = ?, pc_gpu = ?, pc_ram = ?, pc_so = ?, email = ?,
      telegram_chat_id = ?, actualizado = datetime('now')
  WHERE usuario_id = ?
`);

const parsearTiendas = (texto) => {
  if (!texto) return [];
  try {
    const datos = JSON.parse(texto);
    return Array.isArray(datos) ? datos.map(String) : [];
  } catch {
    return [];
  }
};

const mapear = (fila) => ({
  moneda: MONEDAS.includes(fila.moneda) ? fila.moneda : "PEN",
  soloOficiales: Boolean(fila.solo_oficiales),
  tiendas: parsearTiendas(fila.tiendas),
  notificaciones: Boolean(fila.notificaciones),
  pc: {
    cpu: fila.pc_cpu ?? "",
    gpu: fila.pc_gpu ?? "",
    ram: fila.pc_ram ?? "",
    so: fila.pc_so ?? "",
  },
  email: fila.email ?? "",
  telegramChatId: fila.telegram_chat_id ?? "",
  actualizado: fila.actualizado,
});

export const getPrefs = (usuarioId) => {
  asegurar.run(usuarioId);
  return mapear(obtener.get(usuarioId));
};

/** Cambios ya validados por la ruta. Los ausentes conservan su valor. */
export const setPrefs = (usuarioId, cambios = {}) => {
  const actual = getPrefs(usuarioId);

  const moneda = MONEDAS.includes(cambios.moneda) ? cambios.moneda : actual.moneda;
  const soloOficiales =
    typeof cambios.soloOficiales === "boolean" ? cambios.soloOficiales : actual.soloOficiales;
  const tiendas =
    Array.isArray(cambios.tiendas) ? cambios.tiendas.map(String) : actual.tiendas;
  const notificaciones =
    typeof cambios.notificaciones === "boolean" ? cambios.notificaciones : actual.notificaciones;

  const pc = { ...actual.pc, ...(cambios.pc ?? {}) };
  const email = typeof cambios.email === "string" ? cambios.email : actual.email;
  const telegramChatId =
    typeof cambios.telegramChatId === "string" ? cambios.telegramChatId : actual.telegramChatId;

  actualizar.run(
    moneda,
    soloOficiales ? 1 : 0,
    JSON.stringify(tiendas),
    notificaciones ? 1 : 0,
    pc.cpu ?? "",
    pc.gpu ?? "",
    pc.ram ?? "",
    pc.so ?? "",
    email,
    telegramChatId,
    usuarioId
  );

  return getPrefs(usuarioId);
};

/** IDs de tiendas que el usuario acepta en ofertas y comparativas. */
export const tiendasPermitidas = (prefs) => {
  if (prefs.soloOficiales) return TIENDAS_OFICIALES;
  if (prefs.tiendas.length > 0) return prefs.tiendas;
  return null;
};
