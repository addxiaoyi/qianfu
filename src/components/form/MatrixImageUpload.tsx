import React, { useState, useCallback } from 'react';
import { Upload, X, CheckCircle2, Loader2 } from 'lucide-react';
import GeometricLantern from '@/components/ui/GeometricLantern';
import { uploadImageFile } from '@/utils/imageUpload';

interface MatrixImageUploadProps {
  value: string | null;
  onChange: (value: string | null) => void;
  label: string;
  hint: string;
}

const MatrixImageUpload: React.FC<MatrixImageUploadProps> = ({ value, onChange, label, hint }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setUploadError('请选择图片文件');
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    try {
      onChange(await uploadImageFile(file));
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : '图片上传失败，请稍后重试');
    } finally {
      setIsUploading(false);
    }
  }, [onChange]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) void handleFile(file);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
  };

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-black font-mono uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-4 italic">
          <GeometricLantern variant="network" className="w-5 h-5 text-accent" /> {label}
        </h2>
        <span className="text-[9px] font-black text-zinc-300 uppercase tracking-widest italic">{hint}</span>
      </div>

      {/* Compact horizontal layout: thumbnail left + dropzone right */}
      <div className="flex gap-6 h-48">
        {/* Thumbnail preview */}
        <div className="w-48 h-48 rounded-3xl border-2 border-dashed border-zinc-100 bg-zinc-50 overflow-hidden flex-shrink-0 flex items-center justify-center relative group">
          {value ? (
            <>
              <img src={value} alt={`${label}预览`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => onChange(null)}
                  aria-label={`移除${label}`}
                  className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center hover:bg-red-500 hover:text-white transition-all active:scale-90 shadow-xl"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </>
          ) : (
            <GeometricLantern variant="network" className="w-10 h-10 text-zinc-200" />
          )}
        </div>

        {/* Drop Zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          className={`relative flex-grow rounded-3xl border-2 border-dashed transition-all duration-500 flex flex-col items-center justify-center gap-4 ${
            isDragging
              ? 'border-accent bg-accent/5 scale-[1.01]'
              : 'border-zinc-100 bg-zinc-50/50 hover:border-accent/40 hover:bg-zinc-50'
          }`}
        >
          {isUploading ? (
            <div className="text-center space-y-3">
              <div className="relative w-16 h-16 mx-auto">
                <svg className="w-full h-full rotate-[-90deg]" viewBox="0 0 64 64">
                  <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="3" fill="transparent" className="text-zinc-100" />
                  <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="3" fill="transparent" strokeDasharray="44 132" className="text-accent" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 text-accent animate-spin" />
                </div>
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest italic text-accent">正在上传并同步图床</p>
            </div>
          ) : value ? (
            <div className="text-center space-y-3">
              <CheckCircle2 className="w-10 h-10 text-accent mx-auto" />
              <div className="space-y-1.5">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] italic text-zinc-500">图片已上传</p>
                <label className="text-[9px] font-black text-accent uppercase tracking-widest italic underline cursor-pointer">
                  重新选择
                  <input type="file" accept="image/*" onChange={onFileChange} className="hidden" />
                </label>
              </div>
            </div>
          ) : (
            <div className="text-center space-y-4 px-8">
              <div className={`w-16 h-16 bg-white rounded-2xl mx-auto flex items-center justify-center shadow-lg transition-all duration-500 ${
                isDragging ? 'rotate-12 scale-110' : ''
              }`}>
                <Upload className={`w-7 h-7 transition-colors duration-500 ${isDragging ? 'text-accent' : 'text-zinc-200'}`} />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-black uppercase tracking-tight italic text-zinc-400">拖拽图片至此 / 点击上传</p>
                <p className="text-[9px] text-zinc-300 font-bold uppercase tracking-widest italic">PNG · JPG · WEBP · 最大 5MB</p>
              </div>
              <input
                type="file"
                aria-label={`上传${label}`}
                accept="image/*"
                onChange={onFileChange}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
            </div>
          )}
          {uploadError && <p className="absolute bottom-3 px-4 text-center text-xs font-bold text-red-500">{uploadError}</p>}
        </div>
      </div>
    </section>
  );
};

export default MatrixImageUpload;
