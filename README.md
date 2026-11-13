# GameScout

Asistente de videojuegos con **precios reales de Steam en Perú**, comparación entre tiendas,
ofertas, noticias y una **biblioteca personal con alertas de precio**.

No es "un modelo + un prompt": el motor de IA usa **function calling** para consultar APIs reales y
cada resultado se renderiza como un **widget interactivo** dentro del chat (tarjetas de juego,
tabla de precios, ofertas, noticias y panel de biblioteca).

Además, puedes **cambiar entre DeepSeek y Gemini** desde la cabecera del chat, sin perder la
conversación ni la biblioteca.

> Versión consolidada y ampliada de los ejercicios `ejemplito1` … `ejemplito10` del Taller de Software.

---

## Características

- **Precios locales**: Steam consultado con `cc=pe`, precios en soles (S/).
- **Dos motores conmutables**: DeepSeek V4.1 Flash (por defecto, nivel medio) y Gemini.
  La preferencia se guarda en el navegador y cada respuesta indica qué motor la generó.
- **Ofertas de tu biblioteca**: revisa los juegos guardados y muestra solo ofertas que
  realmente sean más baratas que Steam.
- **Revisión de precios y alertas**: actualiza el precio actual, detecta cuando un juego
  baja de tu objetivo y avisa en el panel.
- **Juegos similares y juegos cortos**: recomendaciones por etiquetas y filtro por duración.
- **Filtros de catálogo**: por idioma (español/audio), edad recomendada y presupuesto.
- **Tráilers y capturas** dentro del chat, con reproductor HLS.
- **Próximos lanzamientos** y **más jugados ahora**.
- **Selector de moneda** (PEN/USD/EUR) que se aplica a los precios del chat.
- **Exportación de la biblioteca** en CSV o Markdown.
- **Comparador de 2–3 juegos** con precio, reseñas, duración y mínimo histórico.
- **Análisis de biblioteca**: valor, ahorro objetivo, etiquetas favoritas y horas de backlog.
- **¿Corre en mi PC?**: requisitos de Steam frente a las specs guardadas.
- **Planificador de fin de semana** y **ruleta del backlog**.
- **DLC y ediciones** con precios.
- **Resumen diario** con alertas, ofertas, novedades y próximos lanzamientos.
- **Notificaciones del navegador** cuando un deseo alcanza su precio objetivo.
- **Ajustes**: moneda, tiendas preferidas, especificaciones del PC y canales de aviso.
- **Cuentas locales**: registro e inicio de sesión con contraseña (scrypt) y sesión por cookie;
  cada usuario tiene su propia biblioteca, conversaciones y preferencias.
- **Historial de precios propio** con gráfico SVG y recomendación de compra.
- **Vigilante de precios** en segundo plano: revisa los deseados cada 6 horas y registra snapshots.
- **Alertas por Telegram o correo** (opcionales) cuando un juego alcanza su precio objetivo.
- **Compatibilidad con Steam Deck** integrada en la ficha y en los requisitos.
- **Resumen de reseñas**: porcentaje positivo, total, Metacritic y enlace a Steam.
- **Comparación entre tiendas**: CheapShark aporta ofertas de ~35 tiendas en dólares y el mínimo histórico,
  con conversión referencial a soles.
- **Ofertas del momento** filtradas por descuento y precio máximo.
- **Descubrimiento por etiqueta** (roguelike, story rich, co-op, souls-like…) y **tendencias** de Steam.
- **Noticias y anuncios** de cualquier juego.
- **Biblioteca personal** en SQLite: deseados, jugando, terminados y abandonados; puntuación, notas,
  precio objetivo y **alertas** cuando el precio actual baja del objetivo.
- **Widgets interactivos**: agregar a la biblioteca, cambiar estado, fijar precio objetivo o quitar
  sin escribir otro mensaje.
- **Streaming SSE** token por token, con botón Detener.
- **Conversaciones persistidas** (texto + widgets) que se restauran al recargar.
- **Resiliencia**: reintentos con espera exponencial, modelos de respaldo y timeouts configurables.

## Requisitos

- Node.js 20 o superior
- Al menos **una** API key:
  - DeepSeek: https://platform.deepseek.com/api_keys
  - Google AI Studio: https://aistudio.google.com/apikey

Las APIs de Steam, CheapShark y SteamSpy **no requieren clave**.

## Puesta en marcha

```bash
npm install
cp .env.example .env      # Windows: copy .env.example .env
# edita .env y coloca DEEPSEEK_API_KEY y/o GEMINI_API_KEY
npm start
```

Abre http://localhost:3000

La primera vez verás la pantalla de **crear cuenta**. Registra un usuario y tus datos
(biblioteca, conversaciones y preferencias) quedarán asociados a esa cuenta.

> **Windows:** si PowerShell bloquea `npm` por la política de ejecución de scripts,
> usa `npm.cmd` (`npm.cmd install`, `npm.cmd start`).

Prueba cualquiera de estas frases:

- `¿Cuánto cuesta Hades en Perú y dónde está más barato?`
- `¿Qué juegos están en oferta hoy?`
- `Recomiéndame un roguelike`
- `Muéstrame mi biblioteca`

## Docker

El proyecto incluye `Dockerfile` y `docker-compose.yml` con una imagen multi-stage
(Node 24 + Debian slim) y un volumen para la base de datos.

```bash
cp .env.example .env      # Windows: copy .env.example .env
# edita .env y coloca tus API keys
docker compose up --build -d
```

Abre http://localhost:3000. La primera vez verás la pantalla de **crear cuenta**.

```bash
docker compose ps          # estado y healthcheck
docker compose logs -f     # logs en vivo
docker compose down        # detener (conserva la base)
```

- La base de datos vive en el volumen **`gamescout-data`** y sobrevive a
  `docker compose down`.
- Para borrar también la base: `docker compose down -v` (irreversible).
- Si el puerto 3000 está ocupado, cambia `PORT=3001` en `.env`; el contenedor
  seguirá escuchando en 3000 y Docker mapeará `3001:3000`.
- El contenedor corre como usuario `node` (no root) y tiene
  `no-new-privileges` habilitado.
- `better-sqlite3` se compila en la etapa de build; la imagen final no incluye
  compiladores.
- Para reconstruir tras cambiar dependencias: `docker compose build --no-cache`.

## Variables de entorno

| Variable | Por defecto | Descripción |
|---|---|---|
| `GEMINI_API_KEY` | — (opcional) | Clave de Google AI Studio |
| `MODEL` | `gemini-3.1-flash-lite` | Modelo de Gemini |
| `MODEL_FALLBACKS` | `gemini-3.6-flash,gemini-3.7-flash` | Modelos de respaldo si Gemini está saturado |
| `DEEPSEEK_API_KEY` | — (opcional) | Clave de DeepSeek |
| `DEEPSEEK_MODEL` | `deepseek-flash` | Modelo de DeepSeek (V4.1 Flash) |
| `DEEPSEEK_EFFORT` | `medium` | Nivel por defecto: `low`, `medium`, `high`, `max` |
| `DEEPSEEK_MAX_TOKENS` | `4096` | Tokens máximos por respuesta |
| `DEEPSEEK_TIMEOUT_MS` | `120000` | Timeout del stream de DeepSeek |
| `AI_PROVIDER` | `deepseek` si hay clave; si no, `gemini` | Motor inicial |
| `HOST` / `PORT` | `0.0.0.0` / `3000` | Servidor |
| `DB_PATH` | `data/chat.db` | Archivo SQLite |
| `HISTORY_LIMIT` | `20` | Mensajes previos enviados como contexto |
| `MAX_MESSAGE_LENGTH` | `4000` | Límite por mensaje |
| `STEAM_CC` / `STEAM_LANG` | `pe` / `spanish` | Región e idioma de la tienda (precios en soles) |
| `HTTP_TIMEOUT_MS` | `20000` | Timeout de las APIs externas |
| `SESSION_DAYS` | `30` | Duración de la sesión de login |
| `COOKIE_SECURE` | `false` | Marcar la cookie como Secure (usar con HTTPS) |
| `PRICE_CHECK_INTERVAL_MS` | `21600000` | Frecuencia del vigilante de precios (6 h) |
| `PRICE_CHECK_LIMIT` | `10` | Juegos revisados por usuario y pasada |
| `PRICE_CHECK_DISABLED` | `false` | Desactiva el vigilante en desarrollo |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | — | Alertas por Telegram (opcional) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_FROM` | — | Alertas por correo (opcional) |
| `SMTP_USER` / `SMTP_PASS` / `SMTP_SECURE` | — | Credenciales SMTP |
| `APP_URL` | `http://localhost:3000` | Enlace incluido en las notificaciones |

## Cómo funciona

```
Usuario
  │  POST /api/chat  { mensaje, sesionId, proveedor, nivel }
  ▼
Express ──► Motor elegido (DeepSeek V4.1 Flash | Gemini)
  │            │
  │            └─► function calling: buscar_juegos / comparar_precios / ...
  │                        │
  │                        ├─► Steam Store API      (búsqueda, ficha, precios S/)
  │                        ├─► CheapShark API       (35 tiendas, ofertas, histórico)
  │                        ├─► SteamSpy API         (etiquetas, reseñas, jugadores)
  │                        ├─► Steam News API       (noticias)
  │                        └─► SQLite               (biblioteca)
  │
  ├─ SSE: {"type":"meta"} → {"type":"widget"} → {"type":"chunk"} → {"type":"done"}
  │
  └─ Guarda el turno: texto + widgets + motor/nivel en una transacción
```

El bucle de herramientas permite hasta 4 pasos: el modelo puede buscar, luego comparar precios,
luego agregar a la biblioteca, y recién después redactar la respuesta final.

### Motores de IA

| Motor | Modelo | Niveles | Notas |
|---|---|---|---|
| **DeepSeek** (por defecto) | `deepseek-flash` (V4.1 Flash) | `low`, `medium`, `high`, `max` | Contexto de 1M; `medium` por defecto |
| **Gemini** | `gemini-3.1-flash-lite` | — | Respaldos `gemini-3.6/3.7-flash` ante saturación |

La API de DeepSeek anuncia `low/high/max` y acepta `medium` como nivel intermedio; la aplicación
lo usa por defecto, tal como se pidió. El selector de la cabecera guarda la preferencia en
`localStorage` y cada mensaje se guarda con el motor y nivel usados para mostrarlos bajo la respuesta.

Ambos motores comparten las mismas herramientas y widgets: DeepSeek usa streaming compatible con
OpenAI y acumula los `tool_calls` por índice; Gemini usa `functionDeclarations` nativos.

### Herramientas disponibles

| Herramienta | Qué hace | Fuente |
|---|---|---|
| `buscar_juegos` | Busca por título y devuelve precios en soles | Steam |
| `detalles_juego` | Ficha, géneros, etiquetas, reseñas, fecha | Steam + SteamSpy |
| `comparar_precios` | Otras tiendas, mejor oferta y mínimo histórico | Steam + CheapShark |
| `ofertas` | Mejores descuentos con filtros | CheapShark |
| `tendencias` | Más vendidos y novedades | Steam |
| `descubrir_por_etiqueta` | Juegos populares por género/etiqueta | SteamSpy |
| `noticias_juego` | Anuncios y parches recientes | Steam News |
| `ver_biblioteca` | Lista la biblioteca completa | SQLite |
| `resumen_biblioteca` | Estadísticas y alertas de precio | SQLite |
| `agregar_a_biblioteca` | Agrega un juego (opcional: precio objetivo, nota) | SQLite + Steam |
| `actualizar_juego_biblioteca` | Estado, puntuación, nota, precio objetivo | SQLite |
| `quitar_de_biblioteca` | Elimina un juego | SQLite |
| `ofertas_de_mi_biblioteca` | Ofertas en otras tiendas para tus juegos guardados | Biblioteca + CheapShark |
| `revisar_alertas` | Revisa precios, actualiza la biblioteca y detecta objetivos | Biblioteca + CheapShark + Steam |
| `juegos_similares` | Recomienda por etiquetas de un juego, excluyendo los que ya tienes | SteamSpy + Steam |
| `juegos_cortos` | Populares y bien valorados de pocas horas | SteamSpy |
| `trailers_juego` | Tráilers y capturas | Steam appdetails |
| `filtrar_catalogo` | Filtra por idioma, edad máxima y precio | Steam + SteamSpy |
| `proximos_lanzamientos` | Calendario de próximos estrenos | Steam featuredcategories |
| `mas_jugados` | Ranking por jugadores concurrentes | SteamSpy |
| `comparar_juegos` | Compara 2–3 juegos lado a lado | Steam + SteamSpy + CheapShark |
| `analisis_biblioteca` | Valor, backlog, etiquetas y promedio | Biblioteca + SteamSpy |
| `requisitos_pc` | Requisitos mínimos/recomendados + specs del usuario | Steam appdetails |
| `plan_finde` | Plan de juegos según horas y género | Biblioteca + SteamSpy |
| `ruleta_backlog` | Elige un juego al azar de la biblioteca | Biblioteca + Steam |
| `dlc_juego` | DLC y ediciones con precios | Steam appdetails |
| `resumen_diario` | Alertas, ofertas, noticias y lanzamientos | Todas las anteriores |
| `historial_precios` | Snapshots propios + recomendación de compra | SQLite + Steam |
| `resenas_juego` | Resumen de reseñas y enlace a Steam | SteamSpy + Steam |

### Widgets

| Widget | Contenido | Acciones |
|---|---|---|
| `lista_juegos` | Grilla de tarjetas con portada, precio y descuento | Agregar a biblioteca, ver en Steam |
| `tarjeta_juego` | Ficha grande con descripción, métricas y etiquetas | Agregar, ver en Steam |
| `tabla_precios` | Steam S/, otras tiendas US$ + S/ aproximados, mínimo histórico | Ir a la tienda |
| `noticias` | Titulares con fecha y resumen | Abrir noticia |
| `biblioteca` | Estadísticas + filas con estado, nota y alertas | Cambiar estado, precio objetivo, quitar, refrescar |
| `media` | Reproductor de tráiler (HLS) + galería de capturas | Ver tráiler, abrir captura |
| `comparativa` | Tabla lado a lado de 2–3 juegos | — |
| `analisis` | Estadísticas y barras de etiquetas favoritas | — |
| `requisitos` | Requisitos de Steam + especificaciones del usuario | — |
| `dlc` | DLCs y ediciones con precios | — |
| `plan` | Juegos elegidos para el tiempo disponible | — |
| `digest` | Alertas, ofertas, noticias, próximos y oferta del día | Abrir enlaces |
| `historial` | Gráfico SVG del historial de precios y recomendación | — |
| `resenas` | Barra de positivas/negativas, total y Metacritic | Abrir reseñas en Steam |

Los widgets guardados con el mensaje se reconstruyen al abrir una conversación antigua; los
paneles de biblioteca se refrescan con el estado actual de la base de datos.

## Estructura

```
gemini-chat/
├─ src/
│  ├─ server.js                 # Express, estáticos, arranque/cierre
│  ├─ config.js                 # entorno validado (falla rápido)
│  ├─ ai/
│  │  ├─ client.js              # cliente perezoso de Gemini
│  │  ├─ chat.js                # registro y despacho de proveedores
│  │  ├─ providers/
│  │  │  ├─ deepseek.js         # streaming + tool calls (OpenAI compatible)
│  │  │  └─ gemini.js           # streaming + function calling nativo
│  │  └─ prompts.js             # persona y reglas de GameScout
│  ├─ integrations/
│  │  ├─ http.js                # fetch con timeout y caché en memoria
│  │  ├─ steam.js               # tienda, precios PEN, destacados, noticias
│  │  ├─ cheapshark.js          # ofertas e histórico multi-tienda (USD)
│  │  ├─ steamspy.js            # etiquetas, reseñas, descubrimiento
│  │  └─ currency.js            # USD → PEN
│  ├─ tools/
│  │  ├─ definitions.js         # declaraciones de funciones (formato Gemini)
│  │  ├─ openai.js              # conversión a JSON Schema para DeepSeek
│  │  ├─ juegos.js              # herramientas de catálogo y precios
│  │  ├─ biblioteca.js          # herramientas de biblioteca
│  │  ├─ extras.js              # comparador, análisis, plan, DLC, historial…
│  │  └─ index.js               # registro y ejecución tolerante a errores
│  ├─ repositories/
│  │  ├─ users.js               # cuentas
│  │  ├─ authSessions.js        # sesiones web
│  │  ├─ prefs.js               # moneda, tiendas, PC y canales
│  │  ├─ sessions.js
│  │  ├─ messages.js            # turnos + widgets
│  │  ├─ library.js             # biblioteca por usuario
│  │  └─ prices.js              # snapshots de precio
│  ├─ routes/
│  │  ├─ auth.routes.js
│  │  ├─ chat.routes.js
│  │  ├─ library.routes.js
│  │  ├─ prefs.routes.js
│  │  ├─ alerts.routes.js
│  │  └─ games.routes.js
│  ├─ auth/                     # hash scrypt, cookies y middleware
│  ├─ jobs/priceWatcher.js      # vigilante de precios
│  ├─ services/                 # money, pricing, notifications, libraryView
│  ├─ db/{index.js,schema.sql}
│  ├─ http/sse.js
│  └─ middleware/{validate,errors}.js
├─ public/
│  ├─ index.html
│  ├─ app.js                    # chat, SSE, acciones y estado
│  ├─ widgets.js                # renderizadores de widgets
│  └─ styles.css
├─ data/                        # SQLite (se crea sola, ignorada por git)
└─ README.md
```

## API

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/health` | Estado, motores disponibles y uptime |
| `POST` | `/api/chat` | Mensaje al asistente. Respuesta SSE |
| `GET` | `/api/sesiones` | Lista de conversaciones |
| `GET` | `/api/sesiones/:id/mensajes` | Historial con widgets |
| `DELETE` | `/api/sesiones/:id` | Elimina conversación y mensajes |
| `GET` | `/api/biblioteca` | Biblioteca + resumen y alertas |
| `GET` | `/api/biblioteca/export` | Descarga la biblioteca en CSV o Markdown |
| `POST` | `/api/biblioteca` | Agrega un juego (botón de widget) |
| `PATCH` | `/api/biblioteca/:appid` | Estado, puntuación, nota, precio objetivo |
| `DELETE` | `/api/biblioteca/:appid` | Quita un juego |
| `GET` | `/api/preferencias` | Moneda, tiendas, PC y notificaciones |
| `PATCH` | `/api/preferencias` | Actualiza las preferencias |
| `GET` | `/api/tiendas` | Tiendas de CheapShark (con marca de oficial) |
| `GET` | `/api/alertas` | Alertas de precio actuales |
| `POST` | `/api/alertas/revisar` | Revisa precios y devuelve la biblioteca actualizada |
| `POST` | `/api/auth/registro` | Crea una cuenta e inicia sesión |
| `POST` | `/api/auth/login` | Inicia sesión |
| `POST` | `/api/auth/logout` | Cierra sesión |
| `GET` | `/api/auth/yo` | Usuario actual (o `autenticado:false`) |
| `GET` | `/api/juegos/:appid/historial` | Snapshots de precio propios |
| `POST` | `/api/notificaciones/prueba` | Envía una notificación de prueba |

### Cuerpo de `POST /api/chat`

```json
{
  "mensaje": "¿Cuánto cuesta Hades?",
  "sesionId": "opcional-uuid",
  "proveedor": "deepseek",
  "nivel": "medium"
}
```

- `proveedor`: `deepseek` o `gemini`. Si se omite, usa `AI_PROVIDER`.
- `nivel`: solo para DeepSeek (`low`, `medium`, `high`, `max`). Si se omite, usa el nivel por defecto.
- Un proveedor sin API key configurada responde `400`.

### Eventos SSE de `POST /api/chat`

```
data: {"type":"meta","sesionId":"…","proveedor":"deepseek","model":"deepseek-flash","modeloNombre":"DeepSeek V4.1 Flash","nivel":"medium"}

data: {"type":"widget","widget":{"tipo":"lista_juegos","datos":{…}}}

data: {"type":"chunk","texto":"El precio de "}

data: {"type":"done","sesionId":"…","titulo":"…"}
```

Los errores posteriores al inicio del stream llegan como `{"type":"error","error":"…"}`.

### `GET /api/health`

```json
{
  "status": "ok",
  "provider": "deepseek",
  "model": "deepseek-flash",
  "providers": [
    { "id": "gemini", "nombre": "Gemini", "modelo": "gemini-3.1-flash-lite", "disponible": true, "niveles": [], "nivelPorDefecto": null },
    { "id": "deepseek", "nombre": "DeepSeek", "modelo": "deepseek-flash", "disponible": true, "niveles": ["low", "medium", "high", "max"], "nivelPorDefecto": "medium" }
  ],
  "uptime": 42
}
```

## Modelo de datos

```
usuarios (id PK, usuario UNIQUE, nombre, hash, salt)
   ├─ 1:N sesiones_web (token PK, usuario_id, expira)
   ├─ 1:1 preferencias (moneda, tiendas, PC, canales)
   ├─ 1:N sesiones (id PK, usuario_id, titulo, creada, actualizada)
   │      └─ 1:N mensajes (id PK, sesion_id FK, rol, texto, widgets JSON,
   │                       proveedor, modelo, nivel, fecha)
   └─ 1:N biblioteca (usuario_id + appid UNIQUE, nombre, estado, puntuación,
                      nota, precios, etiquetas, tiempo_medio)

precios_historial (id PK, appid, precio_pen, precio_usd, fuente, fecha)
```

`mensajes.widgets` guarda los widgets que acompañaron cada respuesta. `mensajes.proveedor`,
`modelo` y `nivel` permiten mostrar qué motor generó cada respuesta al recuperar el historial.
`biblioteca` y `sesiones` están aisladas por `usuario_id`; `precios_historial` es global porque
el precio de un juego es el mismo para todos. `precio_objetivo` y `precio_actual` están en soles.

## Datos y atribución

| Servicio | Uso | Clave | Notas |
|---|---|---|---|
| DeepSeek | Modelo y function calling (motor por defecto) | Sí | API compatible con OpenAI; V4.1 Flash |
| Google Gemini | Modelo y function calling alternativo | Sí (gratuita) | Cuotas gratuitas de AI Studio |
| Steam Store API | Catálogo, precios en PEN, destacados | No | Endpoint público no documentado oficialmente |
| Steam News API | Noticias por appid | No | API pública oficial |
| SteamSpy | Etiquetas, reseñas, jugadores | No | Límite aproximado de 1 req/s |
| CheapShark | Precios multi-tienda, histórico | No | Precios en USD |
| open.er-api | Tipo de cambio USD→PEN | No | Actualización diaria |

Los datos se cachean en memoria (5–60 minutos según el recurso) para respetar los límites de uso.
Las APIs de Steam no son oficiales para terceros: pueden cambiar sin aviso.

## Decisiones de diseño

- **Function calling real**, no instrucciones en el prompt: el modelo decide qué herramienta usar
  y el servidor ejecuta y devuelve datos verificables. El prompt prohíbe inventar precios.
- **Los widgets se emiten apenas la herramienta termina**, antes del texto final, para que el usuario
  vea datos reales mientras el modelo redacta.
- **Precios locales primero**: Steam en soles; CheapShark en dólares con conversión referencial y
  una nota explícita. La fila de Steam de CheapShark se excluye porque usa precios de EE. UU.
- **Biblioteca transaccional**: el turno (sesión + pregunta + respuesta + widgets) se guarda en una
  sola transacción; nunca queda una pregunta sin respuesta.
- **El servidor administra el historial**; el navegador solo envía `sesionId` y el mensaje nuevo.
- **Todo Markdown pasa por DOMPurify**; los enlaces e imágenes solo se aceptan por `https`.
- **Reintentos y respaldo de modelo** ante 429/5xx, sin duplicar texto ya emitido. DeepSeek
  reintenta 3 veces; Gemini además prueba modelos de respaldo.
- **Proveedores intercambiables**: las herramientas y widgets son los mismos; cada proveedor
  adapta el formato de mensajes y de `tool_calls`. El motor y el nivel usados se guardan con
  cada respuesta.
- **DeepSeek por defecto** cuando su clave está configurada, por velocidad; si solo hay clave
  de Gemini, el motor inicial es Gemini.
- **Cuentas locales**: contraseña con scrypt + salt, sesión por cookie `HttpOnly`/`SameSite=Lax`
  y todas las consultas de biblioteca/sesiones filtradas por `usuario_id`. El primer registro
  hereda los datos anónimos de la fase single-user.
- **Historial de precios propio**: cada consulta o revisión guarda un snapshot (máximo uno cada
  6 h); el gráfico y la recomendación se calculan sobre esos datos, no sobre un histórico ajeno.
- **Vigilante de precios** cada 6 h por defecto; revisa solo usuarios con deseados y notifica
  únicamente las alertas nuevas.
- **Notificaciones opcionales**: Telegram (bot global + chat ID por usuario) y correo (SMTP);
  si no están configurados, la app sigue funcionando y lo indica en Ajustes.
- **Steam Deck y reseñas**: la compatibilidad sale del endpoint público de Deck; las reseñas son
  un resumen agregado porque Steam no expone los textos por su API pública.

## Verificación realizada

- Arranque, `/api/health`, frontend estático y SSE de punta a punta.
- Function calling en vivo con **DeepSeek** (respuesta en ~4 s) y con **Gemini**: `buscar_juegos`
  → widget → respuesta en español con el precio real.
- Las **29 herramientas** ejecutadas contra las APIs reales (incluidas historial y reseñas).
- CRUD de biblioteca (alta, cambio de estado, precio objetivo, alerta, borrado) y validaciones 400/404.
- Render de los **14 tipos de widget** en navegador, sin errores de consola.
- Persistencia: recarga de conversación con widgets, motor y nivel; sincronización del panel con la base.
- Selector de IA: DeepSeek/medio por defecto, cambio a Gemini, nivel oculto para Gemini y
  preferencia conservada en `localStorage`.
- Autenticación: registro, login, logout, sesión persistente, `401` sin cookie y aislamiento entre
  dos usuarios (biblioteca y conversaciones independientes).
- Historial propio: snapshots, gráfico SVG, mínimo/promedio/actual y recomendación.
- Vigilante de precios ejecutado manualmente: 3 juegos revisados, snapshots guardados, sin errores.
- Steam Deck: Hades reportado como **Verificado** en ficha y requisitos.
- Notificaciones: prueba sin canales configurados devuelve un `400` explicativo (comportamiento esperado).

## Limitaciones

- Instancia local de un solo proceso: no hay despliegue horizontal ni sesiones compartidas.
- No hay recuperación de contraseña ni verificación de correo; el registro es local.
- Las cookies no llevan `Secure` por defecto (pensado para HTTP local); actívalo con
  `COOKIE_SECURE=true` detrás de HTTPS.
- El rate limiting solo cubre intentos de login (en memoria); el resto de la API no tiene límites propios.
- Steam no expone reseñas individuales por su API pública: se muestra el resumen y un enlace a Steam.
- El historial de precios es propio y empieza vacío; no es el histórico completo de Steam.
- Telegram y correo requieren configurar el bot/SMTP en `.env` y el chat ID/correo en Ajustes.
- Solo PC/Steam para precios y catálogo; consolas no están cubiertas.
- El historial de chat se recorta por cantidad de mensajes, no por tokens.
- La API de DeepSeek documenta `low/high/max`; `medium` se envía y es aceptado, pero su
  equivalencia exacta la define el proveedor.
- `better-sqlite3` es un módulo nativo: en Docker necesita herramientas de compilación si no hay
  binario precompilado para la plataforma.

## Próximos pasos

1. Tests de API con `supertest` (auth, biblioteca, alertas) y del repositorio con SQLite en memoria.
2. Recuperación de contraseña y verificación de correo.
3. Predicción de precio con más historial y estacionalidad de descuentos.
4. Dockerfile + despliegue con HTTPS y cookies seguras.
5. Exportar conversaciones y compartir un resumen.
6. Más proveedores de IA o modelos locales.
