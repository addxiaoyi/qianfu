import React from 'react';
import { ChevronLeft, GraduationCap, ShieldCheck, Trophy, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

const LevelRules: React.FC = () => {
  const navigate = useNavigate();

  const sections = [
    {
      title: '经验获取 (XP Gain)',
      icon: Zap,
      items: [
        '首次给已通过审核的服务器点赞 +3 经验',
        '发表评论 +8 经验（每条评论）',
        '每日签到 +25 经验（每日限一次）',
      ],
    },
    {
      title: '等级与解锁 (Unlockables)',
      icon: Trophy,
      items: [
        'Lv.3：解锁「评分」功能',
        'Lv.5：解锁「评论」功能',
        'Lv.25 / 50 / 75：在具备发布权限时，各额外增加 1 个服务器发布位（最多 +3）',
      ],
    },
    {
      title: '称号角标 (Tier Badges)',
      icon: ShieldCheck,
      items: [
        'Lv.35 起：显示「信赖」角标',
        'Lv.60 起：显示「资深」角标',
        'Lv.85 起：显示「精英」角标',
      ],
    },
    {
      title: '权限说明 (Permissions)',
      icon: GraduationCap,
      items: [
        '管理员、运维等角色的既有权限不受等级削弱',
        '等级解锁为额外能力或额度',
        '未登录用户可浏览本页，登录后可查看个人进度',
      ],
    },
  ];

  const rulesHeader = {
    badge: 'PROGRESSION_MATRIX',
    title: '等级与经验规则',
    desc: '用户通过站内互动积累成长经验，最高可达 100 级。等级与角色权限合并计算，部分权益需达到对应等级后解锁。',
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-3xl mx-auto px-6 pt-12">
        <button 
          onClick={() => navigate(-1)}
          className="group flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-12"
        >
          <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm font-bold font-mono uppercase tracking-widest">Back</span>
        </button>

        <motion.header 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-16"
        >
          <h1 className="text-4xl font-black tracking-tight mb-4">等级与经验规则</h1>
          <p className="text-muted-foreground font-medium leading-relaxed">
            用户通过站内互动积累成长经验，最高可达 100 级。等级与角色权限合并计算，部分权益需达到对应等级后解锁。
          </p>
        </motion.header>

        <div className="space-y-16">
          {sections.map((section, idx) => (
            <motion.section 
              key={section.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
            >
              <div className="flex items-center gap-3 mb-6">
                 <div className="p-2 bg-muted rounded">
                    <section.icon className="w-5 h-5 text-black" />
                 </div>
                 <h2 className="text-xl font-bold tracking-tight">{section.title}</h2>
              </div>
              <ul className="space-y-4">
                {section.items.map((item, i) => (
                  <li key={i} className="flex gap-4 items-start group">
                    <span className="mt-2 w-1.5 h-1.5 rounded-full bg-muted-foreground/30 group-hover:bg-black transition-colors shrink-0" />
                    <span className="text-muted-foreground font-medium group-hover:text-foreground transition-colors">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </motion.section>
          ))}
        </div>

        <motion.footer 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-24 pt-12 border-t border-border text-center"
        >
          <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest">
            Rules version: 2026.04.29 · Subject to change
          </p>
        </motion.footer>
      </div>
    </div>
  );
};

export default LevelRules;
