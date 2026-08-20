import React, { lazy, Suspense, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

const GlobalAssistantPanel = lazy(() => import('./GlobalAssistantPanel'));

type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

type AssistantTriggerProps = {
  isAuthPage: boolean;
  onClick: () => void;
  loading?: boolean;
};

const AssistantTrigger: React.FC<AssistantTriggerProps> = ({ isAuthPage, onClick, loading = false }) => (
  <button
    type="button"
    onClick={onClick}
    className={`fixed right-4 z-[200] flex items-center justify-center bg-accent text-white shadow-2xl shadow-accent/30 sm:top-auto sm:bottom-8 sm:right-8 ${isAuthPage ? 'top-24 bottom-auto h-12 w-12 rounded-2xl' : 'bottom-40 h-14 w-14 rounded-[1.5rem]'}`}
    title="千服 AI 助手"
    aria-label={loading ? '正在加载千服 AI 助手' : '打开千服 AI 助手'}
    aria-busy={loading}
  >
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
      <path d="M8 10h.01M12 10h.01M16 10h.01" />
    </svg>
  </button>
);

const GlobalSettingsPanel: React.FC = React.memo(() => {
  const [mountPanel, setMountPanel] = useState(false);
  const [openOnMount, setOpenOnMount] = useState(false);
  const location = useLocation();
  const isAuthPage = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-code'].some((path) => location.pathname.startsWith(path));

  useEffect(() => {
    const idleWindow = window as IdleWindow;
    const mount = () => setMountPanel(true);

    if (idleWindow.requestIdleCallback) {
      const handle = idleWindow.requestIdleCallback(mount, { timeout: 2500 });
      return () => idleWindow.cancelIdleCallback?.(handle);
    }

    const timeout = window.setTimeout(mount, 1400);
    return () => window.clearTimeout(timeout);
  }, []);

  const requestOpen = () => {
    setOpenOnMount(true);
    setMountPanel(true);
  };

  if (!mountPanel) {
    return <AssistantTrigger isAuthPage={isAuthPage} onClick={requestOpen} />;
  }

  return (
    <Suspense fallback={<AssistantTrigger isAuthPage={isAuthPage} onClick={requestOpen} loading />}>
      <GlobalAssistantPanel initialOpen={openOnMount} />
    </Suspense>
  );
});

export default GlobalSettingsPanel;
