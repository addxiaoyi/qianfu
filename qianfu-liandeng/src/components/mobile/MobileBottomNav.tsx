import React, { useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Compass, Home, MessageCircle, PlusCircle, UserRound, type LucideIcon } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

interface NavItem {
  name: string;
  path: string;
  Icon: LucideIcon;
  activePaths?: string[];
  requiresAuth?: boolean;
}

const navItems: NavItem[] = [
  { name: '首页', path: '/mobile', Icon: Home, requiresAuth: false },
  { name: '发现', path: '/servers', Icon: Compass, activePaths: ['/servers', '/search'], requiresAuth: false },
  { name: '发布', path: '/editor', Icon: PlusCircle, requiresAuth: true },
  { name: '消息', path: '/messages', Icon: MessageCircle, activePaths: ['/messages', '/tickets'], requiresAuth: true },
  { name: '我的', path: '/me', Icon: UserRound, activePaths: ['/me', '/dashboard'], requiresAuth: true },
];

interface MobileBottomNavProps {
  className?: string;
}

const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ className = '' }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const matchesPath = (path: string, currentPath: string) =>
    currentPath === path || currentPath.startsWith(`${path}/`);

  const getActiveIndex = (): number => {
    for (let i = 0; i < navItems.length; i++) {
      const item = navItems[i];
      const activePaths = item.activePaths || [item.path];
      if (activePaths.some((path) => matchesPath(path, location.pathname))) {
        return i;
      }
    }
    return 0;
  };

  const handleNavClick = useCallback(
    (item: NavItem, e: React.MouseEvent<HTMLAnchorElement>) => {
      if (item.requiresAuth && !isAuthenticated) {
        e.preventDefault();
        navigate('/login', { replace: true });
        return;
      }
    },
    [isAuthenticated, navigate],
  );

  const activeIndex = getActiveIndex();

  return (
    <nav className={`w-full md:hidden ${className}`} aria-label="底部导航">
      <div className="flex items-center justify-around bg-white/95 px-2 py-1.5 backdrop-blur-xl safe-area-bottom">
        {navItems.map((item, index) => {
          const isActive = index === activeIndex;
          const Icon = item.Icon;

          return (
            <Link
              key={item.name}
              to={item.path}
              onClick={(e) => handleNavClick(item, e)}
              className="flex h-12 w-14 flex-col items-center justify-center gap-1 rounded-2xl"
              aria-current={isActive ? 'page' : undefined}
            >
              <motion.div
                animate={isActive ? { scale: 1.1 } : { scale: 1 }}
                transition={{ duration: 0.2 }}
                className="relative"
              >
                <Icon className={`h-5 w-5 ${isActive ? 'text-black' : 'text-gray-400'}`} strokeWidth={isActive ? 2.6 : 2.1} />
                {isActive && (
                  <motion.div
                    layoutId="bottomNavIndicator"
                    className="absolute -bottom-1 left-1/2 h-0.5 w-4 -translate-x-1/2 rounded-full bg-black"
                  />
                )}
              </motion.div>
              <span className={`text-[10px] font-semibold ${isActive ? 'text-black' : 'text-gray-400'}`}>
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileBottomNav;
