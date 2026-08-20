import React from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, Mail } from 'lucide-react';
import { useT } from '@/store/uiStore';
import LanternLogo from '@/components/ui/LanternLogo';

const ICP_LINK = 'https://beian.miit.gov.cn/';
const ICP_LABEL = '苏ICP备2026025306号-2';

interface FooterProps {
  backendReady?: boolean;
  backendHealthLoading?: boolean;
  backendHealthError?: boolean;
}

const footerLinkClass = 'text-sm font-bold text-muted-foreground hover:text-black transition-colors';

const Footer: React.FC<FooterProps> = ({
  backendReady = true,
  backendHealthLoading = false,
  backendHealthError = false,
}) => {
  const t = useT();
  const footerStatus = backendHealthLoading
    ? { label: t('footer.status.checking'), textClass: 'text-zinc-500', dotClass: 'bg-zinc-400' }
    : backendHealthError || !backendReady
      ? { label: t('footer.status.degraded'), textClass: 'text-amber-600', dotClass: 'bg-amber-500' }
      : { label: t('footer.status.normal'), textClass: 'text-green-500', dotClass: 'bg-green-500' };

  return (
    <footer className="border-t border-border bg-white pb-12 pt-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-24 grid grid-cols-1 gap-12 md:grid-cols-5">
          <div className="space-y-6">
            <Link to="/" className="flex items-center gap-2">
              <LanternLogo size={32} />
              <span className="text-xl font-bold uppercase tracking-tight">千服联灯</span>
            </Link>
            <p className="text-sm font-medium leading-relaxed text-muted-foreground">
              面向中文 Minecraft 玩家和服主的服务器发现、免费发布、内容审核与工单支持平台。平台不提供支付、充值、钱包、商城交易或推广返利服务。
            </p>
            <div className="flex gap-4">
              <Link to="/tickets" aria-label="前往工单支持" className="rounded-lg bg-muted p-2 transition-colors hover:bg-black hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                <MessageCircle className="h-4 w-4" />
              </Link>
              <a href="mailto:support@0st.top" aria-label="发送邮件联系平台" className="rounded-lg bg-muted p-2 transition-colors hover:bg-black hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                <Mail className="h-4 w-4" />
              </a>
            </div>
          </div>

          <div className="space-y-6">
            <h4 className="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">平台</h4>
            <ul className="space-y-4">
              <li><Link to="/servers" className={footerLinkClass}>浏览服务器</Link></li>
              <li><Link to="/search" className={footerLinkClass}>高级搜索</Link></li>
              <li><Link to="/resources" className={footerLinkClass}>资源中心</Link></li>
              <li><Link to="/team" className={footerLinkClass}>开发团队</Link></li>
              <li><Link to="/rules" className={footerLinkClass}>等级规则</Link></li>
            </ul>
          </div>

          <div className="space-y-6">
            <h4 className="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">法律与隐私</h4>
            <ul className="space-y-4">
              <li><Link to="/terms" className={footerLinkClass}>服务条款</Link></li>
              <li><Link to="/privacy" className={footerLinkClass}>隐私声明</Link></li>
              <li><Link to="/acceptable-use" className={footerLinkClass}>可接受使用政策</Link></li>
              <li><Link to="/minor-protection" className={footerLinkClass}>未成年人保护</Link></li>
              <li><Link to="/cookies-and-services" className={footerLinkClass}>Cookie 与第三方服务</Link></li>
              <li><Link to="/compliance" className={footerLinkClass}>全部合规规则</Link></li>
            </ul>
          </div>

          <div className="space-y-6">
            <h4 className="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">平台规则</h4>
            <ul className="space-y-4">
              <li><Link to="/rules" className={footerLinkClass}>等级与签到规则</Link></li>
              <li><Link to="/prohibited-items" className={footerLinkClass}>平台禁售清单</Link></li>
              <li><Link to="/reporting-rules" className={footerLinkClass}>举报与内容处置</Link></li>
              <li><Link to="/ip-complaints" className={footerLinkClass}>知识产权投诉</Link></li>
            </ul>
          </div>

          <div className="space-y-6">
            <h4 className="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">权利与支持</h4>
            <ul className="space-y-4">
              <li><Link to="/ip-complaints" className={footerLinkClass}>知识产权投诉</Link></li>
              <li><Link to="/reporting-rules" className={footerLinkClass}>举报与内容处置</Link></li>
              <li><Link to="/tickets" className={footerLinkClass}>工单支持</Link></li>
              <li><a href="mailto:support@0st.top" className={footerLinkClass}>support@0st.top</a></li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-6 border-t border-border pt-12 md:flex-row">
          <div className="flex flex-col items-center gap-3 text-center md:items-start md:text-left">
            <div className="font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">© 2026 QIANFU LIANDENG. ALL RIGHTS RESERVED.</div>
            <a href={ICP_LINK} target="_blank" rel="noopener noreferrer" className="bg-white text-[6px] font-normal leading-3 text-[#e9e7e7] underline decoration-[#e9e7e7] underline-offset-2 transition-colors hover:text-zinc-500 hover:decoration-zinc-500 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
              {ICP_LABEL}
            </a>
          </div>
          <div className="flex items-center gap-8">
            <span className={`flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-widest ${footerStatus.textClass}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${footerStatus.dotClass}`} />
              {footerStatus.label}
            </span>
            <div className="hidden h-4 w-px bg-border md:block" />
            <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground transition-colors hover:text-black focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
              返回顶部 ↑
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
