import React from 'react';
import {
  Activity,
  Award,
  Bell,
  Check,
  ChevronDown,
  CreditCard,
  Database,
  Gift,
  Heart,
  LampDesk,
  LogOut,
  Mail,
  Megaphone,
  Menu,
  MessageSquare,
  Network,
  Search,
  Server,
  Settings2,
  ShieldCheck,
  SquareTerminal,
  Tag,
  TriangleAlert,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';

export type LanternVariant =
  | 'spark'
  | 'security'
  | 'user'
  | 'data'
  | 'settings'
  | 'terminal'
  | 'network'
  | 'payment'
  | 'activity'
  | 'alert'
  | 'server'
  | 'menu'
  | 'close'
  | 'chevron'
  | 'check'
  | 'mail'
  | 'bell'
  | 'logout'
  | 'message'
  | 'gift'
  | 'award'
  | 'search'
  | 'heart'
  | 'tag'
  | 'broadcast'
  | 'credit-card'
  | 'users';

interface LanternProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  variant?: LanternVariant;
}

const variantIcons: Record<LanternVariant, { Icon: LucideIcon; name: string }> = {
  spark: { Icon: LampDesk, name: 'lamp-desk' },
  security: { Icon: ShieldCheck, name: 'shield-check' },
  user: { Icon: UserRound, name: 'user-round' },
  data: { Icon: Database, name: 'database' },
  settings: { Icon: Settings2, name: 'settings-2' },
  terminal: { Icon: SquareTerminal, name: 'square-terminal' },
  network: { Icon: Network, name: 'network' },
  payment: { Icon: CreditCard, name: 'credit-card' },
  activity: { Icon: Activity, name: 'activity' },
  alert: { Icon: TriangleAlert, name: 'triangle-alert' },
  server: { Icon: Server, name: 'server' },
  menu: { Icon: Menu, name: 'menu' },
  close: { Icon: X, name: 'x' },
  chevron: { Icon: ChevronDown, name: 'chevron-down' },
  check: { Icon: Check, name: 'check' },
  mail: { Icon: Mail, name: 'mail' },
  bell: { Icon: Bell, name: 'bell' },
  logout: { Icon: LogOut, name: 'log-out' },
  message: { Icon: MessageSquare, name: 'message-square' },
  gift: { Icon: Gift, name: 'gift' },
  award: { Icon: Award, name: 'award' },
  search: { Icon: Search, name: 'search' },
  heart: { Icon: Heart, name: 'heart' },
  tag: { Icon: Tag, name: 'tag' },
  broadcast: { Icon: Megaphone, name: 'megaphone' },
  'credit-card': { Icon: CreditCard, name: 'credit-card' },
  users: { Icon: Users, name: 'users' },
};

/**
 * Keeps the legacy component API while rendering recognizable functional icons.
 * The lantern silhouette remains exclusive to the product logo.
 */
export const GeometricLantern: React.FC<LanternProps> = ({
  size = 24,
  variant = 'spark',
  className = '',
  ...props
}) => {
  const { Icon, name } = variantIcons[variant] ?? variantIcons.spark;

  return (
    <Icon
      size={size}
      strokeWidth={2.25}
      data-lucide={name}
      aria-hidden={props['aria-label'] ? undefined : true}
      className={className}
      style={{ width: '1em', height: '1em', flexShrink: 0, ...props.style }}
      {...props}
    />
  );
};

export default GeometricLantern;
