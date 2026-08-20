/**
 * 备份管理页面模块
 */
const BackupPage = {
    /**
     * 渲染页面内容
     */
    render() {
        return `
        <div class="card">
            <div class="card-header">
                <div class="card-title">
                    <i data-lucide="database"></i>
                    <span>数据备份</span>
                </div>
            </div>
            
            <div class="backup-section">
                <h3 class="backup-title">导出数据</h3>
                <p class="backup-desc">下载完整的站点配置备份文件，包括所有设置、图片等内容</p>
                <button class="btn btn-accent" onclick="BackupPage.exportData()">
                    <i data-lucide="download"></i>
                    导出备份
                </button>
            </div>
            
            <div class="backup-divider"></div>
            
            <div class="backup-section">
                <h3 class="backup-title">导入数据</h3>
                <p class="backup-desc">从备份文件恢复站点配置，当前数据会自动备份</p>
                <div class="import-area" id="import-area">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="17,8 12,3 7,8"/>
                        <line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    <p>点击或拖拽备份文件到此处</p>
                    <input type="file" id="backup-file-input" accept=".json" style="display:none;">
                </div>
                <button class="btn btn-secondary" onclick="BackupPage.selectFile()">
                    选择备份文件
                </button>
            </div>
            
            <div class="backup-divider"></div>
            
            <div class="backup-section">
                <h3 class="backup-title">注意事项</h3>
                <ul class="backup-tips">
                    <li>导入会覆盖当前所有配置，请谨慎操作</li>
                    <li>导入前会自动备份当前数据到 <code>data/backups/</code> 目录</li>
                    <li>备份文件包含上传的图片（Base64 编码）</li>
                    <li>建议定期导出备份，防止数据丢失</li>
                </ul>
            </div>
        </div>
        
        <style>
        .backup-section {
            padding: 16px 0;
        }
        .backup-title {
            font-size: 16px;
            font-weight: 600;
            color: #fafafa;
            margin: 0 0 8px;
        }
        .backup-desc {
            font-size: 14px;
            color: #a1a1aa;
            margin: 0 0 16px;
        }
        .backup-divider {
            height: 1px;
            background: #27272a;
            margin: 8px 0;
        }
        .backup-tips {
            margin: 0;
            padding-left: 20px;
            color: #a1a1aa;
            font-size: 14px;
        }
        .backup-tips li {
            margin: 8px 0;
        }
        .backup-tips code {
            background: #27272a;
            padding: 2px 6px;
            border-radius: 4px;
            font-family: monospace;
        }
        .import-area {
            border: 2px dashed #3f3f46;
            border-radius: 8px;
            padding: 32px;
            text-align: center;
            cursor: pointer;
            transition: all 0.2s;
            margin-bottom: 16px;
        }
        .import-area:hover, .import-area.dragover {
            border-color: var(--accent, #7c3aed);
            background: rgba(124, 58, 237, 0.1);
        }
        .import-area svg {
            color: #71717a;
            margin-bottom: 8px;
        }
        .import-area p {
            margin: 0;
            color: #71717a;
        }
        </style>`;
    },
    
    /**
     * 初始化页面交互
     */
    init() {
        const importArea = document.getElementById('import-area');
        const fileInput = document.getElementById('backup-file-input');
        
        if (importArea && fileInput) {
            importArea.onclick = () => fileInput.click();
            
            fileInput.onchange = (e) => {
                const file = e.target.files[0];
                if (file) this.importData(file);
            };
            
            importArea.ondragover = (e) => {
                e.preventDefault();
                importArea.classList.add('dragover');
            };
            
            importArea.ondragleave = () => {
                importArea.classList.remove('dragover');
            };
            
            importArea.ondrop = (e) => {
                e.preventDefault();
                importArea.classList.remove('dragover');
                const file = e.dataTransfer.files[0];
                if (file && file.name.endsWith('.json')) {
                    this.importData(file);
                } else {
                    Components.toast('请上传 JSON 格式的备份文件', 'warning');
                }
            };
        }
    },
    
    /**
     * 选择文件
     */
    selectFile() {
        const fileInput = document.getElementById('backup-file-input');
        if (fileInput) fileInput.click();
    },
    
    /**
     * 导出数据
     */
    async exportData() {
        try {
            Components.toast('正在导出...', 'success');
            
            const blob = await API.exportData();
            
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `site-backup-${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            Components.toast('导出成功', 'success');
            API.addLog('export', '备份管理', '导出站点备份');
        } catch (err) {
            Components.toast(err.message || '导出失败', 'error');
        }
    },
    
    /**
     * 导入数据
     */
    async importData(file) {
        if (!confirm(`确定要导入备份文件 "${file.name}" 吗？\n当前数据会自动备份。`)) {
            return;
        }
        
        try {
            Components.toast('正在导入...', 'success');
            
            const result = await API.importData(file);
            
            if (result.status === 'success') {
                Components.toast(`导入成功，已恢复 ${result.restoredImages || 0} 张图片`, 'success');
                API.addLog('import', '备份管理', `导入备份文件: ${file.name}`);
                
                setTimeout(() => {
                    window.location.reload();
                }, 1500);
            } else {
                throw new Error(result.message || '导入失败');
            }
        } catch (err) {
            Components.toast(err.message || '导入失败', 'error');
        }
    }
};