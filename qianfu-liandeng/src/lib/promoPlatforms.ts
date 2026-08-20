export const PROMO_PLATFORM_IDS = ['bilibili', 'douyin', 'kuaishou', 'xiaohongshu', 'weibo'] as const;

export type PromoPlatformId = (typeof PROMO_PLATFORM_IDS)[number];

export interface PromoPlatformConfig {
  value: PromoPlatformId;
  label: string;
  shortLabel: string;
  idLabel: string;
  idPlaceholder: string;
  description: string;
  verificationHint: string;
  validateUserId: (value: string) => boolean;
}

const accountIdPattern = /^[A-Za-z0-9._:-]{2,128}$/;
const numericIdPattern = /^\d{1,20}$/;

export const PROMO_PLATFORMS: PromoPlatformConfig[] = [
  {
    value: 'bilibili',
    label: '哔哩哔哩',
    shortLabel: 'B站',
    idLabel: '哔哩哔哩 UID',
    idPlaceholder: '例如：2293237813',
    description: '使用空间主页公开 UID',
    verificationHint: '把验证码放入个人简介或公开动态，再粘贴公开页面链接。',
    validateUserId: (value) => numericIdPattern.test(value),
  },
  {
    value: 'douyin',
    label: '抖音',
    shortLabel: '抖音',
    idLabel: '抖音号或用户 ID',
    idPlaceholder: '请输入公开主页显示的抖音号',
    description: '不要填写昵称，优先填写抖音号',
    verificationHint: '把验证码放入公开简介或公开视频文案，再粘贴公开链接。',
    validateUserId: (value) => accountIdPattern.test(value),
  },
  {
    value: 'kuaishou',
    label: '快手',
    shortLabel: '快手',
    idLabel: '快手号或用户 ID',
    idPlaceholder: '请输入公开主页显示的快手号',
    description: '使用可唯一定位账号的公开标识',
    verificationHint: '把验证码放入公开简介或公开视频文案，再粘贴公开链接。',
    validateUserId: (value) => accountIdPattern.test(value),
  },
  {
    value: 'xiaohongshu',
    label: '小红书',
    shortLabel: '小红书',
    idLabel: '小红书号或用户 ID',
    idPlaceholder: '请输入公开主页显示的小红书号',
    description: '不要只填写展示昵称',
    verificationHint: '把验证码放入公开简介或公开笔记，再粘贴公开链接。',
    validateUserId: (value) => accountIdPattern.test(value),
  },
  {
    value: 'weibo',
    label: '微博',
    shortLabel: '微博',
    idLabel: '微博 UID',
    idPlaceholder: '请输入数字 UID',
    description: '使用个人主页数字 UID',
    verificationHint: '把验证码放入公开简介或公开微博，再粘贴公开链接。',
    validateUserId: (value) => numericIdPattern.test(value),
  },
];

export const getPromoPlatform = (value: string): PromoPlatformConfig => (
  PROMO_PLATFORMS.find((platform) => platform.value === value) || PROMO_PLATFORMS[0]
);

export const getPromoPlatformLabel = (value: string): string => getPromoPlatform(value).label;

export const validatePromoPlatformUserId = (platform: string, rawValue: string): string | null => {
  const value = rawValue.trim();
  if (!value) return '请填写平台账号的唯一标识。';
  const config = getPromoPlatform(platform);
  if (!config.validateUserId(value)) {
    return `${config.idLabel}格式不正确，请不要填写主页链接或展示昵称。`;
  }
  return null;
};
