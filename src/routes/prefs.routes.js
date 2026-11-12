import { Router } from "express";
import { getPrefs, setPrefs } from "../repositories/prefs.js";
import { listarTiendas } from "../integrations/cheapshark.js";
import { MONEDAS, TIENDAS_OFICIALES } from "../constants.js";
import { usuarioIdDe } from "../auth/context.js";

const router = Router();

// ------------------------------------------------------ GET /api/preferencias
router.get("/preferencias", (req, res) => {
  const usuarioId = usuarioIdDe(req);
  res.json({
    ...getPrefs(usuarioId),
    tiendasOficiales: TIENDAS_OFICIALES,
    monedas: MONEDAS,
  });
});

// ---------------------------------------------------- PATCH /api/preferencias
router.patch("/preferencias", (req, res) => {
  const usuarioId = usuarioIdDe(req);
  const cuerpo = req.body ?? {};
  const cambios = {};

  if (cuerpo.moneda !== undefined) {
    if (!MONEDAS.includes(cuerpo.moneda)) {
      return res.status(400).json({ error: `Moneda inválida. Usa: ${MONEDAS.join(", ")}.` });
    }
    cambios.moneda = cuerpo.moneda;
  }

  if (cuerpo.soloOficiales !== undefined) {
    if (typeof cuerpo.soloOficiales !== "boolean") {
      return res.status(400).json({ error: "soloOficiales debe ser booleano." });
    }
    cambios.soloOficiales = cuerpo.soloOficiales;
  }

  if (cuerpo.tiendas !== undefined) {
    if (!Array.isArray(cuerpo.tiendas) || cuerpo.tiendas.length > 40) {
      return res.status(400).json({ error: "tiendas debe ser un arreglo de IDs." });
    }
    cambios.tiendas = cuerpo.tiendas.map(String).slice(0, 40);
  }

  if (cuerpo.notificaciones !== undefined) {
    if (typeof cuerpo.notificaciones !== "boolean") {
      return res.status(400).json({ error: "notificaciones debe ser booleano." });
    }
    cambios.notificaciones = cuerpo.notificaciones;
  }

  if (cuerpo.pc !== undefined) {
    if (typeof cuerpo.pc !== "object" || cuerpo.pc === null) {
      return res.status(400).json({ error: "pc debe ser un objeto." });
    }
    const limite = (valor) => String(valor ?? "").slice(0, 200);
    cambios.pc = {
      cpu: limite(cuerpo.pc.cpu),
      gpu: limite(cuerpo.pc.gpu),
      ram: limite(cuerpo.pc.ram),
      so: limite(cuerpo.pc.so),
    };
  }

  if (cuerpo.email !== undefined) {
    const email = String(cuerpo.email ?? "").trim();
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return res.status(400).json({ error: "El correo no es válido." });
    }
    cambios.email = email.slice(0, 160);
  }

  if (cuerpo.telegramChatId !== undefined) {
    cambios.telegramChatId = String(cuerpo.telegramChatId ?? "").trim().slice(0, 40);
  }

  res.json({
    ok: true,
    ...setPrefs(usuarioId, cambios),
    tiendasOficiales: TIENDAS_OFICIALES,
    monedas: MONEDAS,
  });
});

// ----------------------------------------------------------- GET /api/tiendas
router.get("/tiendas", async (req, res) => {
  try {
    const tiendas = await listarTiendas();
    res.json({
      tiendas: tiendas.map((tienda) => ({
        ...tienda,
        oficial: TIENDAS_OFICIALES.includes(tienda.id),
      })),
    });
  } catch (error) {
    res.status(502).json({ error: "No se pudo obtener la lista de tiendas." });
  }
});

export default router;
