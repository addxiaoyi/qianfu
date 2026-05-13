import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/request';
import { toast } from '@/hooks/use-toast';
import StatusWrapper from '@/components/StatusWrapper';
import AdminPageHeader from '@/components/AdminPageHeader';
import GeometricLantern from '@/components/icons/GeometricLantern';

// --- Types ---
interface UserData {
  id: number;
  username: string;
  email: string;
  role: string;
  created_at: string;
  avatar_url?: string;
  email_verified: boolean;
  permissions?: string[];
  level: number;
  balance: string;
  lastLogin?: string;
  region?: string;
}

// --- Constants ---
const ROLES = ['admin', 'operator', 'collaborator', 'sponsor', 'user'];
const usersBadge = 'IDENTITY_MANAGEMENT_MATRIX';
const adminShellClass = 'space-y-16 pb-32 bg-white';
const adminHeaderTagClass = 'px-4 py-1.5 bg-accent text-white text-[10px] font-black uppercase tracking-[0.4em] rounded-sm shadow-2xl shadow-accent/20 italic';

const adminTableShellClass = 'border border-zinc-50 rounded-[5rem] overflow-hidden bg-white shadow-xs group/table hover:border-zinc-100 transition-all duration-1000';
const adminHeaderStatClass = 'p-12 border border-zinc-50 rounded-[4rem] bg-white space-y-8 hover:border-zinc-200 hover:shadow-2xl hover:shadow-black/5 transition-all duration-700 shadow-xs relative overflow-hidden group';

const AdminUsers: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  
  // UI States
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [isPermsDialogOpen, setIsPermsDialogOpen] = useState(false);

  const { data: userList = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => api.get<UserData[]>('/admin/users'),
  });

  // Update user role via API
  const handleRoleChange = async (newRole: string) => {
    if (!selectedUser) return;
    
    try {
      await api.patch(`/admin/users/${selectedUser.id}/role`, { role: newRole });
      
      refetch();
      
      toast({ 
        title: 'ROLE_UPDATED', 
        description: `Successfully updated ${selectedUser.username} to ${newRole.toUpperCase()}.` 
      });
      
      setIsRoleDialogOpen(false);
    } catch (err) {
      console.error('Failed to update role:', err);
      toast({ variant: 'destructive', title: 'UPDATE_FAILED', description: 'Could not update user role.' });
    }
  };

  const filteredUsers = userList.filter(u => 
    u.username.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Quick overview statistics
  const summaryStats = [
    { label: 'Verified Nodes', value: userList.length, variant: 'user' as const, color: 'text-green-500', tag: 'POP_01' },
    { label: 'System Admins', value: userList.filter(u => u.role === 'admin').length, variant: 'security' as const, color: 'text-zinc-400', tag: 'POP_02' },
    { label: 'Pending Auth', value: userList.filter(u => !u.email_verified).length, variant: 'alert' as const, color: 'text-orange-500', tag: 'POP_03' },
    { label: 'Avg Capability', value: 'Lv.42', variant: 'data' as const, color: 'text-blue-500', tag: 'POP_04' },
  ];

  return (
    <div className="space-y-16 pb-32 bg-white">
      <StatusWrapper isLoading={isLoading} isError={isError} onRetry={() => refetch()}>
      {/* --- Page Header --- */}
      <AdminPageHeader
        badge="Identity Management Matrix"
        title="Directory."
        description="管理全站用户角色、权限及账户安全状态。执行多维身份验证及全局行为审计。"
        statusLabel="Live Population: 2,400+ Nodes"
        rightSlot={(
          <button className="group px-12 py-8 btn-accent rounded-[3rem] text-[12px] font-black uppercase tracking-[0.5em] transition-all flex items-center gap-6 shadow-2xl shadow-accent/20 italic active:scale-[0.98]">
              <GeometricLantern variant="spark" className="w-6 h-6 group-hover:rotate-12 transition-transform duration-500" /> INVITE_AGENT
          </button>
        )}
      />

      {/* --- Summary Cards --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-10">
         {summaryStats.map((s, idx) => (
           <motion.div 
             key={s.label} 
             initial={{ opacity: 0, y: 10 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ delay: idx * 0.1, duration: 0.6 }}
             className="p-12 border border-zinc-50 rounded-[4rem] bg-white space-y-8 hover:border-zinc-200 hover:shadow-2xl hover:shadow-black/5 transition-all duration-700 shadow-xs relative overflow-hidden group"
           >
              <div className="absolute top-10 right-10 text-[9px] font-black text-zinc-100 group-hover:text-zinc-200 transition-colors italic">/ {s.tag}</div>
              <div className="w-20 h-20 bg-zinc-50 rounded-[2rem] flex items-center justify-center text-zinc-300 group-hover:bg-accent group-hover:text-white group-hover:rotate-6 transition-all duration-700 shadow-xs">
                 <GeometricLantern variant={s.variant} className={`w-8 h-8 ${s.color} group-hover:text-white transition-colors`} />
              </div>
              <div className="space-y-2">
                 <div className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-300 italic group-hover:text-zinc-500 transition-colors leading-none">{s.label}</div>
                 <div className="text-5xl font-black font-mono tracking-tighter italic leading-none">{s.value}</div>
              </div>
           </motion.div>
         ))}
      </div>

      {/* --- Controls & Filter --- */}
      <div className="flex flex-col xl:flex-row items-center justify-between gap-10 pt-12 border-t border-zinc-50">
         <div className="flex gap-4 w-full xl:w-auto">
            <button className="px-10 py-6 bg-zinc-50/50 border border-transparent hover:border-accent hover:bg-white rounded-[2rem] text-[10px] font-black uppercase tracking-[0.4em] flex items-center gap-4 transition-all duration-500 italic shadow-xs group">
               <GeometricLantern variant="settings" className="w-4 h-4 text-zinc-200 group-hover:text-accent transition-colors" /> Filters_Logic
            </button>
            <button className="px-10 py-6 bg-zinc-50/50 border border-transparent hover:border-accent hover:bg-white rounded-[2rem] text-[10px] font-black uppercase tracking-[0.4em] flex items-center gap-4 transition-all duration-500 italic shadow-xs group">
               <GeometricLantern variant="network" className="w-4 h-4 text-zinc-200 group-hover:text-accent transition-colors" /> Regionality_Map
            </button>
         </div>

         <div className="relative w-full xl:w-[48rem] group">
            <GeometricLantern variant="terminal" className="absolute left-10 top-1/2 -translate-y-1/2 w-6 h-6 text-zinc-100 group-focus-within:text-accent transition-all duration-500" />
            <input 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-24 pr-10 py-8 bg-zinc-50/50 border border-transparent focus:bg-white focus:border-accent rounded-[3rem] transition-all duration-500 outline-hidden text-lg font-black italic tracking-tight shadow-xs"
              placeholder="QUERY BY IDENTIFICATION OR EMAIL..."
            />
         </div>
      </div>

      {/* --- User Table --- */}
      <div className="border border-zinc-50 rounded-[5rem] overflow-hidden bg-white shadow-xs group/table hover:border-zinc-100 transition-all duration-1000">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-zinc-50/50 border-b border-zinc-100">
                <th className="px-16 py-10 text-[10px] font-black uppercase tracking-[0.5em] text-zinc-300 italic">Principal Identity</th>
                <th className="px-16 py-10 text-[10px] font-black uppercase tracking-[0.5em] text-zinc-300 italic">Access Protocol</th>
                <th className="px-16 py-10 text-[10px] font-black uppercase tracking-[0.5em] text-zinc-300 italic">Capability Matrix</th>
                <th className="px-16 py-10 text-[10px] font-black uppercase tracking-[0.5em] text-zinc-300 italic">Network Integrity</th>
                <th className="px-16 py-10 text-[10px] font-black uppercase tracking-[0.5em] text-zinc-300 italic text-right">Action Vector</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              <AnimatePresence mode="popLayout">
                {filteredUsers.map((user, idx) => (
                  <motion.tr 
                    key={user.id} 
                    layout
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="group hover:bg-zinc-50/50 transition-all duration-500"
                  >
                    <td className="px-16 py-12">
                      <div className="flex items-center gap-10">
                        <div className="w-20 h-20 rounded-[2rem] bg-zinc-50 border border-zinc-100 flex items-center justify-center font-black text-2xl uppercase italic group-hover:bg-accent group-hover:text-white group-hover:scale-105 transition-all duration-700 shadow-sm">
                          {user.username[0]}
                        </div>
                        <div className="space-y-2">
                          <div className="font-black text-2xl uppercase tracking-tighter italic leading-none group-hover:translate-x-2 transition-transform duration-500">{user.username}</div>
                          <div className="flex items-center gap-3">
                             <GeometricLantern variant="terminal" className="w-3.5 h-3.5 text-zinc-100 group-hover:text-accent transition-colors" />
                             <span className="text-[10px] text-zinc-300 font-black font-mono uppercase tracking-[0.2em] group-hover:text-zinc-500 transition-colors italic">{user.email}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-16 py-12">
                      <div className="flex flex-col gap-3">
                          <span className={`inline-block px-4 py-1.5 rounded-sm text-[10px] font-black uppercase tracking-[0.3em] italic border self-start shadow-xs transition-all duration-700 ${
                            user.role === 'admin' ? 'bg-accent text-white border-accent' : 
                            user.role === 'operator' ? 'bg-zinc-100 border-zinc-200 text-accent' : 'bg-white border-zinc-100 text-zinc-300 group-hover:text-accent group-hover:border-accent'
                          }`}>
                           {user.role}
                         </span>
                         <div className="flex items-center gap-2 text-[9px] font-black font-mono text-zinc-200 uppercase tracking-widest italic group-hover:text-zinc-400 transition-colors">
                            <GeometricLantern variant="network" className="w-3 h-3" /> NODE_GRID: {user.region}
                         </div>
                      </div>
                    </td>
                    <td className="px-16 py-12">
                      <div className="space-y-4">
                         <div className="flex items-center gap-4 text-[11px] font-black font-mono uppercase tracking-[0.4em] text-zinc-200 group-hover:text-zinc-400 transition-colors">
                            <GeometricLantern variant="activity" className="w-4 h-4" /> <span className="text-black italic">LV.{user.level}</span> <span className="opacity-50">CAP</span>
                         </div>
                         <div className="flex items-center gap-4 text-[11px] font-black font-mono uppercase tracking-[0.4em] text-zinc-200 group-hover:text-zinc-400 transition-colors">
                            <GeometricLantern variant="payment" className="w-4 h-4" /> <span className="text-black italic">¥ {user.balance}</span> <span className="opacity-50">CREDIT</span>
                         </div>
                      </div>
                    </td>
                    <td className="px-16 py-12">
                      <div className="space-y-4">
                         <div className="flex items-center gap-4">
                           <div className={`w-2.5 h-2.5 rounded-full shadow-[0_0_12px_rgba(0,0,0,0.1)] ${user.email_verified ? 'bg-green-500 shadow-green-500/20' : 'bg-orange-500 animate-pulse'}`} />
                           <span className="text-[11px] font-black uppercase tracking-[0.4em] text-zinc-300 italic group-hover:text-zinc-600 transition-colors">
                             {user.email_verified ? 'SYNC_VERIFIED' : 'PENDING_HANDSHAKE'}
                           </span>
                         </div>
                         <div className="flex items-center gap-3 text-[10px] font-black font-mono text-zinc-200 uppercase tracking-widest italic group-hover:text-zinc-400 transition-colors">
                            <GeometricLantern variant="activity" className="w-3.5 h-3.5 opacity-50" /> {user.lastLogin}
                         </div>
                      </div>
                    </td>
                    <td className="px-16 py-12 text-right">
                       <div className="flex items-center justify-end gap-4 opacity-0 group-hover:opacity-100 transition-all translate-x-8 group-hover:translate-x-0 duration-700">
                          <button 
                            onClick={() => { setSelectedUser(user); setIsRoleDialogOpen(true); }}
                            className="w-16 h-16 flex items-center justify-center bg-white rounded-2xl border border-zinc-50 hover:border-accent hover:bg-accent hover:text-white transition-all duration-500 shadow-sm active:scale-90"
                            title="Update Role"
                          >
                             <GeometricLantern variant="security" className="w-5 h-5" />
                          </button>
                          <button 
                            onClick={() => { setSelectedUser(user); setIsPermsDialogOpen(true); }}
                            className="w-16 h-16 flex items-center justify-center bg-white rounded-2xl border border-zinc-50 hover:border-accent hover:bg-accent hover:text-white transition-all duration-500 shadow-sm active:scale-90"
                            title="View Permissions"
                          >
                             <GeometricLantern variant="terminal" className="w-5 h-5" />
                          </button>
                          <button className="w-16 h-16 flex items-center justify-center bg-white rounded-2xl border border-zinc-50 hover:border-accent hover:bg-accent hover:text-white transition-all duration-500 shadow-sm active:scale-90">
                             <GeometricLantern variant="settings" className="w-5 h-5" />
                          </button>
                       </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
        {filteredUsers.length === 0 && (
          <div className="py-48 text-center space-y-8">
             <div className="relative inline-block">
                <GeometricLantern variant="data" className="w-20 h-20 text-zinc-50 mx-auto" />
                <GeometricLantern variant="alert" className="absolute -right-2 -bottom-2 w-8 h-8 text-orange-500" />
             </div>
             <p className="text-[12px] font-black text-zinc-300 uppercase tracking-[0.5em] italic">No identities match the current query matrix.</p>
          </div>
        )}
      </div>

      {/* --- Role Selection Modal --- */}
      <AnimatePresence>
        {isRoleDialogOpen && selectedUser && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-8">
             <motion.div 
               initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
               className="absolute inset-0 bg-black/90 backdrop-blur-xl" 
               onClick={() => setIsRoleDialogOpen(false)} 
             />
             <motion.div 
               initial={{ opacity: 0, scale: 0.95, y: 20 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.95, y: 20 }}
               transition={{ duration: 0.4 }}
               className="relative w-full max-w-2xl bg-white rounded-[5rem] shadow-[0_64px_128px_rgba(0,0,0,0.5)] p-20 space-y-16"
             >
                <button 
                   onClick={() => setIsRoleDialogOpen(false)}
                   className="absolute top-12 right-12 p-4 text-zinc-200 hover:text-accent transition-colors"
                >
                   <GeometricLantern variant="alert" className="w-8 h-8" />
                </button>

                <div className="flex items-center gap-10">
                   <div className="w-24 h-24 bg-accent text-white rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-accent/30">
                      <GeometricLantern variant="security" className="w-12 h-12 fill-current" />
                   </div>
                   <div className="space-y-2">
                      <h3 className="text-5xl font-black tracking-tighter uppercase italic leading-none">Authority.</h3>
                      <p className="text-[11px] font-black text-zinc-300 uppercase tracking-[0.4em] italic leading-none">Modifying Access Protocol: <span className="text-accent">{selectedUser.username}</span></p>
                   </div>
                </div>

                <div className="grid grid-cols-1 gap-6">
                   {ROLES.map((role, idx) => (
                     <button
                        key={role}
                        onClick={() => handleRoleChange(role)}
                        className={`w-full p-10 rounded-[3rem] text-left transition-all duration-500 border group/btn relative overflow-hidden active:scale-[0.98] ${
                          selectedUser.role === role 
                          ? 'bg-accent text-white border-accent shadow-2xl shadow-accent/20' 
                          : 'bg-zinc-50/50 border-transparent hover:border-accent hover:bg-zinc-50'
                        }`}
                     >
                        <div className="relative z-10 flex items-center justify-between">
                           <div className="space-y-2">
                              <div className="text-[12px] font-black uppercase tracking-[0.4em] italic leading-none">{role}</div>
                              <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest italic group-hover/btn:text-zinc-500 transition-colors">Protocol_Perms_Node v{idx + 1}.0</div>
                           </div>
                           <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-700 ${
                              selectedUser.role === role ? 'bg-white text-accent border-white' : 'border-zinc-100 bg-white group-hover/btn:border-zinc-300'
                           }`}>
                              {selectedUser.role === role ? <GeometricLantern variant="security" className="w-5 h-5 fill-current" /> : <ChevronRight className="w-4 h-4 opacity-20 group-hover/btn:opacity-100 transition-opacity" />}
                           </div>
                        </div>
                     </button>
                   ))}
                </div>

                <button 
                  onClick={() => setIsRoleDialogOpen(false)}
                  className="w-full py-8 text-[11px] font-black text-zinc-200 uppercase tracking-[0.6em] hover:text-accent transition-all italic leading-none"
                >
                   ABORT_IDENTITY_RECONFIG
                </button>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- Permissions Matrix Modal --- */}
      <AnimatePresence>
        {isPermsDialogOpen && selectedUser && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-8">
             <motion.div 
               initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
               className="absolute inset-0 bg-black/90 backdrop-blur-xl" 
               onClick={() => setIsPermsDialogOpen(false)} 
             />
             <motion.div 
               initial={{ opacity: 0, y: 40 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, y: 40 }}
               className="relative w-full max-w-3xl bg-white rounded-[5rem] shadow-[0_64px_128px_rgba(0,0,0,0.5)] p-20 space-y-16"
             >
                <div className="flex items-center gap-10">
                   <div className="w-24 h-24 bg-accent text-white rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-accent/10">
                      <GeometricLantern variant="terminal" className="w-12 h-12 fill-current" />
                   </div>
                   <div className="space-y-2">
                      <h3 className="text-5xl font-black tracking-tighter uppercase italic leading-none">Privileges.</h3>
                      <p className="text-[11px] font-black text-zinc-300 uppercase tracking-[0.4em] italic leading-none">Atomic Node Authorization Matrix: <span className="text-accent">{selectedUser.username}</span></p>
                   </div>
                </div>

                <div className="bg-zinc-50/50 rounded-[4rem] p-12 border border-zinc-50 min-h-[300px] flex flex-col">
                   <div className="grid grid-cols-2 gap-6">
                      {(selectedUser.permissions || []).map(perm => (
                         <div key={perm} className="px-8 py-6 bg-white rounded-3xl border border-zinc-100 flex items-center justify-between group shadow-xs hover:border-accent transition-all duration-500">
                            <div className="flex items-center gap-4">
                               <div className="w-2.5 h-2.5 rounded-full bg-accent shadow-[0_0_8px_rgba(var(--accent-rgb),0.3)] animate-pulse" />
                               <span className="font-mono text-xs font-black text-black uppercase tracking-tight italic">{perm}</span>
                            </div>
                            <GeometricLantern variant="security" className="w-4 h-4 text-zinc-100 group-hover:text-accent transition-colors" />
                         </div>
                      ))}
                   </div>
                   
                   {(!selectedUser.permissions || selectedUser.permissions.length === 0) && (
                     <div className="flex-grow flex flex-col items-center justify-center gap-8 py-12">
                        <GeometricLantern variant="data" className="w-16 h-16 text-zinc-100" />
                        <p className="text-[12px] font-black text-zinc-200 uppercase tracking-[0.5em] italic">No specific permissions allocated.</p>
                     </div>
                   )}
                </div>

                <div className="pt-8 flex flex-col items-center gap-8">
                   <button 
                     onClick={() => setIsPermsDialogOpen(false)}
                     className="group w-full py-10 btn-accent text-white rounded-[3rem] font-black text-[14px] uppercase tracking-[0.6em] transition-all shadow-accent italic active:scale-[0.98] flex items-center justify-center gap-6"
                   >
                      DEPLOY_CONFIG <ChevronRight className="w-6 h-6 group-hover:translate-x-4 transition-transform duration-500" />
                   </button>
                   <div className="text-[9px] font-black text-zinc-300 uppercase tracking-widest italic opacity-50">
                      <GeometricLantern variant="settings" className="w-3.5 h-3.5 inline mr-2" /> Sector: Permission_Matrix_V4.0
                   </div>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
      </StatusWrapper>
    </div>
  );
};

export default AdminUsers;
