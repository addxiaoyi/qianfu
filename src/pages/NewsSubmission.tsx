import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, Clock3, FileText, Loader2, RefreshCw, Send, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

import { newsSubmissionApi, type NewsSubmission, type NewsSubmissionDraft, type NewsSubmissionStatus } from '@/api/newsSubmissionApi';
import StatusWrapper from '@/components/ui/StatusWrapper';
import { toast } from '@/hooks/use-toast';

const MAX_TITLE_LENGTH = 60;
const MAX_MESSAGE_LENGTH = 20_000;

const statusMeta: Record<NewsSubmissionStatus, { label: string; description: string; className: string; Icon: typeof Clock3 }> = {
  PENDING: { label: '待审核', description: '编辑部会在审核后更新状态。', className: 'border-amber-200 bg-amber-50 text-amber-800', Icon: Clock3 },
  REJECTED: { label: '已驳回', description: '请根据驳回原因修改后重新提交。', className: 'border-rose-200 bg-rose-50 text-rose-800', Icon: XCircle },
  APPROVED: { label: '已发布', description: '这篇投稿已经进入新闻页面。', className: 'border-emerald-200 bg-emerald-50 text-emerald-800', Icon: CheckCircle2 },
};

const emptyDraft: NewsSubmissionDraft = { title: '', message: '' };

function formatSubmissionDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function SubmissionStatus({ submission }: { submission: NewsSubmission }) {
  const meta = statusMeta[submission.status];
  const Icon = meta.Icon;
  return (
    <div className={`rounded-2xl border p-4 ${meta.className}`}>
      <div className="flex items-center gap-2 text-sm font-black"><Icon className="h-4 w-4" /> {meta.label}</div>
      <p className="mt-1 text-xs font-medium leading-5">{meta.description}</p>
      {submission.rejectionReason ? <p className="mt-3 border-t border-current/15 pt-3 text-sm font-bold">驳回原因：{submission.rejectionReason}</p> : null}
    </div>
  );
}

const NewsSubmission: React.FC = () => {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<NewsSubmission | null>(null);
  const [draft, setDraft] = useState<NewsSubmissionDraft>(emptyDraft);
  const submissionsQuery = useQuery({ queryKey: ['news-submissions', 'mine'], queryFn: newsSubmissionApi.mine });
  const submissions = submissionsQuery.data ?? [];

  const saveMutation = useMutation({
    mutationFn: () => editing ? newsSubmissionApi.update(editing.id, draft) : newsSubmissionApi.create(draft),
    onSuccess: async () => {
      toast({ title: editing ? '投稿已重新提交' : '投稿已提交', description: '稿件已进入编辑部审核队列。' });
      setEditing(null);
      setDraft(emptyDraft);
      await queryClient.invalidateQueries({ queryKey: ['news-submissions', 'mine'] });
    },
    onError: (error: unknown) => toast({ variant: 'destructive', title: '投稿提交失败', description: error instanceof Error ? error.message : '请稍后重试。' }),
  });

  const canSubmit = useMemo(() => draft.title.trim().length > 0 && draft.message.trim().length > 0, [draft]);

  const startNew = () => {
    setEditing(null);
    setDraft(emptyDraft);
  };

  const editRejected = (submission: NewsSubmission) => {
    setEditing(submission);
    setDraft({ title: submission.title, message: submission.message });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit || saveMutation.isPending) return;
    saveMutation.mutate();
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 text-zinc-900 sm:px-6 sm:py-12">
      <header className="flex flex-col gap-5 border-b border-zinc-200 pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link to="/me" className="mb-4 inline-flex items-center gap-2 text-xs font-black text-zinc-500 hover:text-black"><ArrowLeft className="h-4 w-4" /> 返回个人中心</Link>
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-zinc-400">NEWSROOM / SUBMISSION</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">投稿新闻</h1>
          <p className="mt-3 max-w-2xl text-sm font-medium leading-7 text-zinc-500">分享服务器动态、社区故事和游戏见闻。投稿通过审核后会刊登在新闻页面。</p>
        </div>
        <button type="button" onClick={startNew} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-black px-5 py-3 text-sm font-black text-white"><FileText className="h-4 w-4" /> 新建投稿</button>
      </header>

      <form onSubmit={submit} className="grid gap-6 rounded-[2rem] border border-zinc-200 bg-white p-5 shadow-sm sm:p-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-zinc-400">{editing ? '重新编辑' : '新稿件'}</p>
            <h2 className="mt-2 text-xl font-black">{editing ? '根据审核意见修改稿件' : '写下你想分享的故事'}</h2>
          </div>
          <label className="block space-y-2 text-sm font-bold">
            <span>标题</span>
            <input required maxLength={MAX_TITLE_LENGTH} value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="给这篇稿件一个清晰的标题" className="w-full rounded-2xl border border-zinc-200 px-4 py-3.5 outline-none focus:border-black" />
            <span className="block text-right text-xs font-medium text-zinc-400">{draft.title.length}/{MAX_TITLE_LENGTH}</span>
          </label>
          <label className="block space-y-2 text-sm font-bold">
            <span>正文</span>
            <textarea required maxLength={MAX_MESSAGE_LENGTH} rows={14} value={draft.message} onChange={(event) => setDraft((current) => ({ ...current, message: event.target.value }))} placeholder="支持长篇叙事，建议分段书写。" className="w-full resize-y rounded-2xl border border-zinc-200 px-4 py-3.5 leading-7 outline-none focus:border-black" />
            <span className="block text-right text-xs font-medium text-zinc-400">{draft.message.length}/{MAX_MESSAGE_LENGTH}</span>
          </label>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            {editing ? <button type="button" onClick={startNew} className="rounded-2xl border border-zinc-200 px-5 py-3 text-sm font-black">取消编辑</button> : null}
            <button type="submit" disabled={!canSubmit || saveMutation.isPending} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-black px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50">{saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {editing ? '重新提交' : '提交审核'}</button>
          </div>
        </div>
        <aside className="rounded-2xl bg-zinc-50 p-5 text-sm">
          <p className="font-black">投稿须知</p>
          <ul className="mt-4 space-y-3 text-xs font-medium leading-5 text-zinc-500">
            <li>只发布真实、清晰、适合社区阅读的内容。</li>
            <li>不支持支付、钱包、商城或推广交易内容。</li>
            <li>审核通过后才会出现在公开新闻页。</li>
            <li>被驳回的稿件可以修改后再次提交。</li>
          </ul>
        </aside>
      </form>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div><p className="text-[10px] font-black uppercase tracking-[0.28em] text-zinc-400">YOUR SUBMISSIONS</p><h2 className="mt-1 text-2xl font-black">我的投稿</h2></div>
          {submissionsQuery.isError ? <button type="button" onClick={() => void submissionsQuery.refetch()} className="inline-flex items-center gap-2 text-xs font-black text-zinc-500"><RefreshCw className="h-4 w-4" /> 重试</button> : null}
        </div>
        <StatusWrapper isLoading={submissionsQuery.isLoading} isError={submissionsQuery.isError} onRetry={() => submissionsQuery.refetch()}>
          {submissions.length === 0 ? <div className="rounded-2xl border border-dashed border-zinc-200 p-10 text-center text-sm font-bold text-zinc-400">还没有投稿记录，写下第一篇吧。</div> : (
            <div className="grid gap-4">
              {submissions.map((submission) => (
                <article key={submission.id} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0"><h3 className="break-words text-lg font-black">{submission.title}</h3><p className="mt-2 text-xs font-medium text-zinc-400">最近更新：{formatSubmissionDate(submission.updatedAt)}</p></div>
                    <div className="shrink-0"><SubmissionStatus submission={submission} /></div>
                  </div>
                  {submission.status === 'REJECTED' ? <button type="button" onClick={() => editRejected(submission)} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-zinc-200 px-4 py-2.5 text-xs font-black hover:bg-zinc-50">修改后重投</button> : null}
                </article>
              ))}
            </div>
          )}
        </StatusWrapper>
      </section>
    </div>
  );
};

export default NewsSubmission;
