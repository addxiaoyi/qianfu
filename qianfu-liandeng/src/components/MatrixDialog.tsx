import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import GeometricLantern from '@/components/icons/GeometricLantern';

interface MatrixDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (value: string) => void;
  title: string;
  placeholder: string;
  defaultValue?: string;
  icon?: React.ReactNode;
}

const MatrixDialog: React.FC<MatrixDialogProps> = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  title, 
  placeholder, 
  defaultValue = '',
  icon
}) => {
  const [value, setValue] = React.useState(defaultValue);

  React.useEffect(() => {
    if (isOpen) setValue(defaultValue);
  }, [isOpen, defaultValue]);

  const handleConfirm = React.useCallback(() => {
    onSubmit(value);
    onClose();
  }, [onClose, onSubmit, value]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="w-full max-w-md bg-white rounded-[3rem] p-12 relative shadow-2xl overflow-hidden"
          >
             <div className="absolute top-0 right-0 p-12 opacity-[0.03] pointer-events-none">
                <GeometricLantern variant="settings" className="w-48 h-48 rotate-12" />
             </div>

             <div className="relative z-10 space-y-10">
                <header className="space-y-4">
                   <div className="matrix-badge flex items-center gap-2 w-fit">
                      {icon || <GeometricLantern variant="spark" className="w-3.5 h-3.5" />} {title}
                   </div>
                   <h3 className="text-4xl font-black italic uppercase tracking-tighter leading-none">Parameter_Input.</h3>
                </header>

                <div className="space-y-4">
                   <input 
                     autoFocus
                     value={value}
                     onChange={(e) => setValue(e.target.value)}
                     placeholder={placeholder}
                     className="matrix-input !py-6 !text-2xl"
                     onKeyDown={(e) => {
                       if (e.key === 'Enter') {
                         handleConfirm();
                       }
                     }}
                   />
                </div>

                <div className="flex gap-4 pt-4">
                   <button 
                     onClick={handleConfirm}
                     className="flex-grow py-5 bg-black text-white rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-accent transition-all italic"
                   >
                     EXECUTE_COMMAND
                   </button>
                   <button 
                     onClick={onClose}
                     className="px-10 py-5 border border-zinc-100 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-zinc-50 transition-all italic"
                   >
                     CANCEL
                   </button>
                </div>
             </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default React.memo(MatrixDialog);
