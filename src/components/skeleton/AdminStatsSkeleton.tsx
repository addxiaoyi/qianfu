import React from 'react';

export const AdminStatsSkeleton: React.FC = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12 animate-pulse">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="p-8 bg-card border border-border rounded-3xl">
           <div className="w-12 h-12 bg-muted rounded-2xl mb-6" />
           <div className="w-24 h-4 bg-muted rounded-md mb-2" />
           <div className="w-16 h-8 bg-muted rounded-xl" />
        </div>
      ))}
    </div>
  );
};
