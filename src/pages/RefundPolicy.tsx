import React from 'react';
import LegalDocument, { LegalSection } from '@/components/layout/LegalDocument';

const RefundPolicy: React.FC = () => (
  <LegalDocument
    eyebrow="LEGAL / SERVICE BOUNDARY"
    title="千服联灯商业服务关闭说明"
    summary="千服联灯当前处于个人备案模式，仅提供服务器发现、免费发布、内容审核、举报和工单支持等非交易性信息服务。"
  >
    <LegalSection id="scope" title="1. 当前服务范围">
      <p>平台不提供支付、充值、钱包、商城、订单、数字商品、付费推广、订阅、返利或其他商业交易服务。</p>
      <p>服务器发现、公开资料展示、免费发布、新闻公告、内容审核、举报和工单支持不向用户收取平台服务费。</p>
    </LegalSection>

    <LegalSection id="legacy-links" title="2. 历史链接与关闭状态">
      <p>历史页面、搜索缓存或第三方文档中的收费、订单或退款描述不代表当前平台能力。关闭的商业入口会显示功能不可用或返回 PERSONAL_FILING_DISABLED。</p>
      <p>请勿向任何个人账户或第三方提供声称代表平台的款项。</p>
    </LegalSection>

    <LegalSection id="contact" title="3. 反馈与联系">
      <p>如发现页面仍显示支付、钱包、商城或推广内容，请通过工单或 <a className="font-bold text-foreground underline underline-offset-4" href="mailto:support@0st.top">support@0st.top</a> 提交页面地址和截图。</p>
      <p>请勿发送密码、验证码、完整身份证件或其他不必要的敏感信息。</p>
    </LegalSection>
  </LegalDocument>
);

export default RefundPolicy;
