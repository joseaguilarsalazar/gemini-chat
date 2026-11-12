import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const LONGITUD_HASH = 64;

export const hashPassword = (password) => {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(String(password), salt, LONGITUD_HASH).toString("hex");
  return { hash, salt };
};

export const verifyPassword = (password, hash, salt) => {
  if (!hash || !salt) return false;

  const esperado = Buffer.from(hash, "hex");
  if (esperado.length !== LONGITUD_HASH) return false;

  const prueba = scryptSync(String(password), salt, LONGITUD_HASH);
  return timingSafeEqual(esperado, prueba);
};
