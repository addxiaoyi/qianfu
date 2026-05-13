/**
 * 短信验证码发送服务
 *
 * 支持多种 SMS 提供商：
 * - 阿里云 SMS（默认）
 * - 腾讯云 SMS
 * - Twilio
 *
 * 配置环境变量：
 * - SMS_PROVIDER: "aliyun" | "tencent" | "twilio" (默认 aliyun)
 * - ALIBABA_ACCESS_KEY_ID
 * - ALIBABA_ACCESS_KEY_SECRET
 * - ALIBABA_SIGN_NAME
 * - ALIBABA_TEMPLATE_CODE
 * - TENCENT_SECRET_ID
 * - TENCENT_SECRET_KEY
 * - TENCENT_APP_ID
 * - TENCENT_SIGN_NAME
 * - TENCENT_TEMPLATE_ID
 * - TWILIO_ACCOUNT_SID
 * - TWILIO_AUTH_TOKEN
 * - TWILIO_PHONE_NUMBER
 */
export interface SmsSendOptions {
    to: string;
    code: string;
    brandName?: string;
}
/**
 * 发送短信验证码（统一入口）
 */
export declare function sendSmsCode(options: SmsSendOptions): Promise<void>;
/**
 * 发送登录验证码（快捷方法）
 */
export declare function sendPhoneLoginCode(phone: string, code: string): Promise<void>;
//# sourceMappingURL=smsService.d.ts.map