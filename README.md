# MIO Tracker Cali

Aplicación web para monitorear rutas del sistema MIO de Cali en un mapa
interactivo. Permite seleccionar rutas, consultar la ubicación de los buses y
ver las próximas llegadas en la parada más cercana.

## Funcionalidades

- Visualización de buses y recorridos sobre un mapa de Leaflet.
- Selección y búsqueda entre las rutas MIO disponibles.
- Actualización automática de las ubicaciones cada 12 segundos.
- Consulta de la parada más cercana y de sus próximas llegadas.
- Seguimiento de la ubicación del usuario mediante GPS.
- Modos de mapa: satélite, calles y terreno.
- Capa opcional de tráfico en vivo de TomTom.
- La capa de tráfico está limitada geográficamente al área de Cali.
- Temas de color y apariencia oscura, clara o automática.
- Persistencia local de las rutas seleccionadas, el tema y la apariencia.

## Requisitos

- Un navegador moderno con soporte para JavaScript, geolocalización y
  `localStorage`.
- Conexión a internet para cargar las librerías externas, los mapas y los
  datos del backend.

La aplicación usa las siguientes dependencias mediante CDN:

- [Leaflet 1.9.4](https://leafletjs.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Font Awesome 6.4.0](https://fontawesome.com/)

## Ejecución local

Como la aplicación consume recursos externos y puede requerir permisos de
geolocalización, es recomendable servirla mediante HTTP en lugar de abrir
`index.html` directamente.

Con Python:

```bash
python -m http.server 8000
```

Después, abre <http://localhost:8000> en el navegador.

También se puede utilizar cualquier servidor estático equivalente. No se
requiere un proceso de compilación ni instalación de dependencias locales.

## Uso

1. Selecciona una o más rutas en el panel **Rutas activas**.
2. Usa el campo de búsqueda para filtrar por código, nombre o tipo de ruta.
3. Consulta los buses activos en el mapa y selecciona sus marcadores para
   obtener más información.
4. Usa **Centrar** para volver a la vista general de Cali.
5. Activa **Seguimiento** y concede permiso de ubicación para consultar la
   parada más cercana y sus próximas llegadas.
6. Cambia el tipo de mapa o la apariencia desde los controles disponibles.
7. Para ver el tráfico, abre **Configuración**, pega tu clave de TomTom y usa
   el botón **Tráfico** sobre el mapa. El desarrollador debe configurar la
   constante `TOMTOM_API_KEY` en `app.js`; la misma clave se usa para todos
   los usuarios.

## Arquitectura

El proyecto es una aplicación estática y está compuesto por:

| Archivo | Responsabilidad |
| --- | --- |
| `index.html` | Estructura de la interfaz y carga de recursos externos. |
| `styles.css` | Estilos, temas de color y diseño responsivo. |
| `app.js` | Estado de la aplicación, mapa, rutas, GPS y consumo de la API. |

El frontend consume el backend público `mio-backend-mora` para obtener:

- Ubicaciones de buses: `/api/buses`
- Recorridos: `/api/recorrido`
- Paradas: `/api/paradas`
- Próximas llegadas: `/api/llegadas`

La disponibilidad y exactitud de los datos dependen de ese backend y de los
servicios cartográficos externos.

## Privacidad

La ubicación solo se solicita cuando el usuario activa **Seguimiento** y el
navegador pide permiso. Las preferencias de rutas y apariencia se guardan
localmente en el navegador mediante `localStorage`. La clave de TomTom se
incluye en las solicitudes del navegador a TomTom, por lo que debe restringirse
en el portal de TomTom a los dominios autorizados.
