/**
 * Hermes Agent - SSE 连接管理器（带轮询降级）
 * V7-19: SSE 断连时自动降级为轮询机制
 */

const SSEManager = {
    eventSource: null,
    pollingInterval: null,
    pollingUrl: '/api/events/history',
    reconnectAttempts: 0,
    maxReconnectAttempts: 5,
    pollInterval: 3000,
    _lastEventId: null,
    _isPolling: false,

    connect(url) {
        this.disconnect();

        try {
            this.eventSource = new EventSource(url);

            this.eventSource.onopen = () => {
                this.reconnectAttempts = 0;
                this._isPolling = false;
                console.log('[SSE] Connected');
            };

            this.eventSource.onerror = () => {
                console.warn('[SSE] Connection error, attempting reconnect...');
                this.reconnectAttempts++;

                if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                    console.warn('[SSE] Max reconnect attempts reached, falling back to polling');
                    this.fallbackToPolling();
                }
            };

            // 代理标准事件
            this._proxyEvents();

        } catch (e) {
            console.error('[SSE] Failed to connect, falling back to polling:', e);
            this.fallbackToPolling();
        }
    },

    fallbackToPolling() {
        this.disconnect();
        this._isPolling = true;
        console.log('[SSE] Using polling fallback');

        this.pollingInterval = setInterval(async () => {
            try {
                var url = this.pollingUrl + '?limit=10';
                if (this._lastEventId) {
                    url += '&after_id=' + encodeURIComponent(this._lastEventId);
                }
                var resp = await fetch(url);
                var events = await resp.json();
                if (Array.isArray(events)) {
                    events.forEach(event => {
                        this._dispatchEvent(event);
                        if (event.id) this._lastEventId = event.id;
                    });
                }
            } catch (e) {
                console.error('[Polling] Error:', e);
            }
        }, this.pollInterval);
    },

    _proxyEvents() {
        if (!this.eventSource) return;
        var self = this;
        ['message', 'session_created', 'session_updated', 'session_deleted'].forEach(type => {
            this.eventSource.addEventListener(type, (e) => {
                try {
                    var data = JSON.parse(e.data);
                    self._dispatchEvent({ type: type, data: data });
                } catch (err) {
                    // ignore parse errors
                }
            });
        });
    },

    _dispatchEvent(event) {
        window.dispatchEvent(new CustomEvent('hermes:event', { detail: event }));
    },

    disconnect() {
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
        }
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
        this._isPolling = false;
    },

    isPolling() {
        return this._isPolling;
    }
};
