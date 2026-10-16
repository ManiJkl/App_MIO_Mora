/* ==========================================================================
   CONFIG & MASTER ROUTE DEFINITIONS
   ========================================================================== */

const RENDER_API_BASE = 'https://mio-backend-mora.onrender.com/api/buses';
const RENDER_ROUTE_BASE = 'https://mio-backend-mora.onrender.com/api/recorrido';
const RENDER_STOPS_BASE = 'https://mio-backend-mora.onrender.com/api/paradas';
const RENDER_ARRIVALS_BASE = 'https://mio-backend-mora.onrender.com/api/llegadas';
const SELECTED_ROUTES_STORAGE_KEY = 'mio-tracker-selected-routes';
const THEME_STORAGE_KEY = 'mio-tracker-theme';
const APPEARANCE_STORAGE_KEY = 'mio-tracker-appearance';

const FEATURED_ROUTES = [
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
        color: '#58c7d9', // Cyan
        bgBadge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
        desc: 'Conexión Universidad San Buenaventura'
    }
];

const ALL_ROUTE_CODES = [
    'T12', 'T15', 'T31', 'T47', 'T51', 'T52', 'T57', 'T62',
    'E21', 'E27', 'E37', 'E51',
    'P10A', 'P10B', 'P12A', 'P14A', 'P20A', 'P21A', 'P27D', 'P30A',
    'P40A', 'P40B', 'P47', 'P51A', 'P51C', 'P52', 'P60A', 'P60B',
    'P62A', 'P62D', 'P74', 'P82',
    'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A11', 'A12A', 'A12B',
    'A13A', 'A13B', 'A14A', 'A14B', 'A15', 'A17', 'A18', 'A19',
    'A21', 'A24', 'A25', 'A31', 'A32', 'A33', 'A34', 'A35', 'A36',
    'A37', 'A41', 'A41A', 'A42', 'A43', 'A44', 'A45', 'A46', 'A47',
    'A51', 'A52', 'A53', 'A54', 'A55', 'A56', 'A57', 'A61', 'A62',
    'A63', 'A64', 'A71', 'A72', 'A72A', 'A73', 'A74', 'A75', 'A76',
    'A77', 'A78A', 'A81', 'A82', 'A83',
    'AL2A', 'AL2B', 'AL2C', 'AL2D', 'AL3A', 'AL3C', 'AL4A', 'AL4B',
    'AL7B', 'AL7D', 'AL7F', 'AL8', 'AL9A', 'AL9B'
];

const ROUTE_COLORS = ['#ef4444', '#f59e0b', '#10b981', '#a855f7', '#2878f0', '#ec4899'];
const ROUTE_TYPE_LABELS = {
    T: 'TRONCAL',
    E: 'EXPRESA',
    P: 'PRETRONCAL',
    A: 'ALIMENTADOR',
    AL: 'ALIMENTADOR'
};

const TARGET_ROUTES = ALL_ROUTE_CODES.map((routeId, index) => {
    const featuredRoute = FEATURED_ROUTES.find(route => route.id === routeId);
    if (featuredRoute) {
        return featuredRoute;
    }

    const routeType = routeId.startsWith('AL')
        ? ROUTE_TYPE_LABELS.AL
        : ROUTE_TYPE_LABELS[routeId[0]] || 'RUTA';
    const color = ROUTE_COLORS[index % ROUTE_COLORS.length];
    return {
        id: routeId,
        name: `${routeId} · Ruta MIO`,
        type: routeType,
        color,
        bgBadge: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
        desc: `Servicio ${routeType.toLowerCase()}`
    };
});

// App State
let selectedRoutes = loadSelectedRoutes();
let routeSearchTerm = '';
let busDataByRoute = {};
let mapMarkers = {};
let routePointsByRoute = {};
let routeLayers = {};
let stopDataByRoute = {};
let stopLayersByRoute = {};
let map = null;
let tileLayer = null;
let autoRefreshTimer = null;
let routeFetchDebounceTimer = null;
let currentMapMode = 'satellite'; // Default map mode
let userLocationMarker = null;
let userLocationAccuracy = null;
let userCoordinates = null;
let locationWatchId = null;
let locationRequestInProgress = false;
let followUserLocation = false;
let nearestStopKey = null;
let nearestArrivalsRequestId = 0;

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
    initSettings();
    initMap();
    document.getElementById('routeSearch').addEventListener('input', event => {
        routeSearchTerm = event.target.value.trim().toLowerCase();
        renderRouteCards();
    });

    function initSettings() {
        const settingsButton = document.getElementById('settingsButton');
        const closeSettingsButton = document.getElementById('closeSettingsButton');
        const settingsPanel = document.getElementById('settingsPanel');
        const themeSelect = document.getElementById('themeSelect');
        const appearanceSelect = document.getElementById('appearanceSelect');

        if (!settingsButton || !closeSettingsButton || !settingsPanel || !themeSelect || !appearanceSelect) {
            return;
        }

        const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) || 'blue';
        const savedAppearance = localStorage.getItem(APPEARANCE_STORAGE_KEY) || 'auto';
        applyTheme(savedTheme);
        applyAppearance(savedAppearance);
        themeSelect.value = savedTheme;
        appearanceSelect.value = savedAppearance;

        settingsButton.addEventListener('click', () => {
            const isOpen = !settingsPanel.hidden;
            settingsPanel.hidden = isOpen;
            settingsButton.setAttribute('aria-expanded', String(!isOpen));
        });

        closeSettingsButton.addEventListener('click', closeSettings);
        themeSelect.addEventListener('change', event => applyTheme(event.target.value));
        appearanceSelect.addEventListener('change', event => applyAppearance(event.target.value));
        document.addEventListener('click', event => {
            if (!settingsPanel.hidden && !event.target.closest('.settings-menu')) {
                closeSettings();
            }
        });
    }

    function closeSettings() {
        const settingsPanel = document.getElementById('settingsPanel');
        const settingsButton = document.getElementById('settingsButton');
        if (settingsPanel) {
            settingsPanel.hidden = true;
        }
        if (settingsButton) {
            settingsButton.setAttribute('aria-expanded', 'false');
        }
    }

    function applyTheme(theme) {
        const allowedThemes = ['blue', 'amber', 'teal', 'violet'];
        const selectedTheme = allowedThemes.includes(theme) ? theme : 'blue';
        document.documentElement.dataset.theme = selectedTheme;
        localStorage.setItem(THEME_STORAGE_KEY, selectedTheme);
    }

    function applyAppearance(appearance) {
        const allowedAppearances = ['dark', 'light', 'auto'];
        const selectedAppearance = allowedAppearances.includes(appearance) ? appearance : 'auto';
        document.documentElement.dataset.appearance = selectedAppearance;
        localStorage.setItem(APPEARANCE_STORAGE_KEY, selectedAppearance);
    }
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
    map.on('dragstart', () => {
        followUserLocation = false;
        updateLocateButtonState();
    });
    changeMapMode(currentMapMode);
}

function recenterMap() {
    map.flyTo([3.4250, -76.5350], 12.5, { duration: 1 });
}

function locateUser() {
    followUserLocation = true;
    updateLocateButtonState();
    startLocationTracking();

    if (userCoordinates) {
        map.flyTo([userCoordinates.lat, userCoordinates.lng], 16, { duration: 1 });
    }
}

function startLocationTracking() {
    const status = document.getElementById('lastUpdated');
    const button = document.getElementById('locateMeButton');
    const icon = document.getElementById('locateMeIcon');

    if (locationWatchId !== null || locationRequestInProgress) {
        return;
    }

    if (!navigator.geolocation) {
        status.innerText = 'Este navegador no permite obtener la ubicación.';
        return;
    }

    if (!window.isSecureContext) {
        status.innerText = 'El GPS requiere abrir la página con HTTPS en iPhone.';
        return;
    }

    locationRequestInProgress = true;
    button.disabled = true;
    button.classList.add('opacity-60', 'cursor-wait');
    icon.classList.remove('fa-location-crosshairs');
    icon.classList.add('fa-spinner', 'fa-spin');
    status.innerText = 'Buscando tu ubicación...';

    const locationOptions = {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
    };

    navigator.geolocation.getCurrentPosition(
        position => {
            locationRequestInProgress = false;
            updateUserLocation(position);
            locationWatchId = navigator.geolocation.watchPosition(
                updateUserLocation,
                handleLocationError,
                locationOptions
            );
        },
        handleLocationError,
        locationOptions
    );
}

function updateUserLocation(position) {
    const { latitude, longitude, accuracy } = position.coords;
    const userLatLng = [latitude, longitude];
    const shouldCenterMap = !userLocationMarker || followUserLocation;
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

    document.getElementById('lastUpdated').innerText = `Ubicación encontrada · precisión ${Math.round(accuracy)} m`;
    updateNearestStopPanel();
    resetLocateButton();
}

function handleLocationError(error) {
    locationRequestInProgress = false;
    locationWatchId = null;
    followUserLocation = false;
    const messages = {
        1: 'Permiso denegado. Activa Ubicación para Safari en Ajustes.',
        2: 'No se pudo determinar tu ubicación. Revisa el GPS del iPhone.',
        3: 'La búsqueda tardó demasiado. Intenta nuevamente.'
    };
    document.getElementById('lastUpdated').innerText =
        messages[error.code] || 'No se pudo obtener tu ubicación.';
    resetLocateButton();
}

function resetLocateButton() {
    updateLocateButtonState();
}

function updateLocateButtonState() {
    const button = document.getElementById('locateMeButton');
    const icon = document.getElementById('locateMeIcon');

    if (locationRequestInProgress) {
        button.disabled = true;
        button.classList.add('opacity-60', 'cursor-wait');
    } else {
        button.disabled = false;
        button.classList.remove('opacity-60', 'cursor-wait');
    }

    button.classList.toggle('is-following', followUserLocation);
    button.setAttribute('aria-pressed', String(followUserLocation));
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

    const visibleRoutes = TARGET_ROUTES.filter(route => {
        if (!routeSearchTerm) {
            return true;
        }
        return `${route.id} ${route.name} ${route.type} ${route.desc}`
            .toLowerCase()
            .includes(routeSearchTerm);
    });

    visibleRoutes.forEach(route => {
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
    document.getElementById('routesResultCount').innerText =
        `${visibleRoutes.length} de ${TARGET_ROUTES.length} rutas`;

    if (visibleRoutes.length === 0) {
        container.innerHTML = '<div class="route-empty-state">No se encontraron rutas con esa búsqueda.</div>';
    }
}

function toggleRouteSelection(routeId) {
    if (selectedRoutes.includes(routeId)) {
        selectedRoutes = selectedRoutes.filter(id => id !== routeId);
    } else {
        selectedRoutes.push(routeId);
    }
    saveSelectedRoutes();
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
    clearTimeout(routeFetchDebounceTimer);
    routeFetchDebounceTimer = setTimeout(fetchActiveRoutesData, 250);
}

function loadSelectedRoutes() {
    try {
        const savedRoutes = JSON.parse(localStorage.getItem(SELECTED_ROUTES_STORAGE_KEY));
        if (!Array.isArray(savedRoutes)) {
            return [];
        }
        return [...new Set(savedRoutes)].filter(routeId =>
            ALL_ROUTE_CODES.includes(routeId)
        );
    } catch (error) {
        console.warn('No se pudo cargar la configuración de rutas guardada:', error);
        return [];
    }
}

function saveSelectedRoutes() {
    try {
        localStorage.setItem(SELECTED_ROUTES_STORAGE_KEY, JSON.stringify(selectedRoutes));
    } catch (error) {
        console.warn('No se pudo guardar la configuración de rutas:', error);
    }
}

/* ==========================================================================
   API FETCHING FROM RENDER BACKEND
   ========================================================================== */

async function fetchActiveRoutesData() {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    const refreshIcon = document.getElementById('refreshIcon');

    refreshIcon.classList.add('fa-spin');
    statusDot.className = 'w-2 h-2 rounded-full bg-blue-400 animate-ping';
    statusText.innerText = 'Consultando MIO...';

    if (selectedRoutes.length === 0) {
        refreshIcon.classList.remove('fa-spin');
        statusDot.className = 'w-2 h-2 rounded-full bg-gray-400';
        statusText.innerText = 'Selecciona una ruta';
        document.getElementById('lastUpdated').innerText = 'Sin rutas seleccionadas';
        updateBusMarkers();
        updateRoutePaths();
        updateRouteStops();
        updateNearestStopPanel();
        return;
    }

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
        statusDot.className = 'w-2 h-2 rounded-full bg-blue-400';
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
        <div class="stop-popup p-1 min-w-[220px]">
            <div class="stop-popup-heading">
                <div class="font-extrabold text-sm text-gray-100">${stop.nombre}</div>
                <span class="stop-popup-route" style="background-color: ${routeMeta.color}">${routeMeta.id}</span>
            </div>
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
        '<div class="text-xs text-amber-300"><i class="fa-solid fa-spinner fa-spin mr-1"></i>Consultando llegadas...</div>'
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
                <div class="stop-arrivals-list">
                    ${sortArrivalsByCountdown(arrivals).map(arrival => `
                        <div class="stop-arrival-row">
                            <strong class="text-gray-300">${arrival.nombreLinea || routeMeta.id}</strong>
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
        nearestStopKey = null;
        nearestArrivalsRequestId += 1;
        container.innerHTML = `
            <div class="h-full flex flex-col items-center justify-center p-5 text-center text-gray-500">
                <i class="fa-solid fa-road-barrier text-2xl mb-2 text-amber-400/70"></i>
                <p class="text-xs text-gray-300">No hay paradas disponibles</p>
                <p class="text-[10px] text-gray-500 mt-1">Selecciona al menos una ruta para consultar sus paradas.</p>
            </div>
        `;
        return;
    }

    const stopKey = `${nearestStop.route.id}:${nearestStop.stop.id || `${nearestStop.stop.lat},${nearestStop.stop.lng}`}`;
    const distance = getDistanceInMeters(
        userCoordinates.lat,
        userCoordinates.lng,
        nearestStop.stop.lat,
        nearestStop.stop.lng
    );

    if (nearestStopKey !== stopKey) {
        nearestStopKey = stopKey;
        container.innerHTML = `
            <div data-nearest-stop-key="${stopKey}" class="rounded-xl border border-emerald-700/40 p-3">
                <div class="flex items-start justify-between gap-2">
                    <div>
                                <div class="nearest-stop-meta">A ${formatDistance(distance)}</div>
                        <h4 class="text-sm font-extrabold text-gray-100 mt-1">${nearestStop.stop.nombre}</h4>
                    </div>
                    <span class="text-[10px] font-bold px-2 py-1 rounded-full text-white" style="background-color: ${nearestStop.route.color}">
                        ${nearestStop.route.id}
                    </span>
                </div>
                <div id="nearestArrivalsStatus" class="mt-3 text-xs text-amber-300" aria-live="polite">
                    <i class="fa-solid fa-spinner fa-spin mr-1"></i>Consultando llegadas...
                </div>
                <div id="nearestArrivals" class="mt-2">
                    <div class="text-xs text-gray-400">Esperando información de llegadas...</div>
                </div>
            </div>
        `;
    } else {
        const distanceElement = document.getElementById('nearestStopDistance');
        if (distanceElement) {
            distanceElement.innerText = formatDistance(distance);
        }
    }

    fetchNearestStopArrivals(nearestStop.stop, nearestStop.route, stopKey);
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

async function fetchNearestStopArrivals(stop, route, stopKey) {
    const arrivalsContainer = document.getElementById('nearestArrivals');
    const statusContainer = document.getElementById('nearestArrivalsStatus');
    if (!arrivalsContainer || !statusContainer || !stop.id) {
        return;
    }

    const requestId = ++nearestArrivalsRequestId;
    statusContainer.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i>Consultando llegadas...';

    try {
        const response = await fetch(`${RENDER_ARRIVALS_BASE}/${encodeURIComponent(stop.id)}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const json = await response.json();
        const arrivals = json.datos && Array.isArray(json.datos.buses)
            ? sortArrivalsByCountdown(json.datos.buses)
            : [];

        if (requestId !== nearestArrivalsRequestId || nearestStopKey !== stopKey) {
            return;
        }

        arrivalsContainer.innerHTML = arrivals.length > 0
            ? `
                <div class="stop-arrivals-list">
                    ${arrivals.map(arrival => `
                        <div class="stop-arrival-row">
                            <div class="text-xs font-bold text-gray-200">${arrival.nombreLinea || route.id}</div>
                            <span class="text-xs font-black text-emerald-300 whitespace-nowrap">${arrival.cuentaRegresiva || 'Sin tiempo'}</span>
                        </div>
                    `).join('')}
                </div>
            `
            : '<div class="text-xs text-gray-400">No hay buses próximos reportados.</div>';
        statusContainer.innerHTML = '<i class="fa-solid fa-check mr-1"></i>Llegadas actualizadas';
    } catch (err) {
        console.warn(`Error al consultar llegadas de la parada ${stop.id}:`, err);
        if (requestId !== nearestArrivalsRequestId || nearestStopKey !== stopKey) {
            return;
        }
        statusContainer.innerHTML = '<i class="fa-solid fa-triangle-exclamation mr-1"></i>No se pudo actualizar';
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
            <div class="bus-popup p-1">
                <div class="bus-popup-heading">
                    <span class="font-extrabold text-sm text-gray-100">Ruta ${routeMeta.id}</span>
                    <span class="bus-popup-status">En movimiento</span>
                </div>
                <p class="text-xs text-gray-300 font-medium mt-2">Ubicación actualizada por GPS</p>
            </div>
        `;
}