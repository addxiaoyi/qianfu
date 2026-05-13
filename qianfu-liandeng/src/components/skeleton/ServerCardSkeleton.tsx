import React from 'react';

export const ServerCardSkeleton: React.FC = () => {
  return (
    <div className="bg-card border-2 border-border rounded-[2.5rem] overflow-hidden animate-pulse">
      <div className="aspect-video bg-muted" />
      <div className="p-8 space-y-4">
        <div className="flex gap-2">
          <div className="w-12 h-4 bg-muted rounded-full" />
          <div className="w-12 h-4 bg-muted rounded-full" />
        </div>
        <div className="w-3/4 h-8 bg-muted rounded-xl" />
        <div className="space-y-2">
          <div className="w-full h-4 bg-muted rounded-md" />
          <div className="w-5/6 h-4 bg-muted rounded-md" />
        </div>
        <div className="pt-6 border-t-2 border-border flex justify-between items-center">
           <div className="w-24 h-4 bg-muted rounded-md" />
           <div className="w-10 h-10 bg-muted rounded-2xl" />
        </div>
      </div>
    </div>
  );
};
