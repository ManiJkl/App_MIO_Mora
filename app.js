/* ==========================================================================
   CONFIG & MASTER ROUTE DEFINITIONS
   ========================================================================== */

const RENDER_API_BASE = 'https://mio-backend-mora.onrender.com/api/buses';

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
let map = null;
let tileLayer = null;
let autoRefreshTimer = null;

/* ==========================================================================
   LIFECYCLE INITIALIZATION
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    initMap();
    renderRouteCards();
    fetchActiveRoutesData();

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

    tileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap &copy; CARTO'
    }).addTo(map);
}

function recenterMap() {
    map.flyTo([3.4250, -76.5350], 12.5, { duration: 1 });
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
    updateMapAndList();
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
    updateMapAndList();
}

/* ==========================================================================
   MAP MARKERS & BUS LIST RENDERING
   ========================================================================== */

function updateMapAndList() {
    const busesContainer = document.getElementById('busesListContainer');
    busesContainer.innerHTML = '';

    let totalActiveBuses = 0;
    const currentBusCodes = new Set();

    selectedRoutes.forEach(routeId => {
        const routeMeta = TARGET_ROUTES.find(r => r.id === routeId);
        const buses = busDataByRoute[routeId] || [];

        buses.forEach((bus, index) => {
            totalActiveBuses++;
            
            // Extract coordinates & properties flexible to SIUR variations
            const lat = parseFloat(bus.latitud || bus.lat || bus.latitude);
            const lng = parseFloat(bus.longitud || bus.lng || bus.longitude);
            const busCode = bus.idVehiculo || bus.codigo || bus.busId || `${routeId}-${index}`;
            const busKey = `${routeId}_${busCode}`;

            currentBusCodes.add(busKey);

            if (!isNaN(lat) && !isNaN(lng)) {
                // Update or create Leaflet map marker
                renderBusMarker(busKey, lat, lng, routeMeta, busCode);
            }

            // Append card to active list sidebar
            const busCard = document.createElement('div');
            busCard.className = 'p-2.5 rounded-xl bg-gray-700/40 border border-gray-700/60 hover:bg-gray-700/80 transition-all cursor-pointer flex items-center justify-between gap-2';
            busCard.onclick = () => {
                if (mapMarkers[busKey]) {
                    map.flyTo([lat, lng], 15, { duration: 1 });
                    mapMarkers[busKey].openPopup();
                }
            };

            busCard.innerHTML = `
                <div class="flex items-center gap-2.5">
                    <div class="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shadow-md" style="background-color: ${routeMeta.color}">
                        ${routeId}
                    </div>
                    <div>
                        <div class="font-bold text-xs text-gray-200">Bus ${busCode}</div>
                        <div class="text-[10px] text-gray-400">${routeMeta.name}</div>
                    </div>
                </div>
                <div class="text-right">
                    <span class="text-[10px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800/50 px-2 py-0.5 rounded-full">
                        En vivo
                    </span>
                </div>
            `;
            busesContainer.appendChild(busCard);
        });
    });

    // Remove old markers not active anymore
    Object.keys(mapMarkers).forEach(key => {
        if (!currentBusCodes.has(key)) {
            map.removeLayer(mapMarkers[key]);
            delete mapMarkers[key];
        }
    });

    document.getElementById('totalBusesCount').innerText = `${totalActiveBuses} buses`;

    if (totalActiveBuses === 0) {
        busesContainer.innerHTML = `
            <div class="h-full flex flex-col items-center justify-center p-6 text-center text-gray-500">
                <i class="fa-solid fa-bus text-2xl mb-2 opacity-40"></i>
                <p class="text-xs">No hay buses detectados en las rutas seleccionadas.</p>
                <p class="text-[10px] text-gray-600 mt-1">Si el servidor estuvo apagado, volverá en un momento.</p>
            </div>
        `;
    }
}

function renderBusMarker(key, lat, lng, routeMeta, busCode) {
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
    } else {
        const marker = L.marker([lat, lng], { icon: customIcon }).addTo(map);

        marker.bindPopup(`
            <div class="p-1">
                <div class="flex items-center gap-2 border-b border-gray-700 pb-1 mb-1">
                    <span class="font-extrabold text-sm text-gray-100">${routeMeta.id}</span>
                    <span class="text-[10px] text-gray-400">Código: ${busCode}</span>
                </div>
                <p class="text-xs text-gray-300 font-medium">${routeMeta.name}</p>
                <p class="text-[10px] text-emerald-400 font-bold mt-1">● Reportando ubicación GPS</p>
            </div>
        `);

        mapMarkers[key] = marker;
    }
}