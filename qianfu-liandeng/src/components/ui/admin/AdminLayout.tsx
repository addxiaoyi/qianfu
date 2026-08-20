import React from 'react';
import AdminSidebar from './AdminSidebar';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';

const AdminLayout: React.FC<{ children: React.ReactNode }> = React.memo(({ children }) => {
  const location = useLocation();

  return (
    <div className="flex bg-[#fafafa] min-h-screen selection:bg-accent selection:text-white">
      <AdminSidebar />
      <main className="flex-grow p-12 md:p-16 overflow-y-auto relative">
        <div className="absolute top-0 right-0 p-16 pointer-events-none opacity-[0.02]">
           <div className="text-[20rem] font-black leading-none select-none italic">QF.</div>
        </div>
        
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-[1400px] mx-auto relative z-10"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
});

export default AdminLayout;
