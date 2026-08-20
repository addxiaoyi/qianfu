/**
 * 管理团队页面模块
 */
const TeamPage = {
    selectedMembers: new Set(),
    
    /**
     * 渲染页面内容
     */
    render(members, onEdit, onDelete, onAdd) {
        let membersHtml = '';
        const hasMembers = members && members.length > 0;
        
        if (hasMembers) {
            members.forEach((member, index) => {
                const isSelected = this.selectedMembers.has(index);
                membersHtml += `
                <div class="member-item ${isSelected ? 'selected' : ''}" data-index="${index}">
                    <div class="member-checkbox">
                        <input type="checkbox" id="member-check-${index}" 
                            ${isSelected ? 'checked' : ''} 
                            onchange="TeamPage.toggleSelect(${index})">
                        <label for="member-check-${index}"></label>
                    </div>
                    <div class="member-info">
                        <div class="member-avatar">${Components.avatarWithImage(member.avatar, member.name)}</div>
                        <div>
                            <div class="member-name">${Components.escapeHtml(member.name)}</div>
                            <div class="member-role">${Components.escapeHtml(member.role)}</div>
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
            membersHtml = `<div class="card" style="text-align:center;color:#a1a1aa;padding:32px;">暂无成员，点击下方按钮添加</div>`;
        }
        
        const selectedCount = this.selectedMembers.size;
        const batchBarHtml = hasMembers ? `
            <div class="batch-bar ${selectedCount > 0 ? 'active' : ''}">
                <label class="batch-select-all">
                    <input type="checkbox" id="select-all-members" 
                        ${selectedCount === members.length ? 'checked' : ''}
                        onchange="TeamPage.toggleSelectAll(${members?.length || 0})">
                    <span>全选</span>
                </label>
                <span class="batch-count">已选择 ${selectedCount} 项</span>
                <div class="batch-actions">
                    <button class="btn btn-sm btn-secondary" onclick="App.batchDeleteMembers()">
                        <i data-lucide="trash-2"></i>
                        批量删除
                    </button>
                    <button class="btn btn-sm btn-secondary" onclick="TeamPage.clearSelection()">
                        取消选择
                    </button>
                </div>
            </div>
        ` : '';
        
        return `
        <div class="card">
            <div class="card-header">
                <div class="card-title">
                    <i data-lucide="users"></i>
                    <span>管理团队</span>
                </div>
                <span class="member-count">${members?.length || 0} 人</span>
            </div>
            ${batchBarHtml}
            <div id="members-list" class="member-list">
                ${membersHtml}
            </div>
            <div class="add-form" style="margin-top:16px;">
                <div class="form-group">
                    <input type="text" class="form-input" id="new-member-name" placeholder="成员名称">
                </div>
                <div class="form-group">
                    <input type="text" class="form-input" id="new-member-role" placeholder="职位 (如: 开发者)">
                </div>
                <div class="form-group" style="grid-column: 1/-1;">
                    <label class="form-label">头像</label>
                    <div id="new-member-avatar-upload"></div>
                </div>
                <button class="btn btn-accent" onclick="${onAdd}()">
                    <i data-lucide="plus"></i>
                    添加成员
                </button>
            </div>
        </div>`;
    },
    
    /**
     * 初始化添加表单
     */
    initAddForm() {
        const uploadEl = document.getElementById('new-member-avatar-upload');
        if (uploadEl) {
            uploadEl.innerHTML = Components.imageUpload({
                id: 'new-member-avatar',
                value: '',
                placeholder: '点击上传成员头像',
                previewSize: '60px'
            });
            Components.initImageUpload('new-member-avatar');
        }
    },
    
    /**
     * 切换选择状态
     */
    toggleSelect(index) {
        if (this.selectedMembers.has(index)) {
            this.selectedMembers.delete(index);
        } else {
            this.selectedMembers.add(index);
        }
        this.updateUI();
    },
    
    /**
     * 全选/取消全选
     */
    toggleSelectAll(total) {
        const checkbox = document.getElementById('select-all-members');
        if (checkbox.checked) {
            for (let i = 0; i < total; i++) {
                this.selectedMembers.add(i);
            }
        } else {
            this.selectedMembers.clear();
        }
        this.updateUI();
    },
    
    /**
     * 清除选择
     */
    clearSelection() {
        this.selectedMembers.clear();
        this.updateUI();
    },
    
    /**
     * 获取已选择的索引数组（倒序，用于安全删除）
     */
    getSelectedIndexes() {
        return Array.from(this.selectedMembers).sort((a, b) => b - a);
    },
    
    /**
     * 删除已选成员
     */
    deleteSelected() {
        const indexes = this.getSelectedIndexes();
        if (indexes.length === 0) return 0;
        
        const content = Store.get('content') || {};
        const deletedNames = [];
        
        indexes.forEach(index => {
            deletedNames.push(content.members[index]?.name || '未知');
            content.members.splice(index, 1);
        });
        
        Store.set({ content });
        this.selectedMembers.clear();
        
        return deletedNames.length;
    },
    
    /**
     * 更新UI
     */
    updateUI() {
        const content = Store.get('content') || {};
        const members = content.members || [];
        
        document.querySelectorAll('.member-item').forEach(item => {
            const index = parseInt(item.dataset.index);
            const checkbox = document.getElementById(`member-check-${index}`);
            if (checkbox) {
                checkbox.checked = this.selectedMembers.has(index);
            }
            item.classList.toggle('selected', this.selectedMembers.has(index));
        });
        
        const selectAll = document.getElementById('select-all-members');
        if (selectAll) {
            selectAll.checked = this.selectedMembers.size === members.length && members.length > 0;
        }
        
        const batchBar = document.querySelector('.batch-bar');
        const batchCount = document.querySelector('.batch-count');
        if (batchBar) {
            batchBar.classList.toggle('active', this.selectedMembers.size > 0);
        }
        if (batchCount) {
            batchCount.textContent = `已选择 ${this.selectedMembers.size} 项`;
        }
        
        lucide.createIcons();
    },
    
    /**
     * 获取新成员数据
     */
    getNewMember() {
        const name = document.getElementById('new-member-name').value.trim();
        const role = document.getElementById('new-member-role').value.trim();
        
        if (!name) {
            Components.toast('请输入成员名称', 'warning');
            return null;
        }
        
        return { 
            name, 
            role: role || '成员',
            avatar: Components.getImageUploadValue('new-member-avatar')
        };
    },
    
    /**
     * 获取编辑后的成员数据
     */
    getEditedMember(index) {
        const name = document.getElementById('edit-member-name').value.trim();
        const role = document.getElementById('edit-member-role').value.trim();
        
        if (!name) {
            Components.toast('请输入成员名称', 'warning');
            return null;
        }
        
        return { 
            name, 
            role: role || '成员',
            avatar: Components.getImageUploadValue('edit-member-avatar')
        };
    }
};