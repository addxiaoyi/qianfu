import React from 'react';

type LanternVariant =
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
  | 'server';

interface LanternProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  variant?: LanternVariant;
}

/**
 * GeometricLantern - A suite of custom industrial geometric icons.
 * Each variant is uniquely crafted to replace generic UI icons while
 * maintaining the "Command Matrix" branded aesthetic.
 */
export const GeometricLantern: React.FC<LanternProps> = ({ 
  size = 24, 
  variant = 'spark',
  className = "", 
  ...props 
}) => {
  const renderVariant = () => {
    switch (variant) {
      case 'security':
        return (
          <>
            <path d="M12 2L4 5V11C4 16.19 7.41 21.05 12 22C16.59 21.05 20 16.19 20 11V5L12 2Z" fill="none" stroke="currentColor" strokeWidth="2" />
            <rect x="10" y="8" width="4" height="4" fill="currentColor" rx="0.5" />
            <path d="M12 14V17" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
          </>
        );
      case 'user':
        return (
          <>
            <circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M4 20C4 16 8 15 12 15C16 15 20 16 20 20" fill="none" stroke="currentColor" strokeWidth="2" />
            <rect x="11" y="2" width="2" height="2" fill="currentColor" />
          </>
        );
      case 'data':
        return (
          <>
            <rect x="3" y="14" width="4" height="6" fill="currentColor" />
            <rect x="10" y="8" width="4" height="12" fill="currentColor" opacity="0.6" />
            <rect x="17" y="4" width="4" height="16" fill="currentColor" opacity="0.3" />
            <path d="M2 20H22" stroke="currentColor" strokeWidth="1.5" />
          </>
        );
      case 'settings':
        return (
          <>
            <rect x="4" y="4" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" />
            <circle cx="12" cy="12" r="3" fill="currentColor" />
            <path d="M12 4V7M12 17V20M4 12H7M17 12H20" stroke="currentColor" strokeWidth="1.5" />
          </>
        );
      case 'terminal':
        return (
          <>
            <path d="M4 8L10 12L4 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
            <rect x="12" y="16" width="8" height="2" fill="currentColor" />
            <path d="M2 4H22V20H2V4Z" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
          </>
        );
      case 'network':
        return (
          <>
            <circle cx="12" cy="6" r="3" fill="currentColor" />
            <circle cx="6" cy="18" r="3" fill="none" stroke="currentColor" strokeWidth="2" />
            <circle cx="18" cy="18" r="3" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M12 9V15M10 16L7 16M14 16L17 16" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" />
          </>
        );
      case 'payment':
        return (
          <>
            <rect x="2" y="5" width="20" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M2 10H22" stroke="currentColor" strokeWidth="2" />
            <rect x="5" y="14" width="4" height="2" fill="currentColor" />
            <circle cx="18" cy="14" r="1.5" fill="currentColor" />
          </>
        );
      case 'activity':
        return (
          <>
            <path d="M2 12H6L9 5L15 19L18 12H22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.1" />
          </>
        );
      case 'alert':
        return (
          <>
            <path d="M12 3L2 21H22L12 3Z" fill="none" stroke="currentColor" strokeWidth="2" />
            <rect x="11" y="9" width="2" height="6" fill="currentColor" />
            <rect x="11" y="17" width="2" height="2" fill="currentColor" />
          </>
        );
      case 'spark':
      default:
        return (
          <>
            <path d="M12 2C12 2 13 10 13 11C14 11 22 12 22 12C22 12 14 13 13 14C13 15 12 22 12 22C12 22 11 14 11 13C10 13 2 12 2 12C2 12 10 11 11 10C11 9 12 2 12 2Z" />
            <circle cx="6" cy="18" r="1.5" />
            <path d="M18 5V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M16 7H20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </>
        );
    }
  };

  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="currentColor" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      {renderVariant()}
    </svg>
  );
};

export default GeometricLantern;
