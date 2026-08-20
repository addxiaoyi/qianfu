/**
 * 社交链接页面模块
 */
const SocialPage = {
    /**
     * 渲染页面内容
     * @param {object} data - 社交链接数据
     * @param {function} onSave - 保存回调
     */
    render(data, onSave) {
        return `
        <div class="card">
            <div class="card-header">
                <div class="card-title">
                    <i data-lucide="link"></i>
                    <span>社交链接</span>
                </div>
            </div>
            <div class="form-grid">
                <div class="form-group">
                    <label class="form-label">服务器官网</label>
                    <input type="url" class="form-input" id="social-website" value="${Components.escapeHtml(data.website || '')}" placeholder="https://example.com">
                </div>
                <div class="form-group">
                    <label class="form-label">QQ群</label>
                    <input type="text" class="form-input" id="social-qq" value="${Components.escapeHtml(data.qq || '')}" placeholder="123456789">
                </div>
                <div class="form-group">
                    <label class="form-label">Bilibili</label>
                    <input type="url" class="form-input" id="social-bilibili" value="${Components.escapeHtml(data.bilibili || '')}" placeholder="https://bilibili.com/xxx">
                </div>
                <div class="form-group">
                    <label class="form-label">Discord</label>
                    <input type="url" class="form-input" id="social-discord" value="${Components.escapeHtml(data.discord || '')}" placeholder="https://discord.gg/xxx">
                </div>
                <div class="form-group">
                    <label class="form-label">微信公众号</label>
                    <input type="text" class="form-input" id="social-wechat" value="${Components.escapeHtml(data.wechat || '')}" placeholder="公众号名称">
                </div>
                <div class="form-group">
                    <label class="form-label">微博</label>
                    <input type="url" class="form-input" id="social-weibo" value="${Components.escapeHtml(data.weibo || '')}" placeholder="https://weibo.com/xxx">
                </div>
            </div>
            <div class="btn-group" style="margin-top:24px;">
                <button class="btn btn-accent" onclick="${onSave}()">
                    <i data-lucide="save"></i>
                    保存社交链接
                </button>
            </div>
        </div>`;
    },
    
    /**
     * 获取表单数据
     */
    getData() {
        return {
            website: document.getElementById('social-website').value.trim(),
            qq: document.getElementById('social-qq').value.trim(),
            bilibili: document.getElementById('social-bilibili').value.trim(),
            discord: document.getElementById('social-discord').value.trim(),
            wechat: document.getElementById('social-wechat').value.trim(),
            weibo: document.getElementById('social-weibo').value.trim()
        };
    }
};