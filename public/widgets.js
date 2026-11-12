const el = (etiqueta, clase) => {
  const nodo = document.createElement(etiqueta);
  if (clase) nodo.className = clase;
  return nodo;
};

/** Solo permitimos enlaces https en las tarjetas. */
const urlSegura = (valor) => {
  if (typeof valor !== "string") return null;
  try {
    const url = new URL(valor);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
};

const formatoFecha = new Intl.DateTimeFormat("es-PE", { dateStyle: "medium" });

const dinero = (valor) => (valor == null ? "—" : valor);

const botonAccion = (texto, accion, datos = {}) => {
  const boton = el("button", "btn-mini");
  boton.type = "button";
  boton.textContent = texto;
  boton.dataset.accion = accion;
  if (datos.appid != null) boton.dataset.appid = String(datos.appid);
  if (datos.nombre) boton.dataset.nombre = datos.nombre;
  if (datos.imagen) boton.dataset.imagen = datos.imagen;
  if (datos.estado) boton.dataset.estado = datos.estado;
  if (datos.precio != null) boton.dataset.precio = String(datos.precio);
  return boton;
};

const enlace = (texto, url) => {
  const seguro = urlSegura(url);
  if (!seguro) return null;
  const a = el("a", "btn-mini btn-mini-ghost");
  a.href = seguro;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.textContent = texto;
  return a;
};

const enlaceDescarga = (texto, url) => {
  const a = el("a", "btn-mini btn-mini-ghost");
  a.href = url;
  a.textContent = texto;
  a.setAttribute("download", "");
  return a;
};

const cargarScript = (url) =>
  new Promise((resolve, reject) => {
    const existente = document.querySelector(`script[src="${url}"]`);
    if (existente) {
      if (existente.dataset.cargado) resolve();
      else existente.addEventListener("load", resolve, { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = url;
    script.async = true;
    script.addEventListener("load", () => {
      script.dataset.cargado = "1";
      resolve();
    });
    script.addEventListener("error", () => reject(new Error("No se pudo cargar el reproductor.")));
    document.head.append(script);
  });

const insigniaDescuento = (descuento) => {
  if (!descuento) return null;
  const insignia = el("span", "badge-descuento");
  insignia.textContent = `-${descuento}%`;
  return insignia;
};

const imagen = (src, alt, clase) => {
  const segura = urlSegura(src);
  if (!segura) return null;
  const img = el("img", clase);
  img.src = segura;
  img.alt = alt ?? "";
  img.referrerPolicy = "no-referrer";
  return img;
};

// ---------------------------------------------------------------- lista de juegos

const construirJuego = (juego) => {
  const tarjeta = el("article", "jcard");

  const img = imagen(juego.imagen, juego.nombre, "jcard-img");
  if (img) tarjeta.append(img);
  else tarjeta.classList.add("sin-imagen");

  const cuerpo = el("div", "jcard-cuerpo");

  const titulo = el("h4", "jcard-titulo");
  titulo.textContent = juego.nombre;
  cuerpo.append(titulo);

  const precios = el("div", "jcard-precios");
  const precio = el("strong", "jcard-precio");
  precio.textContent = dinero(juego.precioTexto);
  precios.append(precio);

  const descuento = insigniaDescuento(juego.descuento);
  if (descuento) precios.append(descuento);
  cuerpo.append(precios);

  const nota = el("p", "jcard-nota");
  nota.textContent = [juego.notaPrecio, juego.puntuacion ? `Metacritic ${juego.puntuacion}` : null]
    .filter(Boolean)
    .join(" · ");
  if (nota.textContent) cuerpo.append(nota);

  const acciones = el("div", "jcard-acciones");

  if (juego.appid) {
    if (juego.enBiblioteca) {
      const ya = botonAccion("En biblioteca ✓", "nada", { appid: juego.appid });
      ya.disabled = true;
      acciones.append(ya);
    } else {
      acciones.append(
        botonAccion("+ Biblioteca", "agregar", {
          appid: juego.appid,
          nombre: juego.nombre,
          imagen: juego.imagen,
          precio: juego.precioValor,
        })
      );
    }

    const steam = enlace("Ver en Steam", `https://store.steampowered.com/app/${juego.appid}`);
    if (steam) acciones.append(steam);
  } else {
    const oferta = enlace("Ver oferta", juego.enlace);
    if (oferta) acciones.append(oferta);
  }

  if (acciones.childElementCount > 0) cuerpo.append(acciones);
  tarjeta.append(cuerpo);
  return tarjeta;
};

const construirLista = (datos) => {
  const seccion = el("section", "widget");
  seccion.dataset.widget = "lista_juegos";

  const cabecera = el("header", "widget-cabecera");
  const titulo = el("h3");
  titulo.textContent = datos.titulo ?? "Juegos";
  cabecera.append(titulo);
  if (datos.subtitulo) {
    const sub = el("p", "widget-subtitulo");
    sub.textContent = datos.subtitulo;
    cabecera.append(sub);
  }
  seccion.append(cabecera);

  const grilla = el("div", "juegos-grilla");
  for (const juego of datos.juegos ?? []) grilla.append(construirJuego(juego));
  seccion.append(grilla);

  return seccion;
};

// ---------------------------------------------------------------- ficha de juego

const construirFicha = (datos) => {
  const seccion = el("section", "widget ficha");
  seccion.dataset.widget = "ficha_juego";

  const img = imagen(datos.imagen, datos.nombre, "ficha-img");
  if (img) seccion.append(img);

  const cuerpo = el("div", "ficha-cuerpo");

  const titulo = el("h3");
  titulo.textContent = datos.nombre;
  cuerpo.append(titulo);

  const meta = el("p", "ficha-meta");
  meta.textContent = [datos.desarrollador, datos.fecha, ...(datos.generos ?? [])]
    .filter(Boolean)
    .join(" · ");
  cuerpo.append(meta);

  if (datos.descripcion) {
    const desc = el("p", "ficha-descripcion");
    desc.textContent = datos.descripcion;
    cuerpo.append(desc);
  }

  const precios = el("div", "ficha-precios");
  const actual = el("strong", "ficha-precio");
  actual.textContent = dinero(datos.precioTexto);
  precios.append(actual);

  if (datos.precioOriginal) {
    const antes = el("s", "precio-antes");
    antes.textContent = datos.precioOriginal;
    precios.append(antes);
  }

  const descuento = insigniaDescuento(datos.descuento);
  if (descuento) precios.append(descuento);
  cuerpo.append(precios);

  const metricas = el("div", "ficha-metricas");
  if (datos.metacritic) {
    const m = el("span", "metrica");
    m.textContent = `Metacritic ${datos.metacritic}`;
    metricas.append(m);
  }
  if (datos.porcentajePositivo != null) {
    const p = el("span", "metrica");
    p.textContent = `${datos.porcentajePositivo}% reseñas positivas`;
    metricas.append(p);
  }
  if (datos.tieneEspanol) {
    const idioma = el("span", "metrica");
    idioma.textContent = datos.audioEspanol ? "Español con audio" : "Español con subtítulos";
    metricas.append(idioma);
  }
  if (datos.edadMinima) {
    const edad = el("span", "metrica");
    edad.textContent = `+${datos.edadMinima}`;
    metricas.append(edad);
  }
  if (datos.logros) {
    const logros = el("span", "metrica");
    logros.textContent = `${datos.logros} logros`;
    metricas.append(logros);
  }
  if (datos.dlcs) {
    const dlcs = el("span", "metrica");
    dlcs.textContent = `${datos.dlcs} DLC`;
    metricas.append(dlcs);
  }
  if (datos.deck?.etiqueta) {
    const deck = el("span", "metrica");
    deck.textContent = `Steam Deck: ${datos.deck.etiqueta}`;
    metricas.append(deck);
  }
  if (metricas.childElementCount > 0) cuerpo.append(metricas);

  if (datos.etiquetas?.length) {
    const etiquetas = el("div", "ficha-etiquetas");
    for (const texto of datos.etiquetas) {
      const chip = el("span", "chip-etiqueta");
      chip.textContent = texto;
      etiquetas.append(chip);
    }
    cuerpo.append(etiquetas);
  }

  const acciones = el("div", "ficha-acciones");
  if (datos.appid) {
    if (datos.enBiblioteca) {
      const ya = botonAccion("En biblioteca ✓", "nada", { appid: datos.appid });
      ya.disabled = true;
      acciones.append(ya);
    } else {
      acciones.append(
        botonAccion("+ Biblioteca", "agregar", {
          appid: datos.appid,
          nombre: datos.nombre,
          imagen: datos.imagen,
          precio: datos.precioValor,
        })
      );
    }
    const steam = enlace("Ver en Steam", `https://store.steampowered.com/app/${datos.appid}`);
    if (steam) acciones.append(steam);
  }
  cuerpo.append(acciones);

  seccion.append(cuerpo);
  return seccion;
};

// ---------------------------------------------------------------- precios

const construirPrecios = (datos) => {
  const seccion = el("section", "widget");
  seccion.dataset.widget = "tabla_precios";

  const titulo = el("h3");
  titulo.textContent = datos.nombre ? `Precios de ${datos.nombre}` : "Comparativa de precios";
  seccion.append(titulo);

  const resumen = el("div", "precio-resumen");

  const bloqueSteam = el("div", "precio-bloque");
  const etiquetaSteam = el("span", "precio-etiqueta");
  etiquetaSteam.textContent = "Steam Perú";
  bloqueSteam.append(etiquetaSteam);
  const steamValor = el("strong");
  steamValor.textContent = dinero(datos.precioSteam);
  bloqueSteam.append(steamValor);
  if (datos.descuentoSteam) {
    const d = insigniaDescuento(datos.descuentoSteam);
    if (d) bloqueSteam.append(d);
  }
  resumen.append(bloqueSteam);

  const bloqueMejor = el("div", "precio-bloque destacado");
  const etiquetaMejor = el("span", "precio-etiqueta");
  etiquetaMejor.textContent = "Mejor en otras tiendas";
  bloqueMejor.append(etiquetaMejor);
  const mejorValor = el("strong");
  mejorValor.textContent = datos.mejor
    ? `${datos.mejor.precioTexto} · ${datos.mejor.precioPen}`
    : "Sin datos";
  bloqueMejor.append(mejorValor);
  resumen.append(bloqueMejor);

  if (datos.historico) {
    const bloqueHist = el("div", "precio-bloque");
    const etiquetaHist = el("span", "precio-etiqueta");
    etiquetaHist.textContent = "Mínimo histórico";
    bloqueHist.append(etiquetaHist);
    const histValor = el("strong");
    histValor.textContent = `${datos.historico.precioTexto} · ${datos.historico.precioPen}`;
    bloqueHist.append(histValor);
    const fecha = el("small");
    fecha.textContent = formatoFecha.format(new Date(datos.historico.fecha));
    bloqueHist.append(fecha);
    resumen.append(bloqueHist);
  }

  seccion.append(resumen);

  if (datos.tiendas?.length) {
    const tabla = el("table", "tabla-precios");
    const thead = el("thead");
    const filaHead = el("tr");
    for (const texto of ["Tienda", "Precio", "Aprox. S/", ""]) {
      const th = el("th");
      th.textContent = texto;
      filaHead.append(th);
    }
    thead.append(filaHead);
    tabla.append(thead);

    const tbody = el("tbody");
    datos.tiendas.forEach((tienda, indice) => {
      const fila = el("tr");
      if (indice === 0) fila.classList.add("mejor-precio");

      const nombre = el("td");
      nombre.textContent = tienda.tienda;
      fila.append(nombre);

      const precio = el("td");
      precio.textContent = tienda.precioTexto;
      fila.append(precio);

      const aprox = el("td");
      aprox.textContent = tienda.precioPen;
      fila.append(aprox);

      const accion = el("td");
      const link = enlace("Ir a la tienda", tienda.enlace);
      if (link) accion.append(link);
      fila.append(accion);

      tbody.append(fila);
    });
    tabla.append(tbody);
    seccion.append(tabla);
  } else {
    const vacio = el("p", "widget-nota");
    vacio.textContent = "No hay otras tiendas registradas para este juego.";
    seccion.append(vacio);
  }

  if (datos.tipoCambio) {
    const nota = el("p", "widget-nota");
    nota.textContent = `Conversión referencial: S/ ${Number(datos.tipoCambio).toFixed(
      2
    )} por US$ 1. Los precios finales dependen de cada tienda.`;
    seccion.append(nota);
  }

  return seccion;
};

// ---------------------------------------------------------------- noticias

const construirNoticias = (datos) => {
  const seccion = el("section", "widget");
  seccion.dataset.widget = "noticias";

  const titulo = el("h3");
  titulo.textContent = `Noticias de ${datos.nombre ?? "el juego"}`;
  seccion.append(titulo);

  const lista = el("ul", "lista-noticias");
  for (const noticia of datos.noticias ?? []) {
    const item = el("li");

    const link = enlace(noticia.titulo, noticia.url);
    const encabezado = el("div", "noticia-titulo");
    if (link) {
      link.className = "";
      encabezado.append(link);
    } else {
      encabezado.textContent = noticia.titulo;
    }

    const fecha = el("time");
    fecha.textContent = formatoFecha.format(new Date(noticia.fecha));
    encabezado.append(fecha);
    item.append(encabezado);

    if (noticia.resumen) {
      const resumen = el("p");
      resumen.textContent = noticia.resumen;
      item.append(resumen);
    }

    lista.append(item);
  }
  seccion.append(lista);
  return seccion;
};

// ---------------------------------------------------------------- multimedia

const construirMedia = (datos) => {
  const seccion = el("section", "widget media");
  seccion.dataset.widget = "media";

  const titulo = el("h3");
  titulo.textContent = `Tráilers y capturas de ${datos.nombre ?? "el juego"}`;
  seccion.append(titulo);

  const peliculas = (datos.peliculas ?? []).filter((p) => p.hls || p.mp4 || p.webm);

  if (peliculas.length > 0) {
    const contenedor = el("div", "media-video-contenedor");
    const video = el("video", "media-video");
    video.controls = true;
    video.preload = "metadata";
    video.poster = urlSegura(peliculas[0].miniatura) ?? "";
    contenedor.append(video);

    const reproducir = async (pelicula) => {
      video.pause();
      video.removeAttribute("src");
      if (video._hls) {
        video._hls.destroy();
        video._hls = null;
      }

      if (pelicula.mp4) {
        video.src = pelicula.mp4;
      } else if (pelicula.webm) {
        video.src = pelicula.webm;
      } else if (pelicula.hls) {
        try {
          if (!window.Hls) await cargarScript("https://cdn.jsdelivr.net/npm/hls.js@1");
          if (window.Hls?.isSupported()) {
            const hls = new window.Hls();
            hls.loadSource(pelicula.hls);
            hls.attachMedia(video);
            video._hls = hls;
          } else {
            video.src = pelicula.hls;
          }
        } catch {
          // Si el reproductor no carga, queda el póster y el enlace a Steam.
        }
      }
      video.load();
    };

    reproducir(peliculas[0]);

    if (peliculas.length > 1) {
      const selector = el("select", "select-estado media-selector");
      peliculas.forEach((p, indice) =>
        selector.add(new Option(p.nombre ?? `Tráiler ${indice + 1}`, String(indice)))
      );
      selector.addEventListener("change", () =>
        reproducir(peliculas[Number(selector.value)])
      );
      contenedor.append(selector);
    }

    seccion.append(contenedor);
  } else {
    const nota = el("p", "widget-nota");
    nota.textContent = "No hay tráiler disponible. Puedes verlo en la tienda de Steam.";
    seccion.append(nota);
  }

  if (datos.capturas?.length) {
    const galeria = el("div", "media-galeria");
    for (const captura of datos.capturas.slice(0, 8)) {
      const url = urlSegura(captura);
      if (!url) continue;
      const a = el("a", "media-captura");
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      const img = imagen(url, `Captura de ${datos.nombre}`, "");
      if (img) {
        img.loading = "lazy";
        a.append(img);
        galeria.append(a);
      }
    }
    if (galeria.childElementCount > 0) seccion.append(galeria);
  }

  return seccion;
};

// ---------------------------------------------------------------- biblioteca

const ESTADOS = [
  ["wishlist", "Deseado"],
  ["jugando", "Jugando"],
  ["terminado", "Terminado"],
  ["abandonado", "Abandonado"],
];

const construirBiblioteca = (datos) => {
  const seccion = el("section", "widget biblioteca");
  seccion.dataset.widget = "biblioteca";

  const cabecera = el("header", "widget-cabecera biblio-cabecera");
  const titulo = el("h3");
  titulo.textContent = "Mi biblioteca";
  cabecera.append(titulo);

  const accionesCabecera = el("div", "biblio-cabecera-acciones");
  accionesCabecera.append(enlaceDescarga("CSV", "/api/biblioteca/export?formato=csv"));
  accionesCabecera.append(enlaceDescarga("MD", "/api/biblioteca/export?formato=md"));
  accionesCabecera.append(botonAccion("Revisar precios", "revisar-precios"));
  accionesCabecera.append(botonAccion("Actualizar", "refrescar"));
  cabecera.append(accionesCabecera);
  seccion.append(cabecera);

  const resumen = datos.resumen ?? {};
  const stats = el("div", "biblio-stats");
  const items = [
    ["Total", resumen.total ?? 0],
    ["Jugando", resumen.jugando ?? 0],
    ["Terminados", resumen.terminado ?? 0],
    ["Deseados", resumen.wishlist ?? 0],
    ["Alertas", resumen.alertas?.length ?? 0],
  ];
  for (const [etiqueta, valor] of items) {
    const stat = el("div", "biblio-stat");
    const numero = el("strong");
    numero.textContent = String(valor);
    const texto = el("span");
    texto.textContent = etiqueta;
    stat.append(numero, texto);
    stats.append(stat);
  }
  seccion.append(stats);

  if (!datos.juegos?.length) {
    const vacio = el("p", "widget-nota");
    vacio.textContent = "Todavía no has guardado juegos. Pídeme que agregue alguno.";
    seccion.append(vacio);
    return seccion;
  }

  const lista = el("ul", "biblio-lista");
  for (const juego of datos.juegos) {
    const item = el("li", "biblio-item");

    const img = imagen(juego.imagen, juego.nombre, "biblio-img");
    if (img) item.append(img);

    const info = el("div", "biblio-info");
    const nombre = el("strong", "biblio-nombre");
    nombre.textContent = juego.nombre;
    info.append(nombre);

    const estado = el("span", `chip-estado estado-${juego.estado}`);
    estado.textContent = juego.estadoTexto ?? juego.estado;
    info.append(estado);

    if (juego.alerta) {
      const alerta = el("span", "chip-alerta");
      alerta.textContent = "¡Llegó a tu precio!";
      info.append(alerta);
    }

    const detalles = [];
    if (juego.puntuacion) detalles.push(`Puntuación ${juego.puntuacion}/10`);
    if (juego.precioObjetivo != null) detalles.push(`Objetivo S/ ${Number(juego.precioObjetivo).toFixed(2)}`);
    if (juego.precioActual != null) detalles.push(`Actual S/ ${Number(juego.precioActual).toFixed(2)}`);

    if (detalles.length) {
      const meta = el("p", "biblio-meta");
      meta.textContent = detalles.join(" · ");
      info.append(meta);
    }

    if (juego.nota) {
      const nota = el("p", "biblio-nota");
      nota.textContent = juego.nota;
      info.append(nota);
    }

    item.append(info);

    const acciones = el("div", "biblio-acciones");

    const selector = el("select", "select-estado");
    selector.dataset.accion = "estado";
    selector.dataset.appid = String(juego.appid);
    selector.setAttribute("aria-label", `Estado de ${juego.nombre}`);
    for (const [valor, texto] of ESTADOS) {
      const opcion = el("option");
      opcion.value = valor;
      opcion.textContent = texto;
      if (juego.estado === valor) opcion.selected = true;
      selector.append(opcion);
    }
    acciones.append(selector);

    acciones.append(
      botonAccion("Precio objetivo", "objetivo", { appid: juego.appid, nombre: juego.nombre })
    );
    acciones.append(botonAccion("Quitar", "quitar", { appid: juego.appid, nombre: juego.nombre }));

    item.append(acciones);
    lista.append(item);
  }

  seccion.append(lista);
  return seccion;
};

// ---------------------------------------------------------------- comparativa

const construirComparativa = (datos) => {
  const seccion = el("section", "widget comparativa");
  seccion.dataset.widget = "comparativa";

  const titulo = el("h3");
  titulo.textContent = "Comparativa de juegos";
  seccion.append(titulo);

  if (!datos.juegos?.length) return seccion;

  const tabla = el("table", "tabla-comparativa");
  const thead = el("thead");
  const filaHead = el("tr");
  filaHead.append(el("th"));
  for (const juego of datos.juegos) {
    const th = el("th");
    th.textContent = juego.nombre;
    filaHead.append(th);
  }
  thead.append(filaHead);
  tabla.append(thead);

  const filas = [
    ["Precio", (j) => j.precioTexto],
    ["Descuento", (j) => (j.descuento ? `-${j.descuento}%` : "—")],
    ["Metacritic", (j) => j.metacritic ?? "—"],
    ["Reseñas", (j) => (j.porcentajePositivo != null ? `${j.porcentajePositivo}%` : "—")],
    ["Duración", (j) => (j.horas ? `≈ ${j.horas} h` : "—")],
    ["Mínimo histórico", (j) => j.historicoTexto ?? "—"],
    ["Etiquetas", (j) => j.etiquetas?.join(", ") || "—"],
  ];

  const tbody = el("tbody");
  for (const [etiqueta, valor] of filas) {
    const fila = el("tr");
    const th = el("th");
    th.textContent = etiqueta;
    fila.append(th);
    for (const juego of datos.juegos) {
      const td = el("td");
      td.textContent = valor(juego);
      fila.append(td);
    }
    tbody.append(fila);
  }
  tabla.append(tbody);
  seccion.append(tabla);

  return seccion;
};

// ---------------------------------------------------------------- análisis

const construirAnalisis = (datos) => {
  const seccion = el("section", "widget analisis");
  seccion.dataset.widget = "analisis";

  const titulo = el("h3");
  titulo.textContent = "Análisis de tu biblioteca";
  seccion.append(titulo);

  const stats = el("div", "biblio-stats");
  const items = [
    ["Total", datos.total],
    ["Jugando", datos.estados?.jugando ?? 0],
    ["Terminados", datos.estados?.terminado ?? 0],
    ["Deseados", datos.estados?.wishlist ?? 0],
    ["Backlog", `${datos.horasBacklog ?? 0} h`],
    ["Valor", datos.valorTexto ?? "—"],
    ["Promedio", datos.promedio ? `${datos.promedio}/10` : "—"],
    ["Alertas", datos.alertas ?? 0],
  ];
  for (const [etiqueta, valor] of items) {
    const stat = el("div", "biblio-stat");
    const numero = el("strong");
    numero.textContent = String(valor ?? "—");
    const texto = el("span");
    texto.textContent = etiqueta;
    stat.append(numero, texto);
    stats.append(stat);
  }
  seccion.append(stats);

  if (datos.etiquetas?.length) {
    const bloque = el("div", "analisis-etiquetas");
    const subtitulo = el("h4");
    subtitulo.textContent = "Tus etiquetas favoritas";
    bloque.append(subtitulo);

    const maximo = Math.max(...datos.etiquetas.map((e) => e.total), 1);
    for (const etiqueta of datos.etiquetas) {
      const fila = el("div", "barra-etiqueta");
      const nombre = el("span");
      nombre.textContent = etiqueta.nombre;
      const barra = el("div", "barra");
      const relleno = el("div", "barra-relleno");
      relleno.style.width = `${Math.max(6, (etiqueta.total / maximo) * 100)}%`;
      barra.append(relleno);
      const total = el("span", "barra-total");
      total.textContent = String(etiqueta.total);
      fila.append(nombre, barra, total);
      bloque.append(fila);
    }
    seccion.append(bloque);
  }

  const nota = el("p", "widget-nota");
  nota.textContent = `Valor actual ${datos.valorTexto ?? "—"} · objetivo de ahorro ${
    datos.objetivoTexto ?? "—"
  }. Las horas de backlog son una estimación de SteamSpy.`;
  seccion.append(nota);

  return seccion;
};

// ---------------------------------------------------------------- requisitos

const construirRequisitos = (datos) => {
  const seccion = el("section", "widget requisitos");
  seccion.dataset.widget = "requisitos";

  const titulo = el("h3");
  titulo.textContent = `Requisitos de ${datos.nombre ?? "el juego"}`;
  seccion.append(titulo);

  if (datos.deck?.etiqueta) {
    const deck = el("span", "chip-etiqueta");
    deck.textContent = `Steam Deck: ${datos.deck.etiqueta}`;
    seccion.append(deck);
  }

  const grid = el("div", "requisitos-grid");
  const bloque = (tituloBloque, texto) => {
    const div = el("div", "requisitos-bloque");
    const h4 = el("h4");
    h4.textContent = tituloBloque;
    const p = el("p", "requisitos-texto");
    p.textContent = texto || "No publicado por Steam.";
    div.append(h4, p);
    return div;
  };

  grid.append(bloque("Mínimo", datos.requisitos?.minimo));
  grid.append(bloque("Recomendado", datos.requisitos?.recomendado));
  seccion.append(grid);

  const pc = el("div", "requisitos-pc");
  const h4 = el("h4");
  h4.textContent = "Tu PC";
  pc.append(h4);

  if (datos.tienePc) {
    const lista = el("ul", "requisitos-lista");
    const partes = [
      ["CPU", datos.pc?.cpu],
      ["GPU", datos.pc?.gpu],
      ["RAM", datos.pc?.ram],
      ["Sistema", datos.pc?.so],
    ].filter(([, valor]) => valor);
    for (const [etiqueta, valor] of partes) {
      const li = el("li");
      const strong = el("strong");
      strong.textContent = `${etiqueta}: `;
      li.append(strong, document.createTextNode(valor));
      lista.append(li);
    }
    pc.append(lista);
  } else {
    const aviso = el("p", "widget-nota");
    aviso.textContent =
      "Configura tu CPU, GPU, RAM y sistema en Ajustes para que el asistente pueda comparar.";
    pc.append(aviso);
  }

  seccion.append(pc);
  return seccion;
};

// ---------------------------------------------------------------- DLC

const construirDlc = (datos) => {
  const seccion = el("section", "widget");
  seccion.dataset.widget = "dlc";

  const titulo = el("h3");
  titulo.textContent = `DLC y ediciones de ${datos.nombre ?? "el juego"}`;
  seccion.append(titulo);

  if (datos.ediciones?.length) {
    const subtitulo = el("h4", "subtitulo-widget");
    subtitulo.textContent = "Ediciones";
    seccion.append(subtitulo);

    const lista = el("ul", "dlc-lista");
    for (const edicion of datos.ediciones) {
      const li = el("li", "dlc-item");
      const nombre = el("span");
      nombre.textContent = edicion.texto;
      const precio = el("strong");
      precio.textContent = edicion.precioTexto ?? "";
      li.append(nombre, precio);
      lista.append(li);
    }
    seccion.append(lista);
  }

  if (datos.dlcs?.length) {
    const subtitulo = el("h4", "subtitulo-widget");
    subtitulo.textContent = "DLC";
    seccion.append(subtitulo);

    const lista = el("ul", "dlc-lista");
    for (const dlc of datos.dlcs) {
      const li = el("li", "dlc-item");
      const img = imagen(dlc.imagen, dlc.nombre, "dlc-img");
      if (img) li.append(img);

      const info = el("div", "dlc-info");
      const nombre = el("span", "dlc-nombre");
      nombre.textContent = dlc.nombre;
      const meta = el("small");
      meta.textContent = [dlc.fecha, dlc.descuento ? `-${dlc.descuento}%` : null]
        .filter(Boolean)
        .join(" · ");
      info.append(nombre, meta);
      li.append(info);

      const precio = el("strong");
      precio.textContent = dlc.precioTexto ?? "—";
      li.append(precio);
      lista.append(li);
    }
    seccion.append(lista);
  }

  return seccion;
};

// ---------------------------------------------------------------- plan

const construirPlan = (datos) => {
  const seccion = el("section", "widget plan");
  seccion.dataset.widget = "plan";

  const titulo = el("h3");
  titulo.textContent = `Plan para ${datos.horasDisponibles ?? "?"} horas`;
  seccion.append(titulo);

  const resumen = el("p", "widget-subtitulo");
  resumen.textContent = `${datos.juegos?.length ?? 0} juegos · ${datos.totalHoras ?? 0} h estimadas`;
  seccion.append(resumen);

  const lista = el("div", "plan-lista");
  for (const juego of datos.juegos ?? []) {
    const item = el("article", "plan-item");
    const img = imagen(juego.imagen, juego.nombre, "plan-img");
    if (img) item.append(img);

    const info = el("div", "plan-info");
    const nombre = el("h4");
    nombre.textContent = juego.nombre;
    const meta = el("p", "plan-meta");
    meta.textContent = [
      `${juego.horas} h`,
      juego.puntuacion ? `${juego.puntuacion}/10` : null,
      juego.estado,
    ]
      .filter(Boolean)
      .join(" · ");
    info.append(nombre, meta);

    if (juego.etiquetas?.length) {
      const chips = el("div", "ficha-etiquetas");
      for (const etiqueta of juego.etiquetas) {
        const chip = el("span", "chip-etiqueta");
        chip.textContent = etiqueta;
        chips.append(chip);
      }
      info.append(chips);
    }

    item.append(info);
    lista.append(item);
  }
  seccion.append(lista);

  return seccion;
};

// ---------------------------------------------------------------- digest

const construirDigest = (datos) => {
  const seccion = el("section", "widget digest");
  seccion.dataset.widget = "digest";

  const titulo = el("h3");
  titulo.textContent = "Tu resumen";
  seccion.append(titulo);

  const grid = el("div", "digest-grid");

  const bloque = (tituloBloque, contenido, vacio) => {
    const div = el("section", "digest-bloque");
    const h4 = el("h4");
    h4.textContent = tituloBloque;
    div.append(h4);
    if (contenido) div.append(contenido);
    else {
      const p = el("p", "widget-nota");
      p.textContent = vacio;
      div.append(p);
    }
    return div;
  };

  // Alertas
  let alertas = null;
  if (datos.alertas?.length) {
    alertas = el("ul", "digest-lista");
    for (const alerta of datos.alertas) {
      const li = el("li");
      const strong = el("strong");
      strong.textContent = `${alerta.nombre}: `;
      li.append(strong, document.createTextNode(`${alerta.precioActual} (objetivo ${alerta.precioObjetivo})`));
      alertas.append(li);
    }
  }
  grid.append(bloque("Alertas de precio", alertas, "Ningún juego alcanzó su objetivo."));

  // Ofertas de la biblioteca
  let ofertas = null;
  if (datos.ofertas?.length) {
    ofertas = el("ul", "digest-lista");
    for (const oferta of datos.ofertas) {
      const li = el("li");
      const link = enlace(oferta.nombre, oferta.enlace);
      if (link) {
        link.className = "digest-link";
        li.append(link);
      } else {
        const strong = el("strong");
        strong.textContent = oferta.nombre;
        li.append(strong);
      }
      const detalle = el("span", "digest-detalle");
      detalle.textContent = `${oferta.precioTexto} · ${oferta.notaPrecio ?? ""}`;
      li.append(detalle);
      ofertas.append(li);
    }
  }
  grid.append(bloque("Ofertas de tu lista", ofertas, "Sin ofertas más baratas que Steam."));

  // Noticias
  let noticias = null;
  if (datos.noticias?.length) {
    noticias = el("div", "digest-noticias");
    for (const grupo of datos.noticias) {
      const h5 = el("h5");
      h5.textContent = grupo.nombre;
      noticias.append(h5);
      const lista = el("ul", "digest-lista");
      for (const noticia of grupo.noticias) {
        const li = el("li");
        const link = enlace(noticia.titulo, noticia.url);
        if (link) {
          link.className = "digest-link";
          li.append(link);
        } else {
          li.textContent = noticia.titulo;
        }
        lista.append(li);
      }
      noticias.append(lista);
    }
  }
  grid.append(bloque("Novedades de tus juegos", noticias, "Sin novedades recientes."));

  // Próximos
  let proximos = null;
  if (datos.proximos?.length) {
    proximos = el("ul", "digest-lista");
    for (const juego of datos.proximos) {
      const li = el("li");
      li.textContent = juego.nombre;
      proximos.append(li);
    }
  }
  grid.append(bloque("Próximos lanzamientos", proximos, "Sin lanzamientos destacados."));

  // Oferta del día
  let destacada = null;
  if (datos.ofertaDelDia) {
    destacada = el("div", "digest-destacada");
    const img = imagen(datos.ofertaDelDia.imagen, datos.ofertaDelDia.nombre, "digest-img");
    if (img) destacada.append(img);
    const info = el("div");
    const nombre = el("strong");
    nombre.textContent = datos.ofertaDelDia.nombre;
    const detalle = el("p", "widget-nota");
    detalle.textContent = `${datos.ofertaDelDia.precioTexto} · ${datos.ofertaDelDia.tienda}`;
    const link = enlace("Ver oferta", datos.ofertaDelDia.enlace);
    info.append(nombre, detalle);
    if (link) info.append(link);
    destacada.append(info);
  }
  grid.append(bloque("Oferta del día", destacada, "Sin oferta destacada."));

  seccion.append(grid);
  return seccion;
};

// ---------------------------------------------------------------- historial

const SVG_NS = "http://www.w3.org/2000/svg";

const crearSvg = (etiqueta, atributos = {}) => {
  const nodo = document.createElementNS(SVG_NS, etiqueta);
  for (const [clave, valor] of Object.entries(atributos)) nodo.setAttribute(clave, valor);
  return nodo;
};

const construirHistorial = (datos) => {
  const seccion = el("section", "widget historial");
  seccion.dataset.widget = "historial";

  const titulo = el("h3");
  titulo.textContent = `Historial de precios de ${datos.nombre ?? "el juego"}`;
  seccion.append(titulo);

  if (!datos.puntos?.length) {
    const nota = el("p", "widget-nota");
    nota.textContent = "Aún no hay registros de precio para este juego.";
    seccion.append(nota);
    return seccion;
  }

  const resumen = el("div", "precio-resumen");
  const bloque = (etiqueta, valor, destacado = false) => {
    const div = el("div", `precio-bloque${destacado ? " destacado" : ""}`);
    const tituloBloque = el("span", "precio-etiqueta");
    tituloBloque.textContent = etiqueta;
    const valorBloque = el("strong");
    valorBloque.textContent = valor;
    div.append(tituloBloque, valorBloque);
    return div;
  };

  resumen.append(
    bloque("Mínimo registrado", `S/ ${Number(datos.minimo).toFixed(2)}`),
    bloque("Promedio", `S/ ${Number(datos.promedio).toFixed(2)}`),
    bloque("Precio actual", `S/ ${Number(datos.actual).toFixed(2)}`, true)
  );
  seccion.append(resumen);

  if (datos.recomendacion) {
    const badge = el("span", `chip-precio nivel-${datos.recomendacion.nivel}`);
    badge.textContent = datos.recomendacion.texto;
    seccion.append(badge);
  }

  const puntos =
    datos.puntos.length > 30
      ? datos.puntos.filter(
          (_, indice) =>
            indice % Math.ceil(datos.puntos.length / 30) === 0 ||
            indice === datos.puntos.length - 1
        )
      : datos.puntos;

  const W = 640;
  const H = 220;
  const P = 32;
  const valores = puntos.map((p) => Number(p.precio));
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const rango = max - min || 1;
  const x = (indice) => P + (indice * (W - 2 * P)) / Math.max(1, puntos.length - 1);
  const y = (valor) => H - P - ((valor - min) / rango) * (H - 2 * P);

  const svg = crearSvg("svg", {
    viewBox: `0 0 ${W} ${H}`,
    class: "grafico-precios",
    role: "img",
    "aria-label": `Historial de precios de ${datos.nombre ?? "el juego"}`,
  });

  svg.append(
    crearSvg("line", {
      x1: P,
      y1: H - P,
      x2: W - P,
      y2: H - P,
      class: "grafico-eje",
    })
  );

  const area = [
    `M ${x(0)} ${H - P}`,
    ...puntos.map((p, indice) => `L ${x(indice)} ${y(Number(p.precio))}`),
    `L ${x(puntos.length - 1)} ${H - P}`,
    "Z",
  ].join(" ");

  svg.append(crearSvg("path", { d: area, class: "grafico-area" }));
  svg.append(
    crearSvg("polyline", {
      points: puntos.map((p, indice) => `${x(indice)},${y(Number(p.precio))}`).join(" "),
      class: "grafico-linea",
    })
  );

  puntos.forEach((punto, indice) => {
    svg.append(
      crearSvg("circle", {
        cx: x(indice),
        cy: y(Number(punto.precio)),
        r: indice === puntos.length - 1 ? 4.5 : 3,
        class:
          indice === puntos.length - 1 ? "grafico-punto actual" : "grafico-punto",
      })
    );
  });

  const etiquetaMax = crearSvg("text", { x: P, y: P - 12, class: "grafico-texto" });
  etiquetaMax.textContent = `S/ ${max.toFixed(2)}`;
  const etiquetaMin = crearSvg("text", { x: P, y: H - 8, class: "grafico-texto" });
  etiquetaMin.textContent = `S/ ${min.toFixed(2)}`;
  svg.append(etiquetaMax, etiquetaMin);

  seccion.append(svg);

  const fechas = el("div", "grafico-fechas");
  const primera = el("span");
  const ultima = el("span");
  const fechaDe = (texto) => {
    const fecha = new Date(`${texto.replace(" ", "T")}Z`);
    return Number.isNaN(fecha.getTime()) ? texto : formatoFecha.format(fecha);
  };
  primera.textContent = fechaDe(datos.puntos[0].fecha);
  ultima.textContent = fechaDe(datos.puntos[datos.puntos.length - 1].fecha);
  fechas.append(primera, ultima);
  seccion.append(fechas);

  const nota = el("p", "widget-nota");
  nota.textContent =
    "Se guarda un punto por revisión (máximo uno cada 6 h). Los precios están en soles.";
  seccion.append(nota);

  return seccion;
};

// ---------------------------------------------------------------- reseñas

const construirResenas = (datos) => {
  const seccion = el("section", "widget resenas");
  seccion.dataset.widget = "resenas";

  const titulo = el("h3");
  titulo.textContent = `Reseñas de ${datos.nombre ?? "el juego"}`;
  seccion.append(titulo);

  if (datos.prensa) {
    const prensa = el("blockquote", "resenas-prensa");
    prensa.textContent = datos.prensa;
    seccion.append(prensa);
  }

  const stats = el("div", "biblio-stats");
  const items = [
    ["Positivas", datos.positivas],
    ["Negativas", datos.negativas],
    ["Total", datos.total],
    ["Metacritic", datos.metacritic ?? "—"],
  ];
  for (const [etiqueta, valor] of items) {
    const stat = el("div", "biblio-stat");
    const numero = el("strong");
    numero.textContent = String(valor ?? "—");
    const texto = el("span");
    texto.textContent = etiqueta;
    stat.append(numero, texto);
    stats.append(stat);
  }
  seccion.append(stats);

  const total = Number(datos.total) || 1;
  const barra = el("div", "resenas-barra");
  const positivas = el("span", "resenas-positivas");
  positivas.style.width = `${(Number(datos.positivas) / total) * 100}%`;
  const negativas = el("span", "resenas-negativas");
  negativas.style.width = `${(Number(datos.negativas) / total) * 100}%`;
  barra.append(positivas, negativas);
  seccion.append(barra);

  if (datos.porcentaje != null) {
    const porcentaje = el("p", "resenas-porcentaje");
    porcentaje.textContent = `${datos.porcentaje}% de reseñas positivas`;
    seccion.append(porcentaje);
  }

  const nota = el("p", "widget-nota");
  nota.textContent = datos.nota;
  seccion.append(nota);

  const link = enlace("Leer reseñas en Steam", datos.url);
  if (link) {
    link.style.marginTop = "8px";
    seccion.append(link);
  }

  return seccion;
};

// ---------------------------------------------------------------- registro

const constructores = {
  lista_juegos: construirLista,
  tarjeta_juego: construirFicha,
  tabla_precios: construirPrecios,
  noticias: construirNoticias,
  biblioteca: construirBiblioteca,
  media: construirMedia,
  comparativa: construirComparativa,
  analisis: construirAnalisis,
  requisitos: construirRequisitos,
  dlc: construirDlc,
  plan: construirPlan,
  digest: construirDigest,
  historial: construirHistorial,
  resenas: construirResenas,
};

const construir = (widget) => {
  const constructor = constructores[widget?.tipo];
  if (!constructor) {
    console.warn("Widget desconocido:", widget?.tipo);
    return null;
  }
  return constructor(widget.datos ?? {});
};

/** Añade un widget a un contenedor y devuelve el nodo creado. */
export const renderWidget = (widget, contenedor) => {
  const nodo = construir(widget);
  if (!nodo) return null;
  contenedor.append(nodo);
  return nodo;
};

/** Reemplaza todos los paneles de biblioteca visibles por el estado más reciente. */
export const sincronizarBiblioteca = (datos) => {
  document.querySelectorAll('[data-widget="biblioteca"]').forEach((viejo) => {
    viejo.replaceWith(construirBiblioteca(datos));
  });
};

/** Marca como "en biblioteca" las tarjetas cuyo appid ya está guardado. */
export const marcarAgregados = (appids) => {
  const guardados = new Set((appids ?? []).map(String));
  document.querySelectorAll('[data-accion="agregar"]').forEach((boton) => {
    if (!guardados.has(String(boton.dataset.appid))) return;
    boton.textContent = "En biblioteca ✓";
    boton.disabled = true;
  });
};
