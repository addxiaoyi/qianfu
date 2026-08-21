import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Info, ShieldAlert, X } from 'lucide-react';
import { Link } from 'react-router-dom';

import { announcementApi, type Announcement, type AnnouncementTone } from '@/api/announcementApi';

const toneStyles: Record<AnnouncementTone, { shell: string; Icon: React.ElementType }> = {
  INFO: { shell: 'bg-black text-white', Icon: Info },
  SUCCESS: { shell: 'bg-emerald-700 text-white', Icon: CheckCircle2 },
  WARNING: { shell: 'bg-amber-500 text-black', Icon: AlertTriangle },
  CRITICAL: { shell: 'bg-red-700 text-white', Icon: ShieldAlert },
};

const DEFAULT_TONE: AnnouncementTone = 'INFO';

function normalizeAnnouncementTone(value: unknown): AnnouncementTone {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(toneStyles, value)
    ? (value as AnnouncementTone)
    : DEFAULT_TONE;
}

function readDismissal(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function persistDismissal(key: string): void {
  try {
    window.localStorage.setItem(key, key);
  } catch {
    // Storage can be unavailable in strict privacy modes. Dismissing still works for this render.
  }
}

function dismissalKey(announcement: Announcement) {
  return `qf_announcement_dismissed:${announcement.id}:${announcement.version}`;
}

const AnnouncementBanner: React.FC = () => {
  const [dismissed, setDismissed] = useState<string | null>(null);
  const { data: announcement } = useQuery({
    queryKey: ['public-announcement'],
    queryFn: announcementApi.current,
    staleTime: 15_000,
    refetchInterval: 30_000,
    retry: 1,
  });

  const currentDismissalKey = announcement ? dismissalKey(announcement) : null;

  useEffect(() => {
    if (!currentDismissalKey) {
      setDismissed(null);
      return;
    }
    setDismissed(readDismissal(currentDismissalKey));
  }, [currentDismissalKey]);

  if (!announcement || dismissed === currentDismissalKey) return null;

  const tone = normalizeAnnouncementTone(announcement.tone);
  const { shell, Icon } = toneStyles[tone];
  const closeAnnouncement = () => {
    if (!announcement.dismissible || !currentDismissalKey) return;
    persistDismissal(currentDismissalKey);
    setDismissed(currentDismissalKey);
  };

  return (
    <AnimatePresence>
      <motion.div
        key={currentDismissalKey}
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        className={`${shell} relative z-[60] overflow-hidden`}
        role={tone === 'CRITICAL' ? 'alert' : 'status'}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-2.5 text-[11px] font-semibold tracking-wide">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/20">
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <span className="font-black">{announcement.title}：</span>
              <span>{announcement.message}</span>
              {announcement.linkPath && announcement.linkLabel ? (
                <Link className="ml-3 underline underline-offset-4 hover:no-underline" to={announcement.linkPath}>
                  {announcement.linkLabel}
                </Link>
              ) : null}
            </div>
          </div>
          {announcement.dismissible ? (
            <button
              type="button"
              onClick={closeAnnouncement}
              className="shrink-0 rounded-md p-1.5 transition-colors hover:bg-white/20"
              aria-label="关闭当前公告"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default AnnouncementBanner;
