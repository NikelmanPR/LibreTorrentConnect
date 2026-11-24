(function () {
    'use strict';

    var FLAG = '__LTS_LTC_V1_1_REGISTERED__';
    if (window[FLAG]) return;

    function getMagnet(element) {
        if (!element) return '';
        if (element.MagnetUri) return String(element.MagnetUri);
        if (/^magnet:/i.test(element.Link || '')) return String(element.Link);
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

    function addMenuAction(event) {
        if (!event || event.type !== 'onlong' || !event.menu || !event.element) return;
        if (typeof event.menu.push !== 'function' || event.__ltsLtcAdded) return;

        var magnet = getMagnet(event.element);
        if (!magnet) return;

        event.__ltsLtcAdded = true;
        var title = getTitle(event.element);

        event.menu.push({
            title: 'Добавить в фильмотеку',
            onSelect: function () {
                try {
                    if (
                        !window.AndroidJS ||
                        typeof window.AndroidJS.openTorrentLink !== 'function'
                    ) {
                        notify('LTC: AndroidJS недоступен');
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
                        return;
                    }

                    notify('LTC: запрос на добавление отправлен');
                } catch (error) {
                    console.error('[LTS][LTC]', error);
                    notify('LTC: ошибка передачи magnet');
                }
            }
        });
    }

    function start() {
        if (window[FLAG]) return;
        if (!window.Lampa || !Lampa.Listener || !Lampa.SettingsApi) return;

        try {
            Lampa.SettingsApi.addComponent({
                component: 'lts_diagnostic',
                name: 'LTS',
                icon: '<svg viewBox="0 0 24 24"></svg>'
            });

            Lampa.SettingsApi.addParam({
                component: 'lts_diagnostic',
                param: {
                    name: 'lts_ltc_status',
                    type: 'static',
                    default: true
                },
                field: {
                    name: 'LibreTorrent Connect',
                    description: 'LTC 1.1 активен. Передача magnet в LibreTorrent с автоматическим добавлением.'
                }
            });

            Lampa.Listener.follow('torrent', addMenuAction);
            Lampa.Listener.follow('torrent_file', addMenuAction);

            window[FLAG] = true;
            console.log('[LTS][LTC] Version 1.1 registered');
        } catch (error) {
            console.error('[LTS][LTC] Registration error:', error);
        }
    }

    if (window.appready) {
        start();
    } else if (window.Lampa && Lampa.Listener) {
        Lampa.Listener.follow('app', function (event) {
            if (event.type === 'ready') start();
        });
    }
})();