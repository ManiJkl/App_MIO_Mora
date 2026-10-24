# MIO Tracker Cali

Aplicación web para seguir en tiempo real los buses del sistema MIO de Cali.
Muestra en un mapa interactivo la posición de los buses, el recorrido y las
paradas de cada ruta, y calcula cuál es la parada más cercana a ti junto con
sus próximas llegadas.

Es una aplicación 100 % estática (HTML + CSS + JavaScript): no necesita
compilación ni instalar dependencias.

## Funcionalidades

### Rutas y buses
- Catálogo de más de 100 rutas MIO: troncales (`T`), expresas (`E`),
  pretroncales (`P`) y alimentadoras (`A` / `AL`).
- Selección múltiple: puedes monitorear varias rutas a la vez, cada una con su
  propio color.
- Buscador por código, nombre o tipo de ruta, con contador de resultados.
- Marcadores de bus animados con el código de la ruta y un popup con su estado.
- Actualización automática cada 12 segundos y botón de refresco manual.
- Dibujo del recorrido de cada ruta seleccionada sobre el mapa.

### Paradas y llegadas
- Paradas de cada ruta seleccionada, dibujadas como marcadores sobre el
  recorrido.
- Al tocar una parada se consultan sus próximas llegadas, ordenadas por tiempo
  de espera.
- Panel **Cerca de mí** con la parada más cercana (entre las rutas
  seleccionadas), la distancia a pie y sus llegadas.
- La parada más cercana se resalta en el mapa.

### Ubicación (GPS)
- Botón **Seguimiento** para ubicarte en el mapa y que este te siga.
- Círculo de precisión alrededor de tu posición.
- Suavizado de la señal GPS (filtro exponencial según la precisión) y
  recentrado solo si te mueves más de 25 m, para evitar saltos del mapa.
- Mensajes claros cuando el permiso se deniega, el GPS no responde o la página
  no se sirve por HTTPS.

### Mapa
- Tres modos: satélite, calles y terreno.
- Botón **Centrar** para volver a la vista general de Cali.
- Capa opcional de **tráfico en vivo** de TomTom, limitada al área de Cali.

### Interfaz
- 12 colores de interfaz: azul, ámbar, turquesa, violeta, rosa, lima, índigo,
  rojo, amarillo, verde, blanco y negro.
- Apariencia oscura, clara o automática (según el sistema).
- Diseño responsivo: panel lateral en escritorio y hoja inferior desplegable
  en móvil.
- Indicador de estado de conexión (conectando, en línea, despertando servidor,
  servidor caído) y hora de la última actualización.
- Persistencia local de rutas seleccionadas, color y apariencia.

## Cómo funciona

1. **Carga.** `index.html` aplica el tema guardado antes del primer render
   (para evitar parpadeos) y carga Leaflet, Font Awesome, Google Fonts y
   `app.js`. Al iniciar, `app.js` crea el mapa centrado en Cali, restaura las
   rutas seleccionadas desde `localStorage` y genera las tarjetas de rutas.
2. **Selección de rutas.** En la pestaña **Rutas** eliges una o más rutas. La
   selección se guarda en el navegador y dispara una consulta de datos.
3. **Consulta de datos.** Para cada ruta seleccionada la app pide al backend,
   en paralelo:
   - los buses activos (`/api/buses/{ruta}`),
   - el recorrido (`/api/recorrido/{ruta}`), que se pide una sola vez y se
     guarda en memoria,
   - las paradas (`/api/paradas/{ruta}`), también cacheadas.
4. **Dibujo en el mapa.** El recorrido se dibuja como línea, las paradas como
   marcadores y los buses como marcadores animados que se mueven al recibir
   nuevas posiciones. Al deseleccionar una ruta se retiran sus capas.
5. **Actualización.** Un temporizador repite la consulta de buses cada 12
   segundos. La insignia del encabezado refleja el estado: si todas las
   peticiones fallan con error de servidor se muestra "Servidor caído"; si no
   hay respuesta aún, "Despertando servidor" (el backend gratuito puede tardar
   en arrancar).
6. **Parada más cercana.** Al activar **Seguimiento**, el navegador entrega
   tu posición, que se suaviza con un filtro. Con la fórmula de Haversine se
   calcula la distancia a todas las paradas de las rutas seleccionadas y se
   elige la menor. Luego se consultan sus llegadas
   (`/api/llegadas/{parada}`) y se muestran ordenadas por minutos restantes.
   Las respuestas obsoletas se descartan si la parada más cercana cambia
   mientras se consulta.
7. **Preferencias.** Tema, apariencia y rutas se guardan en
   `localStorage`.

## Cómo usarla

1. Abre la pestaña **Rutas** y selecciona una o varias (usa el buscador para
   filtrar).
2. Toca un bus para ver su popup, o una parada para consultar sus llegadas.
3. Pulsa **Seguimiento** y concede el permiso de ubicación. En la pestaña
   **Cerca de mí** verás la parada más cercana y los próximos buses.
4. Cambia el modo del mapa con el selector de capas, o usa **Centrar** para
   volver a Cali.
5. Pulsa **Tráfico** para activar o desactivar la capa de tráfico.
6. Abre **Configuración** (engranaje) para cambiar el color o la apariencia.

## Ejecución local

Conviene servir la aplicación por HTTP(S) en lugar de abrir `index.html`
directamente: la geolocalización exige un contexto seguro (HTTPS o
`localhost`).

```bash
python -m http.server 8000
```

Luego abre <http://localhost:8000>. Cualquier servidor estático equivalente
sirve.

### Requisitos
- Navegador moderno con JavaScript, geolocalización y `localStorage`.
- Conexión a internet para las librerías, los mapas y el backend.

### Dependencias (por CDN)
- [Leaflet 1.9.4](https://leafletjs.com/)
- [Font Awesome 6.4.0](https://fontawesome.com/)
- Tipografías de Google Fonts: Bricolage Grotesque y Figtree.

## Configuración para desarrolladores

Las constantes principales están al inicio de `app.js`:

| Constante | Descripción |
| --- | --- |
| `RENDER_API_BASE`, `RENDER_ROUTE_BASE`, `RENDER_STOPS_BASE`, `RENDER_ARRIVALS_BASE` | URLs del backend. |
| `ALL_ROUTE_CODES` | Lista de rutas disponibles. Añade o quita códigos aquí. |
| `FEATURED_ROUTES` | Rutas con nombre, descripción y color propios. |
| `TOMTOM_API_KEY` | Clave de TomTom para la capa de tráfico; se comparte entre todos los usuarios. |
| `CALI_TRAFFIC_BOUNDS` | Límites geográficos de la capa de tráfico. |
| `GPS_FILTER_*`, `GPS_RECENTER_THRESHOLD_METERS` | Ajustes del suavizado del GPS. |

## Estructura del proyecto

| Archivo | Responsabilidad |
| --- | --- |
| `index.html` | Estructura de la interfaz y carga de recursos externos. |
| `styles.css` | Estilos, temas de color, modo claro/oscuro y diseño responsivo. |
| `app.js` | Estado, mapa, rutas, paradas, GPS y consumo de la API. |
| `icon.png` | Logo y favicon. |

## Backend

El frontend consume el backend `mio-backend-mora`
(`https://mio-backend-mora.onrender.com`):

| Endpoint | Datos |
| --- | --- |
| `/api/buses/{ruta}` | Ubicaciones de los buses activos. |
| `/api/recorrido/{ruta}` | Puntos del recorrido. |
| `/api/paradas/{ruta}` | Paradas de la ruta. |
| `/api/llegadas/{parada}` | Próximas llegadas a una parada. |

La disponibilidad y exactitud de los datos dependen de ese backend y de los
servicios cartográficos externos.

## Privacidad

- La ubicación solo se solicita al activar **Seguimiento** y nunca se envía a
  un servidor propio: se usa únicamente en el navegador para calcular la
  parada más cercana.
- Las preferencias se guardan localmente con `localStorage`.
- La clave de TomTom viaja en las peticiones del navegador a TomTom, por lo que
  debe restringirse a los dominios autorizados desde el portal de TomTom.
- La página incluye Google Analytics (`gtag.js`) para métricas de uso.
