import React from 'react';

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
  | 'search';

interface LanternProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  variant?: LanternVariant;
}

/**
 * GeometricLantern
 * Pixel lantern icon system: all variants share one lantern silhouette,
 * then overlay feature-specific pixel glyphs so each location looks related
 * but still functionally distinct.
 */
export const GeometricLantern: React.FC<LanternProps> = ({
  size = 24,
  variant = 'spark',
  className = '',
  ...props 
}) => {
  const block = (x: number, y: number, w = 1, h = 1, opacity = 1, key?: string) => (
    <rect key={key || `${x}-${y}-${w}-${h}-${opacity}`} x={x} y={y} width={w} height={h} fill="currentColor" opacity={opacity} />
  );

  const lanternBase = (
    <>
      {block(11, 1, 2, 1, 0.9)}
      {block(10, 2, 4, 1, 0.85)}
      {block(9, 3, 6, 1, 0.8)}
      {block(8, 4, 8, 1, 0.95)}

      {block(8, 5, 1, 10, 0.92)}
      {block(15, 5, 1, 10, 0.92)}
      {block(9, 5, 6, 1, 0.85)}
      {block(9, 14, 6, 1, 0.85)}
      {block(10, 5, 1, 9, 0.45)}
      {block(13, 5, 1, 9, 0.45)}

      {block(10, 8, 4, 4, 0.16)}
      {block(11, 7, 2, 1, 0.12)}

      {block(10, 15, 4, 1, 0.8)}
      {block(10, 16, 4, 1, 0.65)}
      {block(11, 17, 2, 1, 0.72)}
    </>
  );

  const renderVariant = () => {
    switch (variant) {
      case 'security':
        return (
          <>
            {block(11, 7, 2, 1)}
            {block(10, 8, 1, 1)}
            {block(13, 8, 1, 1)}
            {block(10, 9, 4, 3)}
            {block(12, 10, 1, 2, 0.35)}
          </>
        );
      case 'user':
        return (
          <>
            {block(11, 7, 2, 2)}
            {block(10, 10, 4, 2)}
            {block(9, 11, 1, 1)}
            {block(14, 11, 1, 1)}
          </>
        );
      case 'data':
        return (
          <>
            {block(10, 11, 1, 2)}
            {block(12, 10, 1, 3)}
            {block(14, 9, 1, 4)}
            {block(10, 13, 5, 1, 0.75)}
          </>
        );
      case 'settings':
        return (
          <>
            {block(12, 8, 1, 5)}
            {block(10, 10, 5, 1)}
            {block(11, 9, 1, 1)}
            {block(13, 9, 1, 1)}
            {block(11, 11, 1, 1)}
            {block(13, 11, 1, 1)}
          </>
        );
      case 'terminal':
        return (
          <>
            {block(10, 9, 1, 1)}
            {block(11, 10, 1, 1)}
            {block(10, 11, 1, 1)}
            {block(12, 11, 3, 1)}
          </>
        );
      case 'network':
        return (
          <>
            {block(10, 9, 1, 1)}
            {block(14, 9, 1, 1)}
            {block(12, 12, 1, 1)}
            {block(11, 10, 1, 1, 0.8)}
            {block(13, 10, 1, 1, 0.8)}
            {block(12, 11, 1, 1, 0.8)}
          </>
        );
      case 'payment':
        return (
          <>
            {block(10, 8, 5, 1)}
            {block(10, 12, 5, 1)}
            {block(10, 9, 1, 3)}
            {block(14, 9, 1, 3)}
            {block(12, 9, 1, 3)}
            {block(11, 10, 3, 1)}
          </>
        );
      case 'activity':
        return (
          <>
            {block(10, 11, 1, 1)}
            {block(11, 10, 1, 1)}
            {block(12, 12, 1, 1)}
            {block(13, 9, 1, 1)}
            {block(14, 11, 1, 1)}
          </>
        );
      case 'alert':
        return (
          <>
            {block(12, 8, 1, 4)}
            {block(12, 13, 1, 1)}
            {block(11, 7, 3, 1, 0.85)}
          </>
        );
      case 'server':
        return (
          <>
            {block(10, 9, 5, 1)}
            {block(9, 11, 6, 1)}
            {block(10, 13, 5, 1)}
            {block(12, 10, 1, 3, 0.35)}
          </>
        );
      case 'menu':
        return (
          <>
            {block(8, 8, 8, 1, 0.95)}
            {block(8, 11, 8, 1, 0.85)}
            {block(8, 14, 8, 1, 0.95)}
            {block(10, 9, 4, 1, 0.25)}
            {block(10, 12, 4, 1, 0.2)}
            {block(10, 15, 4, 1, 0.25)}
          </>
        );
      case 'close':
        return (
          <>
            {block(9, 9, 1, 1)}
            {block(10, 10, 1, 1)}
            {block(11, 11, 1, 1)}
            {block(12, 12, 1, 1)}
            {block(13, 11, 1, 1)}
            {block(14, 10, 1, 1)}
            {block(15, 9, 1, 1)}
            {block(9, 15, 1, 1)}
            {block(10, 14, 1, 1)}
            {block(11, 13, 1, 1)}
            {block(13, 13, 1, 1)}
            {block(14, 14, 1, 1)}
            {block(15, 15, 1, 1)}
          </>
        );
      case 'chevron':
        return (
          <>
            {block(9, 9, 1, 1)}
            {block(10, 10, 1, 1)}
            {block(11, 11, 1, 1)}
            {block(12, 12, 1, 1)}
            {block(13, 11, 1, 1)}
            {block(14, 10, 1, 1)}
            {block(15, 9, 1, 1)}
          </>
        );
      case 'check':
        return (
          <>
            {block(9, 12, 1, 1)}
            {block(10, 13, 1, 1)}
            {block(11, 14, 1, 1)}
            {block(12, 13, 1, 1)}
            {block(13, 12, 1, 1)}
            {block(14, 11, 1, 1)}
            {block(15, 10, 1, 1)}
          </>
        );
      case 'mail':
        return (
          <>
            {block(9, 9, 6, 1)}
            {block(9, 10, 1, 4)}
            {block(14, 10, 1, 4)}
            {block(9, 14, 6, 1)}
            {block(10, 10, 1, 1, 0.35)}
            {block(11, 11, 1, 1, 0.35)}
            {block(12, 12, 1, 1, 0.35)}
            {block(13, 11, 1, 1, 0.35)}
            {block(14, 10, 1, 1, 0.35)}
          </>
        );
      case 'bell':
        return (
          <>
            {block(11, 7, 2, 1)}
            {block(10, 8, 4, 1)}
            {block(9, 9, 6, 4)}
            {block(10, 13, 4, 1)}
            {block(11, 14, 2, 1)}
            {block(11, 15, 2, 1, 0.7)}
          </>
        );
      case 'logout':
        return (
          <>
            {block(9, 8, 4, 8)}
            {block(13, 10, 2, 1)}
            {block(13, 11, 3, 1)}
            {block(13, 12, 2, 1)}
            {block(13, 13, 3, 1)}
            {block(15, 11, 1, 3)}
          </>
        );
      case 'message':
        return (
          <>
            {block(9, 9, 6, 4)}
            {block(10, 10, 4, 2, 0.28)}
            {block(10, 13, 1, 1)}
            {block(11, 13, 1, 1)}
          </>
        );
      case 'gift':
        return (
          <>
            {block(9, 10, 6, 4)}
            {block(11, 9, 1, 6)}
            {block(10, 12, 4, 1)}
            {block(9, 9, 6, 1, 0.7)}
          </>
        );
      case 'award':
        return (
          <>
            {block(10, 8, 1, 3)}
            {block(13, 8, 1, 3)}
            {block(11, 11, 2, 2)}
            {block(10, 13, 4, 1)}
            {block(11, 14, 2, 1)}
          </>
        );
      case 'search':
        return (
          <>
            {block(10, 9, 3, 1)}
            {block(9, 10, 5, 1)}
            {block(9, 11, 1, 3)}
            {block(13, 11, 1, 3)}
            {block(10, 14, 3, 1)}
            {block(13, 14, 2, 1)}
            {block(14, 15, 1, 1)}
          </>
        );
      case 'spark':
      default:
        return (
          <>
            {block(12, 8, 1, 4)}
            {block(10, 10, 5, 1)}
            {block(16, 7, 1, 1, 0.85)}
            {block(17, 8, 1, 1, 0.75)}
            {block(9, 13, 1, 1, 0.7)}
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
      shapeRendering="crispEdges"
      className={className}
      {...props}
    >
      {lanternBase}
      {renderVariant()}
    </svg>
  );
};

export default GeometricLantern;
