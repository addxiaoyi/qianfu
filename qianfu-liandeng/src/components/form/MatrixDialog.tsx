import React, { useState } from 'react';

interface MatrixDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (value: string) => void;
  title: string;
  placeholder?: string;
  defaultValue?: string;
  icon?: React.ReactNode;
}

/**
 * Matrix 风格的对话框组件
 * 用于富文本编辑器的图片、链接、颜色输入
 */
const MatrixDialog: React.FC<MatrixDialogProps> = ({
  isOpen,
  onClose,
  onSubmit,
  title,
  placeholder = '',
  defaultValue = '',
  icon
}) => {
  const [value, setValue] = useState(defaultValue);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onSubmit(value.trim());
      setValue('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onKeyDown={handleKeyDown}
    >
      {/* 背景遮罩 */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        data-noninteractive-click-surface="dismiss-dialog"
        onClick={onClose}
      />

      {/* 对话框 */}
      <div className="relative bg-neutral-900 border border-neutral-700 rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl shadow-black/50" role="dialog" aria-modal="true" aria-label={title}>
        {/* 标题栏 */}
        <div className="flex items-center gap-3 mb-4">
          {icon && (
            <span className="text-cyan-400">
              {icon}
            </span>
          )}
          <h3 className="text-lg font-mono text-cyan-400 tracking-wider">
            {title}
          </h3>
        </div>

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            aria-label={title}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            className="w-full bg-neutral-800 border border-neutral-600 rounded-lg px-4 py-3 text-neutral-100 font-mono text-sm placeholder:text-neutral-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 transition-colors"
            autoFocus
          />

          <div className="flex justify-end gap-3 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-neutral-400 hover:text-neutral-200 font-mono text-sm transition-colors"
            >
              [CANCEL]
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-sm rounded-lg transition-colors"
            >
              [CONFIRM]
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MatrixDialog;
