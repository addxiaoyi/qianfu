import { useState } from "react";

export default function MobileTicketCreate() {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [content, setContent] = useState("");

  const categories = [
    { value: "technical", label: "技术支持" },
    { value: "billing", label: "账单问题" },
    { value: "server", label: "服务器相关" },
    { value: "account", label: "账号问题" },
    { value: "other", label: "其他" },
  ];

  const handleSubmit = () => {
    if (!title.trim() || !category || !content.trim()) return;
    // TODO: 提交工单
    console.log("提交工单", { title, category, content });
  };

  return (
    <div className="min-h-screen bg-white px-4 py-4 space-y-5 pb-24">
      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-2">标题</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="简要描述您的问题"
          className="w-full h-12 px-4 rounded-xl border border-zinc-200 bg-zinc-50 text-sm focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-300"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-2">分类</label>
        <div className="grid grid-cols-2 gap-2">
          {categories.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setCategory(cat.value)}
              className={`h-12 rounded-xl border text-sm font-medium transition-colors ${
                category === cat.value
                  ? "bg-zinc-900 text-white border-zinc-900"
                  : "bg-white text-zinc-700 border-zinc-200"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-2">详细描述</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="请详细描述您遇到的问题..."
          rows={6}
          className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-zinc-50 text-sm focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-300 resize-none"
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={!title.trim() || !category || !content.trim()}
        className="w-full h-14 bg-zinc-900 text-white text-sm font-bold rounded-xl disabled:opacity-40 transition-opacity"
      >
        提交工单
      </button>
    </div>
  );
}
