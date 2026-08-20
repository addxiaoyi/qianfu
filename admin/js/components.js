/**
 * Components 模块 - UI 组件渲染
 * 可复用的 UI 组件函数
 */
const Components = {
    /**
     * 显示 Toast 通知
     * @param {string} message - 消息内容
     * @param {string} type - 类型: success | error | warning
     */
    toast(message, type = 'success') {
        const existing = document.querySelector('.toast');
        if (existing) existing.remove();
        
        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠'
        };
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<span>${icons[type] || '•'}</span> ${message}`;
        document.body.appendChild(toast);
        
        setTimeout(() => toast.remove(), 3000);
    },
    
    /**
     * 图片上传组件
     * @param {object} options - 配置选项
     * @param {string} options.id - 组件唯一 ID
     * @param {string} options.value - 初始图片 URL
     * @param {string} options.placeholder - 占位提示
     * @param {function} options.onChange - 值变更回调
     * @param {string} options.previewSize - 预览图尺寸，默认 80px
     * @returns {string} HTML 字符串
     */
    imageUpload(options = {}) {
        const {
            id = 'img-upload-' + Date.now(),
            value = '',
            placeholder = '点击或拖拽图片到此处上传',
            onChange = null,
            previewSize = '80px'
        } = options;
        
        return `
        <div class="image-upload-wrapper" id="${id}-wrapper">
            <div class="image-upload-input-area" id="${id}" data-value="${Components.escapeHtml(value)}">
                <input type="file" accept="image/*" style="display:none;" id="${id}-file">
                <div class="image-upload-placeholder" style="${value ? 'display:none;' : ''}">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                        <circle cx="8.5" cy="8.5" r="1.5"/>
                        <polyline points="21,15 16,10 5,21"/>
                    </svg>
                    <span>${placeholder}</span>
                </div>
                <div class="image-upload-preview" style="${value ? '' : 'display:none;'}">
                    <img src="${Components.escapeHtml(value)}" alt="预览" style="max-width:100%;max-height:${previewSize};border-radius:4px;">
                </div>
            </div>
            <div class="image-upload-url-row">
                <input type="url" class="form-input" id="${id}-url" value="${Components.escapeHtml(value)}" 
                       placeholder="或输入图片 URL" oninput="Components._handleUrlInput('${id}')">
                <button type="button" class="btn btn-secondary" onclick="Components._triggerFileInput('${id}')">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="17,8 12,3 7,8"/>
                        <line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    上传
                </button>
            </div>
            <div class="image-upload-progress" id="${id}-progress" style="display:none;">
                <div class="progress-bar"></div>
            </div>
        </div>
        <style>
        .image-upload-wrapper { width: 100%; }
        .image-upload-input-area {
            border: 2px dashed #3f3f46;
            border-radius: 8px;
            padding: 24px;
            text-align: center;
            cursor: pointer;
            transition: all 0.2s;
            background: #18181b;
            min-height: 100px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .image-upload-input-area:hover, .image-upload-input-area.dragover {
            border-color: var(--accent, #7c3aed);
            background: rgba(124, 58, 237, 0.1);
        }
        .image-upload-placeholder {
            color: #71717a;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 8px;
        }
        .image-upload-preview img {
            object-fit: cover;
        }
        .image-upload-url-row {
            display: flex;
            gap: 8px;
            margin-top: 8px;
        }
        .image-upload-url-row .form-input {
            flex: 1;
        }
        .image-upload-progress {
            margin-top: 8px;
            height: 4px;
            background: #27272a;
            border-radius: 2px;
            overflow: hidden;
        }
        .image-upload-progress .progress-bar {
            height: 100%;
            background: var(--accent, #7c3aed);
            width: 0%;
            transition: width 0.3s;
        }
        </style>`;
    },
    
    /**
     * 处理文件选择
     * @param {string} id - 组件 ID
     */
    async _handleFileSelect(id) {
        const fileInput = document.getElementById(id + '-file');
        const file = fileInput.files[0];
        if (!file) return;
        
        await this._uploadImage(id, file);
    },
    
    /**
     * 处理 URL 输入
     * @param {string} id - 组件 ID
     */
    _handleUrlInput(id) {
        const urlInput = document.getElementById(id + '-url');
        const value = urlInput.value.trim();
        
        const inputArea = document.getElementById(id);
        const preview = inputArea.querySelector('.image-upload-preview img');
        const placeholder = inputArea.querySelector('.image-upload-placeholder');
        
        if (value) {
            preview.src = value;
            preview.style.display = 'block';
            placeholder.style.display = 'none';
            inputArea.dataset.value = value;
        } else {
            preview.style.display = 'none';
            placeholder.style.display = 'flex';
            inputArea.dataset.value = '';
        }
    },
    
    /**
     * 触发文件选择
     * @param {string} id - 组件 ID
     */
    _triggerFileInput(id) {
        const fileInput = document.getElementById(id + '-file');
        fileInput.click();
        fileInput.onchange = () => this._handleFileSelect(id);
    },
    
    /**
     * 上传图片
     * @param {string} id - 组件 ID
     * @param {File} file - 文件对象
     */
    async _uploadImage(id, file) {
        const wrapper = document.getElementById(id + '-wrapper');
        const inputArea = document.getElementById(id);
        const urlInput = document.getElementById(id + '-url');
        const progress = document.getElementById(id + '-progress');
        const progressBar = progress.querySelector('.progress-bar');
        
        // 显示进度条
        progress.style.display = 'block';
        progressBar.style.width = '30%';
        
        try {
            const result = await API.uploadImage(file);
            
            if (result.status === 'success') {
                const url = result.url;
                
                // 更新 UI
                progressBar.style.width = '100%';
                urlInput.value = url;
                inputArea.dataset.value = url;
                
                const preview = inputArea.querySelector('.image-upload-preview');
                const previewImg = preview.querySelector('img');
                previewImg.src = url;
                previewImg.style.display = 'block';
                preview.style.display = 'block';
                
                inputArea.querySelector('.image-upload-placeholder').style.display = 'none';
                
                this.toast('上传成功', 'success');
                
                setTimeout(() => {
                    progress.style.display = 'none';
                    progressBar.style.width = '0%';
                }, 1000);
            } else {
                throw new Error(result.message || '上传失败');
            }
        } catch (err) {
            progress.style.display = 'none';
            this.toast(err.message || '上传失败', 'error');
        }
    },
    
    /**
     * 初始化图片上传组件事件
     * @param {string} id - 组件 ID
     * @param {function} onChange - 值变更回调
     */
    initImageUpload(id, onChange = null) {
        const inputArea = document.getElementById(id);
        if (!inputArea) return;
        
        // 点击上传区域
        inputArea.onclick = () => {
            const fileInput = document.getElementById(id + '-file');
            fileInput.click();
            fileInput.onchange = () => this._handleFileSelect(id);
        };
        
        // 拖拽事件
        inputArea.ondragover = (e) => {
            e.preventDefault();
            inputArea.classList.add('dragover');
        };
        
        inputArea.ondragleave = () => {
            inputArea.classList.remove('dragover');
        };
        
        inputArea.ondrop = (e) => {
            e.preventDefault();
            inputArea.classList.remove('dragover');
            
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
                this._uploadImage(id, file);
            } else {
                this.toast('请上传图片文件', 'warning');
            }
        };
        
        // URL 输入变化
        const urlInput = document.getElementById(id + '-url');
        if (urlInput && onChange) {
            urlInput.addEventListener('change', () => {
                onChange(urlInput.value.trim());
            });
        }
    },
    
    /**
     * 获取图片上传组件的值
     * @param {string} id - 组件 ID
     * @returns {string} 图片 URL
     */
    getImageUploadValue(id) {
        const urlInput = document.getElementById(id + '-url');
        return urlInput ? urlInput.value.trim() : '';
    },
    
    /**
     * 生成成员头像
     * @param {string} name - 成员名称
     * @returns {string} 首字母
     */
    avatar(name) {
        return name ? name.charAt(0).toUpperCase() : '?';
    },
    
    /**
     * 生成带图片的头像
     * @param {string} avatarUrl - 头像图片 URL
     * @param {string} name - 成员名称（用于无图片时显示首字母）
     * @returns {string} 图片标签或首字母
     */
    avatarWithImage(avatarUrl, name) {
        if (avatarUrl) {
            return `<img src="${this.escapeHtml(avatarUrl)}" alt="${this.escapeHtml(name)}" onerror="this.outerHTML='${this.escapeHtml(name ? name.charAt(0).toUpperCase() : '?')}'">`;
        }
        return this.avatar(name);
    },
    
    /**
     * 渲染成员列表
     * @param {Array} members - 成员数组
     * @param {function} onEdit - 编辑回调
     * @param {function} onDelete - 删除回调
     * @param {function} onAdd - 添加回调
     */
    renderMembers(members, onEdit, onDelete, onAdd) {
        const container = document.getElementById('members-list');
        
        let html = '';
        
        if (members && members.length > 0) {
            members.forEach((member, index) => {
                html += `
                <div class="member-item" data-index="${index}">
                    <div class="member-info">
                        <div class="member-avatar">${this.avatar(member.name)}</div>
                        <div>
                            <div class="member-name">${this.escapeHtml(member.name)}</div>
                            <div class="member-role">${this.escapeHtml(member.role)}</div>
                        </div>
                    </div>
                    <div class="member-actions">
                        <button class="member-btn" onclick="${onEdit}(${index})" title="编辑">
                            <i data-lucide="pencil"></i>
                        </button>
                        <button class="member-btn delete" onclick="${onDelete}(${index})" title="删除">
                            <i data-lucide="trash-2"></i>
                        </button>
                    </div>
                </div>`;
            });
        } else {
            html = `<div class="card" style="text-align:center;color:#a1a1aa;">暂无成员，点击下方按钮添加</div>`;
        }
        
        html += `
        <div class="add-form" style="margin-top:16px;">
            <div class="form-group">
                <input type="text" class="form-input" id="new-member-name" placeholder="成员名称">
            </div>
            <div class="form-group">
                <input type="text" class="form-input" id="new-member-role" placeholder="职位 (如: 开发者)">
            </div>
            <button class="btn btn-accent" onclick="${onAdd}()">
                <i data-lucide="plus"></i> 添加
            </button>
        </div>`;
        
        container.innerHTML = html;
        lucide.createIcons();
    },
    
    /**
     * 渲染主题选择器
     * @param {string} currentTheme - 当前主题
     * @param {function} onChange - 变更回调
     */
    renderThemePicker(currentTheme, onChange) {
        const themes = [
            { id: 'zinc', name: 'Zinc', color: '#18181b' },
            { id: 'violet', name: 'Violet', color: '#7c3aed' },
            { id: 'amber', name: 'Amber', color: '#d97706' },
            { id: 'emerald', name: 'Emerald', color: '#059669' },
            { id: 'sky', name: 'Sky', color: '#0284c7' },
            { id: 'rose', name: 'Rose', color: '#e11d48' }
        ];
        
        const container = document.getElementById('theme-picker');
        container.innerHTML = themes.map(theme => `
            <div class="color-option ${theme.id === currentTheme ? 'active' : ''}" 
                 onclick="${onChange}('${theme.id}')" data-theme="${theme.id}">
                <div class="color-swatch" style="background:${theme.color}"></div>
                <span class="color-name">${theme.name}</span>
            </div>
        `).join('');
    },
    
    /**
     * HTML 转义
     * @param {string} str - 原始字符串
     */
    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },
    
    /**
     * 渲染保存状态指示器
     * @param {boolean} saving - 是否正在保存
     */
    renderSaveIndicator(saving) {
        const indicator = document.getElementById('save-indicator');
        if (indicator) {
            indicator.style.display = saving ? 'flex' : 'none';
        }
    }
};