import { Router } from "express";
import * as library from "../repositories/library.js";
import { vistaBiblioteca } from "../services/libraryView.js";
import { usuarioIdDe } from "../auth/context.js";

const router = Router();

const ESTADOS = new Set(["wishlist", "jugando", "terminado", "abandonado"]);

const esAppid = (valor) => Number.isInteger(valor) && valor > 0;

// -------------------------------------------------------- GET /api/biblioteca
router.get("/biblioteca", (req, res) => {
  res.json(vistaBiblioteca(usuarioIdDe(req)));
});

// ----------------------------------------------- GET /api/biblioteca/export
router.get("/biblioteca/export", (req, res) => {
  const usuarioId = usuarioIdDe(req);
  const juegos = library.listar(usuarioId);
  const formato = String(req.query.formato ?? "csv").toLowerCase();

  if (formato === "md" || formato === "markdown") {
    const lineas = [
      "# Mi biblioteca — GameScout",
      "",
      `Total: ${juegos.length} juegos`,
      "",
      "| Juego | Estado | Puntuación | Objetivo (S/) | Actual (S/) | Etiquetas |",
      "|---|---|---|---|---|---|",
      ...juegos.map(
        (j) =>
          `| ${j.nombre} | ${j.estado} | ${j.puntuacion ?? "—"} | ${
            j.precioObjetivo ?? "—"
          } | ${j.precioActual ?? "—"} | ${j.etiquetas.slice(0, 4).join(", ") || "—"} |`
      ),
    ];

    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="biblioteca-gamescout.md"');
    return res.send(lineas.join("\n"));
  }

  const campo = (valor) => `"${String(valor ?? "").replace(/"/g, '""')}"`;
  const filas = [
    ["appid", "nombre", "estado", "puntuacion", "nota", "precio_objetivo", "precio_actual", "tiempo_medio_min", "etiquetas", "agregado"],
    ...juegos.map((j) => [
      j.appid,
      j.nombre,
      j.estado,
      j.puntuacion,
      j.nota,
      j.precioObjetivo,
      j.precioActual,
      j.tiempoMedio,
      j.etiquetas.join("|"),
      j.agregado,
    ]),
  ];

  const csv = `\uFEFF${filas.map((fila) => fila.map(campo).join(",")).join("\r\n")}`;

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="biblioteca-gamescout.csv"');
  res.send(csv);
});

// ------------------------------------------------------- POST /api/biblioteca
router.post("/biblioteca", (req, res) => {
  const usuarioId = usuarioIdDe(req);
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

  library.guardar(usuarioId, {
    appid: id,
    nombre: nombre.trim().slice(0, 200),
    imagen: typeof imagen === "string" && imagen.startsWith("https://") ? imagen : null,
    estado,
    precioActual: precio,
  });

  res.status(201).json({ ok: true, juego: library.obtener(usuarioId, id), ...vistaBiblioteca(usuarioId) });
});

// -------------------------------------------------- PATCH /api/biblioteca/:appid
router.patch("/biblioteca/:appid", (req, res) => {
  const usuarioId = usuarioIdDe(req);
  const appid = Number(req.params.appid);

  if (!esAppid(appid)) {
    return res.status(400).json({ error: "El identificador del juego no es válido." });
  }
  if (!library.obtener(usuarioId, appid)) {
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

  library.actualizar(usuarioId, appid, cambios);
  res.json({ ok: true, juego: library.obtener(usuarioId, appid), ...vistaBiblioteca(usuarioId) });
});

// ------------------------------------------------- DELETE /api/biblioteca/:appid
router.delete("/biblioteca/:appid", (req, res) => {
  const usuarioId = usuarioIdDe(req);
  const appid = Number(req.params.appid);

  if (!esAppid(appid)) {
    return res.status(400).json({ error: "El identificador del juego no es válido." });
  }
  if (!library.eliminar(usuarioId, appid)) {
    return res.status(404).json({ error: "Ese juego no está en la biblioteca." });
  }
  res.status(204).end();
});

export default router;
