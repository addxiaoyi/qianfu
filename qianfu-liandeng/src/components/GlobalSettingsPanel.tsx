import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check } from 'lucide-react';
import { useUIStore, useT, accentThemes, type AccentTheme, type Locale } from '@/store/uiStore';
import GeometricLantern from '@/components/icons/GeometricLantern';

const SUPPORTED_LOCALES: { id: Locale; label: string; sub: string }[] = [
  { id: 'zh', label: '中文', sub: 'Chinese' },
  { id: 'en', label: 'English', sub: 'English' },
];

const GlobalSettingsPanel: React.FC = React.memo(() => {
  const [isPanelVisible, setIsPanelVisible] = useState(false);
  const { locale, accent, setLocale, setAccent } = useUIStore();
  const t = useT();

  const handleThemeChange = (id: AccentTheme) => {
    setAccent(id);
  };

  const handleLocaleChange = (id: Locale) => {
    setLocale(id);
  };

  return (
    <>
      <motion.button
        onClick={() => setIsPanelVisible(true)}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1 }}
        className="fixed bottom-8 right-8 z-[200] w-14 h-14 bg-accent text-white rounded-[1.5rem] flex items-center justify-center shadow-2xl shadow-accent/30 transition-all duration-300 hover:scale-110 active:scale-95 group"
        title={t('common.settings')}
      >
        <GeometricLantern className="w-6 h-6 group-hover:rotate-45 transition-transform duration-500" />
      </motion.button>

      <AnimatePresence>
        {isPanelVisible && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsPanelVisible(false)}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[210]"
            />

            <motion.div
              initial={{ opacity: 0, x: 20, scale: 0.98 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.98 }}
              transition={{ type: 'spring', damping: 30, stiffness: 400 }}
              className="fixed bottom-8 right-8 z-[220] w-80 bg-white rounded-[2.5rem] shadow-2xl shadow-black/20 border border-zinc-100 overflow-hidden"
            >
              <div className="p-8 border-b border-zinc-50 flex items-center justify-between">
                <div className="space-y-0.5">
                  <h3 className="text-lg font-black uppercase tracking-tighter italic">{t('prefs.title')}.</h3>
                  <p className="text-[10px] font-black text-zinc-300 uppercase tracking-[0.3em] italic">{t('prefs.subtitle')}</p>
                </div>
                <button
                  onClick={() => setIsPanelVisible(false)}
                  className="w-10 h-10 rounded-2xl bg-zinc-50 flex items-center justify-center hover:bg-black hover:text-white transition-all duration-300 group"
                >
                  <X className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
                </button>
              </div>

              <div className="p-8 space-y-5 border-b border-zinc-50">
                <div className="flex items-center gap-3">
                  <GeometricLantern className="w-4 h-4 text-zinc-300" />
                  <span className="text-[11px] font-black uppercase tracking-[0.4em] text-zinc-400 italic">{t('prefs.language')}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {SUPPORTED_LOCALES.map((loc) => (
                    <button
                      key={loc.id}
                      onClick={() => handleLocaleChange(loc.id)}
                      className={`relative flex flex-col items-center py-5 rounded-2xl border-2 transition-all duration-300 group ${
                        locale === loc.id
                          ? 'btn-accent border-transparent shadow-xl'
                          : 'border-zinc-100 hover:border-zinc-300 hover:bg-zinc-50'
                      }`}
                    >
                      {locale === loc.id && (
                        <div className="absolute top-2 right-2"><Check className="w-3 h-3 text-white/70" /></div>
                      )}
                      <span className="text-xl font-black italic leading-none">{loc.label}</span>
                      <span className={`text-[9px] font-black uppercase tracking-widest mt-1 ${locale === loc.id ? 'text-white/60' : 'text-zinc-300'}`}>{loc.sub}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-8 space-y-5">
                <div className="flex items-center gap-3">
                  <GeometricLantern className="w-4 h-4 text-zinc-300" />
                  <span className="text-[11px] font-black uppercase tracking-[0.4em] text-zinc-400 italic">{t('prefs.accent')}</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {(Object.entries(accentThemes) as [AccentTheme, typeof accentThemes[AccentTheme]][]).map(([id, theme]) => (
                    <button
                      key={id}
                      onClick={() => handleThemeChange(id)}
                      className={`relative flex flex-col items-center gap-2 py-4 px-2 rounded-2xl border-2 transition-all duration-300 group ${
                        accent === id
                          ? 'border-zinc-800 bg-zinc-50 shadow-lg'
                          : 'border-zinc-100 hover:border-zinc-200 hover:bg-zinc-50/50'
                      }`}
                    >
                      {accent === id && (
                        <div className="absolute top-1.5 right-1.5">
                          <Check className="w-3 h-3 text-zinc-600" />
                        </div>
                      )}
                      <div
                        className="w-8 h-8 rounded-xl shadow-sm group-hover:scale-110 transition-transform duration-300"
                        style={{ backgroundColor: theme.primary }}
                      />
                      <div className="text-center space-y-0">
                        <div className="text-[9px] font-black uppercase tracking-widest text-zinc-400 leading-tight">{locale === 'zh' ? theme.nameZh : theme.name}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="px-8 pb-6 flex items-center justify-center gap-3 text-[9px] font-black text-zinc-200 uppercase tracking-widest italic">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_6px_rgba(34,197,94,0.5)]" />
                {t('prefs.footer')}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
});

export default GlobalSettingsPanel;
