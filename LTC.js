(function () {
    'use strict';

    const PLUGIN_NAME = 'LTC';
    const EVENT_URL = 'http://127.0.0.1:17865/events';
    const FLAG = '__LTC_REGISTERED__';

    if (window[FLAG]) {
        return;
    }

    window[FLAG] = true;

    const COMPONENT = 'ltc_diagnostic';
    const PARAM_NAME = 'ltc_status';

    let eventSource = null;
    let reconnectTimer = null;

    function notify(message, type) {
        if (typeof Lampa === 'undefined' ||
            !Lampa.Noty ||
            typeof Lampa.Noty.show !== 'function') {
            return;
        }

        Lampa.Noty.show(message, type || 'info');
    }

    function handleEvent(event) {
        if (!event || !event.type) {
            return;
        }

        const name = event.name || event.title || 'Торрент';

        switch (event.type) {
            case 'added':
                notify('Торрент добавлен в мою фильмотеку', 'success');
                break;

            case 'started':
                break;

            case 'finished':
                break;

            case 'error':
                notify(
                    'Ошибка LTConnect: ' +
                    (event.message || event.error || 'Неизвестная ошибка'),
                    'error'
                );
                break;

            case 'duplicate':
                notify('Торрент уже есть в моей фильмотеке', 'info');
                break;

            default:
                break;
        }
    }

    function connect() {
        if (!window.EventSource) {
            return;
        }

        if (eventSource) {
            eventSource.close();
            eventSource = null;
        }

        try {
            eventSource = new EventSource(EVENT_URL);

            eventSource.onmessage = function (message) {
                try {
                    handleEvent(JSON.parse(message.data));
                } catch (error) {
                    console.error('[LTC] Ошибка обработки события:', error);
                }
            };

            eventSource.onerror = function () {
                if (eventSource) {
                    eventSource.close();
                    eventSource = null;
                }

                if (reconnectTimer) {
                    clearTimeout(reconnectTimer);
                }

                reconnectTimer = setTimeout(connect, 5000);
            };
        } catch (error) {
            console.error('[LTC] Ошибка подключения:', error);

            reconnectTimer = setTimeout(connect, 5000);
        }
    }

    function openTorrent(magnet, title) {
        if (!magnet || typeof magnet !== 'string') {
            notify('Ошибка LTConnect: некорректная magnet-ссылка', 'error');
            return;
        }

        if (!window.AndroidJS ||
            typeof window.AndroidJS.openTorrentLink !== 'function') {
            notify('Ошибка LTConnect: приложение недоступно', 'error');
            return;
        }

        try {
            window.AndroidJS.openTorrentLink(
                magnet,
                JSON.stringify({
                    title: title || 'Торрент',
                    poster: 'LTC_AUTO_ADD'
                })
            );
        } catch (error) {
            console.error('[LTC] Ошибка передачи magnet:', error);
            notify('Ошибка LTConnect: ' + error.message, 'error');
        }
    }

    function registerPlugin() {
        if (typeof Lampa === 'undefined' || !Lampa.Listener) {
            return;
        }

        connect();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', registerPlugin);
    } else {
        registerPlugin();
    }

    window.LTC = {
        openTorrent: openTorrent,
        reconnect: connect
    };

})();
