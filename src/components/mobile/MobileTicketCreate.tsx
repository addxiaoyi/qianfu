import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { api } from '../../api/request';
import { toast } from '../../hooks/use-toast';
import { cn } from '../../utils/cn';

const categories = [
  { value: 'technical', label: '技术支持', priority: 'HIGH' },
  { value: 'billing', label: '账单问题', priority: 'HIGH' },
  { value: 'server', label: '服务器相关', priority: 'MEDIUM' },
  { value: 'account', label: '账号问题', priority: 'MEDIUM' },
  { value: 'other', label: '其他', priority: 'LOW' },
] as const;

export default function MobileTicketCreate() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<(typeof categories)[number]>(categories[0]);
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = title.trim().length >= 2 && content.trim().length >= 5 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const ticket = await api.post<any>('/tickets', {
        title: title.trim(),
        description: `[${category.label}]\n${content.trim()}`,
        priority: category.priority,
      });
      toast({ title: '工单已提交' });
      navigate(`/tickets/${ticket?.id || ''}`.replace(/\/$/, ''));
    } catch {
      toast({ variant: 'destructive', title: '提交失败', description: '请检查网络后重试。' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="min-h-screen bg-white px-4 py-4 space-y-5 pb-24" onSubmit={(event) => { event.preventDefault(); void handleSubmit(); }}>
      <div>
        <label htmlFor="mobile-ticket-title" className="block text-sm font-medium text-zinc-700 mb-2">标题</label>
        <input
          id="mobile-ticket-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="简要描述您的问题"
          className="w-full h-12 px-4 rounded-xl border border-zinc-200 bg-zinc-50 text-sm focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-300"
        />
      </div>

      <fieldset>
        <legend className="block text-sm font-medium text-zinc-700 mb-2">分类</legend>
        <div className="grid grid-cols-2 gap-2">
          {categories.map((cat) => (
            <button
              key={cat.value}
              type="button"
              onClick={() => setCategory(cat)}
              aria-pressed={category.value === cat.value}
              className={cn(
                'h-12 rounded-xl border text-sm font-medium transition-colors',
                category.value === cat.value
                  ? 'bg-zinc-900 text-white border-zinc-900'
                  : 'bg-white text-zinc-700 border-zinc-200',
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="mobile-ticket-content" className="block text-sm font-medium text-zinc-700 mb-2">详细描述</label>
        <textarea
          id="mobile-ticket-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="请详细描述您遇到的问题..."
          rows={6}
          className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-zinc-50 text-sm focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-300 resize-none"
        />
      </div>

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full h-14 bg-zinc-900 text-white text-sm font-bold rounded-xl disabled:opacity-40 transition-opacity flex items-center justify-center gap-2"
      >
        {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
        提交工单
      </button>
    </form>
  );
}
