/**
 * 操作日志页面模块
 */
const LogsPage = {
    currentPage: 1,
    totalPages: 1,
    logs: [],
    
    /**
     * 渲染页面内容
     */
    render() {
        return `
        <div class="card">
            <div class="card-header">
                <div class="card-title">
                    <i data-lucide="history"></i>
                    <span>操作日志</span>
                </div>
                <div class="btn-group">
                    <button class="btn btn-secondary" onclick="LogsPage.exportLogs()">
                        <i data-lucide="download"></i>
                        导出日志
                    </button>
                    <button class="btn btn-secondary" onclick="LogsPage.clearLogs()" style="color:#ef4444;">
                        <i data-lucide="trash-2"></i>
                        清除日志
                    </button>
                </div>
            </div>
            <div id="logs-stats" class="logs-stats">
                <span>共 <strong id="logs-count">0</strong> 条记录</span>
            </div>
            <div id="logs-list" class="logs-list">
                <div class="logs-loading">
                    <span>加载中...</span>
                </div>
            </div>
            <div id="logs-pagination" class="pagination"></div>
        </div>`;
    },
    
    /**
     * 初始化页面
     */
    async init() {
        await this.loadLogs(1);
    },
    
    /**
     * 加载日志列表
     */
    async loadLogs(page = 1) {
        this.currentPage = page;
        
        try {
            const response = await fetch(`operation_log.php?page=${page}&limit=20`);
            const result = await response.json();
            
            if (result.success) {
                this.logs = result.data;
                this.totalPages = result.pages;
                
                this.renderLogsList();
                this.renderPagination();
                
                document.getElementById('logs-count').textContent = result.total;
            } else {
                this.renderEmpty('加载失败');
            }
        } catch (error) {
            this.renderEmpty('网络错误');
        }
    },
    
    /**
     * 渲染日志列表
     */
    renderLogsList() {
        const container = document.getElementById('logs-list');
        
        if (this.logs.length === 0) {
            this.renderEmpty('暂无日志记录');
            return;
        }
        
        container.innerHTML = this.logs.map(log => this.renderLogItem(log)).join('');
        lucide.createIcons();
    },
    
    /**
     * 渲染单条日志
     */
    renderLogItem(log) {
        const time = this.formatTime(log.timestamp);
        const actionClass = this.getActionClass(log.action);
        const actionIcon = this.getActionIcon(log.action);
        
        return `
        <div class="log-item">
            <div class="log-icon ${actionClass}">
                <i data-lucide="${actionIcon}"></i>
            </div>
            <div class="log-content">
                <div class="log-header">
                    <span class="log-action">${this.escapeHtml(log.action)}</span>
                    <span class="log-module">${this.escapeHtml(log.module)}</span>
                </div>
                <div class="log-detail">${this.escapeHtml(log.detail || '无详细说明')}</div>
                <div class="log-meta">
                    <span class="log-user">
                        <i data-lucide="user"></i>
                        ${this.escapeHtml(log.user)}
                    </span>
                    <span class="log-ip">
                        <i data-lucide="globe"></i>
                        ${this.escapeHtml(log.ip)}
                    </span>
                    <span class="log-time">
                        <i data-lucide="clock"></i>
                        ${time}
                    </span>
                </div>
            </div>
        </div>`;
    },
    
    /**
     * 渲染空状态
     */
    renderEmpty(message) {
        const container = document.getElementById('logs-list');
        container.innerHTML = `
            <div class="logs-empty">
                <i data-lucide="inbox"></i>
                <span>${message}</span>
            </div>`;
        lucide.createIcons();
    },
    
    /**
     * 渲染分页
     */
    renderPagination() {
        const container = document.getElementById('logs-pagination');
        
        if (this.totalPages <= 1) {
            container.innerHTML = '';
            return;
        }
        
        let pages = [];
        
        // 上一页
        if (this.currentPage > 1) {
            pages.push(`<button class="page-btn" onclick="LogsPage.loadLogs(${this.currentPage - 1})">
                <i data-lucide="chevron-left"></i>
            </button>`);
        }
        
        // 页码
        for (let i = 1; i <= this.totalPages; i++) {
            if (i === 1 || i === this.totalPages || (i >= this.currentPage - 2 && i <= this.currentPage + 2)) {
                pages.push(`<button class="page-btn ${i === this.currentPage ? 'active' : ''}" onclick="LogsPage.loadLogs(${i})">${i}</button>`);
            } else if (i === this.currentPage - 3 || i === this.currentPage + 3) {
                pages.push('<span class="page-ellipsis">...</span>');
            }
        }
        
        // 下一页
        if (this.currentPage < this.totalPages) {
            pages.push(`<button class="page-btn" onclick="LogsPage.loadLogs(${this.currentPage + 1})">
                <i data-lucide="chevron-right"></i>
            </button>`);
        }
        
        container.innerHTML = `<div class="pagination-inner">${pages.join('')}</div>`;
        lucide.createIcons();
    },
    
    /**
     * 导出日志
     */
    exportLogs() {
        const data = JSON.stringify(this.logs, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `operation_logs_${new Date().toISOString().slice(0,10)}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
        Components.toast('日志已导出', 'success');
    },
    
    /**
     * 清除日志
     */
    async clearLogs() {
        if (!confirm('确定要清除所有操作日志吗？此操作不可恢复！')) return;
        
        try {
            const response = await fetch('operation_log.php', {
                method: 'DELETE'
            });
            const result = await response.json();
            
            if (result.success) {
                Components.toast('日志已清除', 'success');
                this.loadLogs(1);
            } else {
                Components.toast('清除失败', 'error');
            }
        } catch (error) {
            Components.toast('网络错误', 'error');
        }
    },
    
    /**
     * 格式化时间
     */
    formatTime(timestamp) {
        const date = new Date(timestamp * 1000);
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) return '刚刚';
        if (diff < 3600000) return Math.floor(diff / 60000) + ' 分钟前';
        if (diff < 86400000) return Math.floor(diff / 3600000) + ' 小时前';
        if (diff < 604800000) return Math.floor(diff / 86400000) + ' 天前';
        
        return date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    },
    
    /**
     * 获取操作类型样式
     */
    getActionClass(action) {
        const map = {
            'save': 'log-save',
            'create': 'log-create',
            'delete': 'log-delete',
            'update': 'log-update',
            'upload': 'log-upload',
            'export': 'log-export',
            'import': 'log-import',
            'login': 'log-login',
            'logout': 'log-logout'
        };
        return map[action.toLowerCase()] || 'log-default';
    },
    
    /**
     * 获取操作图标
     */
    getActionIcon(action) {
        const map = {
            'save': 'save',
            'create': 'plus',
            'delete': 'trash-2',
            'update': 'edit',
            'upload': 'upload',
            'export': 'download',
            'import': 'upload-cloud',
            'login': 'log-in',
            'logout': 'log-out'
        };
        return map[action.toLowerCase()] || 'activity';
    },
    
    /**
     * HTML转义
     */
    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
};