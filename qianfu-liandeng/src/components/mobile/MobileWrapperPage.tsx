import React, { type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useMobile } from '../../hooks/useMobile';
import MobileLayout from './MobileLayout';

interface MobileWrapperPageProps {
  children: ReactNode;
  title?: string;
}

/**
 * Wraps any page in MobileLayout with slide transitions and bottom nav.
 * Used as a route element: element={<MobileWrapperPage title="工单"><MobileTicketList /></MobileWrapperPage>}
 */
const MobileWrapperPage: React.FC<MobileWrapperPageProps> = ({ children, title }) => {
  const location = useLocation();
  const { isMobile } = useMobile(768);

  if (!isMobile) {
    return <>{children}</>;
  }

  return (
    <MobileLayout onBack={location.key !== 'default' ? undefined : undefined}>
      {title && (
        <div className="text-center font-bold text-lg py-2 mb-2">{title}</div>
      )}
      {children}
    </MobileLayout>
  );
};

export default MobileWrapperPage;
