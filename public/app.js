import { renderWidget, sincronizarBiblioteca, marcarAgregados } from "./widgets.js";

/* global marked, DOMPurify, hljs */

const CLAVE_SESION = "gemini-chat:sesion";
const CLAVE_PROVEEDOR = "gamescout:proveedor";
const CLAVE_NIVEL = "gamescout:nivel";

const ETIQUETAS_NIVEL = {
  low: { corto: "bajo", selector: "Bajo" },
  medium: { corto: "medio", selector: "Medio" },
  high: { corto: "alto", selector: "Alto" },
  max: { corto: "máximo", selector: "Máximo" },
};

const NOMBRES_MODELO = {
  "deepseek-flash": "DeepSeek V4.1 Flash",
  "deepseek-v4-pro": "DeepSeek V4 Pro",
  "gemini-3.1-flash-lite": "Gemini 3.1 Flash Lite",
  "gemini-3.6-flash": "Gemini 3.6 Flash",
  "gemini-3.7-flash": "Gemini 3.7 Flash",
};

const el = {
  ventana: document.getElementById("ventana-chat"),
  lista: document.getElementById("lista-sesiones"),
  titulo: document.getElementById("titulo-chat"),
  modelo: document.getElementById("modelo"),
  proveedor: document.getElementById("proveedor-ia"),
  nivel: document.getElementById("nivel-ia"),
  form: document.getElementById("form-chat"),
  ingreso: document.getElementById("ingreso"),
  enviar: document.getElementById("btn-enviar"),
  detener: document.getElementById("btn-detener"),
  nueva: document.getElementById("btn-nueva"),
  estado: document.getElementById("estado"),
  toast: document.getElementById("toast"),
};

const state = {
  sesionId: localStorage.getItem(CLAVE_SESION) || null,
  enviando: false,
  abortador: null,
  sesiones: [],
  proveedores: [],
  proveedor: localStorage.getItem(CLAVE_PROVEEDOR) || null,
  nivel: localStorage.getItem(CLAVE_NIVEL) || null,
};

marked.setOptions({ gfm: true, breaks: true });

/* ---------------------------------------------------------------- utilidades */

const api = async (ruta, opciones = {}) => {
  const respuesta = await fetch(ruta, opciones);
  if (!respuesta.ok) {
    const datos = await respuesta.json().catch(() => ({}));
    const error = new Error(datos.error || `Error ${respuesta.status}`);
    error.status = respuesta.status;
    throw error;
  }
  return respuesta.status === 204 ? null : respuesta.json();
};

const renderMarkdown = (texto) => DOMPurify.sanitize(marked.parse(texto || ""));

const resaltarCodigo = (raiz) => {
  raiz.querySelectorAll("pre code").forEach((bloque) => {
    if (bloque.dataset.resaltado) return;
    hljs.highlightElement(bloque);
    bloque.dataset.resaltado = "1";
  });
};

const fechaDe = (texto) => {
  if (!texto) return new Date();
  const normalizado = texto.includes("T") ? texto : `${texto.replace(" ", "T")}Z`;
  const fecha = new Date(normalizado);
  return Number.isNaN(fecha.getTime()) ? new Date() : fecha;
};

const etiquetaFecha = (texto) => {
  const fecha = fechaDe(texto);
  const minutos = Math.floor((Date.now() - fecha.getTime()) / 60000);

  if (minutos < 1) return "ahora";
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  if (dias < 7) return `hace ${dias} d`;

  return fecha.toLocaleDateString("es-PE", { day: "2-digit", month: "short" });
};

const pegadoAbajo = () =>
  el.ventana.scrollHeight - el.ventana.scrollTop - el.ventana.clientHeight < 140;

const irAbajo = (forzar = false) => {
  if (forzar || pegadoAbajo()) {
    el.ventana.scrollTop = el.ventana.scrollHeight;
  }
};

const setEstado = (texto = "", esError = false) => {
  el.estado.textContent = texto;
  el.estado.classList.toggle("error", esError);
};

let temporizadorToast;
const mostrarToast = (texto, esError = false) => {
  el.toast.textContent = texto;
  el.toast.classList.toggle("error", esError);
  el.toast.classList.add("visible");
  clearTimeout(temporizadorToast);
  temporizadorToast = window.setTimeout(() => el.toast.classList.remove("visible"), 3500);
};

/* ---------------------------------------------------------------- proveedores de IA */

const proveedorActual = () =>
  state.proveedores.find((proveedor) => proveedor.id === state.proveedor) ?? null;

const etiquetaNivel = (nivel, forma = "corto") => {
  if (!nivel) return "";
  return ETIQUETAS_NIVEL[nivel]?.[forma] ?? nivel;
};

const etiquetaSeleccionActual = () => {
  const proveedor = proveedorActual();
  if (!proveedor) return "";
  const nivel = state.nivel ? ` · ${etiquetaNivel(state.nivel)}` : "";
  return `${proveedor.modeloNombre ?? proveedor.modelo}${nivel}`;
};

const etiquetaMensaje = (mensaje) => {
  if (!mensaje?.modelo && !mensaje?.proveedor) return "";
  const nombre = NOMBRES_MODELO[mensaje.modelo] ?? mensaje.modelo ?? mensaje.proveedor;
  const nivel = mensaje.nivel ? ` · ${etiquetaNivel(mensaje.nivel)}` : "";
  return `${nombre}${nivel}`;
};

const actualizarEtiquetaIA = () => {
  const proveedor = proveedorActual();
  if (!proveedor) {
    el.modelo.textContent = "sin conexión";
    return;
  }
  const nivel = state.nivel ? ` · ${etiquetaNivel(state.nivel)}` : "";
  el.modelo.textContent = `${proveedor.nombre}${nivel}`;
};

const actualizarNiveles = () => {
  const proveedor = proveedorActual();
  const niveles = proveedor?.niveles ?? [];

  el.nivel.replaceChildren();
  el.nivel.hidden = niveles.length === 0;

  if (niveles.length === 0) {
    state.nivel = null;
    actualizarEtiquetaIA();
    return;
  }

  for (const nivel of niveles) {
    el.nivel.add(new Option(ETIQUETAS_NIVEL[nivel]?.selector ?? nivel, nivel));
  }

  const recordado = localStorage.getItem(CLAVE_NIVEL);
  state.nivel = niveles.includes(recordado)
    ? recordado
    : niveles.includes(proveedor.nivelPorDefecto)
      ? proveedor.nivelPorDefecto
      : niveles[0];

  el.nivel.value = state.nivel;
  localStorage.setItem(CLAVE_NIVEL, state.nivel);
  actualizarEtiquetaIA();
};

const cargarProveedores = (salud) => {
  state.proveedores = salud?.providers ?? [];

  el.proveedor.replaceChildren();
  for (const proveedor of state.proveedores) {
    const opcion = new Option(
      `${proveedor.modeloNombre ?? proveedor.nombre}${
        proveedor.disponible ? "" : " (sin configurar)"
      }`,
      proveedor.id
    );
    opcion.disabled = !proveedor.disponible;
    el.proveedor.add(opcion);
  }

  const recordado = state.proveedores.find(
    (proveedor) => proveedor.id === state.proveedor && proveedor.disponible
  );
  const porDefecto = state.proveedores.find(
    (proveedor) => proveedor.id === salud?.provider && proveedor.disponible
  );
  const primero = state.proveedores.find((proveedor) => proveedor.disponible);

  state.proveedor = recordado?.id ?? porDefecto?.id ?? primero?.id ?? null;
  el.proveedor.value = state.proveedor ?? "";

  if (state.proveedor) localStorage.setItem(CLAVE_PROVEEDOR, state.proveedor);
  actualizarNiveles();
};

/* ---------------------------------------------------------------- mensajes */

const limpiarVentana = () => {
  el.ventana.replaceChildren();
};

const crearMensajeAsistente = (metaTexto = "") => {
  const nodo = document.createElement("article");
  nodo.className = "mensaje asistente";

  const autor = document.createElement("span");
  autor.className = "autor";
  autor.textContent = "GameScout";

  const contenido = document.createElement("div");
  contenido.className = "contenido";

  const adjuntos = document.createElement("div");
  adjuntos.className = "adjuntos";

  const meta = document.createElement("span");
  meta.className = "meta-ia";
  meta.textContent = metaTexto;

  nodo.append(autor, contenido, adjuntos, meta);
  el.ventana.append(nodo);
  irAbajo(true);

  return { nodo, contenido, adjuntos, meta };
};

const agregarUsuario = (texto) => {
  const nodo = document.createElement("article");
  nodo.className = "mensaje usuario";

  const autor = document.createElement("span");
  autor.className = "autor";
  autor.textContent = "Tú";

  const burbuja = document.createElement("div");
  burbuja.className = "burbuja";
  burbuja.textContent = texto;

  nodo.append(autor, burbuja);
  el.ventana.append(nodo);
  irAbajo(true);
};

const agregarAsistente = (texto, widgets = [], metaTexto = "") => {
  const { contenido, adjuntos } = crearMensajeAsistente(metaTexto);

  if (texto) {
    contenido.innerHTML = renderMarkdown(texto);
    resaltarCodigo(contenido);
  }

  for (const widget of widgets) renderWidget(widget, adjuntos);
  irAbajo(true);
};

const crearBurbujaPensando = (metaTexto = "") => {
  const { nodo, contenido, adjuntos, meta } = crearMensajeAsistente(metaTexto);
  contenido.classList.add("streaming");

  const puntos = document.createElement("div");
  puntos.className = "pensando";
  puntos.innerHTML = "<span></span><span></span><span></span>";
  contenido.append(puntos);

  return { nodo, contenido, adjuntos, meta };
};

/* ---------------------------------------------------------------- sesiones */

const actualizarActiva = () => {
  el.lista.querySelectorAll(".sesion").forEach((nodo) => {
    nodo.classList.toggle("activa", nodo.dataset.id === state.sesionId);
  });
};

const renderSesiones = () => {
  el.lista.replaceChildren();

  if (state.sesiones.length === 0) {
    const vacio = document.createElement("p");
    vacio.className = "vacio";
    vacio.textContent = "Todavía no hay conversaciones guardadas.";
    el.lista.append(vacio);
    return;
  }

  for (const sesion of state.sesiones) {
    const fila = document.createElement("div");
    fila.className = "sesion";
    fila.dataset.id = sesion.id;

    const abrir = document.createElement("button");
    abrir.type = "button";
    abrir.className = "sesion-titulo";
    abrir.title = sesion.titulo;

    const titulo = document.createElement("strong");
    titulo.textContent = sesion.titulo;

    const detalle = document.createElement("small");
    const total = sesion.totalMensajes === 1 ? "1 mensaje" : `${sesion.totalMensajes} mensajes`;
    detalle.textContent = `${total} · ${etiquetaFecha(sesion.actualizada)}`;

    abrir.append(titulo, detalle);
    abrir.addEventListener("click", () => abrirSesion(sesion.id));

    const eliminar = document.createElement("button");
    eliminar.type = "button";
    eliminar.className = "sesion-eliminar";
    eliminar.textContent = "×";
    eliminar.setAttribute("aria-label", `Eliminar conversación: ${sesion.titulo}`);
    eliminar.addEventListener("click", (evento) => {
      evento.stopPropagation();
      borrarSesion(sesion);
    });

    fila.append(abrir, eliminar);
    el.lista.append(fila);
  }

  actualizarActiva();
};

const cargarSesiones = async () => {
  try {
    const datos = await api("/api/sesiones");
    state.sesiones = datos.sesiones;
    renderSesiones();
  } catch (error) {
    console.error("No se pudieron cargar las conversaciones:", error);
  }
};

const abrirSesion = async (id) => {
  if (state.enviando) return;

  try {
    const datos = await api(`/api/sesiones/${id}/mensajes`);

    limpiarVentana();
    if (datos.mensajes.length === 0) {
      mostrarBienvenida();
    } else {
      for (const mensaje of datos.mensajes) {
        if (mensaje.rol === "user") agregarUsuario(mensaje.texto);
        else agregarAsistente(mensaje.texto, mensaje.widgets ?? [], etiquetaMensaje(mensaje));
      }
    }

    state.sesionId = id;
    localStorage.setItem(CLAVE_SESION, id);
    el.titulo.textContent = datos.sesion.titulo;
    document.title = `${datos.sesion.titulo} · GameScout`;
    actualizarActiva();
    irAbajo(true);
    setEstado("");
    await sincronizarEstadoBiblioteca();
  } catch (error) {
    if (error.status === 404) {
      limpiarSesion();
      await cargarSesiones();
      setEstado("Esa conversación ya no existe. Puedes empezar una nueva.");
      return;
    }
    setEstado(error.message, true);
  }
};

const borrarSesion = async (sesion) => {
  if (state.enviando) return;
  const confirmado = window.confirm(`¿Eliminar la conversación "${sesion.titulo}"?`);
  if (!confirmado) return;

  try {
    await api(`/api/sesiones/${sesion.id}`, { method: "DELETE" });
    if (state.sesionId === sesion.id) limpiarSesion();
    await cargarSesiones();
  } catch (error) {
    setEstado(error.message, true);
  }
};

const limpiarSesion = () => {
  state.sesionId = null;
  localStorage.removeItem(CLAVE_SESION);
  el.titulo.textContent = "Nueva conversación";
  document.title = "GameScout · Tu copiloto de videojuegos";
  mostrarBienvenida();
  actualizarActiva();
};

/* ---------------------------------------------------------------- bienvenida */

const SUGERENCIAS = [
  "¿Qué juegos están en oferta hoy?",
  "¿Cuánto cuesta Hades en Perú?",
  "Recomiéndame un roguelike",
  "Muéstrame mi biblioteca",
];

const mostrarBienvenida = () => {
  limpiarVentana();

  const seccion = document.createElement("section");
  seccion.className = "bienvenida";

  const icono = document.createElement("div");
  icono.className = "bienvenida-icono";
  icono.setAttribute("aria-hidden", "true");
  icono.textContent = "🎮";

  const titulo = document.createElement("h2");
  titulo.textContent = "¿Qué jugamos hoy?";

  const texto = document.createElement("p");
  texto.textContent =
    "Precios reales de Steam en soles, ofertas en otras tiendas, noticias y tu biblioteca personal. Pregúntame lo que quieras.";

  const chips = document.createElement("div");
  chips.className = "sugerencias";

  for (const sugerencia of SUGERENCIAS) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.textContent = sugerencia;
    chip.addEventListener("click", () => {
      el.ingreso.value = sugerencia;
      ajustarAltura();
      actualizarBotonEnviar();
      el.ingreso.focus();
    });
    chips.append(chip);
  }

  seccion.append(icono, titulo, texto, chips);
  el.ventana.append(seccion);
};

/* ---------------------------------------------------------------- streaming */

const leerEventos = async (respuesta, manejar) => {
  const lector = respuesta.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";

  while (true) {
    const { value, done } = await lector.read();
    if (done) break;

    buffer += value;
    const bloques = buffer.split("\n\n");
    buffer = bloques.pop() ?? "";

    for (const bloque of bloques) {
      const linea = bloque.split("\n").find((l) => l.startsWith("data:"));
      if (!linea) continue;

      try {
        manejar(JSON.parse(linea.slice(5).trim()));
      } catch (error) {
        console.warn("Evento SSE inválido:", bloque, error);
      }
    }
  }
};

const enviarMensaje = async (texto) => {
  if (state.enviando) return;
  if (!texto.trim()) return;

  const bienvenida = el.ventana.querySelector(".bienvenida");
  if (bienvenida) bienvenida.remove();

  state.enviando = true;
  actualizarBotonEnviar();
  el.detener.hidden = false;
  el.proveedor.disabled = true;
  el.nivel.disabled = true;
  setEstado(`Pensando con ${proveedorActual()?.nombre ?? "la IA"}…`);

  agregarUsuario(texto);
  el.ingreso.value = "";
  ajustarAltura();

  const { nodo, contenido, adjuntos, meta } = crearBurbujaPensando(etiquetaSeleccionActual());
  const controlador = new AbortController();
  state.abortador = controlador;

  let acumulado = "";
  let primerTexto = false;
  let hayWidgets = false;
  let programado = false;
  let errorEnvio = null;
  let tituloSesion = null;

  const pintar = () => {
    programado = false;
    contenido.innerHTML = renderMarkdown(acumulado);
    resaltarCodigo(contenido);
    irAbajo();
  };

  const agendarPintado = () => {
    if (programado) return;
    programado = true;
    window.setTimeout(pintar, 60);
  };

  const quitarPensando = () => contenido.querySelector(".pensando")?.remove();

  try {
    const respuesta = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mensaje: texto,
        sesionId: state.sesionId ?? undefined,
        proveedor: state.proveedor ?? undefined,
        nivel: state.nivel ?? undefined,
      }),
      signal: controlador.signal,
    });

    if (!respuesta.ok) {
      const datos = await respuesta.json().catch(() => ({}));
      const error = new Error(datos.error || `Error ${respuesta.status}`);
      error.status = respuesta.status;
      throw error;
    }

    await leerEventos(respuesta, (evento) => {
      if (evento.type === "meta") {
        state.sesionId = evento.sesionId;
        localStorage.setItem(CLAVE_SESION, evento.sesionId);

        const nombre =
          evento.modeloNombre ?? NOMBRES_MODELO[evento.model] ?? evento.model ?? "";
        const nivel = evento.nivel ? ` · ${etiquetaNivel(evento.nivel)}` : "";
        if (nombre) meta.textContent = `${nombre}${nivel}`;
        return;
      }

      if (evento.type === "widget") {
        quitarPensando();
        hayWidgets = true;
        renderWidget(evento.widget, adjuntos);
        irAbajo();
        return;
      }

      if (evento.type === "chunk") {
        if (!primerTexto) {
          primerTexto = true;
          quitarPensando();
          contenido.classList.add("streaming");
          setEstado("");
        }
        acumulado += evento.texto;
        agendarPintado();
        return;
      }

      if (evento.type === "done") {
        tituloSesion = evento.titulo;
        return;
      }

      if (evento.type === "error") {
        errorEnvio = new Error(evento.error);
      }
    });

    if (errorEnvio) throw errorEnvio;
    if (!primerTexto && !hayWidgets) throw new Error("El modelo no devolvió contenido.");

    contenido.classList.remove("streaming");
    contenido.innerHTML = renderMarkdown(acumulado);
    resaltarCodigo(contenido);

    if (tituloSesion) {
      el.titulo.textContent = tituloSesion;
      document.title = `${tituloSesion} · GameScout`;
    }
  } catch (error) {
    contenido.classList.remove("streaming");

    if (error.name === "AbortError") {
      if (acumulado) {
        contenido.innerHTML = renderMarkdown(acumulado);
        resaltarCodigo(contenido);
        setEstado("Respuesta detenida. El texto parcial quedó guardado.");
      } else if (!hayWidgets) {
        nodo.remove();
        setEstado("Petición cancelada.");
      }
    } else {
      if (!acumulado && !hayWidgets) nodo.remove();
      if (error.status === 404) {
        state.sesionId = null;
        localStorage.removeItem(CLAVE_SESION);
      }
      setEstado(error.message || "Ocurrió un error inesperado.", true);
    }
  } finally {
    state.enviando = false;
    state.abortador = null;
    el.detener.hidden = true;
    el.proveedor.disabled = false;
    el.nivel.disabled = false;
    actualizarBotonEnviar();
    el.ingreso.focus();
    await cargarSesiones();
    await sincronizarEstadoBiblioteca();
  }
};

/* ---------------------------------------------------------------- acciones de widgets */

const recargarBiblioteca = async () => {
  const datos = await api("/api/biblioteca");
  sincronizarBiblioteca(datos);
  marcarAgregados(datos.juegos.map((j) => j.appid));
};

/** Refresca paneles y botones con el estado real de la biblioteca. */
const sincronizarEstadoBiblioteca = async () => {
  try {
    const datos = await api("/api/biblioteca");
    if (document.querySelector('[data-widget="biblioteca"]')) sincronizarBiblioteca(datos);
    marcarAgregados(datos.juegos.map((j) => j.appid));
  } catch {
    // Si falla, los widgets conservan los datos con los que se generaron.
  }
};

el.ventana.addEventListener("click", async (evento) => {
  const boton = evento.target.closest("[data-accion]");
  if (!boton || boton.tagName === "SELECT") return;

  const accion = boton.dataset.accion;
  if (accion === "nada") return;

  const appid = Number(boton.dataset.appid || 0);

  try {
    if (accion === "agregar") {
      if (!appid) return;
      const datos = await api("/api/biblioteca", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appid,
          nombre: boton.dataset.nombre,
          imagen: boton.dataset.imagen,
          precioActual:
            boton.dataset.precio === undefined ? undefined : Number(boton.dataset.precio),
        }),
      });

      boton.textContent = "En biblioteca ✓";
      boton.disabled = true;
      sincronizarBiblioteca(datos);
      marcarAgregados(datos.juegos.map((j) => j.appid));
      mostrarToast(`${boton.dataset.nombre ?? "Juego"} agregado a tu biblioteca`);
      return;
    }

    if (accion === "quitar") {
      await api(`/api/biblioteca/${appid}`, { method: "DELETE" });
      await recargarBiblioteca();
      mostrarToast("Juego eliminado de tu biblioteca");
      return;
    }

    if (accion === "refrescar") {
      await recargarBiblioteca();
      mostrarToast("Biblioteca actualizada");
      return;
    }

    if (accion === "objetivo") {
      const nombre = boton.dataset.nombre ?? "este juego";
      const entrada = window.prompt(
        `Precio objetivo en soles para "${nombre}". Déjalo vacío para quitar la alerta:`,
        ""
      );
      if (entrada === null) return;

      const limpio = entrada.trim();
      const valor = limpio === "" ? null : Number(limpio);
      if (valor !== null && (!Number.isFinite(valor) || valor < 0)) {
        mostrarToast("Ingresa un número válido.", true);
        return;
      }

      const datos = await api(`/api/biblioteca/${appid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ precioObjetivo: valor }),
      });

      sincronizarBiblioteca(datos);
      mostrarToast(
        valor === null
          ? "Alerta de precio eliminada"
          : `Te avisaré cuando baje de S/ ${valor.toFixed(2)}`
      );
    }
  } catch (error) {
    mostrarToast(error.message || "No se pudo completar la acción.", true);
  }
});

el.ventana.addEventListener("change", async (evento) => {
  const selector = evento.target.closest('select[data-accion="estado"]');
  if (!selector) return;

  const appid = Number(selector.dataset.appid || 0);
  if (!appid) return;

  try {
    const datos = await api(`/api/biblioteca/${appid}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: selector.value }),
    });

    sincronizarBiblioteca(datos);
    mostrarToast("Estado actualizado");
  } catch (error) {
    mostrarToast(error.message || "No se pudo actualizar el estado.", true);
    await recargarBiblioteca();
  }
});

/* ---------------------------------------------------------------- formulario */

const ajustarAltura = () => {
  el.ingreso.style.height = "auto";
  el.ingreso.style.height = `${Math.min(el.ingreso.scrollHeight, 160)}px`;
};

const actualizarBotonEnviar = () => {
  el.enviar.disabled = state.enviando || el.ingreso.value.trim().length === 0;
};

el.form.addEventListener("submit", (evento) => {
  evento.preventDefault();
  enviarMensaje(el.ingreso.value);
});

el.ingreso.addEventListener("input", () => {
  ajustarAltura();
  actualizarBotonEnviar();
});

el.ingreso.addEventListener("keydown", (evento) => {
  if (evento.key === "Enter" && !evento.shiftKey && !evento.isComposing) {
    evento.preventDefault();
    el.form.requestSubmit();
  }
});

el.detener.addEventListener("click", () => {
  state.abortador?.abort();
});

el.proveedor.addEventListener("change", () => {
  state.proveedor = el.proveedor.value;
  localStorage.setItem(CLAVE_PROVEEDOR, state.proveedor);
  actualizarNiveles();
});

el.nivel.addEventListener("change", () => {
  state.nivel = el.nivel.value;
  localStorage.setItem(CLAVE_NIVEL, state.nivel);
  actualizarEtiquetaIA();
});

el.nueva.addEventListener("click", () => {
  if (state.enviando) return;
  limpiarSesion();
  el.ingreso.focus();
});

/* ---------------------------------------------------------------- arranque */

const iniciar = async () => {
  try {
    const salud = await api("/api/health");
    cargarProveedores(salud);
  } catch {
    el.modelo.textContent = "sin conexión";
  }

  await cargarSesiones();

  if (state.sesionId) {
    await abrirSesion(state.sesionId);
  } else {
    mostrarBienvenida();
  }

  el.ingreso.focus();
};

iniciar();
