import React, { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, Check, Clock3, Edit3, ImagePlus, Loader2, Megaphone, Newspaper, Plus, Send, Trash2, Upload, X, XCircle } from 'lucide-react';

import {
  announcementApi,
  type Announcement,
  type AnnouncementDraft,
  type AnnouncementStatus,
  type AnnouncementTone,
} from '@/api/announcementApi';
import { newsSubmissionApi, type NewsSubmission } from '@/api/newsSubmissionApi';
import AdminPageHeader from '@/components/ui/AdminPageHeader';
import CustomSelect from '@/components/ui/CustomSelect';
import StatusWrapper from '@/components/ui/StatusWrapper';
import { toast } from '@/hooks/use-toast';
import { formatDateTime } from '@/utils/serverView';
import { appendAnnouncementImage, parseAnnouncementMessage } from '@/utils/announcementContent';
import { uploadImageFile } from '@/utils/imageUpload';

const MAX_NEWS_MESSAGE_LENGTH = 20_000;

const emptyDraft: AnnouncementDraft = {
  title: '',
  message: '',
  tone: 'INFO',
  status: 'DRAFT',
  linkLabel: null,
  linkPath: null,
  startsAt: null,
  endsAt: null,
  priority: 50,
  dismissible: true,
};

const toneLabels: Record<AnnouncementTone, string> = {
  INFO: '普通通知',
  SUCCESS: '成功通知',
  WARNING: '重要提醒',
  CRITICAL: '紧急公告',
};

const statusLabels: Record<AnnouncementStatus, string> = {
  DRAFT: '草稿',
  PUBLISHED: '已发布',
  ARCHIVED: '已下线',
};

const toneOptions: { value: AnnouncementTone; label: string }[] = [
  { value: 'INFO', label: toneLabels.INFO },
  { value: 'SUCCESS', label: toneLabels.SUCCESS },
  { value: 'WARNING', label: toneLabels.WARNING },
  { value: 'CRITICAL', label: toneLabels.CRITICAL },
];

const statusOptions: { value: AnnouncementStatus; label: string }[] = [
  { value: 'DRAFT', label: statusLabels.DRAFT },
  { value: 'PUBLISHED', label: statusLabels.PUBLISHED },
  { value: 'ARCHIVED', label: statusLabels.ARCHIVED },
];

function toLocalDateTime(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function toIsoDateTime(value: string) {
  return value ? new Date(value).toISOString() : null;
}

function toDraft(announcement: Announcement): AnnouncementDraft {
  return {
    title: announcement.title,
    message: announcement.message,
    tone: announcement.tone,
    status: announcement.status ?? 'DRAFT',
    linkLabel: announcement.linkLabel,
    linkPath: announcement.linkPath,
    startsAt: announcement.startsAt,
    endsAt: announcement.endsAt,
    priority: announcement.priority,
    dismissible: announcement.dismissible,
  };
}

function estimateReadingMinutes(message: string): number {
  const text = message.replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\s/g, '');
  return Math.max(1, Math.ceil(text.length / 420));
}

function NewspaperPreview({ draft }: { draft: AnnouncementDraft }) {
  let paragraphIndex = 0;

  return (
    <section data-testid="newspaper-preview" className="border-y-4 border-double border-zinc-950 bg-[#f8f7f3] p-5 text-zinc-950 sm:p-7">
      <div className="flex items-center justify-between gap-3 border-b border-zinc-300 pb-4">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-accent">
          <Newspaper className="h-4 w-4" aria-hidden="true" />
          联灯日报 / 预览
        </div>
        <span className="text-[10px] font-bold text-zinc-400">{estimateReadingMinutes(draft.message)} 分钟</span>
      </div>
      <h3 className="mt-6 break-words font-serif text-3xl font-black leading-tight tracking-[-0.04em]">
        {draft.title.trim() || '未命名新闻'}
      </h3>
      <div className="mt-4 flex items-center gap-2 text-xs font-bold text-zinc-500">
        <Clock3 className="h-4 w-4 text-accent" aria-hidden="true" />
        阅读时间约 {estimateReadingMinutes(draft.message)} 分钟
      </div>
      <div className="mt-6 border-l-2 border-accent pl-4 text-sm font-medium leading-7 text-zinc-700">
        {parseAnnouncementMessage(draft.message).map((block, blockIndex) => {
          if (block.type === 'image') {
            return <img key={`${block.url}-${blockIndex}`} src={block.url} alt={block.alt} className="my-4 max-h-56 w-full object-contain" />;
          }

          return block.value.split(/\n{2,}/).map((paragraph, index) => {
            const trimmed = paragraph.trim();
            if (!trimmed) return null;

            const isLeadParagraph = paragraphIndex === 0;
            paragraphIndex += 1;
            return (
              <p key={`${blockIndex}-${index}-${trimmed.slice(0, 20)}`} className={`mb-4 whitespace-pre-wrap last:mb-0 ${isLeadParagraph ? 'first-letter:mr-2 first-letter:text-5xl first-letter:font-black first-letter:leading-[0.75] first-letter:text-accent' : ''}`}>
                {trimmed}
              </p>
            );
          });
        })}
        {!draft.message.trim() ? <p className="text-zinc-400">正文预览将在这里显示。</p> : null}
      </div>
    </section>
  );
}

const AdminAnnouncements: React.FC = () => {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [draft, setDraft] = useState<AnnouncementDraft>(emptyDraft);
  const [imageUploading, setImageUploading] = useState(false);
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});
  const imageInputRef = useRef<HTMLInputElement>(null);

  const announcementsQuery = useQuery({
    queryKey: ['admin-announcements'],
    queryFn: announcementApi.list,
  });
  const submissionsQuery = useQuery({
    queryKey: ['admin-news-submissions'],
    queryFn: newsSubmissionApi.adminList,
  });

  const refreshAnnouncements = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin-announcements'] }),
      queryClient.invalidateQueries({ queryKey: ['public-announcement'] }),
      queryClient.invalidateQueries({ queryKey: ['public-news'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-news-submissions'] }),
    ]);
  };

  const saveMutation = useMutation({
    mutationFn: () => editingId
      ? announcementApi.update(editingId, draft)
      : announcementApi.create(draft),
    onSuccess: async () => {
      toast({ title: editingId ? '新闻已更新' : '新闻已创建' });
      setEditingId(null);
      setDraft(emptyDraft);
      setShowEditor(false);
      await refreshAnnouncements();
    },
    onError: (error: unknown) => toast({ variant: 'destructive', title: '新闻保存失败', description: error instanceof Error ? error.message : '请稍后重试。' }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AnnouncementStatus }) =>
      announcementApi.update(id, { status }),
    onSuccess: async (_, variables) => {
      toast({ title: variables.status === 'PUBLISHED' ? '新闻已发布' : '新闻已下线' });
      await refreshAnnouncements();
    },
    onError: (error: unknown) => toast({ variant: 'destructive', title: '新闻状态更新失败', description: error instanceof Error ? error.message : '请稍后重试。' }),
  });

  const deleteMutation = useMutation({
    mutationFn: announcementApi.remove,
    onSuccess: async () => {
      toast({ title: '新闻已删除' });
      await refreshAnnouncements();
    },
    onError: (error: unknown) => toast({ variant: 'destructive', title: '新闻删除失败', description: error instanceof Error ? error.message : '请稍后重试。' }),
  });

  const approveSubmissionMutation = useMutation({
    mutationFn: newsSubmissionApi.approve,
    onSuccess: async () => {
      toast({ title: '投稿已通过并发布' });
      await refreshAnnouncements();
    },
    onError: (error: unknown) => toast({ variant: 'destructive', title: '投稿审核失败', description: error instanceof Error ? error.message : '请稍后重试。' }),
  });

  const rejectSubmissionMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => newsSubmissionApi.reject(id, reason),
    onSuccess: async (_, variables) => {
      setRejectionReasons((current) => ({ ...current, [variables.id]: '' }));
      toast({ title: '投稿已驳回' });
      await refreshAnnouncements();
    },
    onError: (error: unknown) => toast({ variant: 'destructive', title: '投稿驳回失败', description: error instanceof Error ? error.message : '请稍后重试。' }),
  });

  const announcementActionPending = statusMutation.isPending || deleteMutation.isPending;
  const reviewActionPending = approveSubmissionMutation.isPending || rejectSubmissionMutation.isPending;

  const openCreator = () => {
    setEditingId(null);
    setDraft(emptyDraft);
    setShowEditor(true);
  };

  const openEditor = (announcement: Announcement) => {
    setEditingId(announcement.id);
    setDraft(toDraft(announcement));
    setShowEditor(true);
  };

  const closeEditor = () => {
    setEditingId(null);
    setDraft(emptyDraft);
    setShowEditor(false);
    setImageUploading(false);
  };

  const uploadNewsImage = async (file: File) => {
    if (imageUploading) return;
    setImageUploading(true);
    try {
      const url = await uploadImageFile(file, 'announcement-image');
      setDraft((current) => ({ ...current, message: appendAnnouncementImage(current.message, url) }));
      toast({ title: '图片已上传到 R2' });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: '新闻图片上传失败',
        description: error instanceof Error ? error.message : '请检查 R2 配置后重试。',
      });
    } finally {
      setImageUploading(false);
    }
  };

  const openImagePicker = () => imageInputRef.current?.click();

  const onImageInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) void uploadNewsImage(file);
  };

  const onImageDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  };

  const onImageDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) void uploadNewsImage(file);
  };

  const saveAnnouncement = (event: React.FormEvent) => {
    event.preventDefault();
    saveMutation.mutate();
  };

  const deleteAnnouncement = (announcement: Announcement) => {
    if (!window.confirm(`确定永久删除新闻“${announcement.title}”吗？`)) return;
    deleteMutation.mutate(announcement.id);
  };

  const announcements = announcementsQuery.data ?? [];
  const publishedCount = announcements.filter((item) => item.status === 'PUBLISHED').length;

  return (
    <div className="space-y-12 bg-white pb-28 text-zinc-900">
      <AdminPageHeader
        badge="PUBLIC NEWS / CONTROL"
        title="新闻管理"
        description="创建、定时、发布和下线平台新闻。公开页面只展示当前时间窗口内的已发布内容。"
        statusLabel={`TOTAL ${announcements.length} / LIVE ${publishedCount}`}
        statusTone={publishedCount > 0 ? 'success' : 'warning'}
        rightSlot={(
          <button
            type="button"
            onClick={openCreator}
            className="inline-flex items-center gap-3 rounded-2xl bg-black px-6 py-4 text-xs font-black tracking-[0.2em] text-white"
          >
            <Plus className="h-4 w-4" /> 新建新闻
          </button>
        )}
      />

      {showEditor ? (
        <form onSubmit={saveAnnouncement} className="space-y-7 rounded-[2.5rem] border border-zinc-200 bg-zinc-50/70 p-8 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
               <div className="text-xs font-black uppercase tracking-[0.3em] text-zinc-400">联灯日报编辑部 / Announcement Editor</div>
              <h2 className="mt-2 text-2xl font-black">{editingId ? '编辑新闻' : '新建新闻'}</h2>
            </div>
            <button type="button" onClick={closeEditor} className="rounded-xl border border-zinc-200 p-3 hover:bg-white" aria-label="关闭编辑器">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <label className="space-y-2 text-sm font-bold">
                <span>新闻标题</span>
              <input required maxLength={60} value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} className="w-full rounded-2xl border border-zinc-200 bg-white px-5 py-4 outline-none focus:border-black" />
            </label>
            <div className="grid grid-cols-2 gap-4">
              <label className="space-y-2 text-sm font-bold">
                <span>类型</span>
                <CustomSelect
                  value={draft.tone}
                  options={toneOptions}
                  onChange={(tone) => setDraft((current) => ({ ...current, tone }))}
                  ariaLabel="新闻类型"
                />
              </label>
              <label className="space-y-2 text-sm font-bold">
                <span>状态</span>
                <CustomSelect
                  value={draft.status}
                  options={statusOptions}
                  onChange={(status) => setDraft((current) => ({ ...current, status }))}
                  ariaLabel="新闻状态"
                />
              </label>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.7fr)]">
            <label className="block space-y-2 text-sm font-bold">
              <span>新闻正文</span>
              <textarea required maxLength={MAX_NEWS_MESSAGE_LENGTH} rows={18} value={draft.message} onChange={(event) => setDraft((current) => ({ ...current, message: event.target.value }))} className="w-full resize-y rounded-2xl border border-zinc-200 bg-white px-5 py-4 leading-7 outline-none focus:border-black" />
              <span className="block text-right text-xs text-zinc-400">{draft.message.length}/{MAX_NEWS_MESSAGE_LENGTH}</span>
            </label>
            <NewspaperPreview draft={draft} />
          </div>

           <div
             onDragOver={onImageDragOver}
             onDrop={onImageDrop}
             className="rounded-2xl border border-dashed border-zinc-300 bg-white p-5 text-sm font-bold text-zinc-500"
           >
             <input ref={imageInputRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={onImageInputChange} aria-label="选择新闻图片" className="sr-only" />
             <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
               <div className="flex items-start gap-3">
                 <ImagePlus className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
                 <div>
                   <p className="text-zinc-900">拖拽图片到这里，或选择图片插入正文</p>
                   <p className="mt-1 text-xs font-medium text-zinc-400">PNG、JPG、GIF、WEBP，单张不超过 5MB。图片统一保存到 R2。</p>
                 </div>
               </div>
               <button type="button" onClick={openImagePicker} disabled={imageUploading} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-zinc-200 px-4 py-3 text-xs font-black text-zinc-900 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50">
                 {imageUploading ? <Loader2 className="h-4 w-4" aria-hidden="true" /> : <Upload className="h-4 w-4" aria-hidden="true" />}
                 {imageUploading ? '上传中…' : '选择图片'}
               </button>
             </div>
           </div>

          <div className="grid gap-5 lg:grid-cols-4">
            <label className="space-y-2 text-sm font-bold">
              <span>链接文字</span>
              <input maxLength={20} value={draft.linkLabel ?? ''} onChange={(event) => setDraft((current) => ({ ...current, linkLabel: event.target.value || null }))} placeholder="查看详情" className="w-full rounded-2xl border border-zinc-200 bg-white px-5 py-4" />
            </label>
            <label className="space-y-2 text-sm font-bold">
              <span>站内链接</span>
              <input maxLength={200} value={draft.linkPath ?? ''} onChange={(event) => setDraft((current) => ({ ...current, linkPath: event.target.value || null }))} placeholder="/status" pattern="/(?!/).*" className="w-full rounded-2xl border border-zinc-200 bg-white px-5 py-4" />
            </label>
            <label className="space-y-2 text-sm font-bold">
              <span>开始时间</span>
              <input type="datetime-local" value={toLocalDateTime(draft.startsAt)} onChange={(event) => setDraft((current) => ({ ...current, startsAt: toIsoDateTime(event.target.value) }))} className="w-full rounded-2xl border border-zinc-200 bg-white px-5 py-4" />
            </label>
            <label className="space-y-2 text-sm font-bold">
              <span>结束时间</span>
              <input type="datetime-local" value={toLocalDateTime(draft.endsAt)} onChange={(event) => setDraft((current) => ({ ...current, endsAt: toIsoDateTime(event.target.value) }))} className="w-full rounded-2xl border border-zinc-200 bg-white px-5 py-4" />
            </label>
          </div>

          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
            <div className="flex flex-wrap items-center gap-6">
              <label className="flex items-center gap-3 text-sm font-bold">
                <span>优先级</span>
                <input type="number" min={0} max={100} value={draft.priority} onChange={(event) => setDraft((current) => ({ ...current, priority: Number(event.target.value) }))} className="w-24 rounded-xl border border-zinc-200 bg-white px-4 py-3" />
              </label>
              <label className="flex items-center gap-3 text-sm font-bold">
                <input type="checkbox" checked={draft.dismissible} onChange={(event) => setDraft((current) => ({ ...current, dismissible: event.target.checked }))} className="h-4 w-4" />
                允许访客关闭
              </label>
            </div>
            <button type="submit" disabled={saveMutation.isPending} className="inline-flex items-center justify-center gap-3 rounded-2xl bg-black px-7 py-4 text-sm font-black text-white disabled:opacity-50">
              <Send className="h-4 w-4" /> {saveMutation.isPending ? '保存中…' : '保存新闻'}
            </button>
          </div>
        </form>
      ) : null}

      <section className="space-y-5 rounded-[2.5rem] border border-amber-200 bg-amber-50/40 p-6 sm:p-8">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.3em] text-amber-700">COMMUNITY DESK / REVIEW</div>
            <h2 className="mt-2 text-2xl font-black">投稿审核</h2>
            <p className="mt-2 text-sm font-medium text-zinc-500">审核通过后自动生成公开新闻；驳回必须填写清晰原因。</p>
          </div>
          <span className="rounded-full border border-amber-200 bg-white px-3 py-2 text-xs font-black text-amber-800">待审核 {submissionsQuery.data?.length ?? 0}</span>
        </div>
        <StatusWrapper isLoading={submissionsQuery.isLoading} isError={submissionsQuery.isError} onRetry={() => submissionsQuery.refetch()}>
          {(submissionsQuery.data ?? []).length === 0 ? (
            <div className="rounded-2xl border border-dashed border-amber-200 bg-white/70 p-10 text-center text-sm font-bold text-zinc-400">当前没有待审核投稿。</div>
          ) : (
            <div className="grid gap-4">
              {(submissionsQuery.data ?? []).map((submission: NewsSubmission) => {
                const reason = rejectionReasons[submission.id] ?? '';
                return (
                  <article key={submission.id} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-col gap-4 xl:flex-row xl:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-zinc-400">
                          <span>投稿人：{submission.authorName || `用户 #${submission.userId}`}</span>
                          <span>提交于：{formatDateTime(submission.createdAt)}</span>
                        </div>
                        <h3 className="mt-3 break-words text-xl font-black">{submission.title}</h3>
                        <p className="mt-3 whitespace-pre-wrap break-words text-sm font-medium leading-7 text-zinc-600">{submission.message}</p>
                      </div>
                      <div className="w-full shrink-0 space-y-3 xl:max-w-sm">
                        <label className="block space-y-2 text-xs font-black">
                          <span>驳回原因</span>
                          <textarea
                            value={reason}
                            onChange={(event) => setRejectionReasons((current) => ({ ...current, [submission.id]: event.target.value }))}
                            placeholder="例如：请补充来源，或删去与主题无关的段落。"
                            rows={4}
                            maxLength={500}
                            className="w-full resize-y rounded-xl border border-zinc-200 px-3 py-2.5 text-sm font-medium outline-none focus:border-rose-400"
                          />
                        </label>
                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => approveSubmissionMutation.mutate(submission.id)} disabled={reviewActionPending} className="inline-flex items-center gap-2 rounded-xl bg-black px-4 py-3 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-50"><Check className="h-4 w-4" /> 通过并发布</button>
                          <button type="button" onClick={() => rejectSubmissionMutation.mutate({ id: submission.id, reason: reason.trim() })} disabled={reviewActionPending || reason.trim().length < 2} className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-black text-rose-800 disabled:cursor-not-allowed disabled:opacity-50"><XCircle className="h-4 w-4" /> 驳回投稿</button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </StatusWrapper>
      </section>

      <StatusWrapper isLoading={announcementsQuery.isLoading} isError={announcementsQuery.isError} onRetry={() => announcementsQuery.refetch()}>
        <div className="grid gap-6">
          {announcements.length === 0 ? (
            <div className="rounded-[2.5rem] border border-dashed border-zinc-200 py-24 text-center">
              <Megaphone className="mx-auto h-10 w-10 text-zinc-300" />
              <p className="mt-5 text-sm font-bold text-zinc-400">还没有新闻，点击“新建新闻”开始。</p>
            </div>
          ) : announcements.map((announcement) => (
            <article key={announcement.id} className="rounded-[2.5rem] border border-zinc-200 bg-white p-7 shadow-sm">
              <div className="flex flex-col justify-between gap-6 xl:flex-row xl:items-center">
                <div className="min-w-0 space-y-3">
                  <div className="flex flex-wrap items-center gap-3 text-[10px] font-black uppercase tracking-[0.24em]">
                    <span className="rounded-full bg-zinc-900 px-3 py-1.5 text-white">{toneLabels[announcement.tone]}</span>
                    <span className="rounded-full bg-zinc-100 px-3 py-1.5 text-zinc-500">{statusLabels[announcement.status ?? 'DRAFT']}</span>
                    <span className="text-zinc-400">优先级 {announcement.priority}</span>
                    <span className="text-zinc-400">版本 {announcement.version}</span>
                  </div>
                  <h2 className="text-xl font-black">{announcement.title}</h2>
                  <p className="max-w-4xl break-words text-sm font-medium leading-7 text-zinc-600">{announcement.message}</p>
                  <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-zinc-400">
                    <span>开始：{announcement.startsAt ? formatDateTime(announcement.startsAt) : '立即'}</span>
                    <span>结束：{announcement.endsAt ? formatDateTime(announcement.endsAt) : '长期'}</span>
                    <span>更新：{formatDateTime(announcement.updatedAt)}</span>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-3">
                  <button type="button" onClick={() => openEditor(announcement)} disabled={announcementActionPending} className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 px-4 py-3 text-xs font-black hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"><Edit3 className="h-4 w-4" /> 编辑</button>
                  {announcement.status === 'PUBLISHED' ? (
                    <button type="button" onClick={() => statusMutation.mutate({ id: announcement.id, status: 'ARCHIVED' })} disabled={announcementActionPending} aria-busy={statusMutation.isPending} className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-black text-amber-800 disabled:cursor-not-allowed disabled:opacity-50"><Archive className="h-4 w-4" /> {statusMutation.isPending ? '处理中…' : '下线'}</button>
                  ) : (
                    <button type="button" onClick={() => statusMutation.mutate({ id: announcement.id, status: 'PUBLISHED' })} disabled={announcementActionPending} aria-busy={statusMutation.isPending} className="inline-flex items-center gap-2 rounded-xl bg-black px-4 py-3 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-50"><Send className="h-4 w-4" /> {statusMutation.isPending ? '处理中…' : '发布'}</button>
                  )}
                  <button type="button" onClick={() => deleteAnnouncement(announcement)} disabled={announcementActionPending} aria-busy={deleteMutation.isPending} className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-4 py-3 text-xs font-black text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"><Trash2 className="h-4 w-4" /> {deleteMutation.isPending ? '删除中…' : '删除'}</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </StatusWrapper>
    </div>
  );
};

export default AdminAnnouncements;
