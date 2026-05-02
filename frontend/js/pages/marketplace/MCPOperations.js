/**
 * MCP 服务 Tab - 操作函数
 * 包含连接测试、服务重启、扫描发现、服务器增删改等操作
 */

const MCPOperations = (() => {
    let _mcpServers = [];
    let _mcpTools = [];
    let _mcpTestResult = null;
    let _discoveredServers = [];
    let _isScanning = false;
    let _container = null;
    let _onReload = null;

    function init(container, mcpServers, mcpTools, onReload) {
        _container = container;
        _mcpServers = mcpServers;
        _mcpTools = mcpTools;
        _onReload = onReload;
    }

    function updateServers(servers) {
        _mcpServers = servers;
    }

    function getTestResult() {
        return _mcpTestResult;
    }

    function getDiscoveredServers() {
        return _discoveredServers;
    }

    function isScanning() {
        return _isScanning;
    }

    function copyText(text) {
        navigator.clipboard
            .writeText(text)
            .then(() => Components.Toast.success('已复制到剪贴板'))
            .catch(() => {
                const textarea = document.createElement('textarea');
                textarea.value = text;
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
                Components.Toast.success('已复制到剪贴板');
            });
    }

    function copyConfig() {
        const el = document.getElementById('configDisplay');
        if (!el) return;
        copyText(el.textContent);
    }

    function copyPrompt() {
        const el = document.getElementById('systemPromptDisplay');
        if (!el) return;
        copyText(el.textContent);
    }

    async function testConnection() {
        Components.Toast.info('正在测试 MCP 连接...');
        try {
            const baseUrl = window.location.origin;
            const resp = await fetch(`${baseUrl}/mcp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'initialize',
                    params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'test', version: '1.0' } },
                }),
            });
            if (resp.ok) {
                const data = await resp.json();
                const serverInfo = data.result?.serverInfo || {};
                _mcpTestResult = {
                    ok: true,
                    detail: `服务器: ${serverInfo.name || 'Hermes Agent'} v${serverInfo.version || '?'}，协议: ${data.result?.protocolVersion || '?'}，${_mcpTools.length} 个工具可用`,
                };
                Components.Toast.success('MCP 连接正常');
            } else {
                _mcpTestResult = { ok: false, detail: `HTTP ${resp.status}: ${resp.statusText}` };
                Components.Toast.error('MCP 连接失败');
            }
        } catch (err) {
            _mcpTestResult = { ok: false, detail: err.message };
            Components.Toast.error(`连接失败: ${err.message}`);
        }
        if (_onReload) _onReload();
    }

    async function restartService() {
        const ok = await Components.Modal.confirm({
            title: '重启 MCP 服务',
            message: '确定要重启 MCP 服务吗？重启期间服务将暂时不可用。',
            confirmText: '重启',
            type: 'warning',
        });
        if (!ok) return;
        try {
            Components.Toast.info('正在重启 MCP 服务...');
            await API.mcp.restart();
            Components.Toast.success('MCP 服务已重启');
            MarketplacePage.render('mcp');
        } catch (err) {
            Components.Toast.error(`重启失败: ${err.message}`);
        }
    }

    async function discoverMCPServers() {
        _isScanning = true;
        if (_onReload) _onReload();
        try {
            const ports = document.getElementById('mcpCustomPorts')?.value.trim() || '';
            const customUrl = document.getElementById('mcpCustomUrl')?.value.trim() || '';
            const hfUser = document.getElementById('mcpHFUser')?.value.trim() || '';
            const params = new URLSearchParams();
            if (ports) params.set('ports', ports);
            if (customUrl) params.set('custom_url', customUrl);
            if (hfUser) params.set('hf_user', hfUser);
            const query = params.toString() ? `?${params.toString()}` : '';
            const resp = await API.get(`/api/mcp/discover${query}`);
            _discoveredServers = resp.discovered || [];
            Components.Toast.success(`扫描完成，发现 ${_discoveredServers.length} 个 MCP 服务`);
        } catch (err) {
            Components.Toast.error(`扫描失败: ${err.message}`);
            _discoveredServers = [];
        }
        _isScanning = false;
        if (_onReload) _onReload();
    }

    async function addDiscoveredServer(name, url) {
        try {
            await API.request('/api/mcp/servers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, url, prefix: '' }),
            });
            Components.Toast.success(`已添加 ${name}`);
            await _reloadServers();
        } catch (err) {
            Components.Toast.error(`添加失败: ${err.message}`);
        }
    }

    async function addAllDiscovered() {
        const existingNames = new Set(_mcpServers.map((s) => s.name));
        const newServers = _discoveredServers.filter((s) => !existingNames.has(s.name));
        if (newServers.length === 0) {
            Components.Toast.info('没有新的服务需要添加');
            return;
        }
        try {
            const resp = await API.post('/api/mcp/discover/add', { servers: newServers });
            Components.Toast.success(`已添加 ${resp.added}/${resp.total} 个服务`);
            await _reloadServers();
        } catch (err) {
            Components.Toast.error(`批量添加失败: ${err.message}`);
        }
    }

    async function addMCPServer() {
        const name = document.getElementById('mcpServerName')?.value.trim();
        const url = document.getElementById('mcpServerUrl')?.value.trim();
        const prefix = document.getElementById('mcpServerPrefix')?.value.trim();
        if (!name || !url) {
            Components.Toast.error('名称和 URL 不能为空');
            return;
        }
        Components.Toast.info('正在连接...');
        try {
            const resp = await API.request('/api/mcp/servers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, url, prefix }),
            });
            Components.Toast.success(resp.message || '添加成功');
            await _reloadServers();
        } catch (err) {
            Components.Toast.error(`添加失败: ${err.message}`);
        }
    }

    async function removeMCPServer(name) {
        const ok = await Components.Modal.confirm({
            title: '删除 MCP 服务器',
            message: `确定要删除 MCP 服务器「${name}」吗？该服务器提供的所有工具将被移除。`,
            confirmText: '删除',
            type: 'danger',
        });
        if (!ok) return;
        try {
            await API.request(`/api/mcp/servers/${encodeURIComponent(name)}`, { method: 'DELETE' });
            Components.Toast.success(`已移除 ${name}`);
            await _reloadServers();
        } catch (err) {
            Components.Toast.error(`移除失败: ${err.message}`);
        }
    }

    async function refreshMCPServer(name) {
        Components.Toast.info('正在刷新...');
        try {
            await API.request(`/api/mcp/servers/${encodeURIComponent(name)}/refresh`, { method: 'POST' });
            Components.Toast.success(`${name} 已刷新`);
            await _reloadServers();
        } catch (err) {
            Components.Toast.error(`刷新失败: ${err.message}`);
        }
    }

    async function _reloadServers() {
        _mcpServers = await API.request('/api/mcp/servers').catch(() => []);
        if (_onReload) _onReload();
    }

    return {
        init, updateServers, getTestResult, getDiscoveredServers, isScanning,
        copyConfig, copyPrompt,
        testConnection, restartService, discoverMCPServers,
        addDiscoveredServer, addAllDiscovered, addMCPServer,
        removeMCPServer, refreshMCPServer,
    };
})();

export default MCPOperations;
