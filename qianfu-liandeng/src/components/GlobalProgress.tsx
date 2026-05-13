import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';

const GlobalProgress: React.FC = () => {
  const location = useLocation();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  return (
    <AnimatePresence>
      {loading && (
        <motion.div
          initial={{ width: '0%', opacity: 1 }}
          animate={{ width: '100%' }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
          className="fixed top-0 left-0 h-1 bg-brand z-[9999] shadow-[0_0_10px_var(--color-brand)]"
        />
      )}
    </AnimatePresence>
  );
};

export default GlobalProgress;
