import { api } from './request';

export type NewsSubmissionStatus = 'PENDING' | 'REJECTED' | 'APPROVED';

export type NewsSubmission = {
  id: string;
  userId: number;
  authorName: string | null;
  title: string;
  message: string;
  status: NewsSubmissionStatus;
  rejectionReason: string | null;
  announcementId: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type NewsSubmissionDraft = Pick<NewsSubmission, 'title' | 'message'>;

function writeHeaders() {
  return { 'Idempotency-Key': crypto.randomUUID() };
}

export const newsSubmissionApi = {
  mine: () => api.get<NewsSubmission[]>('/news-submissions/me'),
  create: (draft: NewsSubmissionDraft) => api.post<NewsSubmission>('/news-submissions', draft, { headers: writeHeaders() }),
  update: (id: string, draft: NewsSubmissionDraft) => api.patch<NewsSubmission>(`/news-submissions/${id}`, draft, { headers: writeHeaders() }),
  adminList: () => api.get<NewsSubmission[]>('/admin/news-submissions'),
  approve: (id: string) => api.post<NewsSubmission>(`/admin/news-submissions/${id}/approve`, undefined, { headers: writeHeaders() }),
  reject: (id: string, reason: string) => api.post<NewsSubmission>(`/admin/news-submissions/${id}/reject`, { reason }, { headers: writeHeaders() }),
};
