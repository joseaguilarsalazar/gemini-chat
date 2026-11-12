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

> **Windows:** si PowerShell bloquea `npm` por la política de ejecución de scripts,
> usa `npm.cmd` (`npm.cmd install`, `npm.cmd start`).

Prueba cualquiera de estas frases:

- `¿Cuánto cuesta Hades en Perú y dónde está más barato?`
- `¿Qué juegos están en oferta hoy?`
- `Recomiéndame un roguelike`
- `Muéstrame mi biblioteca`

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
│  │  └─ index.js               # registro y ejecución tolerante a errores
│  ├─ repositories/
│  │  ├─ sessions.js
│  │  ├─ messages.js            # turnos + widgets
│  │  └─ library.js             # CRUD de biblioteca
│  ├─ routes/
│  │  ├─ chat.routes.js
│  │  └─ library.routes.js
│  ├─ services/libraryView.js   # vista compartida por chat y API
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
sesiones (id PK, titulo, creada, actualizada)
   └─ 1:N mensajes (id PK, sesion_id FK, rol, texto, widgets JSON,
                    proveedor, modelo, nivel, fecha)

biblioteca (appid PK, nombre, imagen, estado, puntuacion, nota,
            precio_objetivo, precio_actual, agregado, actualizado)
```

`mensajes.widgets` guarda los widgets que acompañaron cada respuesta. `mensajes.proveedor`,
`modelo` y `nivel` permiten mostrar qué motor generó cada respuesta al recuperar el historial.
`precio_objetivo` y `precio_actual` están en soles; `precio_actual` se actualiza cuando el chat
consulta el juego.

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

## Verificación realizada

- Arranque, `/api/health`, frontend estático y SSE de punta a punta.
- Function calling en vivo con **DeepSeek** (respuesta en ~4 s) y con **Gemini**: `buscar_juegos`
  → widget → respuesta en español con el precio real.
- Las 12 herramientas ejecutadas individualmente contra las APIs reales.
- CRUD de biblioteca (alta, cambio de estado, precio objetivo, alerta, borrado) y validaciones 400/404.
- Render de los 5 tipos de widget en navegador, sin errores de consola.
- Persistencia: recarga de conversación con widgets, motor y nivel; sincronización del panel con la base.
- Selector de IA: DeepSeek/medio por defecto, cambio a Gemini, nivel oculto para Gemini y
  preferencia conservada en `localStorage`.

## Limitaciones

- Sin autenticación: la biblioteca es global para la instancia (pensado para uso local/demo).
- Sin rate limiting propio; la cuota la controlan DeepSeek/Google.
- Solo PC/Steam para precios y catálogo; consolas no están cubiertas.
- El historial se recorta por cantidad de mensajes, no por tokens.
- La API de DeepSeek documenta `low/high/max`; `medium` se envía y es aceptado, pero su
  equivalencia exacta la define el proveedor.
- `better-sqlite3` es un módulo nativo: en Docker necesita herramientas de compilación si no hay
  binario precompilado para la plataforma.

## Próximos pasos

1. Autenticación simple (cookie firmada) y biblioteca por usuario.
2. Job diario que revise precios objetivo y notifique (correo o Telegram).
3. Historial de precios propio (guardar snapshots) y gráfico de evolución.
4. Comparar dos o tres juegos en un solo widget.
5. Tests de API con `supertest` y del repositorio con SQLite en memoria.
6. Dockerfile y despliegue.
