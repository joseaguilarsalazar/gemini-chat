import { Router } from "express";
import { revisarBiblioteca } from "../services/pricing.js";
import { vistaBiblioteca } from "../services/libraryView.js";
import { getPrefs } from "../repositories/prefs.js";
import { usuarioIdDe } from "../auth/context.js";

const router = Router();

// ----------------------------------------------------------- GET /api/alertas
// Alertas actuales: juegos cuyo precio registrado ya alcanzó el objetivo.
router.get("/alertas", (req, res) => {
  const usuarioId = usuarioIdDe(req);
  const vista = vistaBiblioteca(usuarioId);
  res.json({ alertas: vista.resumen.alertas, total: vista.resumen.alertas.length });
});

// ------------------------------------------------ POST /api/alertas/revisar
// Revisa precios de la biblioteca (botón "Revisar precios" y notificaciones).
router.post("/alertas/revisar", async (req, res) => {
  const usuarioId = usuarioIdDe(req);
  const prefs = getPrefs(usuarioId);
  const limite = Math.min(Math.max(Number(req.body?.limite) || 10, 1), 20);

  try {
    const resultado = await revisarBiblioteca(usuarioId, { prefs, limite });
    res.json({
      ...resultado,
      vista: vistaBiblioteca(usuarioId),
    });
  } catch (error) {
    console.error("[alertas] error:", error.message);
    res.status(502).json({ error: "No se pudieron revisar los precios en este momento." });
  }
});

export default router;
