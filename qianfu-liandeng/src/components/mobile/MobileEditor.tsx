import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Camera, Image, Hash,
  Tag, Globe, Server, Check, X,
  ChevronLeft, Send
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { cn } from '../../utils/cn';

interface FormData {
  name: string;
  description: string;
  category: string;
  version: string;
  maxPlayers: string;
  ip: string;
  port: string;
  tags: string[];
  images: string[];
}

const categories = ['生存', 'PVP', 'RPG', '小游戏', '创造', '模组', '整合包'];

const MobileEditor: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<'form' | 'preview' | 'success'>('form');
  const [formData, setFormData] = useState<FormData>({
    name: '',
    description: '',
    category: '',
    version: '',
    maxPlayers: '',
    ip: '',
    port: '',
    tags: [],
    images: [],
  });
  const [tagInput, setTagInput] = useState('');

  const updateField = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const toggleTag = (tag: string) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter((t) => t !== tag)
        : prev.tags.length < 5
          ? [...prev.tags, tag]
          : prev.tags,
    }));
  };

  const addCustomTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim()) && formData.tags.length < 5) {
      setFormData((prev) => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()],
      }));
      setTagInput('');
    }
  };

  const handleSubmit = () => {
    // In real app, submit to API here
    setStep('success');
  };

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6">
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center space-y-6"
        >
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <Check className="w-10 h-10 text-green-500" />
          </div>
          <h2 className="text-2xl font-black">发布成功！</h2>
          <p className="text-sm text-muted-foreground">
            您的服务器已提交审核，预计 24 小时内完成审核。
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => {
                setStep('form');
                setFormData({
                  name: '',
                  description: '',
                  category: '',
                  version: '',
                  maxPlayers: '',
                  ip: '',
                  port: '',
                  tags: [],
                  images: [],
                });
              }}
              className="flex-1 py-4 bg-gray-100 rounded-2xl font-black text-sm"
            >
              继续发布
            </button>
            <button
              onClick={() => navigate('/servers')}
              className="flex-1 py-4 bg-black text-white rounded-2xl font-black text-sm"
            >
              查看服务器
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-24">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-gray-100">
        <div className="flex items-center justify-between px-4 py-4">
          <Link to="/mobile">
            <ArrowLeft className="w-5 h-5 text-black" />
          </Link>
          <h1 className="text-base font-black uppercase tracking-tight">发布服务器</h1>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-black text-white text-xs font-black rounded-xl"
          >
            发布
          </button>
        </div>
      </div>

      <div className="px-4 py-6 space-y-6">
        {/* Image Upload */}
        <div className="space-y-3">
          <label className="text-xs font-black uppercase tracking-wider text-muted-foreground">
            服务器图片
          </label>
          <div className="grid grid-cols-3 gap-3">
            {formData.images.map((img, index) => (
              <div key={index} className="relative aspect-square">
                <img src={img} alt="" className="w-full h-full object-cover rounded-xl" />
                <button
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      images: prev.images.filter((_, i) => i !== index),
                    }))
                  }
                  className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
            ))}
            {Array.from({ length: Math.max(0, 3 - formData.images.length) }).map((_, i) => (
              <div
                key={`upload-${i}`}
                className="aspect-square border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-2 active:bg-gray-50 transition-colors"
              >
                <Image className="w-6 h-6 text-muted-foreground" />
                <span className="text-[10px] font-bold text-muted-foreground">添加图片</span>
              </div>
            ))}
          </div>
        </div>

        {/* Server Name */}
        <div className="space-y-2">
          <label className="text-xs font-black uppercase tracking-wider text-muted-foreground">
            服务器名称 *
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => updateField('name', e.target.value)}
            placeholder="输入服务器名称"
            className="w-full px-4 py-4 bg-gray-50 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-black/10"
          />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <label className="text-xs font-black uppercase tracking-wider text-muted-foreground">
            服务器介绍
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => updateField('description', e.target.value)}
            placeholder="描述你的服务器特色、玩法等..."
            rows={4}
            className="w-full px-4 py-4 bg-gray-50 border-none rounded-xl text-sm font-medium resize-none focus:ring-2 focus:ring-black/10"
          />
          <p className="text-[10px] text-muted-foreground text-right">
            {formData.description.length}/500
          </p>
        </div>

        {/* Category */}
        <div className="space-y-2">
          <label className="text-xs font-black uppercase tracking-wider text-muted-foreground">
            服务器类型
          </label>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => updateField('category', cat)}
                className={cn(
                  'px-4 py-2 rounded-xl text-xs font-bold transition-colors',
                  formData.category === cat
                    ? 'bg-black text-white'
                    : 'bg-gray-100 text-muted-foreground active:bg-gray-200'
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Technical Info */}
        <div className="space-y-4">
          <label className="text-xs font-black uppercase tracking-wider text-muted-foreground">
            技术信息
          </label>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-muted-foreground flex items-center gap-1">
                <Hash className="w-3 h-3" /> 版本
              </label>
              <input
                type="text"
                value={formData.version}
                onChange={(e) => updateField('version', e.target.value)}
                placeholder="如 1.20.4"
                className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-bold"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-muted-foreground flex items-center gap-1">
                <Server className="w-3 h-3" /> 最大玩家
              </label>
              <input
                type="number"
                value={formData.maxPlayers}
                onChange={(e) => updateField('maxPlayers', e.target.value)}
                placeholder="如 100"
                className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-muted-foreground flex items-center gap-1">
                <Globe className="w-3 h-3" /> IP 地址
              </label>
              <input
                type="text"
                value={formData.ip}
                onChange={(e) => updateField('ip', e.target.value)}
                placeholder="play.example.com"
                className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-mono font-bold"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-muted-foreground">端口</label>
              <input
                type="text"
                value={formData.port}
                onChange={(e) => updateField('port', e.target.value)}
                placeholder="25565"
                className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-mono font-bold"
              />
            </div>
          </div>
        </div>

        {/* Tags */}
        <div className="space-y-3">
          <label className="text-xs font-black uppercase tracking-wider text-muted-foreground">
            标签 ({formData.tags.length}/5)
          </label>
          <div className="flex flex-wrap gap-2">
            {categories.map((tag) => (
              <button
                key={`tag-${tag}`}
                onClick={() => toggleTag(tag)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-[10px] font-bold transition-colors',
                  formData.tags.includes(tag)
                    ? 'bg-black text-white'
                    : 'bg-gray-100 text-muted-foreground'
                )}
              >
                {tag}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="自定义标签"
              onKeyDown={(e) => e.key === 'Enter' && addCustomTag()}
              className="flex-1 px-4 py-3 bg-gray-50 rounded-xl text-sm font-bold"
            />
            <button
              onClick={addCustomTag}
              className="px-4 py-3 bg-gray-100 rounded-xl text-sm font-bold"
            >
              添加
            </button>
          </div>
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          className="w-full py-4 bg-black text-white font-black text-sm rounded-2xl active:scale-95 transition-transform flex items-center justify-center gap-2"
        >
          <Send className="w-4 h-4" />
          发布服务器
        </button>
      </div>
    </div>
  );
};

export default MobileEditor;
