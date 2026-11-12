import config from "../config.js";
import { leerCookie } from "./cookies.js";
import { usuarioDeToken } from "../repositories/authSessions.js";

/** Adjunta req.usuario si hay una cookie de sesión válida. */
export const cargarUsuario = (req, res, next) => {
  const token = leerCookie(req, config.auth.cookieName);
  if (token) {
    const fila = usuarioDeToken(token);
    if (fila) {
      req.usuario = {
        id: fila.usuario_id,
        usuario: fila.usuario,
        nombre: fila.nombre,
      };
      req.tokenSesion = token;
    }
  }
  next();
};

/** Bloquea las rutas que requieren sesión iniciada. */
export const requiereUsuario = (req, res, next) => {
  if (!req.usuario) {
    return res.status(401).json({ error: "Inicia sesión para continuar." });
  }
  next();
};
