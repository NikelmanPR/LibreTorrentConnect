(function () {
    'use strict';

    var VERSION = '1.2.3';
    var FLAG = '__LTC_REGISTERED__';
    var EVENT_URL = 'http://127.0.0.1:17865/events';

    if (window[FLAG]) return;

    var eventCursor = 0;
    var firstPoll = true;
    var pollTimer = null;
    var bootTimer = null;

    function log(message, error) {
        if (error) {
            console.error('[LTC]', message, error);
        } else {
            console.log('[LTC]', message);
        }
    }

    function notify(message) {
        if (window.Lampa && Lampa.Noty) {
            Lampa.Noty.show(message);
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
            return 'magnet:?xt=urn:btih:' + String(element.torrent_hash);
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

    function getEventName(item) {
        return item && item.name != null
            ? String(item.name).trim()
            : '';
    }

    function handleEvent(item) {
        if (!item || !item.type) return;

        var name = getEventName(item);

        switch (item.type) {
            case 'added':
                notify('Торрент добавлен в мою фильмотеку');
                break;

            case 'duplicate':
                notify(name
                    ? 'LTC: «' + name + '» уже есть в фильмотеке'
                    : 'LTC: торрент уже есть в фильмотеке');
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
                log('Event polling error', error);
            });
    }

    function addMenuAction(event) {
        if (
            !event ||
            event.type !== 'onlong' ||
            !event.menu ||
            !event.element
        ) return;

        if (
            typeof event.menu.push !== 'function' ||
            event.__ltcAdded
        ) return;

        var magnet = getMagnet(event.element);

        if (!magnet) return;

        event.__ltcAdded = true;

        var title = getTitle(event.element);

        event.menu.push({
            title: 'Скачать в мою фильмотеку',

            onSelect: function () {
                try {
                    if (
                        !window.AndroidJS ||
                        typeof window.AndroidJS.openTorrentLink !== 'function'
                    ) {
                        notify('LTC: AndroidJS недоступен');
                        log('AndroidJS.openTorrentLink is unavailable');
                        return;
                    }

                    var result = window.AndroidJS.openTorrentLink(
                        magnet,
                        JSON.stringify({
                            title: title,
                            poster: 'LTC_AUTO_ADD'
                        })
                    );

                    if (result === false) {
                        notify('LTC: не удалось передать magnet');
                    }
                } catch (error) {
                    log('Magnet transfer error', error);
                    notify('LTC: не удалось передать magnet');
                }
            }
        });
    }

    function registerSettings() {
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
                    '<br><br><b>Инструкция:</b><br>' +
                    '1. Установите LTConnect;<br>' +
                    '2. Откройте карточку → Смотреть → Торрент;<br>' +
                    '3. Выполните длительное нажатие на нужный торрент;<br>' +
                    '4. Выберите «Скачать в мою фильмотеку»;<br>' +
                    '5. Файл будет доступен в папке, выбранной в LTConnect.'
            }
        });
    }

    function start() {
        if (window[FLAG]) return;

        if (
            !window.Lampa ||
            !Lampa.Listener ||
            !Lampa.SettingsApi ||
            !window.appready
        ) {
            return;
        }

        try {
            registerSettings();

            Lampa.Listener.follow('torrent', addMenuAction);
            Lampa.Listener.follow('torrent_file', addMenuAction);

            pollEvents();

            if (!pollTimer) {
                pollTimer = setInterval(pollEvents, 1200);
            }

            window[FLAG] = true;
            window.__LTC_VERSION__ = VERSION;

            if (bootTimer) {
                clearInterval(bootTimer);
                bootTimer = null;
            }

            log('Libre Torrent Connect ' + VERSION + ' registered');
        } catch (error) {
            log('Registration error', error);
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
            start();
        }
    }

    if (window.appready) {
        start();
    } else if (window.Lampa && Lampa.Listener) {
        Lampa.Listener.follow('app', function (event) {
            if (event.type === 'ready') {
                start();
            }
        });
    }

    if (!window[FLAG] && !bootTimer) {
        bootTimer = setInterval(boot, 500);
    }

})();
