import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, X, TrendingUp, Filter, MapPin,
  Star, Users, Clock, ChevronRight
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { useMobile } from '../../hooks/useMobile';
import { LazyImage } from './MobileLazyImage';
import { Skeleton } from './MobileSkeleton';

interface ServerResult {
  id: string;
  name: string;
  description: string;
  image: string;
  category: string;
  players: number;
  maxPlayers: number;
  rating: number;
  region: string;
  version: string;
  online: boolean;
  featured: boolean;
}

const mockServers: ServerResult[] = [
  {
    id: '1',
    name: '超级生存服',
    description: '原汁原味的生存体验',
    image: 'https://placehold.co/400x200/1a1a2e/white?text=Survival',
    category: '生存',
    players: 128,
    maxPlayers: 200,
    rating: 4.8,
    region: '华东',
    version: '1.20.4',
    online: true,
    featured: true,
  },
  {
    id: '2',
    name: '极限PVP竞技场',
    description: '真实力对决',
    image: 'https://placehold.co/400x200/e94560/white?text=PVP',
    category: 'PVP',
    players: 64,
    maxPlayers: 100,
    rating: 4.6,
    region: '华南',
    version: '1.20.4',
    online: true,
    featured: true,
  },
  {
    id: '3',
    name: '梦幻RPG冒险',
    description: '精彩剧情等你探索',
    image: 'https://placehold.co/400x200/0f3460/white?text=RPG',
    category: 'RPG',
    players: 45,
    maxPlayers: 80,
    rating: 4.9,
    region: '华北',
    version: '1.20.2',
    online: true,
    featured: false,
  },
  {
    id: '4',
    name: '休闲小游戏服',
    description: '轻松愉快',
    image: 'https://placehold.co/400x200/16213e/white?text=Mini+Game',
    category: '小游戏',
    players: 200,
    maxPlayers: 500,
    rating: 4.5,
    region: '西南',
    version: '1.20.4',
    online: true,
    featured: false,
  },
];

const hotSearches = ['生存', 'PVP', 'RPG', '模组', '建筑', '科技', '魔法'];

const MobileSearch: React.FC = () => {
  const { isMobile } = useMobile();
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<ServerResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [activeCategory, setActiveCategory] = useState('全部');
  const [sortBy, setSortBy] = useState<'players' | 'rating' | 'recent'>('players');
  const inputRef = useRef<HTMLInputElement>(null);
  const [showSearch, setShowSearch] = useState(false);
  const { refreshing, refresh } = useMobile();

  const categories = ['全部', '生存', 'PVP', 'RPG', '小游戏', '创造', '模组'];

  const handleSearch = (text: string) => {
    setQuery(text);
    setIsSearching(true);
    setHasSearched(true);

    // Simulate search
    setTimeout(() => {
      const filtered = mockServers.filter(
        (s) =>
          s.name.toLowerCase().includes(text.toLowerCase()) ||
          s.category.includes(text) ||
          s.description.toLowerCase().includes(text.toLowerCase())
      );
      setResults(filtered.length > 0 ? filtered : mockServers);
      setIsSearching(false);
    }, 500);
  };

  const handleCategoryClick = (cat: string) => {
    setActiveCategory(cat);
    if (cat === '全部') {
      setResults(mockServers);
    } else {
      setResults(mockServers.filter((s) => s.category === cat));
    }
    setHasSearched(true);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-gray-50/90 backdrop-blur-xl border-b border-gray-100">
        <div className="px-4 py-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch(query)}
              onFocus={() => setShowSearch(true)}
              placeholder="搜索服务器、玩法..."
              className="w-full pl-10 pr-10 py-3 bg-white border-none rounded-xl text-sm font-medium focus:ring-2 focus:ring-black/10"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>

        {/* Search history bar */}
        {hasSearched && (
          <div className="flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-hide">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => handleCategoryClick(cat)}
                className={cn(
                  'px-4 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors flex-shrink-0',
                  activeCategory === cat
                    ? 'bg-black text-white'
                    : 'bg-white text-muted-foreground active:bg-gray-100'
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Refreshing overlay */}
      {refreshing && (
        <div className="bg-black text-white text-center py-2 text-xs font-bold">
          刷新中...
        </div>
      )}

      <div className="px-4 py-4 space-y-4">
        <AnimatePresence mode="wait">
          {!hasSearched ? (
            /* Explore Mode */
            <motion.div
              key="explore"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              {/* Hot Searches */}
              <div>
                <h3 className="text-sm font-black uppercase tracking-tight mb-3 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  热门搜索
                </h3>
                <div className="flex flex-wrap gap-2">
                  {hotSearches.map((term) => (
                    <button
                      key={term}
                      onClick={() => handleSearch(term)}
                      className="px-4 py-2 bg-white rounded-xl text-xs font-bold text-muted-foreground active:bg-gray-100 transition-colors"
                    >
                      {term}
                    </button>
                  ))}
                </div>
              </div>

              {/* Featured */}
              <div>
                <h3 className="text-sm font-black uppercase tracking-tight mb-3 flex items-center gap-2">
                  <Star className="w-4 h-4" />
                  推荐服务器
                </h3>
                <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
                  {mockServers.filter((s) => s.featured).map((server) => (
                    <motion.div
                      key={server.id}
                      whileTap={{ scale: 0.97 }}
                      className="flex-shrink-0 w-64 bg-white rounded-2xl overflow-hidden shadow-sm"
                    >
                      <LazyImage
                        src={server.image}
                        alt={server.name}
                        className="w-full h-32 object-cover"
                      />
                      <div className="p-3 space-y-2">
                        <h4 className="text-sm font-black truncate">{server.name}</h4>
                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {server.players}/{server.maxPlayers}
                          </span>
                          <span>{server.version}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                          <span className="text-xs font-bold">{server.rating}</span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* All Servers */}
              <div>
                <h3 className="text-sm font-black uppercase tracking-tight mb-3 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  全部服务器
                </h3>
                <div className="space-y-3">
                  {mockServers.map((server, index) => (
                    <motion.div
                      key={server.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="bg-white rounded-2xl overflow-hidden flex gap-3 p-3 active:opacity-80"
                    >
                      <LazyImage
                        src={server.image}
                        alt={server.name}
                        className="w-20 h-20 rounded-xl object-cover flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0 space-y-1">
                        <h4 className="text-sm font-black truncate">{server.name}</h4>
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {server.description}
                        </p>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] px-2 py-0.5 bg-black text-white rounded-md font-bold">
                            {server.category}
                          </span>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {server.players}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                            {server.rating}
                          </span>
                          <span>{server.region}</span>
                          <span>{server.version}</span>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 self-center" />
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          ) : (
            /* Results Mode */
            <motion.div
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <p className="text-xs text-muted-foreground mb-4">
                找到 {results.length} 个结果
              </p>

              {/* Sort */}
              <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide">
                {[
                  { key: 'players', label: '在线人数' },
                  { key: 'rating', label: '评分最高' },
                  { key: 'recent', label: '最近更新' },
                ].map((s) => (
                  <button
                    key={s.key}
                    onClick={() => setSortBy(s.key as typeof sortBy)}
                    className={cn(
                      'px-4 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors flex-shrink-0',
                      sortBy === s.key
                        ? 'bg-black text-white'
                        : 'bg-white text-muted-foreground'
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {isSearching ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-28 rounded-2xl" />
                  ))}
                </div>
              ) : results.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <Search className="w-12 h-12 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground font-bold">没有找到相关服务器</p>
                  <button
                    onClick={() => {
                      setHasSearched(false);
                      setQuery('');
                    }}
                    className="px-6 py-3 bg-black text-white text-sm font-bold rounded-xl"
                  >
                    重新开始
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {results.map((server, index) => (
                    <motion.div
                      key={server.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="bg-white rounded-2xl overflow-hidden flex gap-3 p-3 active:opacity-80"
                    >
                      <LazyImage
                        src={server.image}
                        alt={server.name}
                        className="w-20 h-20 rounded-xl object-cover flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0 space-y-1">
                        <h4 className="text-sm font-black truncate">{server.name}</h4>
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {server.description}
                        </p>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] px-2 py-0.5 bg-black text-white rounded-md font-bold">
                            {server.category}
                          </span>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {server.players}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                            {server.rating}
                          </span>
                          <span>{server.region}</span>
                          <span className={cn(
                            'flex items-center gap-1',
                            server.online ? 'text-green-500' : 'text-red-500'
                          )}>
                            <Clock className="w-3 h-3" />
                            {server.online ? '在线' : '离线'}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 self-center" />
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default MobileSearch;
