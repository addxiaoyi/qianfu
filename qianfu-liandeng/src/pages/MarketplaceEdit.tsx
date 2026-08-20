import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, LampDesk } from 'lucide-react';
import { api } from '@/api/request';
import { sanitizeUrl, isUrlSafe, isImageUrlSafe } from '@/utils/urlValidator';
import { fenToYuanText, parseYuanToFen } from '@/utils/money';

type Product = {
  id: string;
  title: string;
  category: string;
  description: string;
  price: number;
  author: string;
  coverUrl?: string;
  downloadUrl?: string;
};

export default function MarketplaceEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isCreating = !id;
  const [form, setForm] = useState({ title: '', category: 'map', description: '', price: '1.00', author: '', coverUrl: '', downloadUrl: '' });
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [resourceFile, setResourceFile] = useState<File | null>(null);
  const [coverObjectUrl, setCoverObjectUrl] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [pulse, setPulse] = useState(0);

  useEffect(() => {
    if (isCreating) return;
    api.get<{ product: Product }>(`/qianfu/marketplace/products/${id}`)
      .then((data) => {
        const p = data.product;
        setForm({ title: p.title, category: p.category, description: p.description, price: fenToYuanText(p.price), author: p.author, coverUrl: p.coverUrl || '', downloadUrl: p.downloadUrl || '' });
      })
      .catch(() => setMessage('加载商品失败'));
  }, [id, isCreating]);

  const uploadAsset = async (file: File, kind: 'image' | 'asset' = 'image') => {
    const formData = new FormData();
    formData.append('kind', kind);
    formData.append('file', file);
    const result = await api.post<{ data?: { url: string }; url?: string }>('/upload', formData, { skipCsrf: false, useAuth: true });
    return result?.data?.url || result?.url || '';
  };

  useEffect(() => {
    if (!coverFile) {
      setCoverObjectUrl('');
      return;
    }
    const objectUrl = URL.createObjectURL(coverFile);
    setCoverObjectUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [coverFile]);

  const coverPreview = useMemo(() => {
    if (coverObjectUrl) return coverObjectUrl;
    if (form.coverUrl && isImageUrlSafe(form.coverUrl)) return sanitizeUrl(form.coverUrl);
    return '';
  }, [coverObjectUrl, form.coverUrl]);

  const resourcePreview = useMemo(() => {
    if (resourceFile) return resourceFile.name;
    return form.downloadUrl || '尚未设置资源链接';
  }, [resourceFile, form.downloadUrl]);

  const save = async () => {
    setSaving(true);
    try {
      if (!coverFile && form.coverUrl && !isImageUrlSafe(form.coverUrl)) {
        throw new Error('封面地址不安全或不是允许的图片 URL');
      }
      if (!resourceFile && form.downloadUrl && !isUrlSafe(form.downloadUrl)) {
        throw new Error('下载地址不安全');
      }
      const price = parseYuanToFen(form.price);
      if (price === null || price < 1) {
        throw new Error('请输入有效的商品价格，最多保留两位小数');
      }
      if (price > 1_000_000) {
        throw new Error('商品价格不能超过 ¥10,000.00');
      }
      const coverUrl = coverFile ? await uploadAsset(coverFile, 'image') : sanitizeUrl(form.coverUrl);
      const downloadUrl = resourceFile ? await uploadAsset(resourceFile, 'asset') : sanitizeUrl(form.downloadUrl);
      const payload = { ...form, price, coverUrl, downloadUrl };
      if (isCreating) {
        const created = await api.post<{ product: Product }>('/qianfu/marketplace/products', payload);
        setMessage('商品已创建，正在等待平台审核；审核通过后才会公开展示与销售。');
        navigate(`/marketplace/edit/${created.product.id}`, { replace: true });
      } else {
        await api.patch(`/qianfu/marketplace/products/${id}`, payload);
        setMessage('修改已提交，商品已转为待审核状态。');
      }
      setPulse((n) => n + 1);
      setTimeout(() => setMessage(''), 2200);
      setCoverFile(null);
      setResourceFile(null);
    } catch (e: any) {
      setMessage(e?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-16 space-y-6">
      <div className="rounded-3xl border border-border bg-card p-6 md:p-8 shadow-sm space-y-3">
        <div className="text-[10px] font-black uppercase tracking-[0.45em] italic text-accent">{isCreating ? '新建商品' : '编辑商品'}</div>
        <h1 className="text-3xl md:text-4xl font-black tracking-tight">{isCreating ? '发布新商品' : '编辑商品'}</h1>
        <p className="text-sm text-muted-foreground">{isCreating ? '仅允许 Minecraft 数字资源与数字服务。创建后进入审核，审核通过才会公开展示与销售。' : '修改商品信息、封面图或资源附件后会重新进入审核，审核通过后恢复公开展示。'}</p>
        {message && (
          <div className={`mt-4 rounded-2xl border p-4 text-sm flex items-center gap-3 ${message.includes('成功') ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-border bg-muted/20'}`}>
            {message.includes('成功') ? <CheckCircle2 className="w-4 h-4" /> : <LampDesk className="w-4 h-4" />}
            <span>{message}</span>
          </div>
        )}
      </div>

      <div key={pulse} className="grid lg:grid-cols-[1.1fr_0.9fr] gap-6 items-start transition-all duration-300">
        <div className="rounded-3xl border border-border bg-card p-6 md:p-8 space-y-5 shadow-sm">
          <div className="grid md:grid-cols-2 gap-4">
            <input aria-label="商品标题" className="rounded-xl border border-border px-4 py-3 bg-background" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="标题" />
            <input aria-label="商品分类" className="rounded-xl border border-border px-4 py-3 bg-background" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="分类" />
            <input aria-label="商品作者" className="rounded-xl border border-border px-4 py-3 bg-background" value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} placeholder="作者" />
            <input aria-label="商品价格，单位元" type="number" min="0.01" max="10000" step="0.01" inputMode="decimal" className="rounded-xl border border-border px-4 py-3 bg-background" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="价格（元）" />
            <input aria-label="商品封面地址" className="rounded-xl border border-border px-4 py-3 bg-background md:col-span-2" value={form.coverUrl} onChange={(e) => setForm({ ...form, coverUrl: e.target.value })} placeholder="封面地址" />
            <input aria-label="商品下载地址" className="rounded-xl border border-border px-4 py-3 bg-background md:col-span-2" value={form.downloadUrl} onChange={(e) => setForm({ ...form, downloadUrl: e.target.value })} placeholder="下载地址" />
            <label className="rounded-xl border border-dashed border-border px-4 py-3 bg-background text-sm text-muted-foreground cursor-pointer md:col-span-2">
              <span className="block font-bold text-foreground mb-1">重新上传封面图</span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => setCoverFile(e.target.files?.[0] || null)} />
              {coverFile ? coverFile.name : '选择 PNG / JPG / WEBP'}
            </label>
            <label className="rounded-xl border border-dashed border-border px-4 py-3 bg-background text-sm text-muted-foreground cursor-pointer md:col-span-2">
              <span className="block font-bold text-foreground mb-1">重新上传资源文件</span>
              <input type="file" accept=".zip,.jar,.json,.txt,.md,.schem,.schematic" className="hidden" onChange={(e) => setResourceFile(e.target.files?.[0] || null)} />
              {resourceFile ? resourceFile.name : '选择 ZIP / JAR / Schematic / 文本'}
            </label>
            <textarea aria-label="商品描述" className="rounded-xl border border-border px-4 py-3 md:col-span-2 min-h-40 bg-background" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="描述" />
          </div>
          <div className="flex gap-3 flex-wrap">
            <button type="button" onClick={save} disabled={saving} className="px-5 py-3 rounded-xl bg-black text-white font-bold disabled:opacity-60">{saving ? '保存中...' : isCreating ? '提交审核' : '保存并重新提交审核'}</button>
            <Link to="/marketplace/manage" className="px-5 py-3 rounded-xl border border-border font-bold">返回管理</Link>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-3xl border border-border bg-card p-5 shadow-sm space-y-4 overflow-hidden relative">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-black via-zinc-400 to-zinc-200" />
            <div className="text-xs font-black uppercase tracking-[0.35em] text-muted-foreground">封面预览</div>
            <div className="rounded-2xl overflow-hidden border border-border bg-muted/20 aspect-[4/3] transition-all duration-500 hover:scale-[1.01]">
              {coverPreview ? <img src={coverPreview} alt="封面预览" className="w-full h-full object-cover transition-transform duration-500" /> : null}
            </div>
            <div className="text-sm text-muted-foreground break-all">{coverFile?.name || form.coverUrl || '尚未选择封面图'}</div>
          </div>

          <div className="rounded-3xl border border-border bg-card p-5 shadow-sm space-y-4 overflow-hidden relative">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 via-sky-500 to-purple-500" />
            <div className="text-xs font-black uppercase tracking-[0.35em] text-muted-foreground">资源预览</div>
            <div className="rounded-2xl border border-dashed border-border bg-gradient-to-br from-muted/20 to-background p-5 min-h-[170px] flex flex-col justify-between transition-all duration-500 hover:translate-y-[-1px]">
              <div>
                <div className="text-sm font-bold">{resourceFile ? resourceFile.name : '资源链接 / 文件名'}</div>
                <div className="text-sm text-muted-foreground mt-2 leading-6">{resourcePreview}</div>
              </div>
              <div className="text-xs text-muted-foreground mt-4">支持 ZIP、JAR、JSON、TXT、MD、Schematic 等附件。</div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
