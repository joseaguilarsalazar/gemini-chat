import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import config from "./config.js";
import { listarProveedores } from "./ai/chat.js";
import { closeDb } from "./db/index.js";
import chatRoutes from "./routes/chat.routes.js";
import libraryRoutes from "./routes/library.routes.js";
import prefsRoutes from "./routes/prefs.routes.js";
import alertsRoutes from "./routes/alerts.routes.js";
import gamesRoutes from "./routes/games.routes.js";
import authRoutes from "./routes/auth.routes.js";
import { cargarUsuario, requiereUsuario } from "./auth/middleware.js";
import { iniciarVigilantePrecios } from "./jobs/priceWatcher.js";
import { limpiarSesionesExpiradas } from "./repositories/authSessions.js";
import { errorHandler, notFound } from "./middleware/errors.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");

const app = express();
app.disable("x-powered-by");

app.use(express.json({ limit: "64kb" }));
app.use("/api", cargarUsuario);

// Log de peticiones de la API (sin cuerpos ni datos personales).
app.use((req, res, next) => {
  const inicio = Date.now();
  let registrado = false;

  const registrar = () => {
    if (registrado || !req.path.startsWith("/api/")) return;
    registrado = true;
    const ms = Date.now() - inicio;
    console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${ms} ms)`);
  };

  res.on("finish", registrar);
  res.on("close", registrar);
  next();
});

app.get("/api/health", (req, res) => {
  const providers = listarProveedores();
  const actual = providers.find((p) => p.id === config.defaultProvider);

  res.json({
    status: "ok",
    provider: config.defaultProvider,
    model: actual?.modelo ?? null,
    providers,
    uptime: Math.round(process.uptime()),
  });
});

app.use("/api/auth", authRoutes);

// Todo lo demás bajo /api requiere sesión iniciada.
app.use("/api", requiereUsuario);

app.use("/api", chatRoutes);
app.use("/api", libraryRoutes);
app.use("/api", prefsRoutes);
app.use("/api", alertsRoutes);
app.use("/api", gamesRoutes);

// El frontend se sirve desde el mismo origen: no hace falta CORS.
app.use(express.static(publicDir));

app.use(notFound);
app.use(errorHandler);

const server = app.listen(config.port, config.host, () => {
  limpiarSesionesExpiradas();
  console.log(`Servidor iniciado en http://localhost:${config.port}`);
  console.log(`Proveedor por defecto: ${config.defaultProvider}`);
  for (const proveedor of listarProveedores()) {
    console.log(
      `  ${proveedor.disponible ? "[ok]" : "[--]"} ${proveedor.nombre}: ${proveedor.modeloNombre} (${proveedor.modelo})`
    );
  }
  console.log(`Base de datos: ${config.dbPath}`);
  iniciarVigilantePrecios();
});

const cerrar = (senal) => {
  console.log(`\n${senal} recibido, cerrando...`);
  server.close(() => {
    closeDb();
    process.exit(0);
  });
};

process.on("SIGINT", () => cerrar("SIGINT"));
process.on("SIGTERM", () => cerrar("SIGTERM"));

export default app;
