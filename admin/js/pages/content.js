/**
 * 内容管理页面模块
 */
const ContentPage = {
    /**
     * 渲染页面内容
     * @param {object} data - 内容数据
     * @param {function} onSave - 保存回调
     */
    render(data, onSave) {
        return `
        <div class="card">
            <div class="card-header">
                <div class="card-title">
                    <i data-lucide="file-text"></i>
                    <span>内容管理</span>
                </div>
            </div>
            <div class="form-grid">
                <div class="form-group" style="grid-column: 1/-1;">
                    <label class="form-label">服务器介绍</label>
                    <textarea class="form-input" id="content-intro" style="min-height:200px;" placeholder="详细描述您的服务器">${Components.escapeHtml(data.intro || '')}</textarea>
                </div>
                <div class="form-group" style="grid-column: 1/-1;">
                    <label class="form-label">特色玩法</label>
                    <textarea class="form-input" id="content-features" style="min-height:200px;" placeholder="列举服务器特色玩法，每行一条">${Components.escapeHtml(data.features || '')}</textarea>
                </div>
            </div>
            <div class="btn-group" style="margin-top:24px;">
                <button class="btn btn-accent" onclick="${onSave}()">
                    <i data-lucide="save"></i>
                    保存内容
                </button>
            </div>
        </div>`;
    },
    
    /**
     * 获取表单数据
     */
    getData() {
        return {
            intro: document.getElementById('content-intro').value.trim(),
            features: document.getElementById('content-features').value.trim()
        };
    }
};