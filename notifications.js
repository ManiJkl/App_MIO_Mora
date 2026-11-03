/* ==========================================================================
   ARRIVAL ALERTS
   Un aviso = (parada, línea, minutos). Cuando un bus de esa línea está a
   `minutos` o menos de la parada, se muestra una notificación y el aviso se
   elimina (cada aviso suena una sola vez).

   - Con push: el aviso se registra en el backend y llega aunque la app esté
     cerrada (requiere permiso, Service Worker y PushManager; en iPhone, la app
     instalada en la pantalla de inicio).
   - Sin push (o si el backend no responde): mientras la app esté abierta, el
     navegador consulta las llegadas y notifica localmente.
   ========================================================================== */

const MioAlerts = (function () {
    const API_BASE = 'https://mio-backend-mora.onrender.com/api';
    const ALERTS_KEY = 'mio-tracker-alerts';
    const MINUTES_KEY = 'mio-tracker-alert-minutes';
    const DEFAULT_MINUTES = 3;
    const MAX_ALERTS = 10;
    const ALERT_TTL_MS = 3 * 60 * 60 * 1000;
    const WATCH_INTERVAL_MS = 30000;

    const canNotify = 'Notification' in window && 'serviceWorker' in navigator;
    const canPush = canNotify && 'PushManager' in window;

    let alerts = load();
    let pushSubscription = null;
    let watchTimer = null;
    let lastError = '';

    /* ------------------------------------------------------------ storage */
    function load() {
        try {
            const parsed = JSON.parse(localStorage.getItem(ALERTS_KEY) || '[]');
            const now = Date.now();
            return Array.isArray(parsed) ? parsed.filter(a => a && now - a.created < ALERT_TTL_MS) : [];
        } catch (err) {
            return [];
        }
    }

    function save() {
        try {
            localStorage.setItem(ALERTS_KEY, JSON.stringify(alerts));
        } catch (err) { /* sin almacenamiento: los avisos viven mientras dure la pestaña */ }
    }

    function getMinutes() {
        try {
            const value = Number(localStorage.getItem(MINUTES_KEY));
            return value >= 1 && value <= 15 ? value : DEFAULT_MINUTES;
        } catch (err) {
            return DEFAULT_MINUTES;
        }
    }

    function setMinutes(value) {
        try {
            localStorage.setItem(MINUTES_KEY, String(value));
        } catch (err) { /* ignorar */ }
    }

    function changed() {
        save();
        syncButtons();
        renderSettings();
        updateWatcher();
        document.dispatchEvent(new CustomEvent('mio-alerts-changed'));
    }

    /* -------------------------------------------------------------- query */
    function find(stopId, line) {
        return alerts.find(a => a.stopId === String(stopId) && a.line === line);
    }

    function has(stopId, line) {
        return Boolean(find(stopId, line));
    }

    /* ------------------------------------------------------------ backend */
    async function api(path, body) {
        const response = await fetch(`${API_BASE}${path}`, {
            method: body ? 'POST' : 'GET',
            headers: body ? { 'Content-Type': 'application/json' } : undefined,
            body: body ? JSON.stringify(body) : undefined
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
    }

    function urlBase64ToUint8Array(base64) {
        const padded = (base64 + '='.repeat((4 - base64.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/');
        const raw = atob(padded);
        return Uint8Array.from(raw, ch => ch.charCodeAt(0));
    }

    async function getRegistration() {
        return navigator.serviceWorker.ready;
    }

    /** Devuelve la suscripción push (creándola si hace falta) o null si no se puede. */
    async function ensurePushSubscription() {
        if (!canPush || Notification.permission !== 'granted') return null;
        if (pushSubscription) return pushSubscription;
        try {
            const registration = await getRegistration();
            let subscription = await registration.pushManager.getSubscription();
            if (!subscription) {
                const { publicKey } = await api('/push/key');
                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(publicKey)
                });
            }
            pushSubscription = subscription;
            return subscription;
        } catch (err) {
            console.warn('Push no disponible, se avisará solo con la app abierta:', err);
            return null;
        }
    }

    async function registerOnServer(alert) {
        const subscription = await ensurePushSubscription();
        if (!subscription) return false;
        try {
            await api('/push/alerts', {
                subscription: subscription.toJSON(),
                alert: { id: alert.id, stopId: alert.stopId, stopName: alert.stopName, line: alert.line, minutes: alert.minutes }
            });
            alert.server = true;
            return true;
        } catch (err) {
            console.warn('No se pudo registrar el aviso en el servidor:', err);
            return false;
        }
    }

    async function unregisterOnServer(alert) {
        if (!alert.server || !pushSubscription) return;
        try {
            await api('/push/alerts/delete', { endpoint: pushSubscription.endpoint, id: alert.id });
        } catch (err) { /* el servidor lo descarta solo al disparar o caducar */ }
    }

    /** Al abrir la app: los avisos que el servidor ya no tiene se dispararon (o caducaron). */
    async function reconcile() {
        if (!alerts.some(a => a.server)) return;
        const subscription = await ensurePushSubscription();
        if (!subscription) {
            alerts.forEach(a => { a.server = false; });
            changed();
            return;
        }
        try {
            const { alerts: remote } = await api('/push/alerts/list', { endpoint: subscription.endpoint });
            const remoteIds = new Set(remote.map(a => a.id));
            alerts = alerts.filter(a => !a.server || remoteIds.has(a.id));
            changed();
        } catch (err) { /* sin conexión: se reintenta en la próxima apertura */ }
    }

    /* --------------------------------------------------------------- acciones */
    async function requestPermission() {
        if (!canNotify) {
            lastError = 'Este navegador no admite notificaciones. En iPhone, añade la app a la pantalla de inicio.';
            return false;
        }
        if (Notification.permission === 'denied') {
            lastError = 'Las notificaciones están bloqueadas. Actívalas en los ajustes del navegador.';
            return false;
        }
        if (Notification.permission !== 'granted') {
            const result = await Notification.requestPermission();
            if (result !== 'granted') {
                lastError = 'Sin permiso de notificaciones no podemos avisarte.';
                return false;
            }
        }
        lastError = '';
        return true;
    }

    async function add(stopId, stopName, line) {
        if (has(stopId, line)) return true;
        if (alerts.length >= MAX_ALERTS) {
            lastError = `Máximo ${MAX_ALERTS} avisos activos.`;
            renderSettings();
            return false;
        }
        if (!await requestPermission()) {
            renderSettings();
            return false;
        }
        const alert = {
            id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
            stopId: String(stopId),
            stopName: stopName || '',
            line,
            minutes: getMinutes(),
            created: Date.now(),
            server: false
        };
        alerts.push(alert);
        changed();
        if (await registerOnServer(alert)) {
            changed();
        }
        return true;
    }

    function remove(stopId, line) {
        const alert = find(stopId, line);
        if (!alert) return;
        alerts = alerts.filter(a => a !== alert);
        changed();
        unregisterOnServer(alert);
    }

    async function toggle(stopId, stopName, line) {
        if (has(stopId, line)) {
            remove(stopId, line);
            return true;
        }
        return add(stopId, stopName, line);
    }

    function removeById(id) {
        const alert = alerts.find(a => a.id === id);
        if (!alert) return;
        alerts = alerts.filter(a => a !== alert);
        changed();
        unregisterOnServer(alert);
    }

    /* ------------------------------------------- aviso local (app abierta) */
    function countdownMinutes(text) {
        if (typeof text !== 'string') return null;
        const match = text.match(/\d+/);
        if (match) return Number(match[0]);
        return /lleg|ahora|inminente|</i.test(text) ? 0 : null;
    }

    async function showLocalNotification(alert, minutes, destination) {
        const where = alert.stopName || `parada ${alert.stopId}`;
        const registration = await getRegistration();
        await registration.showNotification(
            `${alert.line} ${minutes <= 0 ? 'está llegando' : `llega en ${minutes} min`}`,
            {
                body: destination ? `Hacia ${destination} · ${where}` : where,
                tag: alert.id,
                icon: 'icon-192.png',
                badge: 'icon-192.png',
                data: { stopId: alert.stopId }
            }
        );
    }

    async function checkLocalAlerts() {
        const pending = alerts.filter(a => !a.server);
        const now = Date.now();
        alerts = alerts.filter(a => now - a.created < ALERT_TTL_MS);
        if (pending.length === 0 || Notification.permission !== 'granted') {
            if (alerts.length !== pending.length) changed();
            return;
        }

        const stops = [...new Set(pending.map(a => a.stopId))];
        for (const stopId of stops) {
            let buses = [];
            try {
                const response = await fetch(`${API_BASE}/llegadas/${encodeURIComponent(stopId)}`);
                if (!response.ok) continue;
                const json = await response.json();
                buses = json.datos && Array.isArray(json.datos.buses) ? json.datos.buses : [];
            } catch (err) {
                continue;
            }

            for (const alert of pending.filter(a => a.stopId === stopId)) {
                const matches = buses
                    .filter(bus => String(bus.nombreLinea || '').toUpperCase() === alert.line)
                    .map(bus => ({ minutes: countdownMinutes(bus.cuentaRegresiva), destination: bus.nombreDestino }))
                    .filter(match => match.minutes !== null)
                    .sort((a, b) => a.minutes - b.minutes);
                if (matches.length === 0 || matches[0].minutes > alert.minutes) continue;

                try {
                    await showLocalNotification(alert, matches[0].minutes, matches[0].destination);
                    alerts = alerts.filter(a => a.id !== alert.id);
                    changed();
                } catch (err) {
                    console.warn('No se pudo mostrar la notificación:', err);
                }
            }
        }
    }

    function updateWatcher() {
        const needsWatcher = alerts.some(a => !a.server);
        if (needsWatcher && !watchTimer) {
            watchTimer = setInterval(checkLocalAlerts, WATCH_INTERVAL_MS);
            checkLocalAlerts();
        } else if (!needsWatcher && watchTimer) {
            clearInterval(watchTimer);
            watchTimer = null;
        }
    }

    /* ----------------------------------------------------------------- UI */
    function syncButtons() {
        document.querySelectorAll('.arrival-alert').forEach(button => {
            const active = has(button.dataset.stopId, button.dataset.line);
            button.classList.toggle('is-active', active);
            button.setAttribute('aria-pressed', String(active));
            button.title = active ? 'Quitar aviso' : 'Avisarme cuando esté cerca';
            const icon = button.querySelector('i');
            if (icon) icon.className = active ? 'fa-solid fa-bell' : 'fa-regular fa-bell';
        });
    }

    function escapeHtml(value) {
        return String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    }

    function statusText() {
        if (lastError) return lastError;
        if (!canNotify) return 'Este navegador no admite notificaciones. En iPhone, añade la app a la pantalla de inicio.';
        if (Notification.permission === 'denied') return 'Notificaciones bloqueadas en el navegador.';
        if (!canPush) return 'Solo avisará con la app abierta.';
        return alerts.some(a => !a.server) && alerts.length
            ? 'Algunos avisos solo suenan con la app abierta.'
            : 'Te avisamos aunque la app esté cerrada.';
    }

    function renderSettings() {
        const list = document.getElementById('alertsList');
        const status = document.getElementById('alertsStatus');
        if (status) status.textContent = statusText();
        if (!list) return;

        list.innerHTML = alerts.length === 0
            ? '<li class="alerts-empty">Toca la campana junto a una llegada para crear un aviso.</li>'
            : alerts.map(alert => `
                <li class="alerts-item">
                    <span class="line-plate">${escapeHtml(alert.line)}</span>
                    <span class="alerts-item-text">${escapeHtml(alert.stopName || alert.stopId)} · ≤ ${alert.minutes} min</span>
                    <button type="button" class="alerts-remove" data-alert-id="${escapeHtml(alert.id)}" aria-label="Quitar aviso" title="Quitar aviso">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </li>
            `).join('');
    }

    function init() {
        // Captura: los popups de Leaflet detienen la propagación de los clics.
        document.addEventListener('click', async event => {
            const bell = event.target.closest('.arrival-alert');
            if (bell) {
                event.preventDefault();
                bell.disabled = true;
                await toggle(bell.dataset.stopId, bell.dataset.stopName, bell.dataset.line);
                bell.disabled = false;
                return;
            }
            const removeButton = event.target.closest('.alerts-remove');
            if (removeButton) {
                removeById(removeButton.dataset.alertId);
            }
        }, true);

        const minutesSelect = document.getElementById('alertMinutes');
        if (minutesSelect) {
            minutesSelect.value = String(getMinutes());
            minutesSelect.addEventListener('change', event => setMinutes(Number(event.target.value)));
        }

        if (canNotify) {
            navigator.serviceWorker.addEventListener('message', event => {
                if (event.data && event.data.type === 'alert-fired') {
                    alerts = alerts.filter(a => a.id !== event.data.alertId);
                    changed();
                }
            });
        }

        renderSettings();
        syncButtons();
        updateWatcher();
        reconcile();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    return { has, toggle, syncButtons };
})();
