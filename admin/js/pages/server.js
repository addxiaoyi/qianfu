/**
 * 服务器管理页面模块
 */
const ServerPage = {
    /**
     * 渲染页面内容
     * @param {object} data - 服务器数据
     * @param {function} onSave - 保存回调
     */
    render(data, onSave) {
        return `
        <div class="card">
            <div class="card-header">
                <div class="card-title">
                    <i data-lucide="gamepad-2"></i>
                    <span>服务器信息</span>
                </div>
            </div>
            <div class="form-grid">
                <div class="form-group">
                    <label class="form-label">服务器名称</label>
                    <input type="text" class="form-input" id="server-name" value="${Components.escapeHtml(data.name || '')}" placeholder="我的世界服务器">
                </div>
                <div class="form-group">
                    <label class="form-label">游戏版本</label>
                    <input type="text" class="form-input" id="server-version" value="${Components.escapeHtml(data.version || '')}" placeholder="1.20.4">
                </div>
                <div class="form-group">
                    <label class="form-label">服务器地址</label>
                    <input type="text" class="form-input" id="server-ip" value="${Components.escapeHtml(data.ip || '')}" placeholder="play.example.com">
                </div>
                <div class="form-group">
                    <label class="form-label">服务器端口</label>
                    <input type="number" class="form-input" id="server-port" value="${Components.escapeHtml(data.port || '25565')}" placeholder="25565">
                </div>
                <div class="form-group" style="grid-column: 1/-1;">
                    <label class="form-label">服务器介绍</label>
                    <textarea class="form-input" id="server-desc" placeholder="介绍您的服务器特色玩法">${Components.escapeHtml(data.description || '')}</textarea>
                </div>
            </div>
            <div class="btn-group" style="margin-top:24px;">
                <button class="btn btn-accent" onclick="${onSave}()">
                    <i data-lucide="save"></i>
                    保存服务器信息
                </button>
            </div>
        </div>`;
    },
    
    /**
     * 获取表单数据
     */
    getData() {
        return {
            name: document.getElementById('server-name').value.trim(),
            version: document.getElementById('server-version').value.trim(),
            ip: document.getElementById('server-ip').value.trim(),
            port: document.getElementById('server-port').value.trim() || '25565',
            description: document.getElementById('server-desc').value.trim()
        };
    }
};