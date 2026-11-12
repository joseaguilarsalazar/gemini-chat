import config from "../config.js";

export const leerCookie = (req, nombre) => {
  const raw = req.headers.cookie;
  if (!raw) return null;

  for (const parte of raw.split(";")) {
    const indice = parte.indexOf("=");
    if (indice === -1) continue;
    const clave = parte.slice(0, indice).trim();
    if (clave !== nombre) continue;
    return decodeURIComponent(parte.slice(indice + 1).trim());
  }

  return null;
};

const atributos = (req, extra = "") => {
  const seguro = config.auth.cookieSecure || req.secure ? "; Secure" : "";
  return `Path=/; HttpOnly; SameSite=Lax${seguro}${extra}`;
};

export const ponerCookieSesion = (req, res, token) => {
  const maxAge = config.auth.sessionDays * 24 * 60 * 60;
  res.setHeader(
    "Set-Cookie",
    `${config.auth.cookieName}=${token}; ${atributos(req, `; Max-Age=${maxAge}`)}`
  );
};

export const borrarCookieSesion = (req, res) => {
  res.setHeader(
    "Set-Cookie",
    `${config.auth.cookieName}=; ${atributos(req, "; Max-Age=0")}`
  );
};
