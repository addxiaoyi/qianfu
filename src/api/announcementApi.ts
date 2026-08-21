import { api } from './request';

export type AnnouncementTone = 'INFO' | 'SUCCESS' | 'WARNING' | 'CRITICAL';
export type AnnouncementStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export type Announcement = {
  id: string;
  title: string;
  message: string;
  tone: AnnouncementTone;
  status?: AnnouncementStatus;
  linkLabel: string | null;
  linkPath: string | null;
  startsAt: string | null;
  endsAt: string | null;
  priority: number;
  dismissible: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type AnnouncementDraft = {
  title: string;
  message: string;
  tone: AnnouncementTone;
  status: AnnouncementStatus;
  linkLabel: string | null;
  linkPath: string | null;
  startsAt: string | null;
  endsAt: string | null;
  priority: number;
  dismissible: boolean;
};

function writeHeaders() {
  return { 'Idempotency-Key': crypto.randomUUID() };
}

export const announcementApi = {
  current: () => api.get<Announcement | null>('/announcements/current', undefined, { useAuth: false }),
  publicList: () => api.get<Announcement[]>('/announcements', undefined, { useAuth: false }),
  list: () => api.get<Announcement[]>('/admin/announcements'),
  create: (draft: AnnouncementDraft) => api.post<Announcement>('/admin/announcements', draft, { headers: writeHeaders() }),
  update: (id: string, patch: Partial<AnnouncementDraft>) => api.patch<Announcement>(`/admin/announcements/${id}`, patch, { headers: writeHeaders() }),
  remove: (id: string) => api.delete<{ id: string; deleted: true }>(`/admin/announcements/${id}`, { headers: writeHeaders() }),
};
