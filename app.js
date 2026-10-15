/* ==========================================================================
   CONFIG & MASTER ROUTE DEFINITIONS
   ========================================================================== */

const RENDER_API_BASE = 'https://mio-backend-mora.onrender.com/api/buses';
const RENDER_ROUTE_BASE = 'https://mio-backend-mora.onrender.com/api/recorrido';
const RENDER_STOPS_BASE = 'https://mio-backend-mora.onrender.com/api/paradas';
const RENDER_ARRIVALS_BASE = 'https://mio-backend-mora.onrender.com/api/llegadas';

const TARGET_ROUTES = [
    {
        id: 'T12',
        name: 'T12 Andrés Sanín - Centro - Cll 5ta',
        type: 'TRONCAL',
        color: '#ef4444', // Red
        bgBadge: 'bg-red-500/20 text-red-300 border-red-500/40',
        desc: 'Conecta Oriente con Troncal Cll 5ta'
    },
    {
        id: 'P40B',
        name: 'P40B Andrés Sanín - Centro',
        type: 'PRETRONCAL',
        color: '#f59e0b', // Amber
        bgBadge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
        desc: 'Pretroncal por la Cra 8va'
    },
    {
        id: 'A11',
        name: 'A11 Universidades - Javeriana - Icesi',
        type: 'ALIMENTADOR',
        color: '#10b981', // Emerald
        bgBadge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
        desc: 'Corredor Universitario Pance'
    },
    {
        id: 'A14A',
        name: 'A14A Universidades - San Buenaventura',
        type: 'ALIMENTADOR',
        color: '#a855f7', // Purple
        bgBadge: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
        desc: 'Conexión Universidad San Buenaventura'
    }
];

// App State
let selectedRoutes = ['T12', 'P40B', 'A11', 'A14A']; // All enabled by default
let busDataByRoute = {};
let mapMarkers = {};
let routePointsByRoute = {};
let routeLayers = {};
let stopDataByRoute = {};
let stopLayersByRoute = {};
let map = null;
let tileLayer = null;
let autoRefreshTimer = null;
let currentMapMode = 'satellite'; // Default map mode
let userLocationMarker = null;
let userLocationAccuracy = null;
let userCoordinates = null;
let locationWatchId = null;

const MAP_MODES = {
    dark: {
        url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        attribution: '&copy; OpenStreetMap &copy; CARTO'
    },
    street: {
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '&copy; OpenStreetMap contributors'
    },
    satellite: {
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attribution: 'Tiles &copy; Esri'
    },
    terrain: {
        url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
        attribution: 'Map data &copy; OpenStreetMap contributors, SRTM | Map style &copy; OpenTopoMap'
    }
};

/* ==========================================================================
   LIFECYCLE INITIALIZATION
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    initMap();
    renderRouteCards();
    fetchActiveRoutesData();
    startLocationTracking();

    // Refresh every 12 seconds
    autoRefreshTimer = setInterval(fetchActiveRoutesData, 12000);
});

/* ==========================================================================
   LEAFLET MAP SETUP
   ========================================================================== */

function initMap() {
    // Centered on Cali, Colombia
    map = L.map('map', { zoomControl: false }).setView([3.4250, -76.5350], 12);

    L.control.zoom({ position: 'topright' }).addTo(map);
    changeMapMode(currentMapMode);
}

function recenterMap() {
    map.flyTo([3.4250, -76.5350], 12.5, { duration: 1 });
}

function locateUser() {
    startLocationTracking();
}

function startLocationTracking() {
    const status = document.getElementById('lastUpdated');
    const button = document.getElementById('locateMeButton');
    const icon = document.getElementById('locateMeIcon');

    if (locationWatchId !== null) {
        return;
    }

    if (!navigator.geolocation) {
        status.innerText = 'Este navegador no permite obtener la ubicación.';
        return;
    }

    button.disabled = true;
    button.classList.add('opacity-60', 'cursor-wait');
    icon.classList.remove('fa-location-crosshairs');
    icon.classList.add('fa-spinner', 'fa-spin');
    status.innerText = 'Buscando tu ubicación...';

    locationWatchId = navigator.geolocation.watchPosition(
        position => {
            const { latitude, longitude, accuracy } = position.coords;
            const userLatLng = [latitude, longitude];
            const shouldCenterMap = !userLocationMarker;
            userCoordinates = { lat: latitude, lng: longitude };

            if (userLocationMarker) {
                map.removeLayer(userLocationMarker);
            }
            if (userLocationAccuracy) {
                map.removeLayer(userLocationAccuracy);
            }

            userLocationAccuracy = L.circle(userLatLng, {
                radius: accuracy,
                color: '#34d399',
                fillColor: '#34d399',
                fillOpacity: 0.12,
                weight: 1
            }).addTo(map);

            userLocationMarker = L.marker(userLatLng, {
                icon: L.divIcon({
                    className: 'user-location-marker',
                    html: '<span class="user-location-dot"></span>',
                    iconSize: [22, 22],
                    iconAnchor: [11, 11]
                }),
                title: 'Mi ubicación'
            })
                .addTo(map)
                .bindPopup(`<strong>Mi ubicación</strong><br>Precisión aproximada: ${Math.round(accuracy)} m`);

            if (shouldCenterMap) {
                map.flyTo(userLatLng, 16, { duration: 1 });
            }
            status.innerText = `Ubicación encontrada · precisión ${Math.round(accuracy)} m`;
            updateNearestStopPanel();
            resetLocateButton();
        },
        error => {
            const messages = {
                1: 'Permiso de ubicación denegado.',
                2: 'No se pudo determinar tu ubicación.',
                3: 'La búsqueda de ubicación tardó demasiado.'
            };
            status.innerText = messages[error.code] || 'No se pudo obtener tu ubicación.';
            if (error.code === 1) {
                locationWatchId = null;
            }
            resetLocateButton();
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 30000
        }
    );
}

function resetLocateButton() {
    const button = document.getElementById('locateMeButton');
    const icon = document.getElementById('locateMeIcon');

    button.disabled = false;
    button.classList.remove('opacity-60', 'cursor-wait');
    icon.classList.remove('fa-spinner', 'fa-spin');
    icon.classList.add('fa-location-crosshairs');
}

function changeMapMode(mode) {
    if (!MAP_MODES[mode] || !map) {
        return;
    }

    if (tileLayer) {
        map.removeLayer(tileLayer);
    }

    const selectedMode = MAP_MODES[mode];
    tileLayer = L.tileLayer(selectedMode.url, {
        maxZoom: mode === 'satellite' ? 18 : 19,
        attribution: selectedMode.attribution
    }).addTo(map);
    currentMapMode = mode;
    const mapModeSelect = document.getElementById('mapMode');
    if (mapModeSelect) {
        mapModeSelect.value = mode;
    }
}

/* ==========================================================================
   ROUTE CARD SELECTION UI
   ========================================================================== */

function renderRouteCards() {
    const container = document.getElementById('routesGrid');
    container.innerHTML = '';

    TARGET_ROUTES.forEach(route => {
        const isSelected = selectedRoutes.includes(route.id);
        const activeCount = (busDataByRoute[route.id] || []).length;

        const card = document.createElement('div');
        card.onclick = () => toggleRouteSelection(route.id);

        card.className = `p-3 rounded-xl border transition-all duration-200 cursor-pointer flex flex-col justify-between gap-2 select-none ${
            isSelected 
                ? 'bg-gray-700/80 border-blue-500/80 shadow-md shadow-blue-500/10' 
                : 'bg-gray-800/40 border-gray-700/50 hover:bg-gray-700/40 opacity-60'
        }`;

        card.innerHTML = `
            <div class="flex items-center justify-between">
                <span class="font-extrabold text-sm px-2 py-0.5 rounded-md border ${route.bgBadge}">
                    ${route.id}
                </span>
                <span class="w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                    isSelected ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-400'
                }">
                    <i class="fa-solid ${isSelected ? 'fa-check' : 'fa-plus'}"></i>
                </span>
            </div>
            <div class="flex items-center justify-between text-[11px] text-gray-300 font-medium">
                <span class="truncate pr-1">${route.type}</span>
                <span class="font-bold text-xs ${activeCount > 0 ? 'text-emerald-400' : 'text-gray-500'}">
                    ${activeCount} buses
                </span>
            </div>
        `;

        container.appendChild(card);
    });

    document.getElementById('selectedCount').innerText = `${selectedRoutes.length} activas`;
}

function toggleRouteSelection(routeId) {
    if (selectedRoutes.includes(routeId)) {
        selectedRoutes = selectedRoutes.filter(id => id !== routeId);
    } else {
        selectedRoutes.push(routeId);
    }
    renderRouteCards();
    updateRoutePaths();
    updateRouteStops();
    updateNearestStopPanel();
    if (selectedRoutes.includes(routeId)) {
        if (!routePointsByRoute[routeId]) {
            fetchRoutePath(routeId);
        }
        if (!stopDataByRoute[routeId]) {
            fetchRouteStops(routeId);
        }
    }
    updateBusMarkers();
    updateNearestStopPanel();
}

/* ==========================================================================
   API FETCHING FROM RENDER BACKEND
   ========================================================================== */

async function fetchActiveRoutesData() {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    const refreshIcon = document.getElementById('refreshIcon');

    refreshIcon.classList.add('fa-spin');
    statusDot.className = 'w-2 h-2 rounded-full bg-amber-400 animate-ping';
    statusText.innerText = 'Consultando MIO...';

    let hasSuccess = false;

    // Fetch data for all selected routes concurrently
    const promises = selectedRoutes.map(async (routeId) => {
        try {
            const response = await fetch(`${RENDER_API_BASE}/${routeId}`, { timeout: 9000 });
            if (response.ok) {
                const json = await response.json();
                
                // Extract buses array from JSON response
                let buses = [];
                if (json.buses && Array.isArray(json.buses)) {
                    buses = json.buses;
                } else if (Array.isArray(json)) {
                    buses = json;
                }
                
                busDataByRoute[routeId] = buses;
                hasSuccess = true;
            } else {
                busDataByRoute[routeId] = [];
            }
        } catch (err) {
            console.warn(`Error al consultar ruta ${routeId}:`, err);
            busDataByRoute[routeId] = busDataByRoute[routeId] || [];
        }
    });

    await Promise.all(promises);
    await Promise.all(selectedRoutes.map(routeId => fetchRoutePath(routeId)));
    await Promise.all(selectedRoutes.map(routeId => fetchRouteStops(routeId)));

    refreshIcon.classList.remove('fa-spin');

    if (hasSuccess) {
        statusDot.className = 'w-2 h-2 rounded-full bg-emerald-400';
        statusText.innerText = 'Servidor Render Activo';
    } else {
        statusDot.className = 'w-2 h-2 rounded-full bg-red-400';
        statusText.innerText = 'Servidor en Reposo / Reintentando';
    }

    document.getElementById('lastUpdated').innerText = `Actualizado: ${new Date().toLocaleTimeString('es-CO')}`;

    renderRouteCards();
    updateBusMarkers();
    updateNearestStopPanel();
}

async function fetchRoutePath(routeId) {
    if (routePointsByRoute[routeId]) {
        return;
    }

    const routePathId = encodeURIComponent(routeId.toLowerCase());

    try {
        const response = await fetch(`${RENDER_ROUTE_BASE}/${routePathId}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const json = await response.json();
        const points = Array.isArray(json.puntos) ? json.puntos : [];
        const validPoints = points
            .map(point => [
                parseFloat(point.latitud),
                parseFloat(point.longitud)
            ])
            .filter(([lat, lng]) => !isNaN(lat) && !isNaN(lng));

        if (validPoints.length < 2) {
            throw new Error('La respuesta no contiene al menos dos puntos válidos');
        }

        routePointsByRoute[routeId] = validPoints;
        updateRoutePaths();
    } catch (err) {
        console.warn(`Error al consultar recorrido de ruta ${routeId}:`, err);
    }
}

function updateRoutePaths() {
    const selectedRouteSet = new Set(selectedRoutes);

    Object.keys(routeLayers).forEach(routeId => {
        if (!selectedRouteSet.has(routeId)) {
            map.removeLayer(routeLayers[routeId]);
            delete routeLayers[routeId];
        }
    });

    selectedRoutes.forEach(routeId => {
        const routeMeta = TARGET_ROUTES.find(route => route.id === routeId);
        const points = routePointsByRoute[routeId];

        if (!routeMeta || !points || routeLayers[routeId]) {
            return;
        }

        routeLayers[routeId] = L.polyline(points, {
            color: routeMeta.color,
            weight: 5,
            opacity: 0.85,
            lineCap: 'round',
            lineJoin: 'round'
        }).addTo(map);
    });
}

async function fetchRouteStops(routeId) {
    if (stopDataByRoute[routeId]) {
        return;
    }

    const routePathId = encodeURIComponent(routeId.toLowerCase());

    try {
        const response = await fetch(`${RENDER_STOPS_BASE}/${routePathId}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const json = await response.json();
        const stops = Array.isArray(json.paradas)
            ? json.paradas
            : Array.isArray(json)
                ? json
                : [json];

        const validStops = stops
            .map(stop => ({
                id: stop.id,
                nombre: stop.nombre || 'Parada sin nombre',
                lat: parseFloat(stop.lat),
                lng: parseFloat(stop.lng)
            }))
            .filter(stop => !isNaN(stop.lat) && !isNaN(stop.lng));

        if (validStops.length === 0) {
            throw new Error('La respuesta no contiene paradas válidas');
        }

        stopDataByRoute[routeId] = validStops;
        updateRouteStops();
        updateNearestStopPanel();
    } catch (err) {
        console.warn(`Error al consultar paradas de ruta ${routeId}:`, err);
    }
}

function updateRouteStops() {
    const selectedRouteSet = new Set(selectedRoutes);

    Object.keys(stopLayersByRoute).forEach(routeId => {
        if (!selectedRouteSet.has(routeId)) {
            stopLayersByRoute[routeId].forEach(stopLayer => map.removeLayer(stopLayer));
            delete stopLayersByRoute[routeId];
        }
    });

    selectedRoutes.forEach(routeId => {
        const routeMeta = TARGET_ROUTES.find(route => route.id === routeId);
        const stops = stopDataByRoute[routeId];

        if (!routeMeta || !stops || stopLayersByRoute[routeId]) {
            return;
        }

        stopLayersByRoute[routeId] = stops.map(stop => {
            const stopLayer = L.circleMarker([stop.lat, stop.lng], {
                radius: 5,
                color: '#ffffff',
                weight: 1.5,
                fillColor: routeMeta.color,
                fillOpacity: 1
            }).bindPopup(createStopPopupContent(stop, routeMeta));

            stopLayer.on('click', () => fetchStopArrivals(stop, routeMeta, stopLayer));
            stopLayer.addTo(map);
            return stopLayer;
        });
    });
}

function createStopPopupContent(stop, routeMeta, message = 'Haz clic en la parada para consultar llegadas.') {
    return `
        <div class="p-1 min-w-[220px]">
            <div class="font-extrabold text-sm text-gray-100">${stop.nombre}</div>
            <div class="text-[10px] text-gray-400">Ruta: ${routeMeta.id}</div>
            <div class="text-[10px] text-gray-400">ID: ${stop.id || 'No disponible'}</div>
            <div class="text-[10px] text-gray-400 mb-2">Coordenadas: ${stop.lat}, ${stop.lng}</div>
            ${message}
        </div>
    `;
}

async function fetchStopArrivals(stop, routeMeta, stopLayer) {
    if (!stop.id) {
        stopLayer.setPopupContent(createStopPopupContent(
            stop,
            routeMeta,
            '<div class="text-xs text-red-300">Esta parada no tiene un ID válido para consultar llegadas.</div>'
        ));
        return;
    }

    stopLayer.setPopupContent(createStopPopupContent(
        stop,
        routeMeta,
        '<div class="text-xs text-blue-300"><i class="fa-solid fa-spinner fa-spin mr-1"></i>Consultando llegadas...</div>'
    ));

    try {
        const stopId = encodeURIComponent(stop.id);
        const response = await fetch(`${RENDER_ARRIVALS_BASE}/${stopId}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const json = await response.json();
        const arrivals = json.datos && Array.isArray(json.datos.buses)
            ? json.datos.buses
            : [];

        const arrivalsContent = arrivals.length > 0
            ? `
                <div class="text-[10px] font-bold text-gray-300 mb-1">
                    Próximas llegadas${json.datos.nombreParada ? ` · ${json.datos.nombreParada}` : ''}
                </div>
                <div class="space-y-1">
                    ${sortArrivalsByCountdown(arrivals).map(arrival => `
                        <div class="flex items-center justify-between gap-3 text-[10px]">
                            <span class="text-gray-300">
                                <strong>${arrival.nombreLinea || 'Línea no disponible'}</strong>
                                · ${arrival.nombreDestino || 'Destino no disponible'}
                                <br><span class="text-gray-500">Bus ${arrival.numeroDeBus || 'No disponible'}</span>
                            </span>
                            <span class="font-bold text-emerald-400 whitespace-nowrap">${arrival.cuentaRegresiva || 'Sin tiempo'}</span>
                        </div>
                    `).join('')}
                </div>
            `
            : '<div class="text-xs text-gray-400">No hay buses próximos reportados.</div>';

        stopLayer.setPopupContent(createStopPopupContent(stop, routeMeta, arrivalsContent));
    } catch (err) {
        console.warn(`Error al consultar llegadas de la parada ${stop.id}:`, err);
        stopLayer.setPopupContent(createStopPopupContent(
            stop,
            routeMeta,
            '<div class="text-xs text-red-300">No se pudieron consultar las llegadas. Intenta nuevamente.</div>'
        ));
    }
}

function sortArrivalsByCountdown(arrivals) {
    return [...arrivals].sort((first, second) => {
        const firstMinutes = parseCountdownMinutes(first.cuentaRegresiva);
        const secondMinutes = parseCountdownMinutes(second.cuentaRegresiva);
        return firstMinutes - secondMinutes;
    });
}

function parseCountdownMinutes(countdown) {
    if (typeof countdown !== 'string') {
        return Number.POSITIVE_INFINITY;
    }

    const normalizedCountdown = countdown.replace(',', '.').trim().toLowerCase();
    const timeMatch = normalizedCountdown.match(/^(\d+):(\d+)/);
    if (timeMatch) {
        return Number(timeMatch[1]) * 60 + Number(timeMatch[2]);
    }

    const minutesMatch = normalizedCountdown.match(/^(\d+(?:\.\d+)?)/);
    return minutesMatch ? Number(minutesMatch[1]) : Number.POSITIVE_INFINITY;
}

function updateNearestStopPanel() {
    const container = document.getElementById('nearestStopContainer');
    if (!container) {
        return;
    }

    if (!userCoordinates) {
        return;
    }

    const nearestStop = findNearestStop();
    if (!nearestStop) {
        container.innerHTML = `
            <div class="h-full flex flex-col items-center justify-center p-5 text-center text-gray-500">
                <i class="fa-solid fa-road-barrier text-2xl mb-2 text-amber-400/70"></i>
                <p class="text-xs text-gray-300">No hay paradas disponibles</p>
                <p class="text-[10px] text-gray-500 mt-1">Selecciona al menos una ruta para consultar sus paradas.</p>
            </div>
        `;
        return;
    }

    const distance = getDistanceInMeters(
        userCoordinates.lat,
        userCoordinates.lng,
        nearestStop.stop.lat,
        nearestStop.stop.lng
    );

    container.innerHTML = `
        <div class="rounded-xl bg-gradient-to-br from-emerald-900/40 to-gray-700/40 border border-emerald-700/40 p-3">
            <div class="flex items-start justify-between gap-2">
                <div>
                    <div class="text-[10px] uppercase tracking-wider text-emerald-300 font-bold">Más cercana · ${formatDistance(distance)}</div>
                    <h4 class="text-sm font-extrabold text-gray-100 mt-1">${nearestStop.stop.nombre}</h4>
                </div>
                <span class="text-[10px] font-bold px-2 py-1 rounded-full text-white" style="background-color: ${nearestStop.route.color}">
                    ${nearestStop.route.id}
                </span>
            </div>
            <div class="text-[10px] text-gray-400 mt-1">ID: ${nearestStop.stop.id || 'No disponible'}</div>
            <div id="nearestArrivals" class="mt-3">
                <div class="text-xs text-blue-300"><i class="fa-solid fa-spinner fa-spin mr-1"></i>Consultando llegadas...</div>
            </div>
        </div>
    `;

    fetchNearestStopArrivals(nearestStop.stop, nearestStop.route);
}

function findNearestStop() {
    if (!userCoordinates) {
        return null;
    }

    let nearestStop = null;
    selectedRoutes.forEach(routeId => {
        const route = TARGET_ROUTES.find(item => item.id === routeId);
        const stops = stopDataByRoute[routeId] || [];

        if (!route) {
            return;
        }

        stops.forEach(stop => {
            const distance = getDistanceInMeters(
                userCoordinates.lat,
                userCoordinates.lng,
                stop.lat,
                stop.lng
            );

            if (!nearestStop || distance < nearestStop.distance) {
                nearestStop = { stop, route, distance };
            }
        });
    });

    return nearestStop;
}

async function fetchNearestStopArrivals(stop, route) {
    const arrivalsContainer = document.getElementById('nearestArrivals');
    if (!arrivalsContainer || !stop.id) {
        return;
    }

    try {
        const response = await fetch(`${RENDER_ARRIVALS_BASE}/${encodeURIComponent(stop.id)}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const json = await response.json();
        const arrivals = json.datos && Array.isArray(json.datos.buses)
            ? sortArrivalsByCountdown(json.datos.buses)
            : [];

        arrivalsContainer.innerHTML = arrivals.length > 0
            ? `
                <div class="text-[10px] font-bold text-gray-300 mb-1">
                    Próximos buses${json.datos.nombreParada ? ` · ${json.datos.nombreParada}` : ''}
                </div>
                <div class="space-y-1.5">
                    ${arrivals.map(arrival => `
                        <div class="flex items-center justify-between gap-2 border-t border-gray-700/60 pt-1.5">
                            <div class="min-w-0">
                                <div class="text-xs font-bold text-gray-200">${arrival.nombreLinea || 'Línea no disponible'}</div>
                                <div class="text-[10px] text-gray-400 truncate">${arrival.nombreDestino || 'Destino no disponible'}</div>
                                <div class="text-[10px] text-gray-500">Bus ${arrival.numeroDeBus || 'No disponible'}</div>
                            </div>
                            <span class="text-xs font-black text-emerald-300 whitespace-nowrap">${arrival.cuentaRegresiva || 'Sin tiempo'}</span>
                        </div>
                    `).join('')}
                </div>
            `
            : '<div class="text-xs text-gray-400">No hay buses próximos reportados.</div>';
    } catch (err) {
        console.warn(`Error al consultar llegadas de la parada ${stop.id}:`, err);
        arrivalsContainer.innerHTML = '<div class="text-xs text-red-300">No se pudieron consultar las llegadas.</div>';
    }
}

function getDistanceInMeters(firstLat, firstLng, secondLat, secondLng) {
    const earthRadius = 6371000;
    const latDifference = (secondLat - firstLat) * Math.PI / 180;
    const lngDifference = (secondLng - firstLng) * Math.PI / 180;
    const firstLatitude = firstLat * Math.PI / 180;
    const secondLatitude = secondLat * Math.PI / 180;
    const haversine = Math.sin(latDifference / 2) ** 2
        + Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(lngDifference / 2) ** 2;

    return 2 * earthRadius * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function formatDistance(distance) {
    return distance < 1000
        ? `${Math.round(distance)} m`
        : `${(distance / 1000).toFixed(1)} km`;
}

/* ==========================================================================
   MAP MARKERS & BUS LIST RENDERING
   ========================================================================== */

function updateBusMarkers() {
    const currentBusCodes = new Set();

    selectedRoutes.forEach(routeId => {
        const routeMeta = TARGET_ROUTES.find(r => r.id === routeId);
        const buses = busDataByRoute[routeId] || [];

        buses.forEach((bus, index) => {
            // Extract coordinates & properties flexible to SIUR variations
            const lat = parseFloat(bus.latitud || bus.lat || bus.latitude);
            const lng = parseFloat(bus.longitud || bus.lng || bus.longitude);
            const busCode = bus.id || bus.numeroBus || bus.idVehiculo || bus.codigo || bus.busId || `${routeId}-${index}`;
            const busKey = `${routeId}_${busCode}`;

            currentBusCodes.add(busKey);

            if (!isNaN(lat) && !isNaN(lng)) {
                // Update or create Leaflet map marker
                renderBusMarker(busKey, lat, lng, routeMeta, busCode, bus);
            }
        });
    });

    // Remove old markers not active anymore
    Object.keys(mapMarkers).forEach(key => {
        if (!currentBusCodes.has(key)) {
            map.removeLayer(mapMarkers[key]);
            delete mapMarkers[key];
        }
    });
}

function renderBusMarker(key, lat, lng, routeMeta, busCode, bus) {
    const iconHtml = `
        <div class="relative flex items-center justify-center">
            <div class="absolute w-7 h-7 rounded-full opacity-40 bus-pulse-ring" style="background-color: ${routeMeta.color}"></div>
            <div class="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[11px] font-black shadow-lg border-2 border-gray-900" style="background-color: ${routeMeta.color}">
                <i class="fa-solid fa-bus"></i>
            </div>
            <div class="absolute -bottom-4 bg-gray-900/90 text-white text-[9px] font-bold px-1 rounded border border-gray-700 whitespace-nowrap shadow">
                ${routeMeta.id}
            </div>
        </div>
    `;

    const customIcon = L.divIcon({
        html: iconHtml,
        className: 'bus-marker-custom',
        iconSize: [28, 28],
        iconAnchor: [14, 14]
    });

    if (mapMarkers[key]) {
        mapMarkers[key].setLatLng([lat, lng]);
        mapMarkers[key].setIcon(customIcon);
        mapMarkers[key].setPopupContent(createBusPopupContent(routeMeta, busCode, bus));
    } else {
        const marker = L.marker([lat, lng], { icon: customIcon }).addTo(map);

        marker.bindPopup(createBusPopupContent(routeMeta, busCode, bus));

        mapMarkers[key] = marker;
    }
}

function createBusPopupContent(routeMeta, busCode, bus) {
    return `
            <div class="p-1">
                <div class="flex items-center gap-2 border-b border-gray-700 pb-1 mb-1">
                    <span class="font-extrabold text-sm text-gray-100">${routeMeta.id}</span>
                    <span class="text-[10px] text-gray-400">Bus: ${busCode}</span>
                </div>
                <p class="text-xs text-gray-300 font-medium">Línea: ${bus.nombreLinea || routeMeta.name}</p>
                <p class="text-[10px] text-gray-400">Recorrido: ${bus.origen || bus.paradaInicial || 'Origen no disponible'} &rarr; ${bus.destino || bus.paradaFinal || 'Destino no disponible'}</p>
                <p class="text-[10px] text-gray-400">Coordenadas: ${bus.lat ?? bus.latitud ?? 'No disponible'}, ${bus.lng ?? bus.longitud ?? 'No disponible'}</p>
                <p class="text-[10px] text-emerald-400 font-bold mt-1">● Reportando ubicación GPS</p>
            </div>
        `;
}