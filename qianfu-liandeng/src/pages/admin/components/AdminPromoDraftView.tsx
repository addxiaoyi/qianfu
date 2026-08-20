import React from "react";
import { Link } from "react-router-dom";
import { Copy } from "lucide-react";
import { promoActionLabels } from "../promoActionLabels";

export type PromoTask = {
  id: number;
  title: string;
  target_id?: string;
  reward_amount?: number;
  description?: string;
};

interface Props {
  draftTasks: PromoTask[];
  selectedDraftIds: number[];
  setSelectedDraftIds: React.Dispatch<React.SetStateAction<number[]>>;
  onBatchPublish: () => void;
  onBatchPause: () => void;
  onBatchRestore: () => void;
  onCopyTitles: () => void;
  selectedCount: number;
  onPublishNow: (id: number) => void;
  onPause: (task: PromoTask) => void;
}

const AdminPromoDraftView: React.FC<Props> = ({
  draftTasks,
  selectedDraftIds,
  setSelectedDraftIds,
  onBatchPublish,
  onBatchPause,
  onBatchRestore,
  onCopyTitles,
  selectedCount,
  onPublishNow,
  onPause,
}) => {
  const selectAll = () => setSelectedDraftIds(draftTasks.map((t) => t.id));
  const invert = () =>
    setSelectedDraftIds((prev) =>
      prev.length === 0
        ? draftTasks.map((t) => t.id)
        : draftTasks.filter((t) => !prev.includes(t.id)).map((t) => t.id),
    );
  const clear = () => setSelectedDraftIds([]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.4em] italic text-zinc-400">
            草稿视图
          </div>
          <div className="mt-2 text-sm text-zinc-500">
            草稿任务可在这里统一发布、暂停或复制标题进行批量管理。
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={selectAll}
            className="px-4 py-2 rounded-[1rem] border border-zinc-200 text-[10px] font-black uppercase tracking-[0.3em] italic"
          >
            全选
          </button>
          <button
            type="button"
            onClick={invert}
            className="px-4 py-2 rounded-[1rem] border border-zinc-200 text-[10px] font-black uppercase tracking-[0.3em] italic"
          >
            反选
          </button>
          <button
            type="button"
            onClick={clear}
            className="px-4 py-2 rounded-[1rem] border border-zinc-200 text-[10px] font-black uppercase tracking-[0.3em] italic"
          >
            清空
          </button>
          <button
            type="button"
            onClick={onCopyTitles}
            disabled={selectedCount === 0}
            className="px-4 py-2 rounded-[1rem] border border-zinc-200 text-[10px] font-black uppercase tracking-[0.3em] italic disabled:opacity-40 flex items-center gap-2"
          >
            <Copy className="w-4 h-4" /> 复制标题
          </button>
          <button
            type="button"
            onClick={onBatchPublish}
            disabled={selectedCount === 0}
            className="px-4 py-2 rounded-[1rem] bg-amber-500 text-white text-[10px] font-black uppercase tracking-[0.3em] italic disabled:opacity-40"
          >
            {promoActionLabels.publish} 已选
          </button>
          <button
            type="button"
            onClick={onBatchPause}
            disabled={selectedCount === 0}
            className="px-4 py-2 rounded-[1rem] bg-white border border-amber-200 text-amber-700 text-[10px] font-black uppercase tracking-[0.3em] italic disabled:opacity-40"
          >
            {promoActionLabels.pause} 已选
          </button>
          <button
            type="button"
            onClick={onBatchRestore}
            disabled={selectedCount === 0}
            className="px-4 py-2 rounded-[1rem] bg-white border border-emerald-200 text-emerald-700 text-[10px] font-black uppercase tracking-[0.3em] italic disabled:opacity-40"
          >
            {promoActionLabels.restore} 已选
          </button>
          <span className="text-[10px] font-black uppercase tracking-[0.4em] italic text-zinc-300">
            已选 {selectedCount}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {draftTasks.length === 0 ? (
          <div className="p-16 rounded-[3rem] border border-dashed border-zinc-200 text-center text-zinc-300 font-black uppercase tracking-[0.5em] italic bg-zinc-50/40 lg:col-span-2">
            当前还没有草稿任务。
          </div>
        ) : (
          draftTasks.map((task) => {
            const selected = selectedDraftIds.includes(task.id);
            return (
              <div
                key={task.id}
                className={`p-8 rounded-[3rem] border shadow-sm space-y-5 ${selected ? "border-accent bg-accent/10" : "border-amber-200 bg-amber-50/70"}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
            <input
              type="checkbox"
              aria-label={`选择草稿任务 ${task.title}`}
              checked={selected}
                      onChange={(e) =>
                        setSelectedDraftIds((prev) =>
                          e.target.checked
                            ? [...prev, task.id]
                            : prev.filter((id) => id !== task.id),
                        )
                      }
                      className="mt-1"
                    />
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.4em] italic text-amber-700">
                        草稿任务
                      </div>
                      <Link
                        to={`/admin-promo/tasks/${task.id}`}
                        className="block mt-2 text-2xl font-black uppercase tracking-tighter italic leading-none"
                      >
                        {task.title}
                      </Link>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-white text-amber-700 border border-amber-200 text-[9px] font-black uppercase tracking-[0.35em] italic">
                    仅草稿
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-[10px] font-black uppercase tracking-[0.35em] italic text-zinc-400">
                  <div className="p-4 rounded-[1.5rem] bg-white border border-amber-100">
                    目标
                    <br />
                    <span className="mt-2 block text-zinc-900 tracking-normal lowercase normal-case font-mono break-all">
                      {task.target_id}
                    </span>
                  </div>
                  <div className="p-4 rounded-[1.5rem] bg-white border border-amber-100">
                    奖励
                    <br />
                    <span className="mt-2 block text-zinc-900 tracking-normal normal-case font-mono">
                      ¥ {task.reward_amount}
                    </span>
                  </div>
                  <div className="p-4 rounded-[1.5rem] bg-white border border-amber-100 col-span-2">
                    描述
                    <br />
                    <span className="mt-2 block text-zinc-900 tracking-normal normal-case leading-6 font-medium">
                      {task.description || "暂未填写描述。"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-wrap justify-end">
                  <Link
                    to={`/admin-promo/create?taskId=${task.id}`}
                    className="px-4 py-2 rounded-[1rem] bg-white border border-amber-200 text-[10px] font-black uppercase tracking-[0.3em] italic hover:border-accent transition-all"
                  >
                    编辑草稿
                  </Link>
                  <button
                    type="button"
                    onClick={() => onPublishNow(task.id)}
                    className="px-4 py-2 rounded-[1rem] bg-amber-500 text-white text-[10px] font-black uppercase tracking-[0.3em] italic hover:opacity-90 transition-all"
                  >
                    {promoActionLabels.publish} 当前任务
                  </button>
                  <button
                    type="button"
                    onClick={() => onPause(task)}
                    className="px-4 py-2 rounded-[1rem] bg-white border border-amber-200 text-[10px] font-black uppercase tracking-[0.3em] italic hover:border-amber-300 transition-all"
                  >
                    {promoActionLabels.pause}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default AdminPromoDraftView;
