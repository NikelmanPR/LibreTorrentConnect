(function () {
    'use strict';

    var VERSION = '1.2.4';
    var FLAG = '__LTC_REGISTERED__';
    var EVENT_URL = 'http://127.0.0.1:17865/events';

    console.log('[LTC-DIAG] Script loaded. Version:', VERSION);
    console.log('[LTC-DIAG] appready:', window.appready);
    console.log('[LTC-DIAG] Lampa:', !!window.Lampa);

    if (window[FLAG]) {
        console.log('[LTC-DIAG] Already registered');
        return;
    }

    var eventCursor = 0;
    var firstPoll = true;
    var pollTimer = null;
    var bootTimer = null;

    function log(message, data) {
        if (typeof data !== 'undefined') {
            console.log('[LTC-DIAG]', message, data);
        } else {
            console.log('[LTC-DIAG]', message);
        }
    }

    function getMagnet(element) {
        if (!element) return '';

        if (element.MagnetUri) {
            return String(element.MagnetUri);
        }

        if (/^magnet:/i.test(element.Link || '')) {
            return String(element.Link);
        }

        if (element.torrent_hash) {
            return 'magnet:?xt=urn:btih:' +
                String(element.torrent_hash);
        }

        return '';
    }

    function getTitle(element) {
        if (!element) return '';

        return String(
            element.Title ||
            element.title ||
            element.name ||
            element.path_human ||
            ''
        );
    }

    function notify(message) {
        if (window.Lampa && Lampa.Noty) {
            Lampa.Noty.show(message);
        } else {
            log('Notification unavailable:', message);
        }
    }

    function getEventName(item) {
        return item && item.name != null
            ? String(item.name).trim()
            : '';
    }

    function handleEvent(item) {
        if (!item || !item.type) return;

        var name = getEventName(item);

        log('Backend event:', item);

        switch (item.type) {
            case 'added':
                notify('Торрент добавлен в мою фильмотеку');
                break;

            case 'duplicate':
                notify(
                    name
                        ? 'LTC: «' + name + '» уже есть в фильмотеке'
                        : 'LTC: торрент уже есть в фильмотеке'
                );
                break;

            case 'error':
                notify(
                    'LTC: не удалось добавить' +
                    (name ? ' «' + name + '»' : '') +
                    ' — ' +
                    (item.reason || 'неизвестная ошибка')
                );
                break;

            case 'started':
            case 'finished':
                break;

            default:
                log('Unknown backend event:', item.type);
                break;
        }
    }

    function pollEvents() {
        if (!window.fetch) return;

        fetch(EVENT_URL + '?after=' + eventCursor, {
            method: 'GET',
            cache: 'no-store'
        })
            .then(function (response) {
                if (!response.ok) {
                    throw new Error('HTTP ' + response.status);
                }

                return response.json();
            })
            .then(function (data) {
                var events = data && Array.isArray(data.events)
                    ? data.events
                    : [];

                if (firstPoll && events.length === 0) {
                    eventCursor = Number(data.latest || 0);
                    firstPoll = false;
                    return;
                }

                firstPoll = false;

                events.forEach(function (item) {
                    handleEvent(item);

                    eventCursor = Math.max(
                        eventCursor,
                        Number(item.id || 0)
                    );
                });

                eventCursor = Math.max(
                    eventCursor,
                    Number(data.latest || 0)
                );
            })
            .catch(function (error) {
                log('Event polling error:', error);
            });
    }

    function addMenuAction(event) {
        if (!event) {
            log('Menu event is empty');
            return;
        }

        log('Menu event received:', {
            type: event.type,
            hasMenu: !!event.menu,
            hasElement: !!event.element,
            element: event.element
        });

        if (event.type !== 'onlong') return;

        if (!event.menu || typeof event.menu.push !== 'function') {
            log('Event menu is unavailable');
            return;
        }

        if (!event.element) {
            log('Event element is unavailable');
            return;
        }

        if (event.__ltcAdded) {
            log('LTC menu item already added');
            return;
        }

        var magnet = getMagnet(event.element);

        if (!magnet) {
            log('Magnet not found in event element:', event.element);
            return;
        }

        var title = getTitle(event.element);

        var menuItem = {
            title: 'Скачать в мою фильмотеку',

            onSelect: function () {
                log('Menu item selected:', title);

                try {
                    if (
                        !window.AndroidJS ||
                        typeof window.AndroidJS.openTorrentLink !== 'function'
                    ) {
                        notify('LTC: AndroidJS недоступен');
                        log('AndroidJS.openTorrentLink unavailable');
                        return;
                    }

                    var result = window.AndroidJS.openTorrentLink(
                        magnet,
                        JSON.stringify({
                            title: title,
                            poster: 'LTC_AUTO_ADD'
                        })
                    );

                    log('AndroidJS result:', result);

                    if (result === false) {
                        notify('LTC: не удалось передать magnet');
                    }
                } catch (error) {
                    console.error('[LTC-DIAG] Magnet transfer error:', error);
                    notify('LTC: не удалось передать magnet');
                }
            }
        };

        menuItem.ltcAction = true;

        event.menu.push(menuItem);
        event.__ltcAdded = true;

        log('Menu item successfully added:', title);
    }

    function registerSettings() {
        log('Registering settings');

        Lampa.SettingsApi.addComponent({
            component: 'ltc_diagnostic',
            name: 'Libre Torrent Connect',
            icon: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 3v11m0 0 4-4m-4 4-4-4M5 17v3h14v-3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
        });

        Lampa.SettingsApi.addParam({
            component: 'ltc_diagnostic',

            param: {
                name: 'ltc_status',
                type: 'static',
                default: true
            },

            field: {
                name: 'Libre Torrent Connect',

                description:
                    'Версия ' + VERSION +
                    ' · Статус: активен.' +
                    '<br><br>' +
                    'Добавление и загрузка торрентов через LTConnect.' +
                    '<br><br>' +
                    '<b>Инструкция:</b><br>' +
                    '1. Установите LTConnect;<br>' +
                    '2. Откройте карточку → Смотреть → Торрент;<br>' +
                    '3. Выполните длительное нажатие на нужный торрент;<br>' +
                    '4. Выберите «Скачать в мою фильмотеку»;<br>' +
                    '5. Файл будет доступен в папке, выбранной в LTConnect.'
            }
        });

        log('Settings registered');
    }

    function start() {
        if (window[FLAG]) return;

        log('start() called');

        if (
            !window.Lampa ||
            !Lampa.Listener ||
            !Lampa.SettingsApi
        ) {
            log('Lampa API is not ready');
            return;
        }

        try {
            registerSettings();

            Lampa.Listener.follow('torrent', addMenuAction);
            log('Listener registered: torrent');

            Lampa.Listener.follow('torrent_file', addMenuAction);
            log('Listener registered: torrent_file');

            pollEvents();

            if (!pollTimer) {
                pollTimer = setInterval(pollEvents, 1200);
            }

            window[FLAG] = true;
            window.__LTC_VERSION__ = VERSION;

            log('Registration completed successfully');

            if (bootTimer) {
                clearInterval(bootTimer);
                bootTimer = null;
            }

        } catch (error) {
            console.error('[LTC-DIAG] Registration error:', error);
        }
    }

    function boot() {
        if (window[FLAG]) return;

        if (
            window.Lampa &&
            Lampa.Listener &&
            Lampa.SettingsApi &&
            window.appready
        ) {
            log('Lampa ready detected');
            start();
        }
    }

    if (window.appready) {
        log('Lampa already ready');
        start();
    } else if (window.Lampa && Lampa.Listener) {
        log('Waiting for Lampa ready event');

        Lampa.Listener.follow('app', function (event) {
            log('App event:', event);

            if (event.type === 'ready') {
                start();
            }
        });
    }

    if (!window[FLAG] && !bootTimer) {
        bootTimer = setInterval(boot, 500);
    }

    window.addEventListener('error', function (event) {
        console.error(
            '[LTC-DIAG] JavaScript error:',
            event.message,
            event.filename,
            event.lineno
        );
    });

    window.addEventListener('unhandledrejection', function (event) {
        console.error(
            '[LTC-DIAG] Unhandled promise rejection:',
            event.reason
        );
    });

})();
