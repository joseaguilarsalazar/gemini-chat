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

  const refrescar = botonAccion("Actualizar", "refrescar");
  cabecera.append(refrescar);
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

// ---------------------------------------------------------------- registro

const constructores = {
  lista_juegos: construirLista,
  tarjeta_juego: construirFicha,
  tabla_precios: construirPrecios,
  noticias: construirNoticias,
  biblioteca: construirBiblioteca,
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
