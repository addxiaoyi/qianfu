/**
 * 应用入口 - 主控制器
 * 管理页面路由、状态同步、页面切换
 */
const App = {
    // 当前标签页索引
    currentTab: 0,
    
    // 标签页定义
    tabs: [
        { id: 'site-info', name: '站点信息', icon: 'globe', page: 'site-info' },
        { id: 'server', name: '服务器', icon: 'gamepad-2', page: 'server' },
        { id: 'team', name: '管理团队', icon: 'users', page: 'team' },
        { id: 'content', name: '内容管理', icon: 'file-text', page: 'content' },
        { id: 'style', name: '风格设置', icon: 'palette', page: 'style' },
        { id: 'social', name: '社交链接', icon: 'link', page: 'social' },
        { id: 'backup', name: '备份管理', icon: 'archive', page: 'backup' },
        { id: 'logs', name: '操作日志', icon: 'history', page: 'logs' }
    ],
    
    /**
     * 初始化应用
     */
    async init() {
        // 检查登录状态
        await this.checkAuth();
        
        // 加载数据
        await this.loadData();
        
        // 渲染界面
        this.renderNav();
        this.renderSidebar();
        this.renderPage();
        
        // 初始化图标
        lucide.createIcons();
        
        // 绑定移动端菜单按钮
        this.bindMobileMenu();
    },
    
    /**
     * 渲染侧边栏内容
     */
    renderSidebar() {
        const sidebar = document.getElementById('sidebar');
        if (!sidebar) return;
        
        sidebar.innerHTML = `
            <div class="sidebar-brand">
                <div class="sidebar-logo">千</div>
                <div class="sidebar-title">
                    <span class="sidebar-title-main">千服联灯</span>
                    <span class="sidebar-title-sub">后台管理</span>
                </div>
                <div class="sidebar-status">
                    <span class="status-dot"></span>
                    <span class="status-text">在线</span>
                </div>
            </div>
            
            <!-- Navigation -->
            <nav id="sidebar-nav" class="sidebar-nav">
                <!-- Rendered by JS -->
            </nav>
            
            <!-- Footer -->
            <div class="sidebar-footer">
                <div class="footer-stats">
                    <span class="footer-stat-label">状态</span>
                    <span class="footer-stat-value">已连接</span>
                </div>
                <button class="logout-btn" onclick="App.logout()">
                    <span class="logout-content">
                        <i data-lucide="log-out" class="logout-icon"></i>
                        退出登录
                    </span>
                    <svg class="nav-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M9 18l6-6-6-6"/>
                    </svg>
                </button>
                <a href="../index.html" class="icp-link">← 返回主站</a>
            </div>
        `;
    },
    
    /**
     * 绑定移动端菜单
     */
    bindMobileMenu() {
        // ESC 键关闭菜单
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.toggleMobileMenu(false);
            }
        });
    },
    
    /**
     * 切换移动端菜单
     * @param {boolean} open - 是否打开菜单
     */
    toggleMobileMenu(open) {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        
        if (open) {
            sidebar.classList.add('mobile-open');
            overlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        } else {
            sidebar.classList.remove('mobile-open');
            overlay.classList.remove('active');
            document.body.style.overflow = '';
        }
    },
    
    /**
     * 检查登录状态
     */
    async checkAuth() {
        const state = Store.get('system');
        if (!state || !state.loggedIn) {
            window.location.href = 'login.html';
        }
    },
    
    /**
     * 加载数据
     */
    async loadData() {
        const success = await Store.loadAll();
        if (!success) {
            Components.toast('加载数据失败: ' + Store.get('error'), 'error');
        }
    },
    
    /**
     * 渲染导航栏
     */
    renderNav() {
        const nav = document.getElementById('sidebar-nav');
        const navItems = this.tabs.map((tab, index) => `
            <a href="#" class="nav-item ${index === this.currentTab ? 'active' : ''}" 
               data-tab="${index}" onclick="App.switchTab(${index}); return false;">
                <div class="nav-item-content">
                    <i data-lucide="${tab.icon}" class="nav-icon"></i>
                    <div class="nav-labels">
                        <span class="nav-label">${tab.name}</span>
                    </div>
                </div>
                <svg class="nav-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 18l6-6-6-6"/>
                </svg>
            </a>
        `).join('');
        
        nav.innerHTML = navItems;
        lucide.createIcons();
    },
    
    /**
     * 切换标签页
     * @param {number} index - 标签索引
     */
    switchTab(index) {
        this.currentTab = index;
        
        // 更新导航高亮
        document.querySelectorAll('.nav-item').forEach((item, i) => {
            item.classList.toggle('active', i === index);
        });
        
        // 移动端切换标签时关闭菜单
        this.toggleMobileMenu(false);
        
        // 渲染页面
        this.renderPage();
    },
    
    /**
     * 渲染当前页面
     */
    renderPage() {
        const content = document.getElementById('page-content');
        const tab = this.tabs[this.currentTab];
        const data = Store.get('content') || {};
        const system = Store.get('system') || {};
        
        // 更新背景文字
        document.getElementById('bg-text').textContent = tab.name;
        
        let pageHtml = '';
        
        switch (tab.page) {
            case 'site-info':
                pageHtml = SiteInfoPage.render(data.site || {}, 'App.saveSiteInfo');
                break;
            case 'server':
                pageHtml = ServerPage.render(data.server || {}, 'App.saveServer');
                break;
            case 'team':
                pageHtml = TeamPage.render(data.members || [], 'App.editMember', 'App.deleteMember', 'App.addMember');
                break;
            case 'content':
                pageHtml = ContentPage.render(data.content || {}, 'App.saveContent');
                break;
            case 'style':
                pageHtml = StylePage.render(system.theme || 'violet', 'App.changeTheme');
                break;
            case 'social':
                pageHtml = SocialPage.render(data.social || {}, 'App.saveSocial');
                break;
            case 'backup':
                pageHtml = BackupPage.render();
                break;
            case 'logs':
                pageHtml = LogsPage.render();
                break;
        }
        
        content.innerHTML = pageHtml;
        lucide.createIcons();
        
        // 渲染页面后初始化表单
        if (typeof FormHandler !== 'undefined' && FormHandler.init) {
            FormHandler.init();
        }
        
        // 团队页面初始化添加表单
        if (tab.page === 'team') {
            TeamPage.initAddForm();
        }
        
        // 站点信息页面初始化 Logo 上传
        if (tab.page === 'site-info') {
            SiteInfoPage.initLogoUpload();
        }
        
        // 备份页面初始化交互
        if (tab.page === 'backup') {
            BackupPage.init();
        }
        
        // 日志页面初始化
        if (tab.page === 'logs') {
            LogsPage.init();
        }
    },
    
    // ─── 保存操作 ───
    
    async saveSiteInfo() {
        // 验证必填字段
        if (!Validator.validateForm([
            { selector: '#site-name', rules: ['required', { maxLength: 50, message: '站点名称不能超过50字符' }], name: '站点名称' },
            { selector: '#site-email', rules: ['email'], name: '邮箱' }
        ])) {
            return;
        }
        
        const siteData = SiteInfoPage.getData();
        const content = Store.get('content') || {};
        content.site = siteData;
        
        Components.renderSaveIndicator(true);
        const success = await Store.saveContent(content);
        Components.renderSaveIndicator(false);
        
        if (success) {
            Components.toast('站点信息已保存', 'success');
            API.addLog('save', '站点信息', `更新站点信息: ${siteData.name || ''}`);
        } else {
            Components.toast('保存失败: ' + Store.get('error'), 'error');
        }
    },
    
    async saveServer() {
        // 验证必填字段
        if (!Validator.validateForm([
            { selector: '#server-name', rules: ['required', { maxLength: 50, message: '服务器名称不能超过50字符' }], name: '服务器名称' },
            { selector: '#server-ip', rules: ['required', 'ip'], name: '服务器地址' },
            { selector: '#server-port', rules: ['port'], name: '服务器端口' }
        ])) {
            return;
        }
        
        const serverData = ServerPage.getData();
        const content = Store.get('content') || {};
        content.server = serverData;
        
        Components.renderSaveIndicator(true);
        const success = await Store.saveContent(content);
        Components.renderSaveIndicator(false);
        
        if (success) {
            Components.toast('服务器信息已保存', 'success');
            API.addLog('save', '服务器信息', `更新服务器: ${serverData.name || ''} (${serverData.ip || ''})`);
        } else {
            Components.toast('保存失败: ' + Store.get('error'), 'error');
        }
    },
    
    async saveContent() {
        const contentData = ContentPage.getData();
        const content = Store.get('content') || {};
        content.content = contentData;
        
        Components.renderSaveIndicator(true);
        const success = await Store.saveContent(content);
        Components.renderSaveIndicator(false);
        
        if (success) {
            Components.toast('内容已保存', 'success');
            API.addLog('save', '内容管理', '更新页面内容');
        } else {
            Components.toast('保存失败: ' + Store.get('error'), 'error');
        }
    },
    
    async saveSocial() {
        // 验证URL字段
        if (!Validator.validateForm([
            { selector: '#social-website', rules: ['url'], name: '服务器官网' },
            { selector: '#social-discord', rules: ['url'], name: 'Discord' },
            { selector: '#social-bilibili', rules: ['url'], name: 'Bilibili' },
            { selector: '#social-weibo', rules: ['url'], name: '微博' }
        ])) {
            return;
        }
        
        const socialData = SocialPage.getData();
        const content = Store.get('content') || {};
        content.social = socialData;
        
        Components.renderSaveIndicator(true);
        const success = await Store.saveContent(content);
        Components.renderSaveIndicator(false);
        
        if (success) {
            Components.toast('社交链接已保存', 'success');
            API.addLog('save', '社交链接', '更新社交媒体链接');
        } else {
            Components.toast('保存失败: ' + Store.get('error'), 'error');
        }
    },
    
    // ─── 团队成员操作 ───
    
    addMember() {
        const newMember = TeamPage.getNewMember();
        if (!newMember) return;
        
        const content = Store.get('content') || {};
        content.members = content.members || [];
        content.members.push(newMember);
        
        Store.set({ content });
        this.renderPage();
        Components.toast('成员已添加', 'success');
        API.addLog('create', '管理团队', `添加成员: ${newMember.name}`);
    },
    
    editMember(index) {
        const content = Store.get('content') || {};
        const member = content.members[index];
        if (!member) return;
        
        // 创建支持头像上传的编辑对话框
        const dialog = document.createElement('div');
        dialog.className = 'modal-overlay edit-member-modal';
        dialog.innerHTML = `
            <div class="modal-content">
                <h3 class="modal-title">编辑成员</h3>
                <div class="form-group">
                    <label>名称</label>
                    <input type="text" id="edit-member-name" value="${Components.escapeHtml(member.name || '')}" class="form-input" required>
                </div>
                <div class="form-group">
                    <label>职位</label>
                    <input type="text" id="edit-member-role" value="${Components.escapeHtml(member.role || '')}" class="form-input">
                </div>
                <div class="form-group">
                    <label>头像</label>
                    <div id="edit-member-avatar-upload"></div>
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn btn-secondary modal-cancel">取消</button>
                    <button type="button" class="btn btn-primary modal-confirm">保存</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(dialog);
        
        // 初始化图片上传组件
        setTimeout(() => {
            document.getElementById('edit-member-avatar-upload').innerHTML = Components.imageUpload({
                id: 'edit-member-avatar',
                value: member.avatar || '',
                placeholder: '点击上传头像',
                previewSize: '60px'
            });
            Components.initImageUpload('edit-member-avatar');
        }, 0);
        
        // 取消按钮
        dialog.querySelector('.modal-cancel').addEventListener('click', () => {
            document.body.removeChild(dialog);
        });
        
        // 保存按钮
        dialog.querySelector('.modal-confirm').addEventListener('click', async () => {
            const name = document.getElementById('edit-member-name').value.trim();
            const role = document.getElementById('edit-member-role').value.trim();
            const avatar = Components.getImageUploadValue('edit-member-avatar');
            
            if (!name) {
                Components.toast('请输入成员名称', 'error');
                return;
            }
            
            content.members[index] = { 
                name, 
                role: role || '成员',
                avatar: avatar || member.avatar || ''
            };
            Store.set({ content });
            document.body.removeChild(dialog);
            this.renderPage();
            Components.toast('成员已更新', 'success');
            API.addLog('update', '管理团队', `更新成员: ${name}`);
        });
        
        // 点击遮罩关闭
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                document.body.removeChild(dialog);
            }
        });
    },
    
    deleteMember(index) {
        if (!confirm('确定删除该成员?')) return;
        
        const content = Store.get('content') || {};
        const memberName = content.members[index]?.name || '未知';
        content.members.splice(index, 1);
        Store.set({ content });
        this.renderPage();
        Components.toast('成员已删除', 'success');
        API.addLog('delete', '管理团队', `删除成员: ${memberName}`);
    },
    
    // ─── 批量操作 ───
    
    batchDeleteMembers() {
        const selected = TeamPage.getSelectedIndexes();
        if (selected.length === 0) {
            Components.toast('请先选择要删除的成员', 'warning');
            return;
        }
        
        if (!confirm(`确定要删除选中的 ${selected.length} 个成员吗？此操作不可恢复！`)) {
            return;
        }
        
        const count = TeamPage.deleteSelected();
        this.renderPage();
        Components.toast(`已删除 ${count} 个成员`, 'success');
        API.addLog('delete', '管理团队', `批量删除 ${count} 个成员`);
    },
    
    // ─── 主题切换 ───
    
    async changeTheme(theme) {
        const system = Store.get('system') || {};
        system.theme = theme;
        
        // 立即更新 UI
        document.documentElement.setAttribute('data-accent', theme);
        
        // 保存到后端
        Components.renderSaveIndicator(true);
        const success = await Store.saveSystem(system);
        Components.renderSaveIndicator(false);
        
        // 更新主题选择器高亮
        document.querySelectorAll('.color-option').forEach(opt => {
            opt.classList.toggle('active', opt.dataset.theme === theme);
        });
        
        if (success) {
            Components.toast('主题已切换', 'success');
            API.addLog('update', '风格设置', `切换主题: ${theme}`);
        } else {
            Components.toast('主题保存失败', 'error');
        }
    },
    
    // ─── 退出登录 ───
    
    async logout() {
        if (!confirm('确定退出登录?')) return;
        
        try {
            await API.logout();
        } catch (e) {}
        
        window.location.href = 'login.html';
    }
};