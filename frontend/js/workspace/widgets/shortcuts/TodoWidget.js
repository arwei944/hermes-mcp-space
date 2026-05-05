/**
 * TodoWidget — 待办事项
 *
 * 功能: 简单的待办事项列表，支持添加/删除/勾选，数据保存到 localStorage
 * 类型: shortcut, category: shortcuts, defaultSize: {w:1, h:1}
 *
 * 依赖: WidgetRegistry (全局)
 */
const TodoWidget = (() => {
    'use strict';

    const MAX_VISIBLE = 10;

    function mount(container, props) {
        const cardId = props?.cardId || 'default';
        const storageKey = `hermes_workspace_todo_${cardId}`;

        // 读取已保存数据
        const _loadTodos = () => {
            try {
                const raw = localStorage.getItem(storageKey);
                return raw ? JSON.parse(raw) : [];
            } catch (e) {
                return [];
            }
        };

        // 保存数据
        const _saveTodos = (todos) => {
            try {
                localStorage.setItem(storageKey, JSON.stringify(todos));
            } catch (e) {
                // localStorage 不可用时静默失败
            }
        };

        let todos = _loadTodos();

        container.innerHTML = `
            <div class="ws-widget" style="display:flex; flex-direction:column; height:100%;">
                <div class="ws-widget__content" style="flex:1; display:flex; flex-direction:column; padding:12px; gap:8px; overflow:hidden;">
                    <div style="display:flex; gap:6px;">
                        <input type="text" class="ws-widget__todo-input"
                               placeholder="添加待办事项..."
                               style="flex:1; padding:6px 10px; border:1px solid var(--border); border-radius:var(--radius-sm); background:var(--surface); color:var(--text-primary); font-size:var(--text-sm); outline:none; transition:border-color 0.15s;"
                        />
                        <button class="ws-widget__todo-add-btn"
                                style="padding:6px 12px; border:none; border-radius:var(--radius-sm); background:var(--primary, #4f46e5); color:#fff; cursor:pointer; font-size:var(--text-xs); white-space:nowrap; transition:opacity 0.15s;">
                            添加
                        </button>
                    </div>
                    <div class="ws-widget__todo-list" style="flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:4px;"></div>
                </div>
            </div>`;

        const input = container.querySelector('.ws-widget__todo-input');
        const addBtn = container.querySelector('.ws-widget__todo-add-btn');
        const listEl = container.querySelector('.ws-widget__todo-list');

        // 输入框聚焦样式
        input.addEventListener('focus', () => {
            input.style.borderColor = 'var(--primary, #4f46e5)';
        });
        input.addEventListener('blur', () => {
            input.style.borderColor = 'var(--border)';
        });

        // 渲染待办列表
        function _renderList() {
            if (todos.length === 0) {
                listEl.innerHTML = `
                    <div style="text-align:center; padding:16px; color:var(--text-tertiary); font-size:var(--text-xs);">
                        暂无待办事项
                    </div>`;
                return;
            }

            const visible = todos.slice(0, MAX_VISIBLE);
            listEl.innerHTML = visible.map((todo, idx) => `
                <div class="ws-widget__todo-item" data-index="${idx}"
                     style="display:flex; align-items:center; gap:8px; padding:6px 8px; border-radius:var(--radius-sm); transition:background 0.15s;">
                    <input type="checkbox" class="ws-widget__todo-checkbox" data-index="${idx}"
                           ${todo.done ? 'checked' : ''}
                           style="flex-shrink:0; width:14px; height:14px; cursor:pointer; accent-color:var(--primary, #4f46e5);" />
                    <span class="ws-widget__todo-text" data-index="${idx}"
                          style="flex:1; font-size:var(--text-sm); color:var(--text-primary); ${todo.done ? 'text-decoration:line-through; color:var(--text-tertiary);' : ''}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                        ${_escapeHtml(todo.text)}
                    </span>
                    <button class="ws-widget__todo-delete" data-index="${idx}"
                            style="flex-shrink:0; border:none; background:none; color:var(--text-tertiary); cursor:pointer; font-size:14px; padding:0 2px; opacity:0; transition:opacity 0.15s; line-height:1;">
                        ×
                    </button>
                </div>
            `).join('');

            if (todos.length > MAX_VISIBLE) {
                listEl.innerHTML += `
                    <div style="text-align:center; padding:4px; color:var(--text-tertiary); font-size:var(--text-xs);">
                        还有 ${todos.length - MAX_VISIBLE} 项...
                    </div>`;
            }

            // 删除按钮悬停显示
            listEl.querySelectorAll('.ws-widget__todo-item').forEach(item => {
                const deleteBtn = item.querySelector('.ws-widget__todo-delete');
                item.addEventListener('mouseenter', () => {
                    item.style.background = 'var(--surface-hover, var(--surface))';
                    deleteBtn.style.opacity = '1';
                });
                item.addEventListener('mouseleave', () => {
                    item.style.background = '';
                    deleteBtn.style.opacity = '0';
                });
            });
        }

        // HTML 转义
        function _escapeHtml(str) {
            const div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
        }

        // 添加待办
        function _addTodo() {
            const text = input.value.trim();
            if (!text) return;

            todos.unshift({ text, done: false, id: Date.now() });
            _saveTodos(todos);
            input.value = '';
            _renderList();
        }

        // 切换完成状态
        function _toggleTodo(index) {
            if (index >= 0 && index < todos.length) {
                todos[index].done = !todos[index].done;
                _saveTodos(todos);
                _renderList();
            }
        }

        // 删除待办
        function _deleteTodo(index) {
            if (index >= 0 && index < todos.length) {
                todos.splice(index, 1);
                _saveTodos(todos);
                _renderList();
            }
        }

        // 事件绑定
        const _handleKeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                _addTodo();
            }
        };
        input.addEventListener('keydown', _handleKeydown);
        addBtn.addEventListener('click', _addTodo);

        const _handleListClick = (e) => {
            const checkbox = e.target.closest('.ws-widget__todo-checkbox');
            if (checkbox) {
                _toggleTodo(parseInt(checkbox.dataset.index, 10));
                return;
            }
            const deleteBtn = e.target.closest('.ws-widget__todo-delete');
            if (deleteBtn) {
                _deleteTodo(parseInt(deleteBtn.dataset.index, 10));
                return;
            }
        };
        listEl.addEventListener('click', _handleListClick);

        // 初始渲染
        _renderList();

        return {
            destroy() {
                input.removeEventListener('keydown', _handleKeydown);
                listEl.removeEventListener('click', _handleListClick);
                container.innerHTML = '';
            },
            refresh() {
                todos = _loadTodos();
                _renderList();
            }
        };
    }

    WidgetRegistry.register('todo', {
        type: 'shortcut',
        label: '待办事项',
        icon: '✅',
        description: '简单的待办事项列表，支持添加/删除/勾选',
        defaultSize: { w: 1, h: 1 },
        category: 'shortcuts',
        mount
    });
})();
