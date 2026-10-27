/* ==========================================================================
   CONSENT: Google Analytics only loads after the visitor accepts.
   Ley 1581 de 2012 (Habeas Data): prior, express and informed authorization.
   ========================================================================== */

(function () {
    var CONSENT_STORAGE_KEY = 'mio-tracker-consent';
    var GA_MEASUREMENT_ID = 'G-ME2E5HNNJK';
    var analyticsLoaded = false;
    var consentCallbacks = [];

    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    window.gtag = gtag;

    function readConsent() {
        try {
            var saved = JSON.parse(localStorage.getItem(CONSENT_STORAGE_KEY));
            return saved && (saved.analytics === true || saved.analytics === false) ? saved : null;
        } catch (error) {
            return null;
        }
    }

    function saveConsent(analytics) {
        try {
            localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify({
                analytics: analytics,
                date: new Date().toISOString()
            }));
        } catch (error) {
            // Storage unavailable: the choice only lasts for this page view
        }
    }

    function loadAnalytics() {
        if (analyticsLoaded) {
            return;
        }
        analyticsLoaded = true;
        window['ga-disable-' + GA_MEASUREMENT_ID] = false;

        gtag('consent', 'default', {
            analytics_storage: 'granted',
            ad_storage: 'denied',
            ad_user_data: 'denied',
            ad_personalization: 'denied'
        });
        gtag('js', new Date());
        gtag('config', GA_MEASUREMENT_ID, { allow_google_signals: false });

        var script = document.createElement('script');
        script.async = true;
        script.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_MEASUREMENT_ID;
        document.head.appendChild(script);

        consentCallbacks.splice(0).forEach(function (callback) { callback(); });
    }

    function removeAnalyticsCookies() {
        var hostParts = location.hostname.split('.');
        var domains = ['', location.hostname];
        for (var i = 1; i < hostParts.length - 1; i++) {
            domains.push('.' + hostParts.slice(i).join('.'));
        }
        document.cookie.split(';').forEach(function (cookie) {
            var name = cookie.split('=')[0].trim();
            if (name.indexOf('_ga') !== 0) {
                return;
            }
            domains.forEach(function (domain) {
                document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/' +
                    (domain ? '; domain=' + domain : '');
            });
        });
    }

    function applyConsent(analytics) {
        saveConsent(analytics);
        if (analytics) {
            loadAnalytics();
        } else {
            window['ga-disable-' + GA_MEASUREMENT_ID] = true;
            removeAnalyticsCookies();
        }
    }

    function closeBanner() {
        var banner = document.getElementById('consentBanner');
        if (banner) {
            banner.remove();
        }
    }

    function openBanner() {
        if (document.getElementById('consentBanner')) {
            return;
        }

        var banner = document.createElement('div');
        banner.id = 'consentBanner';
        banner.className = 'consent-banner';
        banner.setAttribute('role', 'dialog');
        banner.setAttribute('aria-labelledby', 'consentTitle');
        banner.setAttribute('aria-describedby', 'consentText');

        var title = document.createElement('strong');
        title.id = 'consentTitle';
        title.className = 'consent-title';
        title.textContent = 'Tu privacidad';

        var text = document.createElement('p');
        text.id = 'consentText';
        text.className = 'consent-text';
        text.append(
            'Usamos Google Analytics para medir cómo se usa la app y mejorarla. ' +
            'Solo se activa si lo aceptas. Tu ubicación nunca se envía a nuestros servidores. ',
        );
        var link = document.createElement('a');
        link.href = 'legal.html#privacidad';
        link.textContent = 'Política de privacidad';
        text.append(link, '.');

        var actions = document.createElement('div');
        actions.className = 'consent-actions';

        var reject = document.createElement('button');
        reject.type = 'button';
        reject.className = 'consent-button';
        reject.textContent = 'Rechazar';
        reject.addEventListener('click', function () {
            applyConsent(false);
            closeBanner();
        });

        var accept = document.createElement('button');
        accept.type = 'button';
        accept.className = 'consent-button';
        accept.textContent = 'Aceptar';
        accept.addEventListener('click', function () {
            applyConsent(true);
            closeBanner();
        });

        actions.append(reject, accept);
        banner.append(title, text, actions);
        document.body.appendChild(banner);
    }

    // Events are dropped unless the visitor accepted analytics
    function track(name, params) {
        if (analyticsLoaded && window['ga-disable-' + GA_MEASUREMENT_ID] === false) {
            gtag('event', name, params);
        }
    }

    // Runs the callback now if analytics is on, or once the visitor accepts it
    function whenConsented(callback) {
        if (analyticsLoaded) {
            callback();
        } else {
            consentCallbacks.push(callback);
        }
    }

    window.MioConsent = { open: openBanner, track: track, whenConsented: whenConsented };

    var saved = readConsent();
    if (saved && saved.analytics) {
        loadAnalytics();
    } else if (saved) {
        window['ga-disable-' + GA_MEASUREMENT_ID] = true;
    }

    document.addEventListener('DOMContentLoaded', function () {
        if (!saved) {
            openBanner();
        }
    });
})();
