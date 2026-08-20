import { z } from 'zod';
/**
 * Resolves all IP addresses for a hostname and checks if any are private
 */
export declare const isSafeHostname: (hostname: string) => Promise<boolean>;
export declare const registerSchema: z.ZodObject<{
    email: z.ZodString;
    phone: z.ZodOptional<z.ZodString>;
    code: z.ZodOptional<z.ZodString>;
    password: z.ZodString;
    confirmPassword: z.ZodOptional<z.ZodString>;
    username: z.ZodString;
    agree: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strict>;
export declare const usernameAvailabilitySchema: z.ZodObject<{
    username: z.ZodString;
}, z.core.$strip>;
export declare const verifyEmailSchema: z.ZodObject<{
    token: z.ZodString;
    email: z.ZodString;
}, z.core.$strip>;
export declare const loginSchema: z.ZodObject<{
    identifier: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodString>;
    password: z.ZodString;
}, z.core.$strict>;
export declare const devAuthLoginSchema: z.ZodObject<{
    username: z.ZodString;
    password: z.ZodString;
}, z.core.$strip>;
export declare const forgotPasswordSchema: z.ZodObject<{
    email: z.ZodString;
}, z.core.$strict>;
export declare const authCodeRequestSchema: z.ZodObject<{
    email: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodString>;
}, z.core.$strict>;
export declare const authCodeVerifySchema: z.ZodObject<{
    code: z.ZodString;
    email: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodString>;
}, z.core.$strict>;
export declare const resendVerificationSchema: z.ZodObject<{
    email: z.ZodString;
}, z.core.$strip>;
export declare const resetPasswordSchema: z.ZodObject<{
    token: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodString>;
    code: z.ZodOptional<z.ZodString>;
    password: z.ZodOptional<z.ZodString>;
    newPassword: z.ZodOptional<z.ZodString>;
    confirmPassword: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const resetPasswordCodeSchema: z.ZodObject<{
    email: z.ZodString;
    code: z.ZodString;
    password: z.ZodOptional<z.ZodString>;
    newPassword: z.ZodOptional<z.ZodString>;
    confirmPassword: z.ZodOptional<z.ZodString>;
}, z.core.$strict>;
export declare const resetPasswordTokenSchema: z.ZodObject<{
    token: z.ZodString;
    email: z.ZodOptional<z.ZodString>;
    password: z.ZodOptional<z.ZodString>;
    newPassword: z.ZodOptional<z.ZodString>;
    confirmPassword: z.ZodOptional<z.ZodString>;
}, z.core.$strict>;
export declare const changePasswordSchema: z.ZodObject<{
    email: z.ZodOptional<z.ZodString>;
    oldPassword: z.ZodOptional<z.ZodString>;
    currentPassword: z.ZodOptional<z.ZodString>;
    newPassword: z.ZodString;
    confirmPassword: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const uploadSchema: z.ZodObject<{
    filename: z.ZodOptional<z.ZodString>;
    dataUrl: z.ZodOptional<z.ZodString>;
    base64: z.ZodOptional<z.ZodString>;
    mime: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const saveDraftSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    content: z.ZodOptional<z.ZodString>;
    version: z.ZodOptional<z.ZodNumber>;
    seo_title: z.ZodOptional<z.ZodString>;
    seo_description: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const serverSchema: z.ZodObject<{
    name: z.ZodString;
    name_en: z.ZodOptional<z.ZodString>;
    thumbnail: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
    summary: z.ZodOptional<z.ZodString>;
    summary_en: z.ZodOptional<z.ZodString>;
    content_html: z.ZodOptional<z.ZodString>;
    ip: z.ZodOptional<z.ZodString>;
    group_number: z.ZodOptional<z.ZodString>;
    tags: z.ZodString;
    link: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
    activity: z.ZodOptional<z.ZodNumber>;
    owner_id: z.ZodOptional<z.ZodNumber>;
    platform: z.ZodOptional<z.ZodEnum<{
        java: "java";
        bedrock: "bedrock";
    }>>;
    category: z.ZodOptional<z.ZodString>;
    online_mode: z.ZodOptional<z.ZodBoolean>;
    supported_versions: z.ZodOptional<z.ZodString>;
    network_env: z.ZodOptional<z.ZodString>;
    listing_plan: z.ZodOptional<z.ZodEnum<{
        "basic-monthly": "basic-monthly";
        "pro-quarterly": "pro-quarterly";
        "vip-yearly": "vip-yearly";
    }>>;
}, z.core.$strip>;
export declare const rollbackSchema: z.ZodObject<{
    version: z.ZodNumber;
}, z.core.$strip>;
export declare const checkStatusQuerySchema: z.ZodObject<{
    host: z.ZodString;
    bedrock: z.ZodPipe<z.ZodOptional<z.ZodEnum<{
        true: "true";
        false: "false";
    }>>, z.ZodTransform<boolean, "true" | "false" | undefined>>;
    serverId: z.ZodPipe<z.ZodOptional<z.ZodString>, z.ZodTransform<number | undefined, string | undefined>>;
}, z.core.$strip>;
export declare const serverHistoryQuerySchema: z.ZodObject<{
    page: z.ZodPipe<z.ZodOptional<z.ZodString>, z.ZodTransform<number, string | undefined>>;
    limit: z.ZodPipe<z.ZodOptional<z.ZodString>, z.ZodTransform<number, string | undefined>>;
}, z.core.$strip>;
/** GET /servers/:id/versions/compare?old=&new= */
export declare const compareVersionsQuerySchema: z.ZodObject<{
    old: z.ZodPipe<z.ZodString, z.ZodTransform<number, string>>;
    new: z.ZodPipe<z.ZodString, z.ZodTransform<number, string>>;
}, z.core.$strip>;
export declare const serverCommentBodySchema: z.ZodObject<{
    body: z.ZodString;
}, z.core.$strip>;
export declare const playerHistoryQuerySchema: z.ZodObject<{
    range: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        "24h": "24h";
        "7d": "7d";
    }>>>;
}, z.core.$strip>;
export declare const auditQuerySchema: z.ZodObject<{
    page: z.ZodPipe<z.ZodOptional<z.ZodString>, z.ZodTransform<number, string | undefined>>;
    limit: z.ZodPipe<z.ZodOptional<z.ZodString>, z.ZodTransform<number, string | undefined>>;
    start: z.ZodPipe<z.ZodOptional<z.ZodString>, z.ZodTransform<number | undefined, string | undefined>>;
    end: z.ZodPipe<z.ZodOptional<z.ZodString>, z.ZodTransform<number | undefined, string | undefined>>;
    user: z.ZodPipe<z.ZodOptional<z.ZodString>, z.ZodTransform<number | undefined, string | undefined>>;
    action: z.ZodOptional<z.ZodString>;
    target: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
/**
 * Validate if the hostname is valid
 */
export declare const validateHost: (host: string) => {
    message: string;
} | null;
/**
 * Validate if a URL is safe (not pointing to a private address)
 */
export declare const validateUrl: (urlString: string) => {
    message: string;
} | null;
/**
 * Check if IP address is a private IP or local loopback address
 */
export declare const isPrivateIP: (ip: string) => boolean;
export declare const auditQuerySchemaFull: z.ZodObject<{
    target: z.ZodOptional<z.ZodString>;
    limit: z.ZodPipe<z.ZodOptional<z.ZodString>, z.ZodTransform<number, string | undefined>>;
}, z.core.$strip>;
export declare const metricsQuerySchema: z.ZodObject<{
    page: z.ZodPipe<z.ZodOptional<z.ZodString>, z.ZodTransform<number, string | undefined>>;
    size: z.ZodPipe<z.ZodOptional<z.ZodString>, z.ZodTransform<number, string | undefined>>;
    sortBy: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        timestamp: "timestamp";
        visits: "visits";
        active: "active";
        registered: "registered";
    }>>>;
    order: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        asc: "asc";
        desc: "desc";
    }>>>;
    start: z.ZodPipe<z.ZodOptional<z.ZodString>, z.ZodTransform<number | undefined, string | undefined>>;
    end: z.ZodPipe<z.ZodOptional<z.ZodString>, z.ZodTransform<number | undefined, string | undefined>>;
}, z.core.$strip>;
export declare const idParamSchema: z.ZodObject<{
    id: z.ZodPipe<z.ZodString, z.ZodTransform<number, string>>;
}, z.core.$strip>;
export declare const serverIdParamSchema: z.ZodObject<{
    serverId: z.ZodPipe<z.ZodString, z.ZodTransform<number, string>>;
}, z.core.$strip>;
export declare const userIdParamSchema: z.ZodObject<{
    userId: z.ZodPipe<z.ZodString, z.ZodTransform<number, string>>;
}, z.core.$strip>;
export declare const serverCommentDeleteParamSchema: z.ZodObject<{
    id: z.ZodPipe<z.ZodString, z.ZodTransform<number, string>>;
    commentId: z.ZodPipe<z.ZodString, z.ZodTransform<number, string>>;
}, z.core.$strip>;
export declare const reviewActionSchema: z.ZodObject<{
    status: z.ZodEnum<{
        APPROVED: "APPROVED";
        REJECTED: "REJECTED";
        NEEDS_REVISION: "NEEDS_REVISION";
        PENDING: "PENDING";
    }>;
    notes: z.ZodOptional<z.ZodString>;
    score: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export declare const batchReviewSchema: z.ZodObject<{
    serverIds: z.ZodArray<z.ZodNumber>;
    status: z.ZodEnum<{
        APPROVED: "APPROVED";
        REJECTED: "REJECTED";
        NEEDS_REVISION: "NEEDS_REVISION";
    }>;
    feedback: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const profileUpdateSchema: z.ZodObject<{
    username: z.ZodOptional<z.ZodString>;
    display_name: z.ZodOptional<z.ZodString>;
    avatar_url: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
    preferences: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodRecord<z.ZodString, z.ZodAny>]>>;
    bio_html: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
/** 兼容历史 Prisma UUID 会话与 SuperTokens session handle */
export declare const sessionIdParamSchema: z.ZodObject<{
    sessionId: z.ZodString;
}, z.core.$strip>;
export declare const ticketSchema: z.ZodObject<{
    title: z.ZodString;
    description: z.ZodString;
    priority: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        MEDIUM: "MEDIUM";
        LOW: "LOW";
        HIGH: "HIGH";
        URGENT: "URGENT";
    }>>>;
    paymentId: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const ticketMessageSchema: z.ZodObject<{
    content: z.ZodString;
}, z.core.$strip>;
export declare const ticketStatusSchema: z.ZodObject<{
    status: z.ZodEnum<{
        OPEN: "OPEN";
        IN_PROGRESS: "IN_PROGRESS";
        RESOLVED: "RESOLVED";
        CLOSED: "CLOSED";
    }>;
}, z.core.$strip>;
export declare const paymentCreateSchema: z.ZodObject<{
    amount: z.ZodOptional<z.ZodNumber>;
    planId: z.ZodString;
    marketplaceOrderId: z.ZodOptional<z.ZodString>;
    projectKey: z.ZodOptional<z.ZodString>;
    provider: z.ZodOptional<z.ZodEnum<{
        paypro: "paypro";
        xpay: "xpay";
        tpay: "tpay";
        hupijiao: "hupijiao";
    }>>;
    paymentMethod: z.ZodEnum<{
        balance: "balance";
        wechat: "wechat";
        alipay: "alipay";
    }>;
    currency: z.ZodDefault<z.ZodOptional<z.ZodString>>;
}, z.core.$strip>;
export declare const manualPaymentSchema: z.ZodObject<{
    orderId: z.ZodString;
}, z.core.$strip>;
export declare const paymentStatusParamSchema: z.ZodObject<{
    orderId: z.ZodString;
}, z.core.$strip>;
export declare const paymentCancelParamSchema: z.ZodObject<{
    orderId: z.ZodString;
}, z.core.$strip>;
export declare const permissionHistoryQuerySchema: z.ZodObject<{
    userId: z.ZodOptional<z.ZodPipe<z.ZodString, z.ZodTransform<number, string>>>;
    page: z.ZodPipe<z.ZodOptional<z.ZodString>, z.ZodTransform<number, string | undefined>>;
    limit: z.ZodPipe<z.ZodOptional<z.ZodString>, z.ZodTransform<number, string | undefined>>;
}, z.core.$strip>;
export declare const xpayNotifySchema: z.ZodObject<{
    type: z.ZodString;
    money: z.ZodString;
    mark: z.ZodString;
    dt: z.ZodString;
    sign: z.ZodString;
}, z.core.$strip>;
export declare const payProNotifySchema: z.ZodObject<{
    orderNo: z.ZodString;
    amount: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
    payNum: z.ZodString;
    sign: z.ZodString;
}, z.core.$strip>;
export declare const tpayNotifySchema: z.ZodObject<{
    order_no: z.ZodString;
    subject: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    pay_type: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
    money: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
    realmoney: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
    result: z.ZodString;
    xddpay_order: z.ZodString;
    app_id: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
    extra: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    sign: z.ZodString;
}, z.core.$strip>;
export declare const hupijiaoNotifySchema: z.ZodObject<{
    trade_order_id: z.ZodString;
    total_fee: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
    transaction_id: z.ZodString;
    open_order_id: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    order_title: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    status: z.ZodString;
    plugins: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    attach: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    appid: z.ZodString;
    time: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
    nonce_str: z.ZodString;
    hash: z.ZodString;
}, z.core.$loose>;
export declare const paginationQuerySchema: z.ZodPipe<z.ZodObject<{
    page: z.ZodPipe<z.ZodOptional<z.ZodString>, z.ZodTransform<number, string | undefined>>;
    limit: z.ZodPipe<z.ZodOptional<z.ZodString>, z.ZodTransform<number, string | undefined>>;
    search: z.ZodPipe<z.ZodOptional<z.ZodString>, z.ZodTransform<string | undefined, string | undefined>>;
    q: z.ZodPipe<z.ZodOptional<z.ZodString>, z.ZodTransform<string | undefined, string | undefined>>;
    tag: z.ZodOptional<z.ZodString>;
    bedrock: z.ZodOptional<z.ZodString>;
    host: z.ZodOptional<z.ZodString>;
    sortBy: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        name: "name";
        activity: "activity";
        updated: "updated";
        created: "created";
        players: "players";
    }>>>;
    sortOrder: z.ZodOptional<z.ZodEnum<{
        asc: "asc";
        desc: "desc";
    }>>;
    order: z.ZodOptional<z.ZodEnum<{
        asc: "asc";
        desc: "desc";
    }>>;
    version: z.ZodOptional<z.ZodString>;
    online: z.ZodOptional<z.ZodEnum<{
        true: "true";
        false: "false";
    }>>;
    status: z.ZodOptional<z.ZodEnum<{
        unknown: "unknown";
        online: "online";
        offline: "offline";
    }>>;
    category: z.ZodOptional<z.ZodString>;
    platform: z.ZodOptional<z.ZodEnum<{
        java: "java";
        bedrock: "bedrock";
        all: "all";
    }>>;
    online_mode: z.ZodOptional<z.ZodEnum<{
        all: "all";
        yes: "yes";
        no: "no";
    }>>;
    fuzzy: z.ZodPipe<z.ZodOptional<z.ZodEnum<{
        true: "true";
        false: "false";
    }>>, z.ZodTransform<boolean, "true" | "false" | undefined>>;
    startDate: z.ZodPipe<z.ZodOptional<z.ZodString>, z.ZodTransform<Date | undefined, string | undefined>>;
    endDate: z.ZodPipe<z.ZodOptional<z.ZodString>, z.ZodTransform<Date | undefined, string | undefined>>;
}, z.core.$strip>, z.ZodTransform<{
    search: string | undefined;
    sortOrder: "asc" | "desc";
    fuzzy: boolean;
    page: number;
    limit: number;
    q: string | undefined;
    sortBy: "name" | "activity" | "updated" | "created" | "players";
    startDate: Date | undefined;
    endDate: Date | undefined;
    tag?: string | undefined;
    bedrock?: string | undefined;
    host?: string | undefined;
    order?: "asc" | "desc" | undefined;
    version?: string | undefined;
    online?: "true" | "false" | undefined;
    status?: "unknown" | "online" | "offline" | undefined;
    category?: string | undefined;
    platform?: "java" | "bedrock" | "all" | undefined;
    online_mode?: "all" | "yes" | "no" | undefined;
}, {
    page: number;
    limit: number;
    search: string | undefined;
    q: string | undefined;
    sortBy: "name" | "activity" | "updated" | "created" | "players";
    fuzzy: boolean;
    startDate: Date | undefined;
    endDate: Date | undefined;
    tag?: string | undefined;
    bedrock?: string | undefined;
    host?: string | undefined;
    sortOrder?: "asc" | "desc" | undefined;
    order?: "asc" | "desc" | undefined;
    version?: string | undefined;
    online?: "true" | "false" | undefined;
    status?: "unknown" | "online" | "offline" | undefined;
    category?: string | undefined;
    platform?: "java" | "bedrock" | "all" | undefined;
    online_mode?: "all" | "yes" | "no" | undefined;
}>>;
export declare const setupSoleAdminSchema: z.ZodObject<{
    targetUsername: z.ZodOptional<z.ZodString>;
    targetEmail: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const userRoleUpdateSchema: z.ZodObject<{
    role: z.ZodString;
}, z.core.$strip>;
export declare const userEmailVerificationUpdateSchema: z.ZodObject<{
    email_verified: z.ZodBoolean;
}, z.core.$strip>;
export declare const auditLogQuerySchema: z.ZodPipe<z.ZodObject<{
    action: z.ZodOptional<z.ZodString>;
    userId: z.ZodPipe<z.ZodOptional<z.ZodString>, z.ZodTransform<number | undefined, string | undefined>>;
    search: z.ZodPipe<z.ZodOptional<z.ZodString>, z.ZodTransform<string | undefined, string | undefined>>;
    q: z.ZodPipe<z.ZodOptional<z.ZodString>, z.ZodTransform<string | undefined, string | undefined>>;
    startDate: z.ZodPipe<z.ZodOptional<z.ZodString>, z.ZodTransform<Date | undefined, string | undefined>>;
    endDate: z.ZodPipe<z.ZodOptional<z.ZodString>, z.ZodTransform<Date | undefined, string | undefined>>;
    level: z.ZodOptional<z.ZodString>;
    sortBy: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        created_at: "created_at";
        action: "action";
    }>>>;
    sortOrder: z.ZodOptional<z.ZodEnum<{
        asc: "asc";
        desc: "desc";
    }>>;
    order: z.ZodOptional<z.ZodEnum<{
        asc: "asc";
        desc: "desc";
    }>>;
    page: z.ZodPipe<z.ZodOptional<z.ZodString>, z.ZodTransform<number, string | undefined>>;
    limit: z.ZodPipe<z.ZodOptional<z.ZodString>, z.ZodTransform<number, string | undefined>>;
}, z.core.$strip>, z.ZodTransform<{
    search: string | undefined;
    sortOrder: "asc" | "desc";
    userId: number | undefined;
    q: string | undefined;
    startDate: Date | undefined;
    endDate: Date | undefined;
    sortBy: "created_at" | "action";
    page: number;
    limit: number;
    action?: string | undefined;
    level?: string | undefined;
    order?: "asc" | "desc" | undefined;
}, {
    userId: number | undefined;
    search: string | undefined;
    q: string | undefined;
    startDate: Date | undefined;
    endDate: Date | undefined;
    sortBy: "created_at" | "action";
    page: number;
    limit: number;
    action?: string | undefined;
    level?: string | undefined;
    sortOrder?: "asc" | "desc" | undefined;
    order?: "asc" | "desc" | undefined;
}>>;
export declare const assignPermissionGroupSchema: z.ZodObject<{
    group: z.ZodString;
}, z.core.$strip>;
export declare const batchAssignPermissionGroupSchema: z.ZodObject<{
    userIds: z.ZodArray<z.ZodNumber>;
    group: z.ZodString;
}, z.core.$strip>;
export declare const updateModerationSettingSchema: z.ZodObject<{
    key: z.ZodString;
    value: z.ZodOptional<z.ZodAny>;
    isSecret: z.ZodOptional<z.ZodBoolean>;
    description: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const moderationLogQuerySchema: z.ZodObject<{
    status: z.ZodOptional<z.ZodString>;
    type: z.ZodOptional<z.ZodString>;
    contentType: z.ZodOptional<z.ZodString>;
    page: z.ZodPipe<z.ZodOptional<z.ZodString>, z.ZodTransform<number, string | undefined>>;
    limit: z.ZodPipe<z.ZodOptional<z.ZodString>, z.ZodTransform<number, string | undefined>>;
}, z.core.$strip>;
export declare const reviewModerationLogSchema: z.ZodObject<{
    status: z.ZodEnum<{
        REJECTED: "REJECTED";
        PASSED: "PASSED";
    }>;
    reason: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const updateModerationConfigSchema: z.ZodObject<{
    enabled: z.ZodOptional<z.ZodBoolean>;
    threshold: z.ZodOptional<z.ZodNumber>;
    imageThreshold: z.ZodOptional<z.ZodNumber>;
    apiKey: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const preferencesUpdateSchema: z.ZodObject<{
    theme: z.ZodOptional<z.ZodEnum<{
        minimal: "minimal";
        system: "system";
        light: "light";
        dark: "dark";
        classic: "classic";
        monitoring: "monitoring";
        random: "random";
    }>>;
    language: z.ZodOptional<z.ZodEnum<{
        en: "en";
        zh: "zh";
    }>>;
    emailNotifications: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export declare const staticDataQuerySchema: z.ZodObject<{
    page: z.ZodPipe<z.ZodOptional<z.ZodString>, z.ZodTransform<number, string | undefined>>;
    limit: z.ZodPipe<z.ZodOptional<z.ZodString>, z.ZodTransform<number, string | undefined>>;
}, z.core.$strip>;
export declare const port5555LogQuerySchema: z.ZodObject<{
    page: z.ZodPipe<z.ZodOptional<z.ZodString>, z.ZodTransform<number, string | undefined>>;
    limit: z.ZodPipe<z.ZodOptional<z.ZodString>, z.ZodTransform<number, string | undefined>>;
    search: z.ZodOptional<z.ZodString>;
    action: z.ZodOptional<z.ZodString>;
    method: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<{
        success: "success";
        failed: "failed";
    }>>;
    startDate: z.ZodOptional<z.ZodString>;
    endDate: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const port5555ExportSchema: z.ZodObject<{
    format: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        json: "json";
        csv: "csv";
    }>>>;
    search: z.ZodOptional<z.ZodString>;
    method: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<{
        success: "success";
        failed: "failed";
    }>>;
    startDate: z.ZodOptional<z.ZodString>;
    endDate: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const port5555CleanupSchema: z.ZodObject<{
    retentionDays: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, z.core.$strip>;
export declare const port5555DetailsSchema: z.ZodObject<{
    ip_address: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    userAgent: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    path: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    method: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    sessionId: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const myServersQuerySchema: z.ZodPipe<z.ZodObject<{
    page: z.ZodPipe<z.ZodOptional<z.ZodString>, z.ZodTransform<number, string | undefined>>;
    limit: z.ZodPipe<z.ZodOptional<z.ZodString>, z.ZodTransform<number, string | undefined>>;
    search: z.ZodPipe<z.ZodOptional<z.ZodString>, z.ZodTransform<string | undefined, string | undefined>>;
    q: z.ZodPipe<z.ZodOptional<z.ZodString>, z.ZodTransform<string | undefined, string | undefined>>;
    reviewStatus: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        APPROVED: "APPROVED";
        REJECTED: "REJECTED";
        NEEDS_REVISION: "NEEDS_REVISION";
        PENDING: "PENDING";
        all: "all";
    }>>>;
    sortBy: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        name: "name";
        created_at: "created_at";
        updated_at: "updated_at";
        activity: "activity";
    }>>>;
    sortOrder: z.ZodOptional<z.ZodEnum<{
        asc: "asc";
        desc: "desc";
    }>>;
    order: z.ZodOptional<z.ZodEnum<{
        asc: "asc";
        desc: "desc";
    }>>;
    fuzzy: z.ZodPipe<z.ZodOptional<z.ZodEnum<{
        true: "true";
        false: "false";
    }>>, z.ZodTransform<boolean, "true" | "false" | undefined>>;
    startDate: z.ZodPipe<z.ZodOptional<z.ZodString>, z.ZodTransform<Date | undefined, string | undefined>>;
    endDate: z.ZodPipe<z.ZodOptional<z.ZodString>, z.ZodTransform<Date | undefined, string | undefined>>;
}, z.core.$strip>, z.ZodTransform<{
    search: string | undefined;
    sortOrder: "asc" | "desc";
    fuzzy: boolean;
    page: number;
    limit: number;
    q: string | undefined;
    reviewStatus: "APPROVED" | "REJECTED" | "NEEDS_REVISION" | "PENDING" | "all";
    sortBy: "name" | "created_at" | "updated_at" | "activity";
    startDate: Date | undefined;
    endDate: Date | undefined;
    order?: "asc" | "desc" | undefined;
}, {
    page: number;
    limit: number;
    search: string | undefined;
    q: string | undefined;
    reviewStatus: "APPROVED" | "REJECTED" | "NEEDS_REVISION" | "PENDING" | "all";
    sortBy: "name" | "created_at" | "updated_at" | "activity";
    fuzzy: boolean;
    startDate: Date | undefined;
    endDate: Date | undefined;
    sortOrder?: "asc" | "desc" | undefined;
    order?: "asc" | "desc" | undefined;
}>>;
export declare const cmsPaginationQuerySchema: z.ZodObject<{
    page: z.ZodPipe<z.ZodOptional<z.ZodString>, z.ZodTransform<number, string | undefined>>;
    limit: z.ZodPipe<z.ZodOptional<z.ZodString>, z.ZodTransform<number, string | undefined>>;
}, z.core.$strip>;
export declare const cmsGetPageQuerySchema: z.ZodObject<{
    lock: z.ZodPipe<z.ZodOptional<z.ZodString>, z.ZodTransform<boolean, string | undefined>>;
}, z.core.$strip>;
export declare const paymentQuerySchema: z.ZodPipe<z.ZodObject<{
    page: z.ZodPipe<z.ZodOptional<z.ZodString>, z.ZodTransform<number, string | undefined>>;
    limit: z.ZodPipe<z.ZodOptional<z.ZodString>, z.ZodTransform<number, string | undefined>>;
    search: z.ZodPipe<z.ZodOptional<z.ZodString>, z.ZodTransform<string | undefined, string | undefined>>;
    q: z.ZodPipe<z.ZodOptional<z.ZodString>, z.ZodTransform<string | undefined, string | undefined>>;
    fuzzy: z.ZodPipe<z.ZodOptional<z.ZodEnum<{
        true: "true";
        false: "false";
    }>>, z.ZodTransform<boolean, "true" | "false" | undefined>>;
    status: z.ZodOptional<z.ZodString>;
    planId: z.ZodOptional<z.ZodString>;
    userId: z.ZodPipe<z.ZodOptional<z.ZodString>, z.ZodTransform<number | undefined, string | undefined>>;
    sortBy: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        status: "status";
        created_at: "created_at";
        updated_at: "updated_at";
        amount: "amount";
    }>>>;
    sortOrder: z.ZodOptional<z.ZodEnum<{
        asc: "asc";
        desc: "desc";
    }>>;
    order: z.ZodOptional<z.ZodEnum<{
        asc: "asc";
        desc: "desc";
    }>>;
    startDate: z.ZodPipe<z.ZodOptional<z.ZodString>, z.ZodTransform<Date | undefined, string | undefined>>;
    endDate: z.ZodPipe<z.ZodOptional<z.ZodString>, z.ZodTransform<Date | undefined, string | undefined>>;
}, z.core.$strip>, z.ZodTransform<{
    search: string | undefined;
    fuzzy: boolean;
    sortOrder: "asc" | "desc";
    page: number;
    limit: number;
    q: string | undefined;
    userId: number | undefined;
    sortBy: "status" | "created_at" | "updated_at" | "amount";
    startDate: Date | undefined;
    endDate: Date | undefined;
    status?: string | undefined;
    planId?: string | undefined;
    order?: "asc" | "desc" | undefined;
}, {
    page: number;
    limit: number;
    search: string | undefined;
    q: string | undefined;
    fuzzy: boolean;
    userId: number | undefined;
    sortBy: "status" | "created_at" | "updated_at" | "amount";
    startDate: Date | undefined;
    endDate: Date | undefined;
    status?: string | undefined;
    planId?: string | undefined;
    sortOrder?: "asc" | "desc" | undefined;
    order?: "asc" | "desc" | undefined;
}>>;
export declare const userQuerySchema: z.ZodPipe<z.ZodObject<{
    page: z.ZodPipe<z.ZodOptional<z.ZodString>, z.ZodTransform<number, string | undefined>>;
    limit: z.ZodPipe<z.ZodOptional<z.ZodString>, z.ZodTransform<number, string | undefined>>;
    search: z.ZodPipe<z.ZodOptional<z.ZodString>, z.ZodTransform<string | undefined, string | undefined>>;
    q: z.ZodPipe<z.ZodOptional<z.ZodString>, z.ZodTransform<string | undefined, string | undefined>>;
    role: z.ZodOptional<z.ZodString>;
    status: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        all: "all";
        verified: "verified";
        unverified: "unverified";
    }>>>;
    sortBy: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        email: "email";
        created_at: "created_at";
        username: "username";
        last_login_at: "last_login_at";
    }>>>;
    sortOrder: z.ZodOptional<z.ZodEnum<{
        asc: "asc";
        desc: "desc";
    }>>;
    order: z.ZodOptional<z.ZodEnum<{
        asc: "asc";
        desc: "desc";
    }>>;
    fuzzy: z.ZodPipe<z.ZodOptional<z.ZodEnum<{
        true: "true";
        false: "false";
    }>>, z.ZodTransform<boolean, "true" | "false" | undefined>>;
    startDate: z.ZodPipe<z.ZodOptional<z.ZodString>, z.ZodTransform<Date | undefined, string | undefined>>;
    endDate: z.ZodPipe<z.ZodOptional<z.ZodString>, z.ZodTransform<Date | undefined, string | undefined>>;
}, z.core.$strip>, z.ZodTransform<{
    search: string | undefined;
    sortOrder: "asc" | "desc";
    fuzzy: boolean;
    page: number;
    limit: number;
    q: string | undefined;
    status: "all" | "verified" | "unverified";
    sortBy: "email" | "created_at" | "username" | "last_login_at";
    startDate: Date | undefined;
    endDate: Date | undefined;
    role?: string | undefined;
    order?: "asc" | "desc" | undefined;
}, {
    page: number;
    limit: number;
    search: string | undefined;
    q: string | undefined;
    status: "all" | "verified" | "unverified";
    sortBy: "email" | "created_at" | "username" | "last_login_at";
    fuzzy: boolean;
    startDate: Date | undefined;
    endDate: Date | undefined;
    role?: string | undefined;
    sortOrder?: "asc" | "desc" | undefined;
    order?: "asc" | "desc" | undefined;
}>>;
export declare const bioVersionQuerySchema: z.ZodObject<{
    page: z.ZodPipe<z.ZodOptional<z.ZodString>, z.ZodTransform<number, string | undefined>>;
    limit: z.ZodPipe<z.ZodOptional<z.ZodString>, z.ZodTransform<number, string | undefined>>;
}, z.core.$strip>;
export declare const ticketQuerySchema: z.ZodPipe<z.ZodObject<{
    page: z.ZodPipe<z.ZodOptional<z.ZodString>, z.ZodTransform<number, string | undefined>>;
    limit: z.ZodPipe<z.ZodOptional<z.ZodString>, z.ZodTransform<number, string | undefined>>;
    status: z.ZodOptional<z.ZodEnum<{
        OPEN: "OPEN";
        IN_PROGRESS: "IN_PROGRESS";
        RESOLVED: "RESOLVED";
        CLOSED: "CLOSED";
    }>>;
    priority: z.ZodOptional<z.ZodEnum<{
        MEDIUM: "MEDIUM";
        LOW: "LOW";
        HIGH: "HIGH";
        URGENT: "URGENT";
    }>>;
    search: z.ZodPipe<z.ZodOptional<z.ZodString>, z.ZodTransform<string | undefined, string | undefined>>;
    q: z.ZodPipe<z.ZodOptional<z.ZodString>, z.ZodTransform<string | undefined, string | undefined>>;
    fuzzy: z.ZodPipe<z.ZodOptional<z.ZodEnum<{
        true: "true";
        false: "false";
    }>>, z.ZodTransform<boolean, "true" | "false" | undefined>>;
    sortBy: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        status: "status";
        created_at: "created_at";
        updated_at: "updated_at";
        priority: "priority";
    }>>>;
    sortOrder: z.ZodOptional<z.ZodEnum<{
        asc: "asc";
        desc: "desc";
    }>>;
    order: z.ZodOptional<z.ZodEnum<{
        asc: "asc";
        desc: "desc";
    }>>;
    startDate: z.ZodPipe<z.ZodOptional<z.ZodString>, z.ZodTransform<Date | undefined, string | undefined>>;
    endDate: z.ZodPipe<z.ZodOptional<z.ZodString>, z.ZodTransform<Date | undefined, string | undefined>>;
}, z.core.$strip>, z.ZodTransform<{
    search: string | undefined;
    fuzzy: boolean;
    sortOrder: "asc" | "desc";
    page: number;
    limit: number;
    q: string | undefined;
    sortBy: "status" | "created_at" | "updated_at" | "priority";
    startDate: Date | undefined;
    endDate: Date | undefined;
    status?: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED" | undefined;
    priority?: "MEDIUM" | "LOW" | "HIGH" | "URGENT" | undefined;
    order?: "asc" | "desc" | undefined;
}, {
    page: number;
    limit: number;
    search: string | undefined;
    q: string | undefined;
    fuzzy: boolean;
    sortBy: "status" | "created_at" | "updated_at" | "priority";
    startDate: Date | undefined;
    endDate: Date | undefined;
    status?: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED" | undefined;
    priority?: "MEDIUM" | "LOW" | "HIGH" | "URGENT" | undefined;
    sortOrder?: "asc" | "desc" | undefined;
    order?: "asc" | "desc" | undefined;
}>>;
export declare const aiChatSchema: z.ZodObject<{
    message: z.ZodString;
    context: z.ZodOptional<z.ZodString>;
    language: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        en: "en";
        zh: "zh";
    }>>>;
    clientMeta: z.ZodOptional<z.ZodObject<{
        routeHash: z.ZodOptional<z.ZodString>;
        isMobileViewport: z.ZodOptional<z.ZodBoolean>;
        viewport: z.ZodOptional<z.ZodString>;
        activeIntegrationIds: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
        sceneNote: z.ZodOptional<z.ZodString>;
        profileHint: z.ZodOptional<z.ZodObject<{
            level: z.ZodOptional<z.ZodNumber>;
            role: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const visitSchema: z.ZodObject<{
    page: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const visitStatsQuerySchema: z.ZodObject<{
    days: z.ZodPipe<z.ZodOptional<z.ZodString>, z.ZodTransform<number, string | undefined>>;
}, z.core.$strip>;
export declare const auditStatsQuerySchema: z.ZodObject<{
    days: z.ZodPipe<z.ZodOptional<z.ZodString>, z.ZodTransform<number, string | undefined>>;
}, z.core.$strip>;
export declare const auditTimeSeriesQuerySchema: z.ZodObject<{
    days: z.ZodPipe<z.ZodOptional<z.ZodString>, z.ZodTransform<number, string | undefined>>;
    interval: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        hour: "hour";
        day: "day";
    }>>>;
}, z.core.$strip>;
export declare const auditReportSchema: z.ZodObject<{
    startDate: z.ZodOptional<z.ZodString>;
    endDate: z.ZodOptional<z.ZodString>;
    format: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        json: "json";
        csv: "csv";
    }>>>;
    reportType: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        custom: "custom";
        daily: "daily";
        weekly: "weekly";
        monthly: "monthly";
    }>>>;
}, z.core.$strip>;
export declare const port5555BatchOperationsSchema: z.ZodObject<{
    operations: z.ZodArray<z.ZodObject<{
        type: z.ZodString;
        payload: z.ZodOptional<z.ZodAny>;
        priority: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const port5555ErrorTestQuerySchema: z.ZodObject<{
    type: z.ZodOptional<z.ZodEnum<{
        session: "session";
        permission: "permission";
        rate_limit: "rate_limit";
    }>>;
}, z.core.$strip>;
export declare const auditCleanupSchema: z.ZodObject<{
    days: z.ZodPipe<z.ZodOptional<z.ZodString>, z.ZodTransform<number, string | undefined>>;
}, z.core.$strip>;
export declare const auditExportSchema: z.ZodObject<{
    format: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        json: "json";
        csv: "csv";
    }>>>;
    startDate: z.ZodOptional<z.ZodString>;
    endDate: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const reviewQuerySchema: z.ZodObject<{
    sortBy: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        name: "name";
        created_at: "created_at";
        updated_at: "updated_at";
    }>>>;
    sortOrder: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        asc: "asc";
        desc: "desc";
    }>>>;
    page: z.ZodPipe<z.ZodOptional<z.ZodString>, z.ZodTransform<number, string | undefined>>;
    limit: z.ZodPipe<z.ZodOptional<z.ZodString>, z.ZodTransform<number, string | undefined>>;
}, z.core.$strip>;
export declare const walletRechargeSchema: z.ZodObject<{
    amount: z.ZodNumber;
    targetUserId: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export declare const walletTransactionQuerySchema: z.ZodObject<{
    page: z.ZodPipe<z.ZodOptional<z.ZodString>, z.ZodTransform<number, string | undefined>>;
    limit: z.ZodPipe<z.ZodOptional<z.ZodString>, z.ZodTransform<number, string | undefined>>;
}, z.core.$strip>;
export declare const walletRedeemSchema: z.ZodObject<{
    code: z.ZodString;
}, z.core.$strip>;
export declare const adminCreateRedeemCodeSchema: z.ZodObject<{
    code: z.ZodString;
    amount: z.ZodNumber;
    maxUses: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    nonWithdrawable: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    expiresAt: z.ZodOptional<z.ZodString>;
    note: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const adminGenerateRedeemCodeSchema: z.ZodObject<{
    amount: z.ZodNumber;
    maxUses: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    nonWithdrawable: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    expiresAt: z.ZodOptional<z.ZodString>;
    note: z.ZodOptional<z.ZodString>;
    length: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, z.core.$strip>;
export declare const adminRedeemCodeListQuerySchema: z.ZodObject<{
    q: z.ZodOptional<z.ZodString>;
    page: z.ZodPipe<z.ZodOptional<z.ZodString>, z.ZodTransform<number, string | undefined>>;
    limit: z.ZodPipe<z.ZodOptional<z.ZodString>, z.ZodTransform<number, string | undefined>>;
}, z.core.$strip>;
export declare const mcStatusDirectTestSchema: z.ZodObject<{
    host: z.ZodString;
    type: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        java: "java";
        bedrock: "bedrock";
    }>>>;
}, z.core.$strip>;
export declare const paymentStatsQuerySchema: z.ZodObject<{
    days: z.ZodPipe<z.ZodOptional<z.ZodString>, z.ZodTransform<number, string | undefined>>;
}, z.core.$strip>;
export declare const port5555StatsQuerySchema: z.ZodObject<{
    days: z.ZodPipe<z.ZodOptional<z.ZodString>, z.ZodTransform<number, string | undefined>>;
}, z.core.$strip>;
//# sourceMappingURL=validation.d.ts.map