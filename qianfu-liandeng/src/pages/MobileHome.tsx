import React from 'react';
import { motion } from 'framer-motion';
import { Zap, Search, Server, ShieldCheck, ChevronRight, Smartphone } from 'lucide-react';
import { Link } from 'react-router-dom';

const quickActions = [
  { name: '找服', icon: Server, path: '/servers', color: 'bg-blue-500' },
  { name: '规则', icon: ShieldCheck, path: '/rules', color: 'bg-green-500' },
  { name: '推广', icon: Zap, path: '/promotion', color: 'bg-orange-500' },
  { name: '搜索', icon: Search, path: '/search', color: 'bg-black' },
];

const MobileHome: React.FC = () => {
  return (
    <div className="min-h-screen bg-white md:hidden">
      {/* Mobile Top Nav */}
      <div className="px-6 py-4 flex items-center justify-between border-b border-border bg-white/80 backdrop-blur-md sticky top-0 z-50">
         <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-black rounded flex items-center justify-center text-white">
               <Zap className="w-4 h-4 fill-current" />
            </div>
            <span className="font-black tracking-tighter text-lg uppercase">QianFu</span>
         </Link>
         <button className="p-2 bg-muted rounded-lg">
            <Smartphone className="w-5 h-5" />
         </button>
      </div>

      {/* Hero Section */}
      <section className="px-6 py-12 space-y-8">
         <motion.div 
           initial={{ opacity: 0, y: 10 }}
           animate={{ opacity: 1, y: 0 }}
           className="space-y-4"
         >
            <h1 className="text-4xl font-black tracking-tighter leading-none">
               FIND YOUR <br />
               <span className="text-muted-foreground">NEXT WORLD.</span>
            </h1>
            <p className="text-sm font-medium text-muted-foreground">
               为移动端优化的极致找服体验。
            </p>
         </motion.div>

         <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="搜索服务器..." 
              className="w-full pl-11 pr-4 py-4 bg-muted border-none rounded-xl text-sm font-bold"
            />
         </div>
      </section>

      {/* Quick Access Grid */}
      <section className="px-6 py-8 grid grid-cols-2 gap-4">
         {quickActions.map(item => (
           <Link 
             key={item.name}
             to={item.path}
             className="p-6 border border-border rounded-2xl flex flex-col items-center gap-4 active:scale-95 transition-transform"
           >
              <div className={`w-10 h-10 ${item.color} rounded-xl flex items-center justify-center text-white shadow-lg shadow-black/5`}>
                 <item.icon className="w-5 h-5" />
              </div>
              <span className="text-xs font-black uppercase tracking-widest">{item.name}</span>
           </Link>
         ))}
      </section>

      {/* Featured List */}
      <section className="px-6 py-12 space-y-6">
         <div className="flex items-end justify-between">
            <h2 className="text-xl font-black uppercase tracking-tight">精选推荐</h2>
            <Link to="/servers" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">See all</Link>
         </div>

         <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <Link key={i} to={`/server/${i}`} className="flex gap-4 p-4 border border-border rounded-2xl active:bg-muted transition-colors">
                 <div className="w-20 h-20 bg-muted rounded-xl shrink-0" />
                 <div className="flex-grow space-y-1">
                    <h3 className="font-bold">某推荐服务器 #{i}</h3>
                    <div className="flex items-center gap-2">
                       <span className="px-2 py-0.5 bg-black text-white text-[8px] font-black uppercase rounded">Survival</span>
                       <span className="text-[10px] font-mono text-muted-foreground">1.20.1</span>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                       <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                       <span className="text-[10px] font-bold text-muted-foreground">124 PLAYERS</span>
                    </div>
                 </div>
                 <div className="self-center">
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                 </div>
              </Link>
            ))}
         </div>
      </section>

      {/* Bottom Nav Placeholder for mobile feel */}
      <div className="h-20" />
    </div>
  );
};

export default MobileHome;
