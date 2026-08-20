/**
 * API 模块 - 封装所有后端通信
 * 统一错误处理、请求拦截、响应处理
 */
const API = {
    baseUrl: '',
    
    /**
     * 发送请求
     * @param {string} endpoint - API 端点
     * @param {object} options - 请求选项
     * @returns {Promise<any>}
     */
    async request(endpoint, options = {}) {
        const url = this.baseUrl + endpoint;
        const defaultOptions = {
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin'
        };
        
        try {
            const response = await fetch(url, { ...defaultOptions, ...options });
            
            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: '请求失败' }));
                throw new Error(error.error || `HTTP ${response.status}`);
            }
            
            return await response.json();
        } catch (err) {
            if (err.name === 'TypeError') {
                throw new Error('网络连接失败，请检查网络');
            }
            throw err;
        }
    },
    
    // ─── 内容管理 ───
    async getContent() {
        return this.request('api.php?action=get');
    },
    
    async saveContent(data) {
        return this.request('api.php?action=save', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },
    
    // ─── 系统设置 ───
    async getSystem() {
        return this.request('system.php?action=get');
    },
    
    async saveSystem(data) {
        return this.request('system.php?action=save', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },
    
    async verifyPassword(password) {
        return this.request('login.php?action=verify', {
            method: 'POST',
            body: JSON.stringify({ password })
        });
    },
    
    async logout() {
        return this.request('logout.php');
    },

    // ─── 图片上传 ───
    async uploadImage(file) {
        const formData = new FormData();
        formData.append('image', file);
        
        const response = await fetch(this.baseUrl + 'upload.php', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: '上传失败' }));
            throw new Error(error.error || '上传失败');
        }
        
        return await response.json();
    },
    
    // ─── 数据导出/导入 ───
    async exportData() {
        const response = await fetch(this.baseUrl + 'export.php', {
            method: 'GET'
        });
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: '导出失败' }));
            throw new Error(error.error || '导出失败');
        }
        
        return await response.blob();
    },
    
    async importData(file) {
        const formData = new FormData();
        formData.append('backup', file);
        
        const response = await fetch(this.baseUrl + 'import.php', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: '导入失败' }));
            throw new Error(error.error || '导入失败');
        }
        
        return await response.json();
    },
    
    // ─── 操作日志 ───
    async addLog(action, module, detail = '') {
        return this.request('operation_log.php', {
            method: 'POST',
            body: JSON.stringify({ action, module, detail })
        });
    },
    
    async getLogs(page = 1, limit = 20) {
        return this.request(`operation_log.php?page=${page}&limit=${limit}`);
    },
    
    async clearLogs() {
        return this.request('operation_log.php', { method: 'DELETE' });
    }
};