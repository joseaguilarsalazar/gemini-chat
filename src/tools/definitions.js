import { Type } from "@google/genai";

const appid = {
  type: Type.INTEGER,
  description: "Identificador de Steam del juego (steam_appid).",
};

const estado = {
  type: Type.STRING,
  enum: ["wishlist", "jugando", "terminado", "abandonado"],
  description: "Estado del juego en la biblioteca del usuario.",
};

/**
 * Declaraciones de funciones que Gemini puede invocar.
 * Los nombres y descripciones son parte del prompt: mientras más claros,
 * mejor elige el modelo cuándo usar cada herramienta.
 */
export const declaracionesHerramientas = [
  {
    name: "buscar_juegos",
    description:
      "Busca videojuegos por título en la tienda de Steam y devuelve precio en soles peruanos. " +
      "Úsala cuando el usuario nombre un juego o pida recomendaciones por título. " +
      "No inventes precios: si el usuario pregunta por un precio, primero busca el juego.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        consulta: {
          type: Type.STRING,
          description: "Título o palabras clave. Ejemplos: 'Hades', 'Elden Ring', 'zombies cooperativo'.",
        },
      },
      required: ["consulta"],
    },
  },
  {
    name: "detalles_juego",
    description:
      "Obtiene la ficha completa de un juego: precio en soles, descuento, géneros, etiquetas, " +
      "reseñas, fecha y descripción. Úsala después de buscar_juegos cuando necesites hablar de un juego concreto.",
    parameters: {
      type: Type.OBJECT,
      properties: { appid },
      required: ["appid"],
    },
  },
  {
    name: "comparar_precios",
    description:
      "Compara el precio de Steam (en soles) con las ofertas de otras tiendas (CheapShark, en dólares) " +
      "y muestra el precio histórico más bajo. Úsala cuando pregunten dónde comprar más barato o si vale la pena esperar una oferta.",
    parameters: {
      type: Type.OBJECT,
      properties: { appid },
      required: ["appid"],
    },
  },
  {
    name: "ofertas",
    description:
      "Lista las mejores ofertas de videojuegos del momento en tiendas como Steam, GOG, Epic o Fanatical. " +
      "Filtra por descuento mínimo y precio máximo en dólares.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        descuentoMinimo: {
          type: Type.NUMBER,
          description: "Porcentaje mínimo de descuento (por defecto 50).",
        },
        precioMaximo: {
          type: Type.NUMBER,
          description: "Precio máximo en dólares (por defecto 20).",
        },
        metacriticMinimo: {
          type: Type.NUMBER,
          description: "Puntuación mínima de Metacritic (ej. 80). Opcional.",
        },
        ratingMinimo: {
          type: Type.NUMBER,
          description: "Porcentaje mínimo de reseñas positivas en Steam (ej. 80). Opcional.",
        },
        limite: {
          type: Type.INTEGER,
          description: "Cantidad de ofertas a devolver (máximo 10).",
        },
      },
    },
  },
  {
    name: "tendencias",
    description:
      "Devuelve los juegos más vendidos y las novedades destacadas de Steam en este momento, con precios en soles.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "descubrir_por_etiqueta",
    description:
      "Descubre juegos populares por etiqueta/género de Steam. La etiqueta debe ir en inglés " +
      "(por ejemplo: 'Roguelike', 'Story Rich', 'Co-op', 'Horror', 'Souls-like', ' farming'). " +
      "Úsala para recomendaciones por gusto o estado de ánimo.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        etiqueta: {
          type: Type.STRING,
          description: "Etiqueta de Steam en inglés. Ejemplos: 'Roguelike', 'Story Rich', 'Co-op'.",
        },
        limite: {
          type: Type.INTEGER,
          description: "Cantidad de juegos a devolver (máximo 10).",
        },
      },
      required: ["etiqueta"],
    },
  },
  {
    name: "noticias_juego",
    description:
      "Devuelve las noticias y anuncios recientes de un juego en Steam. Úsala cuando pregunten por novedades, actualizaciones o parches.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        appid,
        cantidad: {
          type: Type.INTEGER,
          description: "Número de noticias (máximo 5).",
        },
      },
      required: ["appid"],
    },
  },
  {
    name: "ver_biblioteca",
    description:
      "Muestra la biblioteca personal del usuario con todos sus juegos, estados, notas y precios objetivo.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "agregar_a_biblioteca",
    description:
      "Agrega un juego a la biblioteca del usuario (wishlist por defecto) y muestra el panel actualizado. " +
      "Úsala cuando digan 'agrégalo', 'lo quiero', 'anótalo' o pidan guardar un juego.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        appid,
        estado,
        precioObjetivo: {
          type: Type.NUMBER,
          description: "Precio objetivo en soles para avisar cuando baje (opcional).",
        },
        nota: { type: Type.STRING, description: "Nota corta del usuario (opcional)." },
      },
      required: ["appid"],
    },
  },
  {
    name: "actualizar_juego_biblioteca",
    description:
      "Actualiza un juego que ya está en la biblioteca: cambia estado, puntuación (1-10), nota o precio objetivo.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        appid,
        estado,
        puntuacion: {
          type: Type.INTEGER,
          description: "Puntuación personal del 1 al 10.",
        },
        nota: { type: Type.STRING },
        precioObjetivo: {
          type: Type.NUMBER,
          description: "Precio objetivo en soles.",
        },
      },
      required: ["appid"],
    },
  },
  {
    name: "quitar_de_biblioteca",
    description: "Elimina un juego de la biblioteca del usuario.",
    parameters: {
      type: Type.OBJECT,
      properties: { appid },
      required: ["appid"],
    },
  },
  {
    name: "resumen_biblioteca",
    description:
      "Devuelve estadísticas de la biblioteca: cuántos juegos hay por estado y qué juegos alcanzaron su precio objetivo. " +
      "Úsala cuando pregunten qué jugar, cuántos juegos tienen o si algún juego llegó a su precio.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "ofertas_de_mi_biblioteca",
    description:
      "Busca ofertas en otras tiendas para los juegos que el usuario ya guardó (por defecto, solo deseados). " +
      "Úsala cuando pregunten '¿algo de mi lista está en oferta?' o '¿dónde compro lo que quiero?'.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        soloDeseos: {
          type: Type.BOOLEAN,
          description: "Si es true, solo revisa la lista de deseados (por defecto true).",
        },
        limite: {
          type: Type.INTEGER,
          description: "Cantidad de juegos a revisar (máximo 8).",
        },
      },
    },
  },
  {
    name: "revisar_alertas",
    description:
      "Revisa y actualiza los precios de la biblioteca, y devuelve los juegos que alcanzaron su precio objetivo. " +
      "Úsala cuando pidan 'revisa mis precios' o '¿bajó algo de mi lista?'.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        limite: {
          type: Type.INTEGER,
          description: "Cantidad de juegos a revisar (máximo 20).",
        },
      },
    },
  },
  {
    name: "juegos_similares",
    description:
      "Recomienda juegos parecidos a uno dado, usando sus etiquetas de Steam y excluyendo los que ya están en la biblioteca.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        appid,
        limite: {
          type: Type.INTEGER,
          description: "Cantidad de recomendaciones (máximo 10).",
        },
      },
      required: ["appid"],
    },
  },
  {
    name: "juegos_cortos",
    description:
      "Lista juegos populares y bien valorados que se pueden terminar en pocas horas. Útil para 'algo corto para el fin de semana'.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        horas: {
          type: Type.NUMBER,
          description: "Duración máxima estimada en horas (por defecto 8).",
        },
        precioMaximo: {
          type: Type.NUMBER,
          description: "Precio máximo en dólares (por defecto 20).",
        },
        limite: {
          type: Type.INTEGER,
          description: "Cantidad de juegos (máximo 10).",
        },
      },
    },
  },
  {
    name: "trailers_juego",
    description:
      "Muestra el tráiler y las capturas de un juego. Úsala cuando pidan ver cómo se juega o ver imágenes.",
    parameters: {
      type: Type.OBJECT,
      properties: { appid },
      required: ["appid"],
    },
  },
  {
    name: "filtrar_catalogo",
    description:
      "Busca juegos populares aplicando filtros de idioma, edad máxima y precio en soles. " +
      "Úsala para 'juegos en español', 'aptos para niños' o 'menos de S/ 50'.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        etiqueta: {
          type: Type.STRING,
          description: "Etiqueta de Steam en inglés (opcional). Si se omite, usa los más jugados.",
        },
        idioma: {
          type: Type.STRING,
          description: "Idioma requerido: 'español' (subtítulos) o 'audio español'. Por defecto 'español'.",
        },
        edadMaxima: {
          type: Type.NUMBER,
          description: "Edad mínima recomendada máxima (ej. 13). Opcional.",
        },
        precioMaximo: {
          type: Type.NUMBER,
          description: "Precio máximo en soles. Opcional.",
        },
        limite: {
          type: Type.INTEGER,
          description: "Cantidad de juegos (máximo 6).",
        },
      },
    },
  },
  {
    name: "proximos_lanzamientos",
    description: "Muestra los próximos lanzamientos destacados de Steam con su fecha estimada.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        limite: {
          type: Type.INTEGER,
          description: "Cantidad de lanzamientos (máximo 8).",
        },
      },
    },
  },
  {
    name: "mas_jugados",
    description:
      "Muestra los juegos con más jugadores concurrentes ahora mismo. Úsala para 'qué está de moda' o 'qué juega todo el mundo'.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        limite: {
          type: Type.INTEGER,
          description: "Cantidad de juegos (máximo 10).",
        },
      },
    },
  },
];
