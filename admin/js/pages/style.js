/**
 * 风格设置页面模块
 */
const StylePage = {
    /**
     * 渲染页面内容
     * @param {string} theme - 当前主题
     * @param {function} onThemeChange - 主题变更回调
     */
    render(theme, onThemeChange) {
        const themes = [
            { id: 'zinc', name: 'Zinc', color: '#18181b' },
            { id: 'violet', name: 'Violet', color: '#7c3aed' },
            { id: 'amber', name: 'Amber', color: '#d97706' },
            { id: 'emerald', name: 'Emerald', color: '#059669' },
            { id: 'sky', name: 'Sky', color: '#0284c7' },
            { id: 'rose', name: 'Rose', color: '#e11d48' }
        ];
        
        const themeOptions = themes.map(t => `
            <div class="color-option ${t.id === theme ? 'active' : ''}" 
                 onclick="${onThemeChange}('${t.id}')" data-theme="${t.id}">
                <div class="color-swatch" style="background:${t.color}"></div>
                <span class="color-name">${t.name}</span>
            </div>
        `).join('');
        
        return `
        <div class="card">
            <div class="card-header">
                <div class="card-title">
                    <i data-lucide="palette"></i>
                    <span>风格设置</span>
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">选择主题颜色</label>
                <div id="theme-picker" class="color-grid">
                    ${themeOptions}
                </div>
            </div>
        </div>`;
    }
};