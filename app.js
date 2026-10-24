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
const GLASS_STORAGE_KEY = 'mio-tracker-glass';
const TOMTOM_API_KEY = 'gMnPtcEnZf43HD4ce4MNriH7UIwnROU8';
const CALI_TRAFFIC_BOUNDS = [
    [3.25, -76.65],
    [3.55, -76.45]
];

const FEATURED_ROUTES = [
    {
        id: 'T12',
        name: 'T12 Andrés Sanín - Centro - Cll 5ta',
        type: 'TRONCAL',
        color: '#ef4444', // Red
        desc: 'Conecta Oriente con Troncal Cll 5ta'
    },
    {
        id: 'P40B',
        name: 'P40B Andrés Sanín - Centro',
        type: 'PRETRONCAL',
        color: '#f59e0b', // Amber
        desc: 'Pretroncal por la Cra 8va'
    },
    {
        id: 'A11',
        name: 'A11 Universidades - Javeriana - Icesi',
        type: 'ALIMENTADOR',
        color: '#10b981', // Emerald
        desc: 'Corredor Universitario Pance'
    },
    {
        id: 'A14A',
        name: 'A14A Universidades - San Buenaventura',
        type: 'ALIMENTADOR',
        color: '#58c7d9', // Cyan
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

// Picks white or dark text, whichever has the higher WCAG contrast against a route's hex color
function routeInk(hex) {
    const channels = hex.replace('#', '').match(/../g).map(part => {
        const value = parseInt(part, 16) / 255;
        return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    const luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    const contrastWithWhite = 1.05 / (luminance + 0.05);
    const contrastWithDark = (luminance + 0.05) / 0.055;
    return contrastWithWhite >= contrastWithDark ? '#ffffff' : '#0b1017';
}

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
const STOP_RADIUS = 7;
const STOP_RADIUS_FOCUSED = 11;
const STOP_RADIUS_NEAREST = 10;
let stopRenderer = null;
let stopDataByRoute = {};
const failedStopRoutes = new Set();
let stopLayersByRoute = {};
let map = null;
let tileLayer = null;
let trafficLayer = null;
let trafficEnabled = false;
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
let filteredUserLocation = null;

const GPS_FILTER_MIN_ALPHA = 0.15;
const GPS_FILTER_MAX_ALPHA = 0.65;
const GPS_RECENTER_THRESHOLD_METERS = 25;

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
    initDock();
    initMap();
    document.getElementById('routeSearch').addEventListener('input', event => {
        routeSearchTerm = event.target.value.trim().toLowerCase();
        renderRouteCards();
    });

    function initDock() {
        const dock = document.getElementById('dock');
        const handle = document.getElementById('dockHandle');
        if (!dock || !handle) {
            return;
        }

        const mobileQuery = window.matchMedia('(max-width: 1023px)');
        const tabsBar = dock.querySelector('.dock-tabs');

        // Sheet heights in px (mobile only): peek shows the tabs + a short panel, open is ~55% of the viewport
        const peekHeight = () => handle.offsetHeight + tabsBar.offsetHeight + 112 + 2;
        const openHeight = () => Math.min(window.innerHeight * 0.55, 520);

        const applyHeight = state => {
            dock.style.height = mobileQuery.matches
                ? `${state === 'open' ? openHeight() : peekHeight()}px`
                : '';
        };

        const setSheet = state => {
            dock.dataset.sheet = state;
            handle.setAttribute('aria-expanded', String(state === 'open'));
            handle.setAttribute('aria-label', state === 'open' ? 'Contraer panel' : 'Expandir panel');
            applyHeight(state);
        };

        const setTab = (tab, { expand = false } = {}) => {
            if (tab !== dock.dataset.tab) {
                dock.dataset.dir = tab === 'routes' ? 'forward' : 'back';
            }
            dock.dataset.tab = tab;
            dock.querySelectorAll('[data-dock-tab]').forEach(button => {
                const isActive = button.dataset.dockTab === tab;
                button.classList.toggle('is-active', isActive);
                button.setAttribute('aria-selected', String(isActive));
            });
            document.getElementById('nearestPanel').hidden = tab !== 'nearest';
            document.getElementById('rutas_seleccionar').hidden = tab !== 'routes';
            if (expand) {
                setSheet('open');
            }
        };

        dock.querySelectorAll('[data-dock-tab]').forEach(button => {
            button.addEventListener('click', () => {
                const alreadyActive = dock.dataset.tab === button.dataset.dockTab;
                // On mobile, tapping the active tab toggles the sheet; otherwise it opens it
                if (alreadyActive && window.matchMedia('(max-width: 1023px)').matches) {
                    setSheet(dock.dataset.sheet === 'open' ? 'peek' : 'open');
                } else {
                    setTab(button.dataset.dockTab, { expand: window.matchMedia('(max-width: 1023px)').matches });
                }
            });
        });

        // Drag the handle (or the tab strip) to resize the sheet; a plain tap on the handle slides it open/closed
        let drag = null;
        let suppressClick = false;

        const onDragStart = event => {
            if (!mobileQuery.matches || (event.pointerType === 'mouse' && event.button !== 0)) {
                return;
            }
            drag = {
                id: event.pointerId,
                target: event.currentTarget,
                startY: event.clientY,
                startH: dock.offsetHeight,
                lastY: event.clientY,
                lastT: event.timeStamp,
                velocity: 0,
                moved: false
            };
        };

        const onDragMove = event => {
            if (!drag || event.pointerId !== drag.id) {
                return;
            }
            const dy = event.clientY - drag.startY;
            if (!drag.moved) {
                if (Math.abs(dy) < 6) {
                    return;
                }
                drag.moved = true;
                drag.target.setPointerCapture(drag.id);
                dock.classList.add('is-dragging');
            }
            const dt = event.timeStamp - drag.lastT;
            if (dt > 0) {
                drag.velocity = (event.clientY - drag.lastY) / dt;
            }
            drag.lastY = event.clientY;
            drag.lastT = event.timeStamp;
            const min = peekHeight();
            const max = openHeight();
            dock.style.height = `${Math.max(min, Math.min(max, drag.startH - dy))}px`;
        };

        const onDragEnd = event => {
            if (!drag || event.pointerId !== drag.id) {
                return;
            }
            const { moved, velocity } = drag;
            drag = null;
            if (!moved) {
                return;
            }
            suppressClick = true;
            setTimeout(() => { suppressClick = false; }, 0);
            dock.classList.remove('is-dragging');
            const mid = (peekHeight() + openHeight()) / 2;
            // A quick flick wins over position; otherwise snap to the nearest state
            const goOpen = Math.abs(velocity) > 0.4 ? velocity < 0 : dock.offsetHeight > mid;
            setSheet(goOpen ? 'open' : 'peek');
        };

        [handle, tabsBar].forEach(el => {
            el.addEventListener('pointerdown', onDragStart);
            el.addEventListener('pointermove', onDragMove);
            el.addEventListener('pointerup', onDragEnd);
            el.addEventListener('pointercancel', onDragEnd);
        });
        // Swallow the click that follows a drag so it doesn't also toggle the sheet or switch tabs
        dock.addEventListener('click', event => {
            if (suppressClick) {
                event.stopPropagation();
                event.preventDefault();
            }
        }, true);

        handle.addEventListener('click', () => setSheet(dock.dataset.sheet === 'open' ? 'peek' : 'open'));
        mobileQuery.addEventListener('change', () => applyHeight(dock.dataset.sheet));
        window.addEventListener('resize', () => applyHeight(dock.dataset.sheet));

        // "Seleccionar rutas" links inside the nearest-stop empty state
        document.addEventListener('click', event => {
            const link = event.target.closest('a[href="#rutas_seleccionar"]');
            if (link) {
                event.preventDefault();
                setTab('routes', { expand: true });
            }
        });

        // Keep Leaflet's bottom controls above the sheet on mobile
        const syncDockHeight = () => {
            const isSheet = window.matchMedia('(max-width: 1023px)').matches;
            document.documentElement.style.setProperty('--dock-h', isSheet ? `${dock.offsetHeight}px` : '0px');
        };
        if (window.ResizeObserver) {
            new ResizeObserver(syncDockHeight).observe(dock);
        }
        window.addEventListener('resize', syncDockHeight);
        syncDockHeight();
        applyHeight(dock.dataset.sheet);
    }

    function initSettings() {
        const settingsButton = document.getElementById('settingsButton');
        const closeSettingsButton = document.getElementById('closeSettingsButton');
        const settingsPanel = document.getElementById('settingsPanel');
        const themeOptions = document.getElementById('themeOptions');
        const appearanceSelect = document.getElementById('appearanceSelect');

        if (!settingsButton || !closeSettingsButton || !settingsPanel || !themeOptions || !appearanceSelect) {
            return;
        }

        document.body.appendChild(settingsPanel);
        const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) || 'blue';
        const savedAppearance = localStorage.getItem(APPEARANCE_STORAGE_KEY) || 'auto';
        applyTheme(savedTheme);
        applyAppearance(savedAppearance);
        appearanceSelect.value = savedAppearance;

        settingsButton.addEventListener('click', () => {
            const isOpen = !settingsPanel.hidden;
            settingsPanel.hidden = isOpen;
            settingsButton.setAttribute('aria-expanded', String(!isOpen));
            if (!isOpen) {
                positionSettingsPanel(settingsButton, settingsPanel);
            }
        });

        closeSettingsButton.addEventListener('click', closeSettings);
        themeOptions.addEventListener('click', event => {
            const themeOption = event.target.closest('[data-theme-option]');
            if (themeOption) {
                applyTheme(themeOption.dataset.themeOption);
            }
        });
        appearanceSelect.addEventListener('change', event => applyAppearance(event.target.value));

        const glassToggle = document.getElementById('glassToggle');
        if (glassToggle) {
            glassToggle.checked = document.documentElement.dataset.glass !== 'off';
            glassToggle.addEventListener('change', event => setGlassEnabled(event.target.checked));
        }
        window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
            applyAppearance(document.documentElement.dataset.appearance);
        });
        document.addEventListener('click', event => {
            if (!settingsPanel.hidden && !event.target.closest('.settings-menu') && !event.target.closest('#settingsPanel')) {
                closeSettings();
            }
        });
        window.addEventListener('resize', () => {
            if (!settingsPanel.hidden) {
                positionSettingsPanel(settingsButton, settingsPanel);
            }
        });
    }

    function positionSettingsPanel(button, panel) {
        const buttonRect = button.getBoundingClientRect();
        const panelWidth = Math.min(320, window.innerWidth - 24);
        const right = Math.max(12, window.innerWidth - buttonRect.right);
        panel.style.width = `${panelWidth}px`;
        panel.style.top = `${buttonRect.bottom + 12}px`;
        panel.style.right = `${right}px`;
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
        const allowedThemes = ['blue', 'amber', 'teal', 'violet', 'rose', 'lime', 'indigo', 'red', 'yellow', 'green', 'white', 'black'];
        const selectedTheme = allowedThemes.includes(theme) ? theme : 'blue';
        document.documentElement.dataset.theme = selectedTheme;
        localStorage.setItem(THEME_STORAGE_KEY, selectedTheme);
        document.querySelectorAll('[data-theme-option]').forEach(option => {
            option.classList.toggle('is-selected', option.dataset.themeOption === selectedTheme);
        });
    }

    function applyAppearance(appearance) {
        const allowedAppearances = ['dark', 'light', 'auto'];
        const selectedAppearance = allowedAppearances.includes(appearance) ? appearance : 'auto';
        const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
        document.documentElement.dataset.appearance = selectedAppearance;
        document.documentElement.dataset.mode = selectedAppearance === 'auto'
            ? (prefersLight ? 'light' : 'dark')
            : selectedAppearance;
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

    L.control.zoom({ position: 'bottomright' }).addTo(map);
    map.on('dragstart', () => {
        followUserLocation = false;
        updateLocateButtonState();
    });
    map.on('moveend', refreshStopMarkerStyles);
    changeMapMode(currentMapMode);
    updateTrafficButtonState();
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
    button.classList.add('is-busy');
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
    const previousLocation = filteredUserLocation;
    const filterAlpha = previousLocation
        ? Math.min(
            GPS_FILTER_MAX_ALPHA,
            Math.max(GPS_FILTER_MIN_ALPHA, 12 / Math.max(accuracy, 12))
        )
        : 1;

    filteredUserLocation = previousLocation
        ? {
            lat: previousLocation.lat + (latitude - previousLocation.lat) * filterAlpha,
            lng: previousLocation.lng + (longitude - previousLocation.lng) * filterAlpha
        }
        : { lat: latitude, lng: longitude };

    const userLatLng = [filteredUserLocation.lat, filteredUserLocation.lng];
    const shouldCenterMap = !userLocationMarker || followUserLocation;
    userCoordinates = filteredUserLocation;

    if (!userLocationAccuracy) {
        userLocationAccuracy = L.circle(userLatLng, {
            radius: accuracy,
            color: '#34d399',
            fillColor: '#34d399',
            fillOpacity: 0.12,
            weight: 1
        }).addTo(map);
    } else {
        userLocationAccuracy.setLatLng(userLatLng);
        userLocationAccuracy.setRadius(accuracy);
    }

    if (!userLocationMarker) {
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
    } else {
        userLocationMarker.setLatLng(userLatLng);
        userLocationMarker.setPopupContent(
            `<strong>Mi ubicación</strong><br>Precisión aproximada: ${Math.round(accuracy)} m`
        );
    }

    if (shouldCenterMap && (
        !previousLocation ||
        getDistanceInMeters(previousLocation.lat, previousLocation.lng, userLatLng[0], userLatLng[1])
            >= GPS_RECENTER_THRESHOLD_METERS
    )) {
        map.panTo(userLatLng, { animate: true, duration: 0.35, noMoveStart: true });
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
        button.classList.add('is-busy');
    } else {
        button.disabled = false;
        button.classList.remove('is-busy');
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

function toggleTraffic() {
    if (!TOMTOM_API_KEY || TOMTOM_API_KEY === 'REPLACE_WITH_YOUR_TOMTOM_API_KEY') {
        document.getElementById('lastUpdated').innerText = 'Configura TOMTOM_API_KEY en app.js para activar el tráfico.';
        return;
    }

    setTrafficEnabled(!trafficEnabled);
}

function setTrafficEnabled(enabled) {
    if (!map) {
        return;
    }

    if (enabled) {
        if (!trafficLayer) {
            trafficLayer = L.tileLayer(
                `https://api.tomtom.com/traffic/map/4/tile/flow/relative0/{z}/{x}/{y}.png?key=${encodeURIComponent(TOMTOM_API_KEY)}`,
                {
                    attribution: '&copy; TomTom',
                    maxZoom: 22,
                    opacity: 0.75,
                    bounds: CALI_TRAFFIC_BOUNDS
                }
            );
        }
        trafficLayer.addTo(map);
        trafficEnabled = true;
    } else {
        if (trafficLayer) {
            map.removeLayer(trafficLayer);
        }
        trafficLayer = null;
        trafficEnabled = false;
    }

    updateTrafficButtonState();
}

function updateTrafficButtonState() {
    const button = document.getElementById('trafficToggleButton');
    const icon = document.getElementById('trafficToggleIcon');
    const text = document.getElementById('trafficToggleText');
    if (!button || !icon || !text) {
        return;
    }

    const hasApiKey = TOMTOM_API_KEY !== 'REPLACE_WITH_YOUR_TOMTOM_API_KEY';
    button.classList.toggle('is-active', trafficEnabled);
    button.setAttribute('aria-pressed', String(trafficEnabled));
    button.title = hasApiKey
        ? `${trafficEnabled ? 'Desactivar' : 'Activar'} tráfico TomTom`
        : 'Configurar tráfico TomTom';
    text.innerText = trafficEnabled ? 'Tráfico activo' : 'Tráfico';
    icon.className = `fa-solid ${trafficEnabled ? 'fa-toggle-on text-success' : 'fa-traffic-light text-warning'}`;
}

/* ==========================================================================
   ROUTE CARD SELECTION UI
   ========================================================================== */

function renderRouteCards() {
    const container = document.getElementById('routesGrid');
    const previousScroll = container.scrollTop;
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

        const card = document.createElement('button');
        card.type = 'button';
        card.onclick = () => toggleRouteSelection(route.id);
        card.className = `route-card${isSelected ? ' is-selected' : ''}`;
        card.style.setProperty('--route-color', route.color);
        card.style.setProperty('--route-ink', routeInk(route.color));
        card.setAttribute('aria-pressed', String(isSelected));
        card.title = route.name;

        card.innerHTML = `
            <span class="route-card-top">
                <span class="route-code">${route.id}</span>
                <span class="route-check" aria-hidden="true">
                    <i class="fa-solid ${isSelected ? 'fa-check' : 'fa-plus'}"></i>
                </span>
            </span>
            <span class="route-card-meta">
                <span class="route-type">${route.type}</span>
                <span class="route-buses${activeCount > 0 ? ' has-buses' : ''}">
                    ${activeCount} ${activeCount === 1 ? 'bus' : 'buses'}
                </span>
            </span>
        `;

        container.appendChild(card);
    });

    document.getElementById('selectedCount').innerText =
        `${selectedRoutes.length} ${selectedRoutes.length === 1 ? 'activa' : 'activas'}`;
    document.getElementById('routesResultCount').innerText =
        `${visibleRoutes.length} de ${TARGET_ROUTES.length} rutas`;

    if (visibleRoutes.length === 0) {
        container.innerHTML = '<div class="route-empty-state">No se encontraron rutas con esa búsqueda.</div>';
    }

    container.scrollTop = previousScroll;
    renderMapLegend();
}

function renderMapLegend() {
    const legend = document.getElementById('mapLegend');
    if (!legend) {
        return;
    }

    const routes = selectedRoutes
        .map(routeId => TARGET_ROUTES.find(route => route.id === routeId))
        .filter(Boolean);

    legend.innerHTML = routes.length > 0
        ? routes.map(route =>
            `<span class="legend-item" style="--route-color: ${route.color}; --route-ink: ${routeInk(route.color)}">${route.id}</span>`
        ).join('')
        : '<span>Sin rutas en el mapa</span>';
}

function setConnectionStatus(state, text) {
    document.getElementById('statusBadge').dataset.state = state;
    document.getElementById('statusText').innerText = text;
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
    const refreshIcon = document.getElementById('refreshIcon');

    refreshIcon.classList.add('fa-spin');
    setConnectionStatus('loading', 'Consultando MIO...');

    if (selectedRoutes.length === 0) {
        refreshIcon.classList.remove('fa-spin');
        setConnectionStatus('idle', 'Selecciona una ruta');
        document.getElementById('lastUpdated').innerHTML = 'Sin rutas seleccionadas';
        updateBusMarkers();
        updateRoutePaths();
        updateRouteStops();
        updateNearestStopPanel();
        return;
    }

    let hasSuccess = false;
    let serverError = false; // <-- NUEVA BANDERA PARA DETECTAR CAÍDAS

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
                // <-- SI RESPONDE 503 O CUALQUIER ERROR 500, MARCAR COMO CAÍDO
                if (response.status === 503 || response.status >= 500) {
                    serverError = true;
                }
            }
        } catch (err) {
            console.warn(`Error al consultar ruta ${routeId}:`, err);
            busDataByRoute[routeId] = busDataByRoute[routeId] || [];
            serverError = true; // Un error de red (servidor apagado) también cuenta como caído
        }
    });

    await Promise.all(promises);
    await Promise.all(selectedRoutes.map(routeId => fetchRoutePath(routeId)));
    await Promise.all(selectedRoutes.map(routeId => fetchRouteStops(routeId)));

    refreshIcon.classList.remove('fa-spin');

   // <-- NUEVA LÓGICA VISUAL PARA EL ERROR 503
    if (serverError && !hasSuccess) {
        // 1. AÑADE LA CAPA ROJA: Solo cuando hay error crítico
        document.documentElement.setAttribute('data-server-error', 'true');
        
        setConnectionStatus('error', 'Servidor caído (503)');
        document.getElementById('lastUpdated').innerHTML = '<span class="text-danger"><i class="fa-solid fa-triangle-exclamation"></i> API fuera de servicio temporalmente</span>';
        
    } else if (hasSuccess) {
        // 2. QUITA LA CAPA ROJA: Restaura el tema original (Verde)
        document.documentElement.removeAttribute('data-server-error');

        setConnectionStatus('ok', 'En línea');
        document.getElementById('lastUpdated').innerText = `Actualizado: ${new Date().toLocaleTimeString('es-CO')}`;
        
    } else {
        // 3. QUITA LA CAPA ROJA: Restaura el tema original (Naranja)
        document.documentElement.removeAttribute('data-server-error');

        setConnectionStatus('warn', 'Despertando servidor...');
        document.getElementById('lastUpdated').innerText = 'Reintentando conexión...';
    }

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
        failedStopRoutes.delete(routeId);
        updateRouteStops();
        updateNearestStopPanel();
    } catch (err) {
        console.warn(`Error al consultar paradas de ruta ${routeId}:`, err);
        failedStopRoutes.add(routeId);
        updateNearestStopPanel();
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
                radius: STOP_RADIUS,
                color: '#ffffff',
                weight: 2,
                fillColor: routeMeta.color,
                fillOpacity: 1,
                renderer: getStopRenderer()
            }).bindPopup(createStopPopupContent(stop, routeMeta));

            stopLayer.stopData = stop;
            stopLayer.routeMeta = routeMeta;
            stopLayer.on('click', () => fetchStopArrivals(stop, routeMeta, stopLayer));
            stopLayer.addTo(map);
            return stopLayer;
        });
    });

    refreshStopMarkerStyles();
}

function getStopRenderer() {
    // Tolerancia extra para que tocar cerca del punto en celular también lo seleccione
    if (!stopRenderer) {
        // Pane propio por encima de los trayectos (overlayPane = 400) y debajo de los buses (markerPane = 600)
        const stopsPane = map.getPane('stopsPane') || map.createPane('stopsPane');
        stopsPane.style.zIndex = 450;
        stopRenderer = L.canvas({ padding: 0.5, tolerance: 12, pane: 'stopsPane' });
    }
    return stopRenderer;
}

function refreshStopMarkerStyles() {
    if (!map) {
        return;
    }

    const allLayers = Object.values(stopLayersByRoute).flat();
    if (allLayers.length === 0) {
        return;
    }

    const nearest = findNearestStop();
    const center = map.getCenter();
    const bounds = map.getBounds();

    // La parada más cercana al centro de la pantalla es la que se agranda
    let focusedLayer = null;
    let focusedDistance = Infinity;
    allLayers.forEach(layer => {
        if (!bounds.contains(layer.getLatLng())) {
            return;
        }
        const distance = center.distanceTo(layer.getLatLng());
        if (distance < focusedDistance) {
            focusedDistance = distance;
            focusedLayer = layer;
        }
    });

    allLayers.forEach(layer => {
        const isNearest = nearest
            && layer.stopData === nearest.stop
            && layer.routeMeta.id === nearest.route.id;
        const isFocused = layer === focusedLayer;

        // Solo se toca la capa cuando su rol cambia; evita redibujar todo el canvas en cada movimiento
        const role = isNearest ? 'nearest' : 'normal';
        if (layer.stopRole !== role) {
            layer.stopRole = role;
            layer.setStyle(isNearest
                ? { color: '#111827', weight: 4, fillColor: '#ffffff' }
                : { color: '#ffffff', weight: 2, fillColor: layer.routeMeta.color });
            if (isNearest) {
                layer.bringToFront();
            }
        }

        const targetRadius = isNearest
            ? (isFocused ? STOP_RADIUS_NEAREST + 3 : STOP_RADIUS_NEAREST)
            : (isFocused ? STOP_RADIUS_FOCUSED : STOP_RADIUS);
        if (layer.getRadius() !== targetRadius) {
            layer.setRadius(targetRadius);
        }
    });
}

function setGlassEnabled(enabled) {
    document.documentElement.dataset.glass = enabled ? 'on' : 'off';
    try {
        localStorage.setItem(GLASS_STORAGE_KEY, String(enabled));
    } catch (error) {
        console.warn('No se pudo guardar la preferencia de liquid glass:', error);
    }
}

function createStopPopupContent(stop, routeMeta, message = '<div class="popup-message">Haz clic en la parada para consultar llegadas.</div>') {
    return `
        <div class="popup">
            <div class="popup-heading">
                <div class="popup-title">${stop.nombre}</div>
                <span class="route-chip" style="--route-color: ${routeMeta.color}; --route-ink: ${routeInk(routeMeta.color)}">${routeMeta.id}</span>
            </div>
            ${message}
        </div>
    `;
}

function createArrivalsList(arrivals, fallbackLine) {
    return `
        <div class="arrivals-list">
            ${arrivals.map(arrival => `
                <div class="arrival-row">
                    <span class="arrival-line"><span class="line-plate">${arrival.nombreLinea || fallbackLine}</span></span>
                    <span class="arrival-time">${arrival.cuentaRegresiva || 'Sin tiempo'}</span>
                </div>
            `).join('')}
        </div>
    `;
}

async function fetchStopArrivals(stop, routeMeta, stopLayer) {
    if (!stop.id) {
        stopLayer.setPopupContent(createStopPopupContent(
            stop,
            routeMeta,
            '<div class="popup-message is-danger">Esta parada no tiene un ID válido para consultar llegadas.</div>'
        ));
        return;
    }

    stopLayer.setPopupContent(createStopPopupContent(
        stop,
        routeMeta,
        '<div class="popup-message is-warning"><i class="fa-solid fa-spinner fa-spin"></i>Consultando llegadas...</div>'
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
            ? createArrivalsList(sortArrivalsByCountdown(arrivals), routeMeta.id)
            : '<div class="arrivals-empty">No hay buses próximos reportados.</div>';

        stopLayer.setPopupContent(createStopPopupContent(stop, routeMeta, arrivalsContent));
    } catch (err) {
        console.warn(`Error al consultar llegadas de la parada ${stop.id}:`, err);
        stopLayer.setPopupContent(createStopPopupContent(
            stop,
            routeMeta,
            '<div class="popup-message is-danger">No se pudieron consultar las llegadas. Intenta nuevamente.</div>'
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

        const stopsLoading = selectedRoutes.some(
            routeId => !stopDataByRoute[routeId] && !failedStopRoutes.has(routeId)
        );
        if (stopsLoading) {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="empty-state-icon"><i class="fa-solid fa-spinner fa-spin"></i></span>
                    <p class="empty-state-title">Cargando paradas...</p>
                    <p class="empty-state-text">Buscando la parada más cercana en tus rutas seleccionadas.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="empty-state">
                <span class="empty-state-icon is-warning"><i class="fa-solid fa-road-barrier"></i></span>
                <p class="empty-state-title">No hay paradas disponibles</p>
                <p class="empty-state-text">Selecciona al menos una ruta para consultar sus paradas.</p>
                <a href="#rutas_seleccionar" class="link-button">Seleccionar rutas <i class="fa-solid fa-arrow-down"></i></a>
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
            <div data-nearest-stop-key="${stopKey}" class="nearest-stop">
                <div class="nearest-stop-head">
                    <span id="nearestArrivalsStatus" class="nearest-status" data-state="loading" role="status" aria-live="polite" title="Consultando llegadas..." aria-label="Consultando llegadas...">
                        <i class="fa-solid fa-spinner fa-spin"></i>
                    </span>
                    <h3 class="nearest-stop-name">${nearestStop.stop.nombre}</h3>
                    <span class="nearest-stop-meta"><span id="nearestStopDistance">${formatDistance(distance)}</span></span>
                    <span class="route-chip" style="--route-color: ${nearestStop.route.color}; --route-ink: ${routeInk(nearestStop.route.color)}">
                        ${nearestStop.route.id}
                    </span>
                </div>
                <div id="nearestArrivals">
                    <div class="arrivals-empty">Esperando información de llegadas...</div>
                </div>
            </div>
        `;
    } else {
        const distanceElement = document.getElementById('nearestStopDistance');
        if (distanceElement) {
            distanceElement.innerText = formatDistance(distance);
        }
    }

    refreshStopMarkerStyles();
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

function setArrivalsStatus(container, iconClasses, label) {
    container.innerHTML = `<i class="fa-solid ${iconClasses}"></i>`;
    container.title = label;
    container.setAttribute('aria-label', label);
}

async function fetchNearestStopArrivals(stop, route, stopKey) {
    const arrivalsContainer = document.getElementById('nearestArrivals');
    const statusContainer = document.getElementById('nearestArrivalsStatus');
    if (!arrivalsContainer || !statusContainer || !stop.id) {
        return;
    }

    const requestId = ++nearestArrivalsRequestId;
    statusContainer.dataset.state = 'loading';
    setArrivalsStatus(statusContainer, 'fa-spinner fa-spin', 'Consultando llegadas...');

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
            ? createArrivalsList(arrivals, route.id)
            : '<div class="arrivals-empty">No hay buses próximos reportados.</div>';
        statusContainer.dataset.state = 'ok';
        setArrivalsStatus(statusContainer, 'fa-check', 'Llegadas actualizadas');
    } catch (err) {
        console.warn(`Error al consultar llegadas de la parada ${stop.id}:`, err);
        if (requestId !== nearestArrivalsRequestId || nearestStopKey !== stopKey) {
            return;
        }
        statusContainer.dataset.state = 'error';
        setArrivalsStatus(statusContainer, 'fa-triangle-exclamation', 'No se pudo actualizar');
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
        <div class="bus-marker" style="--route-color: ${routeMeta.color}; --route-ink: ${routeInk(routeMeta.color)}">
            <span class="bus-marker-pulse"></span>
            <span class="bus-marker-icon"><i class="fa-solid fa-bus"></i></span>
            <span class="bus-marker-label">${routeMeta.id}</span>
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
            <div class="popup">
                <div class="popup-heading">
                    <span class="popup-title">Ruta ${routeMeta.id}</span>
                    <span class="popup-status">En movimiento</span>
                </div>
                <p class="popup-text"><i class="fa-solid fa-satellite-dish"></i>Ubicación actualizada por GPS</p>
            </div>
        `;
}