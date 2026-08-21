import React from 'react';
import { Link } from 'react-router-dom';
import LegalDocument, { LegalSection } from '@/components/layout/LegalDocument';

const Terms: React.FC = () => (
  <LegalDocument
    eyebrow="LEGAL / TERMS"
    title="千服联灯服务条款"
    summary="本条款适用于千服联灯提供的 Minecraft 服务器发现、免费发布、状态展示、内容审核、举报和工单支持服务。平台不提供交易、收费、资金账户或商业推广服务。"
  >
    <LegalSection id="scope" title="1. 条款范围与接受">
      <p>“平台”指千服联灯网站、应用界面、接口及相关服务；“用户”包括访客、注册用户、服务器发布者和其他使用者。</p>
      <p>访问平台、注册账户或提交内容，即表示您已阅读并同意本条款、隐私声明和平台公布的内容规则。法律法规另有强制性规定的，从其规定。</p>
    </LegalSection>

    <LegalSection id="services" title="2. 平台服务边界">
      <p>平台仅提供服务器信息展示、免费服务器发布、公开状态查询、新闻公告、内容审核、举报和工单支持。服务器是否真实可用由发布者负责，平台不对外部服务器作运营或履约保证。</p>
      <p>平台不提供交易、资金收付、余额记账、数字商品交付、付费置顶、返利任务或其他商业撮合功能。任何页面、接口或旧链接出现相关内容，均不代表平台开放该能力。</p>
    </LegalSection>

    <LegalSection id="account" title="3. 账户与安全">
      <p>您应提供真实、准确、完整且保持更新的账户资料，不得冒用他人身份、批量注册、买卖账户或绕过验证和安全措施。</p>
      <p>请妥善保管登录凭据、验证码和设备。发现账户异常时，应立即修改凭据并通过工单或邮件联系平台。</p>
    </LegalSection>

    <LegalSection id="content" title="4. 用户内容与服务器信息">
      <p>您应确保服务器名称、地址、版本、截图、介绍、活动和在线状态真实、合法、及时，不得虚构在线人数、伪造评价、恶意刷量或冒充其他服务器。</p>
      <p>您保留对合法上传内容所享有的权利。为展示、审核、搜索和提供平台服务，您授予平台必要范围内的非独占使用许可。平台可以调整展示格式、添加风险提示、暂停展示或要求补充证明。</p>
      <p>不得发布违法、侵权、欺诈、色情、赌博、恶意软件、未成年人不宜或危害网络安全的内容，不得攻击、扫描、干扰平台或未经授权收集他人个人信息。</p>
    </LegalSection>

    <LegalSection id="moderation" title="5. 审核、举报与处置">
      <p>平台可基于用户举报、自动规则和人工审核，对内容采取要求修改、暂缓发布、降低展示、下架、限制账户或终止服务等措施。</p>
      <p>审核不代表平台对服务器内容、外部链接或第三方服务的真实性、合法性和安全性作出担保。用户可以通过工单提交事实、证明和整改说明。</p>
    </LegalSection>

    <LegalSection id="availability" title="6. 服务可用性与责任">
      <p>平台会采取合理措施维护服务连续性和数据安全，但维护、网络故障、第三方服务异常、不可抗力、监管要求或安全事件可能导致暂时不可用。</p>
      <p>平台仅在法律允许范围内对因自身过错直接造成且可合理预见的实际损失承担责任。用户自行运营服务器、发布外部链接或提交违法内容产生的责任由相应责任方依法承担。</p>
    </LegalSection>

    <LegalSection id="privacy" title="7. 个人信息保护">
      <p>平台按照<Link href="/privacy">《隐私声明》</Link>处理个人信息，并仅在提供账户、审核、展示、举报和支持服务所需范围内使用相关信息。</p>
    </LegalSection>

    <LegalSection id="changes" title="8. 条款更新与联系">
      <p>平台可能因法律变化、安全需要或服务调整更新本条款。重大变化会通过页面提示、站内通知或其他合理方式告知。</p>
      <p>账户、内容审核、举报或申诉问题，可通过平台工单或发送邮件至 <a className="font-bold text-foreground underline underline-offset-4" href="mailto:support@0st.top">support@0st.top</a> 联系。请勿发送密码、验证码或其他不必要的敏感信息。</p>
    </LegalSection>
  </LegalDocument>
);

export default Terms;
