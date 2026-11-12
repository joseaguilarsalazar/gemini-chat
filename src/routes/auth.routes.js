import { Router } from "express";
import { randomUUID } from "node:crypto";
import {
  buscarCredencialesPorUsuario,
  buscarPorUsuario,
  contarUsuarios,
  crearUsuario,
  reclamarDatosAnonimos,
  reclamarDatosDemo,
} from "../repositories/users.js";
import { getPrefs } from "../repositories/prefs.js";
import { crearSesionWeb, eliminarSesionWeb } from "../repositories/authSessions.js";
import { hashPassword, verifyPassword } from "../auth/passwords.js";
import { borrarCookieSesion, ponerCookieSesion, leerCookie } from "../auth/cookies.js";
import config from "../config.js";

const router = Router();

const USUARIO_RE = /^[a-zA-Z0-9_.-]{3,24}$/;
const intentos = new Map();
const VENTANA = 5 * 60 * 1000;
const MAX_INTENTOS = 12;

const limitado = (ip) => {
  const ahora = Date.now();
  const registro = intentos.get(ip) ?? { total: 0, inicio: ahora };

  if (ahora - registro.inicio > VENTANA) {
    registro.total = 0;
    registro.inicio = ahora;
  }

  registro.total += 1;
  intentos.set(ip, registro);
  return registro.total > MAX_INTENTOS;
};

const respuestaSesion = (usuario) => ({
  autenticado: true,
  usuario: {
    id: usuario.id ?? usuario.usuario_id,
    usuario: usuario.usuario,
    nombre: usuario.nombre,
  },
  prefs: getPrefs(usuario.id ?? usuario.usuario_id),
});

// --------------------------------------------------------------- GET /api/auth/yo
router.get("/yo", (req, res) => {
  if (!req.usuario) {
    return res.json({
      autenticado: false,
      hayUsuarios: contarUsuarios() > 0,
    });
  }

  res.json(respuestaSesion(req.usuario));
});

// --------------------------------------------------------- POST /api/auth/registro
router.post("/registro", (req, res) => {
  const { usuario, nombre, password } = req.body ?? {};

  if (typeof usuario !== "string" || !USUARIO_RE.test(usuario.trim())) {
    return res.status(400).json({
      error: "El usuario debe tener entre 3 y 24 caracteres (letras, números, ., _, -).",
    });
  }

  if (typeof password !== "string" || password.length < 6 || password.length > 100) {
    return res.status(400).json({ error: "La contraseña debe tener entre 6 y 100 caracteres." });
  }

  const usuarioNormalizado = usuario.trim().toLowerCase();
  if (buscarPorUsuario(usuarioNormalizado)) {
    return res.status(409).json({ error: "Ese usuario ya existe. Elige otro." });
  }

  const nombreFinal =
    typeof nombre === "string" && nombre.trim() ? nombre.trim().slice(0, 60) : usuarioNormalizado;

  const { hash, salt } = hashPassword(password);
  const id = randomUUID();

  try {
    crearUsuario({
      id,
      usuario: usuarioNormalizado,
      nombre: nombreFinal,
      hash,
      salt,
    });
  } catch {
    return res.status(409).json({ error: "Ese usuario ya existe. Elige otro." });
  }

  // El primer usuario real hereda los datos de la fase sin autenticación.
  if (contarUsuarios() === 1) {
    reclamarDatosAnonimos(id);
    reclamarDatosDemo(id);
  }

  const token = crearSesionWeb(id);
  ponerCookieSesion(req, res, token);

  res.status(201).json(respuestaSesion({ id, usuario: usuarioNormalizado, nombre: nombreFinal }));
});

// ------------------------------------------------------------ POST /api/auth/login
router.post("/login", (req, res) => {
  const ip = req.ip ?? "local";
  if (limitado(ip)) {
    return res.status(429).json({ error: "Demasiados intentos. Espera unos minutos." });
  }

  const { usuario, password } = req.body ?? {};
  if (typeof usuario !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "Indica usuario y contraseña." });
  }

  const encontrado = buscarCredencialesPorUsuario(usuario.trim().toLowerCase());

  if (!encontrado || !verifyPassword(password, encontrado.hash, encontrado.salt)) {
    return res.status(401).json({ error: "Usuario o contraseña incorrectos." });
  }

  const token = crearSesionWeb(encontrado.id);
  ponerCookieSesion(req, res, token);

  res.json(
    respuestaSesion({
      id: encontrado.id,
      usuario: encontrado.usuario,
      nombre: encontrado.nombre,
    })
  );
});

// ----------------------------------------------------------- POST /api/auth/logout
router.post("/logout", (req, res) => {
  const token = req.tokenSesion ?? leerCookie(req, config.auth.cookieName);
  if (token) eliminarSesionWeb(token);
  borrarCookieSesion(req, res);
  res.status(204).end();
});

export default router;
