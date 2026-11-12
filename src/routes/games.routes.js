import { Router } from "express";
import * as prices from "../repositories/prices.js";
import * as steam from "../integrations/steam.js";

const router = Router();

// --------------------------------------- GET /api/juegos/:appid/historial
router.get("/juegos/:appid/historial", async (req, res) => {
  const appid = Number(req.params.appid);

  if (!Number.isInteger(appid) || appid <= 0) {
    return res.status(400).json({ error: "El identificador del juego no es válido." });
  }

  const dias = Math.min(Math.max(Number(req.query.dias) || 90, 7), 365);

  try {
    const ficha = await steam.detalles(appid);
    res.json({
      appid,
      nombre: ficha.nombre,
      imagen: ficha.imagen,
      moneda: "PEN",
      historial: prices.historial(appid, dias),
    });
  } catch {
    res.status(404).json({ error: "No se pudo obtener el juego." });
  }
});

export default router;
