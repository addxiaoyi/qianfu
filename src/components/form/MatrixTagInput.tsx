import React, { useState } from 'react';
import type { KeyboardEvent } from 'react';
import { X, Plus } from 'lucide-react';
import GeometricLantern from '@/components/ui/GeometricLantern';

interface MatrixTagInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const MatrixTagInput: React.FC<MatrixTagInputProps> = ({ value, onChange, placeholder }) => {
  const [inputValue, setInputValue] = useState('');
  const tags = value ? value.split(' ').filter(t => t.length > 0) : [];

  const addTag = (tag: string) => {
    const trimmed = tag.trim().replace(/\s+/g, '_');
    if (trimmed && !tags.includes(trimmed)) {
      const newTags = [...tags, trimmed];
      onChange(newTags.join(' '));
    }
    setInputValue('');
  };

  const removeTag = (index: number) => {
    const newTags = tags.filter((_, i) => i !== index);
    onChange(newTags.join(' '));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  };

  return (
    <div className="group">
      <div className="flex flex-wrap gap-3 min-h-[64px] p-4 bg-zinc-50 border border-transparent focus-within:bg-white focus-within:border-accent transition-all duration-500 rounded-[2rem] shadow-xs">
        {tags.map((tag, index) => (
          <span 
            key={index} 
            className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-xl text-[10px] font-black uppercase tracking-widest italic animate-in zoom-in duration-300"
          >
            {tag}
            <button 
              type="button"
              onClick={() => removeTag(index)}
              aria-label={`移除标签 ${tag}`}
              className="hover:text-accent transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <div className="flex-grow flex items-center gap-3 px-2">
          <GeometricLantern variant="spark" className="w-4 h-4 text-zinc-200 group-focus-within:text-accent transition-colors" />
          <input
            type="text"
            aria-label="添加标签"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => addTag(inputValue)}
            placeholder={tags.length === 0 ? placeholder : 'ADD_TAG...'}
            className="flex-grow bg-transparent border-none outline-none text-sm font-bold italic uppercase tracking-wider placeholder:text-zinc-300 placeholder:font-black"
          />
        </div>
      </div>
      <p className="mt-4 text-[9px] font-black text-zinc-300 uppercase tracking-[0.2em] italic flex items-center gap-2 px-4">
        <Plus className="w-3 h-3" /> 按回车或逗号添加标签 / ENTER_TO_COMMIT_METADATA
      </p>
    </div>
  );
};

export default MatrixTagInput;
