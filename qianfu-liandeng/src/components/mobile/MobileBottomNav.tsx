import React, { useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, Compass, PlusSquare, MessageSquare, User } from 'lucide-react';

interface NavItem {
  name: string;
  path: string;
  icon: React.ElementType;
  activeIcon: React.ElementType;
  requiresAuth?: boolean;
}

const navItems: NavItem[] = [
  { name: '首页', path: '/mobile', icon: Home, activeIcon: Home, requiresAuth: false },
  { name: '发现', path: '/servers', icon: Compass, activeIcon: Compass, requiresAuth: false },
  { name: '发布', path: '/editor', icon: PlusSquare, activeIcon: PlusSquare, requiresAuth: true },
  { name: '消息', path: '/messages', icon: MessageSquare, activeIcon: MessageSquare, requiresAuth: true },
  { name: '我的', path: '/me', icon: User, activeIcon: User, requiresAuth: true },
];

/** Check if user is logged in (mock implementation). */
function isLoggedIn(): boolean {
  try {
    return localStorage.getItem('isLoggedIn') === 'true';
  } catch {
    return false;
  }
}

interface MobileBottomNavProps {
  className?: string;
}

const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ className = '' }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const getActiveIndex = (): number => {
    for (let i = 0; i < navItems.length; i++) {
      if (location.pathname === navItems[i].path || location.pathname.startsWith(navItems[i].path + '/')) {
        return i;
      }
    }
    return 0;
  };

  const handleNavClick = useCallback(
    (item: NavItem, e: React.MouseEvent<HTMLAnchorElement>) => {
      if (item.requiresAuth && !isLoggedIn()) {
        e.preventDefault();
        navigate('/login', { replace: true });
        return;
      }
    },
    [navigate],
  );

  const activeIndex = getActiveIndex();

  return (
    <div className={`fixed bottom-0 left-0 right-0 z-50 md:hidden ${className}`}>
      {/* Glow effect */}
      <div className="absolute inset-x-0 -top-10 h-20 bg-gradient-to-t from-white to-transparent pointer-events-none" />

      <div className="flex items-center justify-around px-2 py-2 bg-white/90 backdrop-blur-xl border-t border-gray-100 safe-area-bottom">
        {navItems.map((item, index) => {
          const isActive = index === activeIndex;
          const Icon = isActive ? item.activeIcon : item.icon;

          return (
            <Link
              key={item.name}
              to={item.path}
              onClick={(e) => handleNavClick(item, e)}
              className="flex flex-col items-center justify-center w-14 h-12 gap-1"
            >
              <motion.div
                animate={isActive ? { scale: 1.1 } : { scale: 1 }}
                transition={{ duration: 0.2 }}
                className={`relative`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-black' : 'text-gray-400'}`} />
                {isActive && (
                  <motion.div
                    layoutId="bottomNavIndicator"
                    className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-black rounded-full"
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
    </div>
  );
};

export default MobileBottomNav;
