/**
 * Store 模块 - 状态管理
 * 管理应用状态，支持订阅变更
 */
const Store = {
    // 状态存储
    _state: {
        content: null,
        system: null,
        loading: false,
        error: null,
        currentTab: 0
    },
    
    // 订阅者列表
    _subscribers: [],
    
    /**
     * 获取当前状态
     * @param {string} key - 状态键，可选
     */
    get(key) {
        return key ? this._state[key] : { ...this._state };
    },
    
    /**
     * 设置状态
     * @param {string|object} key - 键或对象
     * @param {any} value - 值
     */
    set(key, value) {
        if (typeof key === 'object') {
            this._state = { ...this._state, ...key };
        } else {
            this._state[key] = value;
        }
        this._notify();
    },
    
    /**
     * 订阅状态变更
     * @param {function} callback - 回调函数
     * @returns {function} 取消订阅函数
     */
    subscribe(callback) {
        this._subscribers.push(callback);
        return () => {
            this._subscribers = this._subscribers.filter(cb => cb !== callback);
        };
    },
    
    /**
     * 通知所有订阅者
     */
    _notify() {
        this._subscribers.forEach(cb => cb(this._state));
    },
    
    /**
     * 异步加载所有数据
     */
    async loadAll() {
        this.set({ loading: true, error: null });
        try {
            const [content, system] = await Promise.all([
                API.getContent(),
                API.getSystem()
            ]);
            this.set({ content, system, loading: false });
            return true;
        } catch (err) {
            this.set({ error: err.message, loading: false });
            return false;
        }
    },
    
    /**
     * 保存内容
     * @param {object} data - 内容数据
     */
    async saveContent(data) {
        this.set({ loading: true, error: null });
        try {
            await API.saveContent(data);
            this.set({ content: data, loading: false });
            return true;
        } catch (err) {
            this.set({ error: err.message, loading: false });
            return false;
        }
    },
    
    /**
     * 保存系统设置
     * @param {object} data - 系统数据
     */
    async saveSystem(data) {
        this.set({ loading: true, error: null });
        try {
            await API.saveSystem(data);
            this.set({ system: data, loading: false });
            return true;
        } catch (err) {
            this.set({ error: err.message, loading: false });
            return false;
        }
    }
};