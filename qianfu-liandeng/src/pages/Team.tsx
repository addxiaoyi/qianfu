import React from 'react';
import { motion } from 'framer-motion';
import { BadgeCheck, ExternalLink, MessageCircle, ShieldCheck, Sparkles, Users, Zap } from 'lucide-react';

// NOTE: QQ numbers are stored server-side. Frontend only renders display-safe data.
const TEAM_MEMBERS = [
  { name: "银河", role: "服联负责人", description: "服联运营者" },
  { name: "封神", role: "常任委员", description: "服联创始人、擅长人员调度" },
  { name: "木匠", role: "常任委员", description: "擅长项目策划，技术支持" },
  { name: "蓝海狐", role: "常任委员", description: "精通网页部署、Bot开发" },
  { name: "ADDxiaoyi", role: "网站运维组组长", description: "群组腐竹" },
  { name: "龙凌渊", role: "文书运营组组长", description: "精通文案拟定" },
  { name: "紫蝎", role: "自媒体负责人", description: "擅长账号运营" },
  { name: "倔强男孩", role: "技术总监", description: "擅长服务器策划与程序开发" },
];

const RULE_SECTIONS = [
  {
    title: '基础规则',
    icon: ShieldCheck,
    items: ['尊重他人，禁止辱骂、骚扰、歧视', '禁止发布违法、违规或侵权内容', '遵守服务器与社区的统一管理要求'],
  },
  {
    title: '社区协作',
    icon: Users,
    items: ['信息发布保持真实、准确、可追溯', '涉及争议时优先通过管理组协商处理', '建议、反馈、申诉请按指定渠道提交'],
  },
  {
    title: '奖励与激励',
    icon: Sparkles,
    items: ['激励任务需按要求完成并通过审核', '奖励发放以记录与审核结果为准', '个人主页可查看相关记录与历史'],
  },
];

const Team: React.FC = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-6 py-24">
        <header className="mb-24 text-center">
          <div className="mb-6 text-[10px] font-black uppercase tracking-[0.45em] italic text-accent">COMMUNITY_MATRIX</div>
          <motion.h1 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-6xl font-black tracking-tighter mb-6"
          >
            OUR TEAM
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-muted-foreground font-medium max-w-xl mx-auto"
          >
            千服联灯由一群热衷于 Minecraft 社区建设的志愿者共同维护。
            我们致力于打造最专业、最公平的服务器展示平台。
          </motion.p>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-border border border-border rounded-2xl overflow-hidden">
          {TEAM_MEMBERS.map((member, idx) => (
            <motion.div 
              key={member.name}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: idx * 0.05 }}
              className="bg-white p-6 sm:p-8 group hover:bg-zinc-50 transition-colors"
            >
              <div className="mb-8">
                <div className="w-16 h-16 bg-muted rounded-xl mb-6 flex items-center justify-center font-mono text-2xl font-bold border border-border group-hover:border-black transition-colors">
                  {member.name[0]}
                </div>
                <div className="space-y-1">
                  <h3 className="text-xl font-bold tracking-tight">{member.name}</h3>
                  <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">{member.role}</p>
                </div>
              </div>
              
              <p className="text-sm text-muted-foreground font-medium mb-8 line-clamp-3 h-[4.5rem]">
                {member.description}
              </p>

              <div className="flex items-center gap-3">
                <button type="button" 
                  onClick={() => window.open('https://wpa.qq.com/msgrd?v=3&uin=873082710&site=qq&menu=yes', '_blank', 'noopener,noreferrer')}
                  className="p-2 bg-muted rounded-lg hover:bg-black hover:text-white transition-all"
                  title="Contact via QQ"
                >
                  <MessageCircle className="w-4 h-4" />
                </button>
                <button type="button" className="p-2 bg-muted rounded-lg hover:bg-black hover:text-white transition-all">
                  <Zap className="w-4 h-4" />
                </button>
                <div className="flex-grow" />
                <span className="text-[10px] font-mono text-muted-foreground/40 uppercase group-hover:text-muted-foreground transition-colors">
                   Staff verified
                </span>
              </div>
            </motion.div>
          ))}
        </div>

        <section className="mt-24 sm:mt-32 lg:mt-48 space-y-8 sm:space-y-10">
          <div id="community-rules" className="rounded-[2rem] border border-border bg-card p-5 sm:p-8 md:p-10 shadow-sm scroll-mt-24">
            <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.45em] italic text-accent">RULES & GUIDELINES</div>
                <h2 className="mt-2 text-3xl font-black tracking-tight">社区规则</h2>
                <p className="mt-2 text-sm text-muted-foreground max-w-2xl">规则内容已经统一放在团队页面，便于集中查看与维护。</p>
              </div>
              <div className="rounded-full border border-border bg-muted/30 px-3 py-1 text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">Unified</div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {RULE_SECTIONS.map((section) => (
                <div key={section.title} className="rounded-2xl border border-border bg-background p-5 shadow-sm hover:shadow-md transition-shadow">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-black text-white">
                      <section.icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="inline-flex items-center rounded-full bg-muted/60 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-1">Rule</div>
                      <h3 className="font-bold">{section.title}</h3>
                      <p className="text-[11px] text-muted-foreground">{section.items.length} 项说明</p>
                    </div>
                  </div>
                  <ul className="space-y-3">
                    {section.items.map((item) => (
                      <li key={item} className="flex items-start gap-3 text-sm text-muted-foreground">
                        <BadgeCheck className="mt-0.5 w-4 h-4 shrink-0 text-accent" />
                        <span className="leading-6">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="space-y-6">
              <h2 className="text-3xl font-black tracking-tight">加入我们</h2>
              <p className="text-muted-foreground font-medium leading-relaxed">
                千服联灯是一个开放的社区项目。如果你在技术开发、文案策划、美术设计或社区运营方面有专长，
                欢迎加入我们的技术团队或运营小组。
              </p>
              <div className="flex gap-4 pt-4 flex-wrap">
                 <button type="button"
                   onClick={() => window.open('https://wpa.qq.com/msgrd?v=3&uin=873082710&site=qq&menu=yes', '_blank', 'noopener,noreferrer')}
                   className="px-8 py-3 bg-black text-white font-bold rounded-lg text-sm hover:bg-zinc-800 transition-colors"
                 >
                    提交申请
                 </button>
                 <button type="button"
                   onClick={() => document.getElementById('community-rules')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                   className="px-8 py-3 border border-border font-bold rounded-lg text-sm hover:bg-muted transition-colors"
                 >
                    了解更多
                 </button>
              </div>
            </div>
            <div className="bg-muted/30 rounded-2xl p-12 border border-border flex flex-col justify-center">
               <div className="space-y-4">
                  <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Open Positions</div>
                  <ul className="space-y-2">
                     <li className="flex items-center justify-between font-bold text-sm">
                        <span>前端开发</span>
                        <ExternalLink className="w-3 h-3" />
                     </li>
                     <li className="flex items-center justify-between font-bold text-sm">
                        <span>内容运营</span>
                        <ExternalLink className="w-3 h-3" />
                     </li>
                     <li className="flex items-center justify-between font-bold text-sm">
                        <span>安全审核</span>
                        <ExternalLink className="w-3 h-3" />
                     </li>
                  </ul>
               </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Team;
