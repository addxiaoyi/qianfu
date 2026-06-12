import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Info } from 'lucide-react';

const AnnouncementBanner: React.FC = () => {
  const [show, setShow] = useState(true);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="bg-black text-white overflow-hidden relative z-[60]"
        >
          <div className="max-w-7xl mx-auto px-6 py-2 flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.2em]">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 bg-white/20 rounded flex items-center justify-center">
                 <Info className="w-3 h-3" />
              </div>
              <span>系统公告：支付、发服与工单系统已切换到生产链路，提交前请确认信息真实有效。</span>
            </div>
            <button 
              type="button"
              onClick={() => setShow(false)}
              className="p-1 hover:bg-white/20 rounded transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AnnouncementBanner;
