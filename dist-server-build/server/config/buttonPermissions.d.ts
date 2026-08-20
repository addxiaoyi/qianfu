/**
 * 按钮级权限定义
 *
 * 命名规范: btn:<module>:<action>
 * - module: 模块名 (server, user, review, payment, config, etc.)
 * - action: 操作名 (create, edit, delete, view, approve, reject, etc.)
 */
export declare const BUTTON_PERMISSIONS: {
    readonly 'btn:server:publish': {
        readonly name: "发布服务器";
        readonly description: "发布新服务器";
        readonly category: "server";
        readonly dangerLevel: 0;
    };
    readonly 'btn:server:edit': {
        readonly name: "编辑服务器";
        readonly description: "编辑服务器信息";
        readonly category: "server";
        readonly dangerLevel: 1;
    };
    readonly 'btn:server:delete': {
        readonly name: "删除服务器";
        readonly description: "删除服务器";
        readonly category: "server";
        readonly dangerLevel: 3;
    };
    readonly 'btn:server:review': {
        readonly name: "审核服务器";
        readonly description: "审核通过/拒绝服务器";
        readonly category: "server";
        readonly dangerLevel: 2;
    };
    readonly 'btn:server:featured': {
        readonly name: "推荐服务器";
        readonly description: "设置服务器为精选/推荐";
        readonly category: "server";
        readonly dangerLevel: 2;
    };
    readonly 'btn:user:view': {
        readonly name: "查看用户";
        readonly description: "查看用户信息";
        readonly category: "user";
        readonly dangerLevel: 0;
    };
    readonly 'btn:user:edit': {
        readonly name: "编辑用户";
        readonly description: "编辑用户信息";
        readonly category: "user";
        readonly dangerLevel: 2;
    };
    readonly 'btn:user:delete': {
        readonly name: "删除用户";
        readonly description: "删除用户账户";
        readonly category: "user";
        readonly dangerLevel: 3;
    };
    readonly 'btn:user:ban': {
        readonly name: "封禁用户";
        readonly description: "封禁/解封用户";
        readonly category: "user";
        readonly dangerLevel: 3;
    };
    readonly 'btn:user:assign_role': {
        readonly name: "分配角色";
        readonly description: "分配用户角色和权限组";
        readonly category: "user";
        readonly dangerLevel: 3;
    };
    readonly 'btn:payment:view': {
        readonly name: "查看支付";
        readonly description: "查看支付记录";
        readonly category: "payment";
        readonly dangerLevel: 0;
    };
    readonly 'btn:payment:refund': {
        readonly name: "退款";
        readonly description: "执行退款操作";
        readonly category: "payment";
        readonly dangerLevel: 3;
    };
    readonly 'btn:payment:adjust': {
        readonly name: "调整金额";
        readonly description: "手动调整支付金额";
        readonly category: "payment";
        readonly dangerLevel: 3;
    };
    readonly 'btn:config:view': {
        readonly name: "查看配置";
        readonly description: "查看系统配置";
        readonly category: "config";
        readonly dangerLevel: 0;
    };
    readonly 'btn:config:edit': {
        readonly name: "编辑配置";
        readonly description: "修改系统配置";
        readonly category: "config";
        readonly dangerLevel: 3;
    };
    readonly 'btn:config:server_settings': {
        readonly name: "服务器设置";
        readonly description: "修改服务器相关设置";
        readonly category: "config";
        readonly dangerLevel: 2;
    };
    readonly 'btn:promo:create': {
        readonly name: "创建活动";
        readonly description: "创建推广活动";
        readonly category: "promo";
        readonly dangerLevel: 1;
    };
    readonly 'btn:promo:edit': {
        readonly name: "编辑活动";
        readonly description: "编辑推广活动";
        readonly category: "promo";
        readonly dangerLevel: 2;
    };
    readonly 'btn:promo:delete': {
        readonly name: "删除活动";
        readonly description: "删除推广活动";
        readonly category: "promo";
        readonly dangerLevel: 3;
    };
    readonly 'btn:promo:audit': {
        readonly name: "审核领取";
        readonly description: "审核用户领取记录";
        readonly category: "promo";
        readonly dangerLevel: 2;
    };
    readonly 'btn:ticket:view': {
        readonly name: "查看工单";
        readonly description: "查看所有客服工单";
        readonly category: "ticket";
        readonly dangerLevel: 0;
    };
    readonly 'btn:ticket:reply': {
        readonly name: "回复工单";
        readonly description: "回复用户工单";
        readonly category: "ticket";
        readonly dangerLevel: 1;
    };
    readonly 'btn:ticket:close': {
        readonly name: "关闭工单";
        readonly description: "关闭/删除工单";
        readonly category: "ticket";
        readonly dangerLevel: 2;
    };
    readonly 'btn:report:view': {
        readonly name: "查看举报";
        readonly description: "查看所有举报记录";
        readonly category: "report";
        readonly dangerLevel: 0;
    };
    readonly 'btn:report:handle': {
        readonly name: "处理举报";
        readonly description: "处理举报内容";
        readonly category: "report";
        readonly dangerLevel: 2;
    };
    readonly 'btn:content:edit': {
        readonly name: "编辑内容";
        readonly description: "编辑页面内容";
        readonly category: "content";
        readonly dangerLevel: 1;
    };
    readonly 'btn:content:publish': {
        readonly name: "发布内容";
        readonly description: "发布页面内容";
        readonly category: "content";
        readonly dangerLevel: 2;
    };
    readonly 'btn:apikey:create': {
        readonly name: "创建API Key";
        readonly description: "创建新的API密钥";
        readonly category: "apikey";
        readonly dangerLevel: 1;
    };
    readonly 'btn:apikey:revoke': {
        readonly name: "撤销API Key";
        readonly description: "撤销API密钥";
        readonly category: "apikey";
        readonly dangerLevel: 3;
    };
    readonly 'btn:data:export': {
        readonly name: "导出数据";
        readonly description: "导出系统数据";
        readonly category: "data";
        readonly dangerLevel: 2;
    };
};
export type ButtonPermissionId = keyof typeof BUTTON_PERMISSIONS;
export interface ButtonPermission {
    name: string;
    description: string;
    category: string;
    dangerLevel: 0 | 1 | 2 | 3;
}
/**
 * 按钮权限管理器
 */
export declare class ButtonPermissionManager {
    private static permissionMap;
    /**
     * 获取所有按钮权限
     */
    static getAllPermissions(): Record<string, ButtonPermission>;
    /**
     * 获取按分类分组的权限
     */
    static getPermissionsByCategory(): Record<string, ButtonPermission[]>;
    /**
     * 检查用户是否拥有指定按钮权限
     */
    static hasButtonPermission(userPermissions: string[], buttonPermissionId: ButtonPermissionId, isAdmin?: boolean): boolean;
    /**
     * 检查用户是否拥有多个按钮权限（全部满足）
     */
    static hasAllButtonPermissions(userPermissions: string[], buttonPermissionIds: ButtonPermissionId[], isAdmin?: boolean): boolean;
    /**
     * 检查用户是否拥有多个按钮权限（满足任意一个即可）
     */
    static hasAnyButtonPermission(userPermissions: string[], buttonPermissionIds: ButtonPermissionId[], isAdmin?: boolean): boolean;
    /**
     * 根据权限组自动分配按钮权限
     * 这是将角色权限映射到按钮权限的辅助方法
     */
    static getDefaultButtonPermissionsByRole(role: string): ButtonPermissionId[];
    /**
     * 验证权限 ID 是否合法
     */
    static isValidPermission(permissionId: string): permissionId is ButtonPermissionId;
    /**
     * 获取权限的危险等级描述
     */
    static getDangerLevelDescription(dangerLevel: number): string;
}
//# sourceMappingURL=buttonPermissions.d.ts.map