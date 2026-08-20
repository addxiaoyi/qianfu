/**
 * 站点信息页面模块
 */
const SiteInfoPage = {
    /**
     * 渲染页面内容
     * @param {object} data - 站点数据
     * @param {function} onSave - 保存回调
     */
    render(data, onSave) {
        return `
        <div class="card">
            <div class="card-header">
                <div class="card-title">
                    <i data-lucide="globe"></i>
                    <span>站点信息</span>
                </div>
            </div>
            <div class="form-grid">
                <div class="form-group">
                    <label class="form-label">站点 Logo</label>
                    <div id="site-logo-upload"></div>
                </div>
                <div class="form-group">
                    <label class="form-label">站点名称</label>
                    <input type="text" class="form-input" id="site-name" value="${Components.escapeHtml(data.name || '')}" placeholder="输入站点名称">
                </div>
                <div class="form-group">
                    <label class="form-label">站点标题</label>
                    <input type="text" class="form-input" id="site-title" value="${Components.escapeHtml(data.title || '')}" placeholder="输入站点标题">
                </div>
                <div class="form-group">
                    <label class="form-label">联系邮箱</label>
                    <input type="email" class="form-input" id="site-email" value="${Components.escapeHtml(data.email || '')}" placeholder="example@qq.com">
                </div>
                <div class="form-group">
                    <label class="form-label">联系微信</label>
                    <input type="text" class="form-input" id="site-wechat" value="${Components.escapeHtml(data.wechat || '')}" placeholder="输入微信号">
                </div>
                <div class="form-group" style="grid-column: 1/-1;">
                    <label class="form-label">站点描述</label>
                    <input type="text" class="form-input" id="site-desc" value="${Components.escapeHtml(data.description || '')}" placeholder="简短描述您的服务器">
                </div>
                <div class="form-group" style="grid-column: 1/-1;">
                    <label class="form-label">公告内容</label>
                    <textarea class="form-input" id="site-announce" placeholder="服务器公告，支持多行文本">${Components.escapeHtml(data.announcement || '')}</textarea>
                </div>
            </div>
            <div class="btn-group" style="margin-top:24px;">
                <button class="btn btn-accent" onclick="${onSave}()">
                    <i data-lucide="save"></i>
                    保存站点信息
                </button>
            </div>
        </div>`;
    },
    
    /**
     * 初始化 Logo 上传组件
     */
    initLogoUpload() {
        const uploadEl = document.getElementById('site-logo-upload');
        if (uploadEl && !uploadEl.innerHTML) {
            const data = Store.get('content') || {};
            uploadEl.innerHTML = Components.imageUpload({
                id: 'site-logo',
                value: data.logo || '',
                placeholder: '点击上传站点 Logo',
                previewSize: '80px'
            });
            Components.initImageUpload('site-logo');
        }
    },
    
    /**
     * 获取表单数据
     */
    getData() {
        return {
            name: document.getElementById('site-name').value.trim(),
            title: document.getElementById('site-title').value.trim(),
            email: document.getElementById('site-email').value.trim(),
            wechat: document.getElementById('site-wechat').value.trim(),
            description: document.getElementById('site-desc').value.trim(),
            announcement: document.getElementById('site-announce').value.trim(),
            logo: Components.getImageUploadValue('site-logo')
        };
    }
};