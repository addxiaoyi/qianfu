import React from 'react';
import { Link } from 'react-router-dom';
import { Zap, MessageCircle, Mail } from 'lucide-react';
import { useT } from '@/store/uiStore';

const ICP_LINK = 'https://beian.miit.gov.cn/';
const ICP_LABEL = '苏ICP备2026025306号-2';

interface FooterProps {
  backendReady?: boolean;
  backendHealthLoading?: boolean;
  backendHealthError?: boolean;
}

const Footer: React.FC<FooterProps> = ({
  backendReady = true,
  backendHealthLoading = false,
  backendHealthError = false,
}) => {
  const t = useT();
  const footerStatus = backendHealthLoading
    ? {
        label: t('footer.status.checking'),
        textClass: 'text-zinc-500',
        dotClass: 'bg-zinc-400',
      }
    : backendHealthError || !backendReady
      ? {
          label: t('footer.status.degraded'),
          textClass: 'text-amber-600',
          dotClass: 'bg-amber-500',
        }
      : {
          label: t('footer.status.normal'),
          textClass: 'text-green-500',
          dotClass: 'bg-green-500',
        };

  return (
    <footer className="bg-white border-t border-border pt-24 pb-12">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-24">
          <div className="col-span-1 md:col-span-1 space-y-6">
            <Link to="/" className="flex items-center gap-2">
               <div className="w-8 h-8 bg-black rounded flex items-center justify-center text-white">
                  <Zap className="w-4 h-4 fill-current" />
               </div>
               <span className="text-xl font-bold tracking-tight uppercase">千服联灯</span>
            </Link>
            <p className="text-sm text-muted-foreground font-medium leading-relaxed">
              千服联灯 (QianFu Liandeng) 致力于构建最纯净、高效的 Minecraft 服务器展示平台，连接每一个热爱创作与探索的灵魂。
            </p>
            <div className="flex gap-4">
               <button type="button" className="p-2 bg-muted rounded-lg hover:bg-black hover:text-white transition-all">
                  <Zap className="w-4 h-4" />
               </button>
               <button type="button" className="p-2 bg-muted rounded-lg hover:bg-black hover:text-white transition-all">
                  <MessageCircle className="w-4 h-4" />
               </button>
               <button type="button" className="p-2 bg-muted rounded-lg hover:bg-black hover:text-white transition-all">
                  <Mail className="w-4 h-4" />
               </button>
            </div>
          </div>

          <div className="space-y-6">
             <h4 className="text-[10px] font-black font-mono uppercase tracking-[0.2em] text-muted-foreground">平台</h4>
             <ul className="space-y-4">
                <li><Link to="/servers" className="text-sm font-bold text-muted-foreground hover:text-black transition-colors">浏览服务器</Link></li>
                <li><Link to="/search" className="text-sm font-bold text-muted-foreground hover:text-black transition-colors">高级搜索</Link></li>
                <li><Link to="/promotion" className="text-sm font-bold text-muted-foreground hover:text-black transition-colors">推广方案</Link></li>
                <li><Link to="/resources" className="text-sm font-bold text-muted-foreground hover:text-black transition-colors">资源中心</Link></li>
             </ul>
          </div>

          <div className="space-y-6">
             <h4 className="text-[10px] font-black font-mono uppercase tracking-[0.2em] text-muted-foreground">站点信息</h4>
             <ul className="space-y-4">
                <li><Link to="/team" className="text-sm font-bold text-muted-foreground hover:text-black transition-colors">开发团队</Link></li>
                <li><Link to="/rules" className="text-sm font-bold text-muted-foreground hover:text-black transition-colors">等级规则</Link></li>
                <li><Link to="/terms" className="text-sm font-bold text-muted-foreground hover:text-black transition-colors">服务条款</Link></li>
                <li><Link to="/privacy" className="text-sm font-bold text-muted-foreground hover:text-black transition-colors">隐私政策</Link></li>
             </ul>
          </div>

          <div className="space-y-6">
             <h4 className="text-[10px] font-black font-mono uppercase tracking-[0.2em] text-muted-foreground">服务入口</h4>
             <ul className="space-y-4">
                <li className="flex items-center gap-2 group cursor-pointer">
                   <Link to="/dashboard/billing" className="text-sm font-bold text-muted-foreground group-hover:text-black transition-colors">钱包与账单</Link>
                </li>
                <li className="flex items-center gap-2 group cursor-pointer">
                   <Link to="/promotion" className="text-sm font-bold text-muted-foreground group-hover:text-black transition-colors">推广中心</Link>
                </li>
                <li className="flex items-center gap-2 group cursor-pointer">
                   <Link to="/tickets" className="text-sm font-bold text-muted-foreground group-hover:text-black transition-colors">工单支持</Link>
                </li>
             </ul>
          </div>
        </div>

        <div className="pt-12 border-t border-border flex flex-col md:flex-row justify-between items-center gap-6">
           <div className="flex flex-col items-center md:items-start gap-3 text-center md:text-left">
              <div className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-widest">
                 © 2026 QIANFU LIANDENG. ALL RIGHTS RESERVED.
              </div>
              <a
                href={ICP_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-semibold text-zinc-500 transition-colors hover:text-black"
              >
                {ICP_LABEL}
              </a>
           </div>
           <div className="flex gap-8 items-center">
              <span className={`text-[10px] font-mono font-bold uppercase tracking-widest flex items-center gap-2 ${footerStatus.textClass}`}>
                 <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${footerStatus.dotClass}`} />
                 {footerStatus.label}
              </span>
              <div className="w-px h-4 bg-border hidden md:block" />
              <button type="button" className="text-[10px] font-mono font-bold text-muted-foreground hover:text-black transition-colors uppercase tracking-widest">
                 返回顶部 ↑
              </button>
           </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
