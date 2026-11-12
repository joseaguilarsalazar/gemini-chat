import { USUARIO_DEMO } from "../constants.js";

/**
 * Usuario de la petición. En la fase single-user es el usuario demo.
 * Cuando se active la autenticación, el middleware deja `req.usuario`.
 */
export const usuarioIdDe = (req) => req.usuario?.id ?? USUARIO_DEMO;
