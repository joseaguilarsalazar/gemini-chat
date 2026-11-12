import { Router } from "express";
import * as library from "../repositories/library.js";
import { vistaBiblioteca } from "../services/libraryView.js";

const router = Router();

const ESTADOS = new Set(["wishlist", "jugando", "terminado", "abandonado"]);

const esAppid = (valor) => Number.isInteger(valor) && valor > 0;

// -------------------------------------------------------- GET /api/biblioteca
router.get("/biblioteca", (req, res) => {
  res.json(vistaBiblioteca());
});

// ------------------------------------------------------- POST /api/biblioteca
// Lo usa el botón "Agregar" de los widgets. No llama a Steam: los datos ya
// vienen en la tarjeta que el usuario está viendo.
router.post("/biblioteca", (req, res) => {
  const { appid, nombre, imagen, estado = "wishlist", precioActual = null } = req.body ?? {};
  const id = Number(appid);

  if (!esAppid(id)) {
    return res.status(400).json({ error: "El identificador del juego no es válido." });
  }
  if (typeof nombre !== "string" || nombre.trim().length === 0) {
    return res.status(400).json({ error: "Falta el nombre del juego." });
  }
  if (!ESTADOS.has(estado)) {
    return res.status(400).json({ error: "Estado inválido." });
  }

  let precio = null;
  if (precioActual !== null && precioActual !== undefined) {
    const valor = Number(precioActual);
    if (!Number.isFinite(valor) || valor < 0) {
      return res.status(400).json({ error: "El precio actual debe ser un número positivo." });
    }
    precio = valor;
  }

  library.guardar({
    appid: id,
    nombre: nombre.trim().slice(0, 200),
    imagen: typeof imagen === "string" && imagen.startsWith("https://") ? imagen : null,
    estado,
    precioActual: precio,
  });

  res.status(201).json({ ok: true, juego: library.obtener(id), ...vistaBiblioteca() });
});

// -------------------------------------------------- PATCH /api/biblioteca/:appid
router.patch("/biblioteca/:appid", (req, res) => {
  const appid = Number(req.params.appid);
  if (!esAppid(appid)) {
    return res.status(400).json({ error: "El identificador del juego no es válido." });
  }
  if (!library.obtener(appid)) {
    return res.status(404).json({ error: "Ese juego no está en la biblioteca." });
  }

  const { estado, puntuacion, nota, precioObjetivo } = req.body ?? {};
  const cambios = {};

  if (estado !== undefined) {
    if (!ESTADOS.has(estado)) return res.status(400).json({ error: "Estado inválido." });
    cambios.estado = estado;
  }

  if (puntuacion !== undefined) {
    const valor = Number(puntuacion);
    if (!Number.isInteger(valor) || valor < 1 || valor > 10) {
      return res.status(400).json({ error: "La puntuación debe ser un entero entre 1 y 10." });
    }
    cambios.puntuacion = valor;
  }

  if (nota !== undefined) {
    if (nota !== null && typeof nota !== "string") {
      return res.status(400).json({ error: "La nota debe ser texto." });
    }
    cambios.nota = nota === null ? null : nota.slice(0, 500);
  }

  if (precioObjetivo !== undefined) {
    if (precioObjetivo === null) {
      cambios.precio_objetivo = null;
    } else {
      const valor = Number(precioObjetivo);
      if (!Number.isFinite(valor) || valor < 0) {
        return res.status(400).json({ error: "El precio objetivo debe ser un número positivo." });
      }
      cambios.precio_objetivo = valor;
    }
  }

  library.actualizar(appid, cambios);
  res.json({ ok: true, juego: library.obtener(appid), ...vistaBiblioteca() });
});

// ------------------------------------------------- DELETE /api/biblioteca/:appid
router.delete("/biblioteca/:appid", (req, res) => {
  const appid = Number(req.params.appid);
  if (!esAppid(appid)) {
    return res.status(400).json({ error: "El identificador del juego no es válido." });
  }
  if (!library.eliminar(appid)) {
    return res.status(404).json({ error: "Ese juego no está en la biblioteca." });
  }
  res.status(204).end();
});

export default router;
