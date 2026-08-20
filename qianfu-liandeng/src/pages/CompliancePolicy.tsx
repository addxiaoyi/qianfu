import React from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import LegalDocument, { LegalSection } from '@/components/layout/LegalDocument';

export type CompliancePolicyDefinition = {
  path: string;
  title: string;
  eyebrow: string;
  summary: string;
  sections: Array<{
    id: string;
    title: string;
    paragraphs?: string[];
    bullets?: string[];
  }>;
};

export const policyDefinitions: CompliancePolicyDefinition[] = [
  {
    path: '/acceptable-use',
    title: '可接受使用政策',
    eyebrow: 'Acceptable Use',
    summary: '说明平台允许的使用范围、禁止内容、禁止行为、审核处置和申诉渠道。',
    sections: [
      {
        id: 'scope',
        title: '1. 服务范围',
        paragraphs: [
          '千服联灯仅提供 Minecraft 服务器信息展示、免费发布、公开状态查询、新闻公告、内容审核、举报和工单支持。',
          '平台不提供支付、充值、钱包、商城交易、数字商品交付、付费推广或返利服务。',
        ],
      },
      {
        id: 'content',
        title: '2. 禁止内容',
        bullets: [
          '不得发布色情、性剥削、未成年人不当、仇恨、威胁、极端暴力、自残鼓励或恐怖主义内容。',
          '不得发布恶意软件、凭据窃取、钓鱼工具、勒索软件、隐藏后门或要求关闭安全控制才能运行的文件。',
          '不得发布违法、侵权、冒充官方、虚假宣传或侵犯他人隐私的服务器资料、图片、链接和公告。',
        ],
      },
      {
        id: 'conduct',
        title: '3. 禁止行为',
        bullets: [
          '不得欺诈、冒充、骚扰、发送垃圾信息、未授权访问、利用漏洞、攻击服务器或实施 DDoS。',
          '不得绕过认证、速率限制、审核、账户限制或其他技术防护，不得操纵投票、评价、玩家数量和公开统计。',
          '不得抓取、共享账户、转售凭据或诱导用户向站外提供密码、验证码和无关身份材料。',
        ],
      },
      {
        id: 'enforcement',
        title: '4. 审核、处置与申诉',
        paragraphs: [
          '平台可以使用自动规则、人工审核、举报和安全信号评估内容与账户，并可要求修改、暂缓发布、降低展示、下架、限制账户或终止服务。',
          '对处置结果有异议时，可通过平台工单或 support@0st.top 提交事实、证明和整改说明。请勿发送密码、API 密钥或验证码。',
        ],
      },
    ],
  },
  {
    path: '/minor-protection',
    title: '未成年人保护规则',
    eyebrow: 'Minor Protection',
    summary: '说明未成年人注册、内容接触、监护人协助和个人信息保护要求。',
    sections: [
      {
        id: 'scope',
        title: '1. 适用范围与基本原则',
        paragraphs: [
          '平台面向 Minecraft 玩家和服主提供信息服务。未成年人使用平台时，应在监护人知情和指导下进行。',
          '平台不得以诱导、攀比、抽奖暗示或虚假稀缺刺激非理性行为。',
        ],
      },
      {
        id: 'registration',
        title: '2. 注册与监护人协助',
        bullets: [
          '用户应提供真实、准确且必要的信息，不得冒用他人身份。',
          '未成年人遇到账户、内容或安全问题时，可由监护人通过工单或邮件申请协助。',
          '平台仅在实现保护目的所必需的范围内处理未成年人及监护人信息。',
        ],
      },
      {
        id: 'content',
        title: '3. 内容与互动保护',
        bullets: [
          '禁止欺凌、侮辱、性暗示、暴力威胁、诱骗提供隐私或引导线下危险接触的内容。',
          '平台可以对涉嫌侵害未成年人权益的内容采取屏蔽、下架、限制账户、保全证据和依法报告等措施。',
        ],
      },
      {
        id: 'contact',
        title: '4. 联系与申诉',
        paragraphs: [
          '监护人可以通过工单或 support@0st.top 申请查询、限制或删除未成年人信息。为防止冒领，平台可以要求必要的身份和监护关系证明。',
        ],
      },
    ],
  },
  {
    path: '/cookies-and-services',
    title: 'Cookie 与第三方服务清单',
    eyebrow: 'Cookies & Services',
    summary: '披露必要 Cookie、本地存储、基础设施服务和数据处理用途。',
    sections: [
      {
        id: 'cookies',
        title: '1. 必要 Cookie 与本地存储',
        bullets: [
          '登录与会话：维持登录状态、识别会话和防止未授权访问。',
          '安全与 CSRF：验证请求来源、防止跨站请求伪造和重复提交。',
          '偏好设置：保存主题、语言和界面模式等用户主动选择。',
        ],
      },
      {
        id: 'non-essential',
        title: '2. 非必要追踪规则',
        paragraphs: [
          '平台不得在未披露用途和法律依据的情况下启用广告画像、跨站追踪或出售个人信息。新增非必要分析服务前，应更新本清单并在需要时取得用户同意。',
          '拒绝非必要 Cookie 不应影响登录、安全、服务器浏览、发布和工单等核心功能。',
        ],
      },
      {
        id: 'vendors',
        title: '3. 第三方服务类别',
        bullets: [
          '邮件服务：发送验证码、安全和工单通知，处理收件地址、模板变量和投递状态。',
          '基础设施服务：提供域名、证书、网络、主机、数据库、缓存、对象存储或安全防护。',
          '内容安全服务：在启用时用于恶意文件、图片、文本、侵权或滥用检测，仅传输必要数据。',
        ],
      },
      {
        id: 'control',
        title: '4. 用户控制与联系',
        paragraphs: [
          '用户可以通过浏览器设置清理 Cookie 或本地存储；清理必要数据可能导致退出登录或需要重新验证。对数据处理有疑问，可通过 support@0st.top 联系平台。',
        ],
      },
    ],
  },
  {
    path: '/prohibited-items',
    title: '平台禁止内容清单',
    eyebrow: 'Prohibited Content',
    summary: '列明不得在平台发布、推广或展示的违法、恶意、侵权和高风险内容。',
    sections: [
      {
        id: 'illegal',
        title: '1. 违法与高风险内容',
        bullets: [
          '违法犯罪工具、危险物品、赌博博彩、洗钱、套现或其他受管制内容。',
          '色情、性剥削、未成年人不当、仇恨极端主义、暴力恐怖或现实伤害内容。',
          '窃取、买卖或泄露个人信息、账号凭据、身份材料和通信记录。',
        ],
      },
      {
        id: 'security',
        title: '2. 恶意与滥用型内容',
        bullets: [
          '木马、病毒、后门、勒索软件、凭据窃取、僵尸网络、DDoS、挖矿或规避安全检测工具。',
          '用于未授权入侵、破坏服务器、批量滥用、垃圾信息或作弊的脚本和服务。',
          '隐藏真实行为、混淆恶意代码或要求关闭安全软件后运行的文件。',
        ],
      },
      {
        id: 'ip',
        title: '3. 侵权与欺诈内容',
        bullets: [
          '盗版插件、模组、地图、材质、整合包、源代码、密钥、账号或未经授权的二次发布。',
          '冒充官方、平台、作者或其他用户，使用未经许可的商标、品牌和素材。',
          '功能、版本、授权、销量、评价或兼容性存在重大虚假陈述的内容。',
        ],
      },
      {
        id: 'enforcement',
        title: '4. 处置',
        paragraphs: [
          '平台可拒绝发布、下架内容、限制账户、保全证据并依法报告。发布者对内容合法性和授权承担责任；平台审核不构成对外部服务器或链接的保证。',
        ],
      },
    ],
  },
  {
    path: '/ip-complaints',
    title: '知识产权投诉规则',
    eyebrow: 'Intellectual Property',
    summary: '说明权利人投诉、证据要求、临时处置、反通知和重复侵权处理。',
    sections: [
      {
        id: 'submission',
        title: '1. 投诉材料',
        bullets: [
          '权利人或授权代理人的身份、联系方式和权利证明。',
          '涉嫌侵权内容的准确地址、截图、文件或页面标识，以及侵权事实说明。',
          '投诉人对材料真实性、完整性和授权范围的声明。',
        ],
      },
      {
        id: 'action',
        title: '2. 受理与处置',
        paragraphs: [
          '平台会在材料足以定位内容时进行初步核验，并可采取限制展示、暂缓发布、下架、保全证据和通知相关用户等措施。',
        ],
      },
      {
        id: 'counter',
        title: '3. 反通知与复核',
        paragraphs: [
          '被通知用户可以提交不侵权说明、授权证明或整改材料。平台会结合双方材料和适用规则复核；复杂争议仍应由有权机关或当事人依法解决。',
        ],
      },
      {
        id: 'repeat',
        title: '4. 重复侵权',
        paragraphs: [
          '对多次发布已确认侵权内容、拒不整改或恶意规避处置的账户，平台可以限制发布、冻结相关内容或终止服务。',
        ],
      },
    ],
  },
  {
    path: '/reporting-rules',
    title: '举报与内容处置规则',
    eyebrow: 'Reporting & Moderation',
    summary: '说明举报入口、风险分级、处置措施、通知、申诉和防报复要求。',
    sections: [
      {
        id: 'report',
        title: '1. 举报入口与材料',
        bullets: [
          '可通过服务器详情页举报入口、平台工单或 support@0st.top 提交线索。',
          '尽量提供内容地址、涉及账户、发生时间、截图和可核验的事实说明。',
          '不得提交恶意举报、伪造材料或以举报为由骚扰他人。',
        ],
      },
      {
        id: 'risk',
        title: '2. 风险分级',
        bullets: [
          '紧急风险：现实人身危险、未成年人侵害、恶意软件或大规模数据泄露，优先限制传播并升级处理。',
          '高风险：违法、侵权、欺诈、账号安全和持续骚扰，优先人工复核并保全证据。',
          '一般风险：资料不实、重复内容、格式问题或社区争议，按队列处理并通知整改。',
        ],
      },
      {
        id: 'actions',
        title: '3. 处置措施',
        bullets: [
          '警告、要求整改、限制展示、隐藏、下架、限制发布、限制登录或终止服务。',
          '保全日志和证据，并在法律要求或必要范围内向主管机关、权利人或基础设施服务商提供信息。',
          '对明显误报、证据不足或不构成违规的举报予以驳回。',
        ],
      },
      {
        id: 'appeal',
        title: '4. 通知、申诉与防报复',
        paragraphs: [
          '除法律禁止或可能妨碍调查外，平台会说明规则依据和申诉渠道。申诉应由未参与原决定或具备复核权限的人员处理。禁止对善意举报人、证人或投诉人进行威胁、骚扰和报复。',
        ],
      },
    ],
  },
];

const policyByPath = new Map(policyDefinitions.map((policy) => [policy.path, policy]));

const CompliancePolicyPage: React.FC = () => {
  const location = useLocation();
  const policy = policyByPath.get(location.pathname);

  if (!policy) {
    return <Navigate to="/compliance" replace />;
  }

  return (
    <LegalDocument eyebrow={policy.eyebrow} title={policy.title} summary={policy.summary}>
      <div className="rounded-xl border border-border bg-muted/40 px-5 py-4 text-sm font-medium leading-7 text-muted-foreground">
        <Link className="font-bold text-foreground underline underline-offset-4" to="/compliance">查看全部合规与信息服务规则</Link>
      </div>
      {policy.sections.map((section) => (
        <LegalSection key={section.id} id={section.id} title={section.title}>
          {section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          {section.bullets?.length ? (
            <ul className="list-disc space-y-2 pl-5">
              {section.bullets.map((item) => <li key={item}>{item}</li>)}
            </ul>
          ) : null}
        </LegalSection>
      ))}
    </LegalDocument>
  );
};

export default CompliancePolicyPage;
