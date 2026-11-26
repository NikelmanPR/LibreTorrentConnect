(function () {
    'use strict';

    var VERSION = '1.2.1';
    var FLAG = '__LTC_REGISTERED__';

    if (window[FLAG]) return;

    var EVENT_URL = 'http://127.0.0.1:17865/events';
    var eventCursor = 0;
    var firstPoll = true;
    var pollTimer = null;

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

    function notify(message) {
        if (window.Lampa && Lampa.Noty) {
            Lampa.Noty.show(message);
        }
    }

    function getEventName(item) {
        return item && item.name != null
            ? String(item.name).trim()
            : '';
    }

    function handleEvent(item) {
        var name = getEventName(item);

        switch (item.type) {
            case 'added':
                notify(name
                    ? 'LTC: торрент «' + name + '» добавлен'
                    : 'LTC: торрент добавлен');
                break;

            case 'duplicate':
                notify(name
                    ? 'LTC: «' + name + '» уже есть в библиотеке'
                    : 'LTC: торрент уже есть в библиотеке');
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
                notify(name
                    ? 'LTC: загрузка ' + name + ' началась!'
                    : 'LTC: загрузка началась!');
                break;

            case 'finished':
                notify(name
                    ? 'LTC: загрузка ' + name + ' завершена!'
                    : 'LTC: загрузка завершена!');
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
            .catch(function () {});
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
            title: 'Скачать в мою библиотеку',

            onSelect: function () {
                try {
                    if (
                        !window.AndroidJS ||
                        typeof window.AndroidJS.openTorrentLink !== 'function'
                    ) {
                        notify('LTC: AndroidJS недоступен');
                        return;
                    }

                    notify('LTC: отправка magnet…');

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
                    console.error('[LTC]', error);
                    notify('LTC: не удалось передать magnet');
                }
            }
        });
    }

    function start() {
        if (window[FLAG]) return;

        if (!window.Lampa || !Lampa.Listener || !Lampa.SettingsApi) {
            return;
        }

        try {
            Lampa.SettingsApi.addComponent({
                component: 'ltc_diagnostic',
                name: 'Libre Torrent Connect',
                icon: '<svg viewBox="0 0 24 24"></svg>'
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
                        ' · Статус: активен. ' +
                        'Добавление торрентов и получение статусов из LTConnect.'
                }
            });

            Lampa.Listener.follow('torrent', addMenuAction);
            Lampa.Listener.follow('torrent_file', addMenuAction);

            pollEvents();

            if (!pollTimer) {
                pollTimer = setInterval(pollEvents, 1200);
            }

            window[FLAG] = true;

            console.log(
                '[LTC] Libre Torrent Connect ' + VERSION + ' registered'
            );

        } catch (error) {
            console.error('[LTC] Registration error:', error);
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
})();
