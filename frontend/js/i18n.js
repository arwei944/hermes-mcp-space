/**
 * Hermes Agent - 国际化 (i18n) 基础框架
 * V7-23: 多语言支持基础架构
 */

const I18n = {
    locale: 'zh-CN',
    messages: {
        'zh-CN': {
            // 通用
            'common.save': '保存',
            'common.cancel': '取消',
            'common.delete': '删除',
            'common.edit': '编辑',
            'common.search': '搜索',
            'common.export': '导出',
            'common.import': '导入',
            'common.confirm': '确认',
            'common.loading': '加载中...',
            'common.error': '操作出错',
            'common.success': '操作成功',
            'common.noData': '暂无数据',
            'common.refresh': '刷新',
            'common.close': '关闭',
            'common.retry': '重试',
            'common.submit': '提交',
            'common.copy': '复制',
            // 会话
            'session.title': '会话',
            'session.new': '新建会话',
            'session.delete': '删除会话',
            'session.archive': '归档会话',
            'session.export': '导出会话',
            'session.search': '搜索会话',
            'session.messages': '消息',
            'session.tags': '标签',
            'session.rename': '重命名',
            // 标签
            'tag.manage': '标签管理',
            'tag.add': '添加标签',
            'tag.rename': '重命名标签',
            'tag.delete': '删除标签',
            // 分析
            'analytics.title': '数据分析',
            'analytics.overview': '概览',
            'analytics.trend': '趋势',
            // 系统
            'system.config': '系统配置',
            'system.logs': '操作日志',
            'system.about': '关于',
            // 状态
            'status.connected': '已连接',
            'status.degraded': '降级模式',
            'status.connecting': '连接中...',
            // 导出
            'export.inProgress': '正在导出...',
            'export.success': '导出成功',
            'export.failed': '导出失败',
            // 确认
            'confirm.batchDelete': '确定要删除选中的 {count} 个会话吗？此操作不可撤销。',
            'confirm.batchArchive': '确定要归档选中的 {count} 个会话吗？',
            'confirm.title': '操作确认',
            'confirm.cancel': '取消',
            'confirm.ok': '确认',
        },
        'en': {
            // 通用
            'common.save': 'Save',
            'common.cancel': 'Cancel',
            'common.delete': 'Delete',
            'common.edit': 'Edit',
            'common.search': 'Search',
            'common.export': 'Export',
            'common.import': 'Import',
            'common.confirm': 'Confirm',
            'common.loading': 'Loading...',
            'common.error': 'Error',
            'common.success': 'Success',
            'common.noData': 'No data',
            'common.refresh': 'Refresh',
            'common.close': 'Close',
            'common.retry': 'Retry',
            'common.submit': 'Submit',
            'common.copy': 'Copy',
            // 会话
            'session.title': 'Sessions',
            'session.new': 'New Session',
            'session.delete': 'Delete Session',
            'session.archive': 'Archive Session',
            'session.export': 'Export Session',
            'session.search': 'Search Sessions',
            'session.messages': 'Messages',
            'session.tags': 'Tags',
            'session.rename': 'Rename',
            // 标签
            'tag.manage': 'Tag Management',
            'tag.add': 'Add Tag',
            'tag.rename': 'Rename Tag',
            'tag.delete': 'Delete Tag',
            // 分析
            'analytics.title': 'Analytics',
            'analytics.overview': 'Overview',
            'analytics.trend': 'Trend',
            // 系统
            'system.config': 'Configuration',
            'system.logs': 'Logs',
            'system.about': 'About',
            // 状态
            'status.connected': 'Connected',
            'status.degraded': 'Degraded',
            'status.connecting': 'Connecting...',
            // 导出
            'export.inProgress': 'Exporting...',
            'export.success': 'Export successful',
            'export.failed': 'Export failed',
            // 确认
            'confirm.batchDelete': 'Are you sure you want to delete {count} selected sessions? This action cannot be undone.',
            'confirm.batchArchive': 'Are you sure you want to archive {count} selected sessions?',
            'confirm.title': 'Confirm Action',
            'confirm.cancel': 'Cancel',
            'confirm.ok': 'Confirm',
        }
    },

    /**
     * 翻译指定 key
     * @param {string} key - 翻译键，如 'common.save'
     * @param {Object} params - 可选的模板参数，如 { count: 5 }
     * @returns {string} 翻译后的文本
     */
    t: function (key, params) {
        var text = (this.messages[this.locale] && this.messages[this.locale][key]) || key;
        if (params) {
            Object.keys(params).forEach(function (k) {
                text = text.replace('{' + k + '}', params[k]);
            });
        }
        return text;
    },

    /**
     * 设置语言
     * @param {string} locale - 语言代码，如 'zh-CN', 'en'
     */
    setLocale: function (locale) {
        if (!this.messages[locale]) {
            console.warn('[I18n] Unsupported locale:', locale);
            return;
        }
        this.locale = locale;
        localStorage.setItem('hermes-locale', locale);
        document.documentElement.setAttribute('lang', locale);
    },

    /**
     * 获取当前语言
     * @returns {string} 当前语言代码
     */
    getLocale: function () {
        return this.locale;
    },

    /**
     * 初始化国际化
     */
    init: function () {
        var saved = localStorage.getItem('hermes-locale');
        if (saved && this.messages[saved]) {
            this.locale = saved;
        }
        document.documentElement.setAttribute('lang', this.locale);
        console.log('[I18n] Initialized with locale:', this.locale);
    }
};

I18n.init();
