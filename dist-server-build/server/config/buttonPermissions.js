/**
 * 按钮级权限定义
 *
 * 命名规范: btn:<module>:<action>
 * - module: 模块名 (server, user, review, payment, config, etc.)
 * - action: 操作名 (create, edit, delete, view, approve, reject, etc.)
 */
export const BUTTON_PERMISSIONS = {
    // ===== 服务器模块 =====
    'btn:server:publish': {
        name: '发布服务器',
        description: '发布新服务器',
        category: 'server',
        dangerLevel: 0,
    },
    'btn:server:edit': {
        name: '编辑服务器',
        description: '编辑服务器信息',
        category: 'server',
        dangerLevel: 1,
    },
    'btn:server:delete': {
        name: '删除服务器',
        description: '删除服务器',
        category: 'server',
        dangerLevel: 3,
    },
    'btn:server:review': {
        name: '审核服务器',
        description: '审核通过/拒绝服务器',
        category: 'server',
        dangerLevel: 2,
    },
    'btn:server:featured': {
        name: '推荐服务器',
        description: '设置服务器为精选/推荐',
        category: 'server',
        dangerLevel: 2,
    },
    // ===== 用户管理模块 =====
    'btn:user:view': {
        name: '查看用户',
        description: '查看用户信息',
        category: 'user',
        dangerLevel: 0,
    },
    'btn:user:edit': {
        name: '编辑用户',
        description: '编辑用户信息',
        category: 'user',
        dangerLevel: 2,
    },
    'btn:user:delete': {
        name: '删除用户',
        description: '删除用户账户',
        category: 'user',
        dangerLevel: 3,
    },
    'btn:user:ban': {
        name: '封禁用户',
        description: '封禁/解封用户',
        category: 'user',
        dangerLevel: 3,
    },
    'btn:user:assign_role': {
        name: '分配角色',
        description: '分配用户角色和权限组',
        category: 'user',
        dangerLevel: 3,
    },
    // ===== 支付模块 =====
    'btn:payment:view': {
        name: '查看支付',
        description: '查看支付记录',
        category: 'payment',
        dangerLevel: 0,
    },
    'btn:payment:refund': {
        name: '退款',
        description: '执行退款操作',
        category: 'payment',
        dangerLevel: 3,
    },
    'btn:payment:adjust': {
        name: '调整金额',
        description: '手动调整支付金额',
        category: 'payment',
        dangerLevel: 3,
    },
    // ===== 系统配置模块 =====
    'btn:config:view': {
        name: '查看配置',
        description: '查看系统配置',
        category: 'config',
        dangerLevel: 0,
    },
    'btn:config:edit': {
        name: '编辑配置',
        description: '修改系统配置',
        category: 'config',
        dangerLevel: 3,
    },
    'btn:config:server_settings': {
        name: '服务器设置',
        description: '修改服务器相关设置',
        category: 'config',
        dangerLevel: 2,
    },
    // ===== 推广活动模块 =====
    'btn:promo:create': {
        name: '创建活动',
        description: '创建推广活动',
        category: 'promo',
        dangerLevel: 1,
    },
    'btn:promo:edit': {
        name: '编辑活动',
        description: '编辑推广活动',
        category: 'promo',
        dangerLevel: 2,
    },
    'btn:promo:delete': {
        name: '删除活动',
        description: '删除推广活动',
        category: 'promo',
        dangerLevel: 3,
    },
    'btn:promo:audit': {
        name: '审核领取',
        description: '审核用户领取记录',
        category: 'promo',
        dangerLevel: 2,
    },
    // ===== 客服工单模块 =====
    'btn:ticket:view': {
        name: '查看工单',
        description: '查看所有客服工单',
        category: 'ticket',
        dangerLevel: 0,
    },
    'btn:ticket:reply': {
        name: '回复工单',
        description: '回复用户工单',
        category: 'ticket',
        dangerLevel: 1,
    },
    'btn:ticket:close': {
        name: '关闭工单',
        description: '关闭/删除工单',
        category: 'ticket',
        dangerLevel: 2,
    },
    // ===== 举报管理模块 =====
    'btn:report:view': {
        name: '查看举报',
        description: '查看所有举报记录',
        category: 'report',
        dangerLevel: 0,
    },
    'btn:report:handle': {
        name: '处理举报',
        description: '处理举报内容',
        category: 'report',
        dangerLevel: 2,
    },
    // ===== 内容管理模块 =====
    'btn:content:edit': {
        name: '编辑内容',
        description: '编辑页面内容',
        category: 'content',
        dangerLevel: 1,
    },
    'btn:content:publish': {
        name: '发布内容',
        description: '发布页面内容',
        category: 'content',
        dangerLevel: 2,
    },
    // ===== API Key 管理 =====
    'btn:apikey:create': {
        name: '创建API Key',
        description: '创建新的API密钥',
        category: 'apikey',
        dangerLevel: 1,
    },
    'btn:apikey:revoke': {
        name: '撤销API Key',
        description: '撤销API密钥',
        category: 'apikey',
        dangerLevel: 3,
    },
    // ===== 数据导出 =====
    'btn:data:export': {
        name: '导出数据',
        description: '导出系统数据',
        category: 'data',
        dangerLevel: 2,
    },
};
/**
 * 按钮权限管理器
 */
export class ButtonPermissionManager {
    static permissionMap = new Map(Object.entries(BUTTON_PERMISSIONS));
    /**
     * 获取所有按钮权限
     */
    static getAllPermissions() {
        return { ...BUTTON_PERMISSIONS };
    }
    /**
     * 获取按分类分组的权限
     */
    static getPermissionsByCategory() {
        const grouped = {};
        for (const [id, perm] of Object.entries(BUTTON_PERMISSIONS)) {
            if (!grouped[perm.category]) {
                grouped[perm.category] = [];
            }
            grouped[perm.category].push({
                id: id,
                ...perm,
            });
        }
        return grouped;
    }
    /**
     * 检查用户是否拥有指定按钮权限
     */
    static hasButtonPermission(userPermissions, buttonPermissionId, isAdmin = false) {
        if (isAdmin)
            return true;
        return userPermissions.includes(buttonPermissionId);
    }
    /**
     * 检查用户是否拥有多个按钮权限（全部满足）
     */
    static hasAllButtonPermissions(userPermissions, buttonPermissionIds, isAdmin = false) {
        if (isAdmin)
            return true;
        return buttonPermissionIds.every(id => userPermissions.includes(id));
    }
    /**
     * 检查用户是否拥有多个按钮权限（满足任意一个即可）
     */
    static hasAnyButtonPermission(userPermissions, buttonPermissionIds, isAdmin = false) {
        if (isAdmin)
            return true;
        return buttonPermissionIds.some(id => userPermissions.includes(id));
    }
    /**
     * 根据权限组自动分配按钮权限
     * 这是将角色权限映射到按钮权限的辅助方法
     */
    static getDefaultButtonPermissionsByRole(role) {
        const rolePermissionMap = {
            // 普通用户 - 无按钮权限（按钮权限主要是管理功能）
            NORMAL: [],
            VISITOR: [],
            COLLABORATOR: [
                'btn:server:publish',
            ],
            SPONSOR: [],
            CONTRIBUTOR: [
                'btn:server:publish',
            ],
            // 运营人员
            OPERATOR: [
                'btn:server:review',
                'btn:server:featured',
                'btn:report:view',
                'btn:report:handle',
                'btn:ticket:view',
                'btn:ticket:reply',
                'btn:content:edit',
                'btn:content:publish',
            ],
            // 管理员 - 全部权限
            ADMIN: Object.keys(BUTTON_PERMISSIONS),
            // 所有者 - 全部权限
            OWNER: Object.keys(BUTTON_PERMISSIONS),
        };
        return rolePermissionMap[role] || [];
    }
    /**
     * 验证权限 ID 是否合法
     */
    static isValidPermission(permissionId) {
        return permissionId in BUTTON_PERMISSIONS;
    }
    /**
     * 获取权限的危险等级描述
     */
    static getDangerLevelDescription(dangerLevel) {
        const descriptions = {
            0: '安全操作',
            1: '低风险操作',
            2: '中等风险操作',
            3: '高风险操作',
        };
        return descriptions[dangerLevel] || '未知风险';
    }
}
//# sourceMappingURL=buttonPermissions.js.map