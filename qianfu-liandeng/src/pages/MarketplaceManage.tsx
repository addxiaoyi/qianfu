import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/api/request';

type Product = {
  id: string;
  title: string;
  category: string;
  price: number;
  sales: number;
  rating: number;
  reviewCount: number;
  author: string;
};

type UploadAsset = {
  url: string;
  filename: string;
  mime: string;
  size: number;
};

type ShopVersion = { id: string; createdAt: string; config: { bannerUrl: string; avatarUrl: string; shopName: string; announcementTitle: string; announcementText: string; bio: string; theme?: string } };

export default function MarketplaceManage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [message, setMessage] = useState('');
  const [uploads, setUploads] = useState<UploadAsset[]>([]);
  const [diffLeft, setDiffLeft] = useState<ShopVersion | null>(null);
  const [diffRight, setDiffRight] = useState<ShopVersion | null>(null);
  const [versions, setVersions] = useState<ShopVersion[]>([]);

  const load = async () => {
    const data = await api.get<{ products: Product[] }>('/qianfu/marketplace/me/listings');
    setProducts(data.products || []);
    const history = await api.get<{ versions: ShopVersion[] }>('/qianfu/marketplace/shop/history').catch(() => ({ versions: [] as ShopVersion[] }));
    setVersions(history.versions || []);
  };

  useEffect(() => {
    load().catch(() => setProducts([]));
  }, []);

  const unpublish = async (id: string) => {
    try {
      await api.post(`/qianfu/marketplace/products/${id}/unpublish`, {});
      setMessage('已下架');
      await load();
    } catch (e: any) {
      setMessage(e?.message || '下架失败');
    }
  };

  const onUpload = async (file: File, kind: 'image' | 'asset') => {
    const form = new FormData();
    form.append('file', file);
    form.append('kind', kind);
    const resp = await fetch('/api/upload', { method: 'POST', body: form, credentials: 'include' });
    const json = await resp.json();
    if (!resp.ok) throw new Error(json?.message || '上传失败');
    setUploads((current) => [{ url: json.data.url, filename: json.data.filename, mime: json.data.mime, size: json.data.size }, ...current]);
  };

  const diffText = useMemo(() => {
    if (!diffLeft || !diffRight) return '';
    const a = JSON.stringify(diffLeft.config, null, 2).split('\n');
    const b = JSON.stringify(diffRight.config, null, 2).split('\n');
    return a.map((line, index) => (line === b[index] ? `  ${line}` : `- ${line}\n+ ${b[index] || ''}`)).join('\n');
  }, [diffLeft, diffRight]);

  return (
    <div className="max-w-6xl mx-auto px-6 py-16 space-y-8">
      <h1 className="text-3xl font-black">卖家控制台</h1>
      {message && <div className="rounded-2xl border border-border bg-muted/20 p-4 text-sm">{message}</div>}

      <section className="grid lg:grid-cols-2 gap-6">
        <div className="rounded-3xl border border-border bg-card p-5 space-y-4">
          <h2 className="text-xl font-black">资产管理</h2>
          <label className="block text-sm font-medium">上传 Banner / 头像</label>
          <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0], 'image')} />
          <label className="block text-sm font-medium">上传资源文件</label>
          <input type="file" onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0], 'asset')} />
          <div className="grid grid-cols-2 gap-3">
            {uploads.map((asset) => (
              <div key={asset.url} className="rounded-2xl border border-border p-3 text-xs break-all">
                <div className="font-bold">{asset.filename}</div>
                <div>{asset.mime}</div>
                <div>{asset.url}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-card p-5 space-y-4">
          <h2 className="text-xl font-black">版本差异</h2>
          <div className="grid gap-3">
            <select className="rounded-xl border border-border p-3" onChange={(e) => setDiffLeft(versions.find((v) => v.id === e.target.value) || null)}>
              <option value="">选择旧版本</option>
              {versions.map((v) => <option key={v.id} value={v.id}>{v.createdAt} · {v.config.shopName}</option>)}
            </select>
            <select className="rounded-xl border border-border p-3" onChange={(e) => setDiffRight(versions.find((v) => v.id === e.target.value) || null)}>
              <option value="">选择新版本</option>
              {versions.map((v) => <option key={v.id} value={v.id}>{v.createdAt} · {v.config.shopName}</option>)}
            </select>
          </div>
          <pre className="max-h-96 overflow-auto rounded-2xl bg-black text-white p-4 text-xs whitespace-pre-wrap">{diffText || '选择两个版本后查看差异'}</pre>
        </div>
      </section>

      <div className="rounded-3xl border border-border bg-card p-5 space-y-4">
        <h2 className="text-xl font-black">我的商品</h2>
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {products.map((item) => (
            <div key={item.id} className="rounded-2xl border border-border bg-background p-4 space-y-3">
              <div className="font-bold">{item.title}</div>
              <div className="text-sm text-muted-foreground">¥{item.price} · 销量 {item.sales} · 评分 {item.rating}</div>
              <div className="flex gap-2 flex-wrap">
                <Link to={`/marketplace/${item.id}`} className="px-4 py-2 rounded-xl border border-border text-sm font-bold">查看</Link>
                <Link to={`/marketplace/edit/${item.id}`} className="px-4 py-2 rounded-xl border border-border text-sm font-bold">编辑</Link>
                <button type="button" onClick={() => unpublish(item.id)} className="px-4 py-2 rounded-xl bg-black text-white text-sm font-bold">下架</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
