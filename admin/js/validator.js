/**
 * 表单验证模块
 */
const Validator = {
    /**
     * 验证规则
     */
    rules: {
        required: {
            validate: (value) => value && value.trim().length > 0,
            message: '此字段为必填项'
        },
        email: {
            validate: (value) => {
                if (!value) return true;
                return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
            },
            message: '请输入有效的邮箱地址'
        },
        url: {
            validate: (value) => {
                if (!value) return true;
                try {
                    new URL(value);
                    return true;
                } catch {
                    return value.startsWith('/') || value.startsWith('#');
                }
            },
            message: '请输入有效的链接地址'
        },
        ip: {
            validate: (value) => {
                if (!value) return true;
                return /^([0-9]{1,3}\.){3}[0-9]{1,3}$/.test(value) || 
                       /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?(\.[a-zA-Z]{2,})+$/.test(value);
            },
            message: '请输入有效的服务器地址'
        },
        port: {
            validate: (value) => {
                if (!value) return true;
                const port = parseInt(value);
                return !isNaN(port) && port >= 1 && port <= 65535;
            },
            message: '端口号必须在 1-65535 之间'
        },
        maxLength: (max) => ({
            validate: (value) => !value || value.length <= max,
            message: `长度不能超过 ${max} 个字符`
        }),
        minLength: (min) => ({
            validate: (value) => !value || value.length >= min,
            message: `长度不能少于 ${min} 个字符`
        })
    },
    
    /**
     * 验证单个字段
     * @param {string} value - 字段值
     * @param {Array} rules - 验证规则数组
     * @returns {object} { valid: boolean, message: string }
     */
    validate(value, rules) {
        for (const rule of rules) {
            let validator = rule;
            
            if (typeof rule === 'string') {
                validator = this.rules[rule];
            } else if (typeof rule === 'function') {
                validator = { validate: rule, message: '验证失败' };
            } else if (typeof rule === 'object' && !rule.validate) {
                validator = rule;
            }
            
            if (validator && typeof validator.validate === 'function') {
                if (!validator.validate(value)) {
                    return { valid: false, message: validator.message };
                }
            }
        }
        return { valid: true, message: '' };
    },
    
    /**
     * 显示验证错误
     * @param {HTMLElement} input - 输入框元素
     * @param {string} message - 错误消息
     */
    showError(input, message) {
        const wrapper = input.closest('.form-group') || input.parentElement;
        if (!wrapper) return;
        
        // 移除旧错误
        const oldError = wrapper.querySelector('.field-error');
        if (oldError) oldError.remove();
        
        input.classList.add('error');
        input.classList.remove('success');
        
        const errorEl = document.createElement('div');
        errorEl.className = 'field-error';
        errorEl.textContent = message;
        wrapper.appendChild(errorEl);
    },
    
    /**
     * 清除验证错误
     * @param {HTMLElement} input - 输入框元素
     */
    clearError(input) {
        const wrapper = input.closest('.form-group') || input.parentElement;
        if (!wrapper) return;
        
        const error = wrapper.querySelector('.field-error');
        if (error) error.remove();
        
        input.classList.remove('error');
    },
    
    /**
     * 显示验证成功
     * @param {HTMLElement} input - 输入框元素
     */
    showSuccess(input) {
        this.clearError(input);
        input.classList.add('success');
    },
    
    /**
     * 初始化实时验证
     * @param {string} selector - 输入框选择器
     * @param {Array} rules - 验证规则
     */
    initValidation(selector, rules) {
        const input = document.querySelector(selector);
        if (!input) return;
        
        input.addEventListener('blur', () => {
            const result = this.validate(input.value, rules);
            if (!result.valid) {
                this.showError(input, result.message);
            } else if (input.value.trim()) {
                this.showSuccess(input);
            } else {
                this.clearError(input);
            }
        });
        
        input.addEventListener('input', () => {
            if (input.classList.contains('error')) {
                const result = this.validate(input.value, rules);
                if (result.valid) {
                    this.clearError(input);
                }
            }
        });
    },
    
    /**
     * 验证整个表单
     * @param {Array} fields - 字段配置 [{selector, rules, name}]
     * @returns {boolean} 是否通过验证
     */
    validateForm(fields) {
        let isValid = true;
        
        for (const field of fields) {
            const input = document.querySelector(field.selector);
            if (!input) continue;
            
            const result = this.validate(input.value, field.rules);
            if (!result.valid) {
                this.showError(input, result.message);
                isValid = false;
            }
        }
        
        return isValid;
    }
};

/**
 * 表单处理器
 */
const FormHandler = {
    /**
     * 初始化表单验证
     */
    init() {
        this.initSiteInfoValidation();
        this.initServerValidation();
        this.initSocialValidation();
    },
    
    /**
     * 站点信息表单验证
     */
    initSiteInfoValidation() {
        Validator.initValidation('#site-name', ['required', { maxLength: 50, message: '站点名称不能超过50字符' }]);
        Validator.initValidation('#site-title', [{ maxLength: 100, message: '站点标题不能超过100字符' }]);
        Validator.initValidation('#site-email', ['email']);
        Validator.initValidation('#site-desc', [{ maxLength: 200, message: '站点描述不能超过200字符' }]);
    },
    
    /**
     * 服务器表单验证
     */
    initServerValidation() {
        Validator.initValidation('#server-name', ['required', { maxLength: 50, message: '服务器名称不能超过50字符' }]);
        Validator.initValidation('#server-ip', ['required', 'ip']);
        Validator.initValidation('#server-port', ['port']);
    },
    
    /**
     * 社交链接表单验证
     */
    initSocialValidation() {
        Validator.initValidation('#social-website', ['url']);
        Validator.initValidation('#social-discord', ['url']);
        Validator.initValidation('#social-bilibili', ['url']);
        Validator.initValidation('#social-weibo', ['url']);
    }
};