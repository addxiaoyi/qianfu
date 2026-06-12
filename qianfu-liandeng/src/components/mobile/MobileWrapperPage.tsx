import React, { type ReactNode } from 'react';
import MobileLayout from './MobileLayout';

interface MobileWrapperPageProps {
  children: ReactNode;
  title?: string;
  hideNav?: boolean;
}

/**
 * Wraps any page in MobileLayout with slide transitions and bottom nav.
 * Used as a route element: element={<MobileWrapperPage title="工单"><MobileTicketList /></MobileWrapperPage>}
 */
const MobileWrapperPage: React.FC<MobileWrapperPageProps> = ({ children, title, hideNav = false }) => {
  return (
    <MobileLayout title={title} hideNav={hideNav}>
      {children}
    </MobileLayout>
  );
};

export default MobileWrapperPage;
