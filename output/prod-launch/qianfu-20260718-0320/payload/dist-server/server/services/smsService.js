import axios from 'axios';
import { logger } from '../utils/logger.js';
function getConfig() {
    const provider = process.env.SMS_PROVIDER || 'aliyun';
    return {
        provider,
        aliyun: {
            accessKeyId: process.env.ALIBABA_ACCESS_KEY_ID || '',
            accessKeySecret: process.env.ALIBABA_ACCESS_KEY_SECRET || '',
            signName: process.env.ALIBABA_SIGN_NAME || '千服',
            templateCode: process.env.ALIBABA_TEMPLATE_CODE || '',
        },
        tencent: {
            secretId: process.env.TENCENT_SECRET_ID || '',
            secretKey: process.env.TENCENT_SECRET_KEY || '',
            appId: process.env.TENCENT_APP_ID || '',
            signName: process.env.TENCENT_SIGN_NAME || '千服',
            templateId: process.env.TENCENT_TEMPLATE_ID || '',
            sdkAppId: process.env.TENCENT_SDK_APP_ID || '',
            region: process.env.TENCENT_REGION || 'ap-guangzhou',
        },
        twilio: {
            accountSid: process.env.TWILIO_ACCOUNT_SID || '',
            authToken: process.env.TWILIO_AUTH_TOKEN || '',
            phoneNumber: process.env.TWILIO_PHONE_NUMBER || '',
        },
    };
}
/**
 * 阿里云 SMS 发送
 */
async function sendViaAliyun(to, code) {
    const config = getConfig();
    if (!config.aliyun.accessKeyId || !config.aliyun.accessKeySecret) {
        logger.warn('[SmsService] 阿里云 SMS 未配置，跳过发送');
        return;
    }
    const timestamp = new Date().toISOString();
    const params = new URLSearchParams({
        AccessKeyId: config.aliyun.accessKeyId,
        Action: 'SendSms',
        Format: 'JSON',
        RegionId: 'cn-hangzhou',
        PhoneNumbers: to,
        SignName: config.aliyun.signName,
        TemplateCode: config.aliyun.templateCode,
        TemplateParam: JSON.stringify({ code }),
        Timestamp: timestamp,
        Version: '2017-05-25',
    });
    const stringToSign = `GET&%2F&${encodeURIComponent(params.toString())}`;
    const crypto = await import('crypto');
    const signature = crypto
        .createHmac('sha1', `${config.aliyun.accessKeySecret}&`)
        .update(stringToSign)
        .digest('base64');
    try {
        const response = await axios.get('https://dysmsapi.aliyuncs.com/', {
            params: { ...params, Signature: signature },
            timeout: 10000,
        });
        const data = response.data;
        if (data.Code !== 'OK') {
            logger.error(`[SmsService] 阿里云 SMS 发送失败: Code=${data.Code}, Message=${data.Message}`);
        }
        else {
            logger.info(`[SmsService] 阿里云 SMS 发送成功 to=${to}`);
        }
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.error(`[SmsService] 阿里云 SMS 发送异常: ${msg}`);
    }
}
/**
 * 腾讯云 SMS 发送
 */
async function sendViaTencent(to, code) {
    const config = getConfig();
    if (!config.tencent.secretId || !config.tencent.secretKey) {
        logger.warn('[SmsService] 腾讯云 SMS 未配置，跳过发送');
        return;
    }
    const crypto = await import('crypto');
    const nonce = Math.floor(Math.random() * 100000);
    const timestamp = Math.floor(Date.now() / 1000);
    const actions = {
        SmsSdkAppId: config.tencent.sdkAppId || config.tencent.appId,
        SignName: config.tencent.signName,
        TemplateId: config.tencent.templateId,
        TemplateParamList: [code],
        PhoneNumberSet: [to],
        SessionId: `qianfu-${timestamp}`,
    };
    const payload = JSON.stringify(actions);
    const params = new URLSearchParams({
        Action: 'SendSMS',
        Version: '2021-01-11',
        Region: config.tencent.region,
        Timestamp: String(timestamp),
        Nonce: String(nonce),
        SecretId: config.tencent.secretId,
        SignatureMethod: 'HmacSHA256',
    });
    const stringToSign = `POST\ncossms.api.qcloud.com/v2/index.php?${params.toString()}&${encodeURIComponent(payload)}`;
    const signature = crypto
        .createHmac('sha256', config.tencent.secretKey)
        .update(stringToSign)
        .digest('hex');
    try {
        const response = await axios.post('https://ssr.api.qcloud.com/v2/index.php', { ...Object.fromEntries(params), Signature: signature, ...actions }, { timeout: 10000 });
        const data = response.data;
        if (data.code !== 0 || data.codeDescription !== 'success') {
            logger.error(`[SmsService] 腾讯云 SMS 发送失败: ${JSON.stringify(data)}`);
        }
        else {
            logger.info(`[SmsService] 腾讯云 SMS 发送成功 to=${to}`);
        }
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.error(`[SmsService] 腾讯云 SMS 发送异常: ${msg}`);
    }
}
/**
 * Twilio SMS 发送
 */
async function sendViaTwilio(to, code) {
    const config = getConfig();
    if (!config.twilio.accountSid || !config.twilio.authToken) {
        logger.warn('[SmsService] Twilio SMS 未配置，跳过发送');
        return;
    }
    const messageBody = `【${process.env.BRAND_NAME || '千服'}】您的验证码是：${code}，10 分钟内有效。请勿泄露给他人。`;
    try {
        await axios.post(`https://api.twilio.com/2010-04-01/Accounts/${config.twilio.accountSid}/Messages.json`, new URLSearchParams({
            From: config.twilio.phoneNumber,
            To: to.startsWith('+') ? to : `+${to}`,
            Body: messageBody,
        }), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            auth: {
                username: config.twilio.accountSid,
                password: config.twilio.authToken,
            },
            timeout: 10000,
        });
        logger.info(`[SmsService] Twilio SMS 发送成功 to=${to}`);
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.error(`[SmsService] Twilio SMS 发送异常: ${msg}`);
    }
}
/**
 * 发送短信验证码（统一入口）
 */
export async function sendSmsCode(options) {
    const { to, code } = options;
    const config = getConfig();
    if (process.env.NODE_ENV === 'test') {
        logger.info(`[SmsService] [TEST MODE] Code for ${to}: ${code}`);
        return;
    }
    switch (config.provider) {
        case 'tencent':
            await sendViaTencent(to, code);
            break;
        case 'twilio':
            await sendViaTwilio(to, code);
            break;
        default:
            await sendViaAliyun(to, code);
    }
}
/**
 * 发送登录验证码（快捷方法）
 */
export async function sendPhoneLoginCode(phone, code) {
    await sendSmsCode({
        to: phone,
        code,
        brandName: process.env.BRAND_NAME || '千服',
    });
}
//# sourceMappingURL=smsService.js.map