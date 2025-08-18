'use client';

import React, { Suspense } from 'react';

interface LazyComponentProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  className?: string;
}

const DefaultSkeleton = () => (
  <div className="animate-pulse">
    <div className="bg-gray-700 rounded-lg h-32 w-full mb-4"></div>
    <div className="space-y-2">
      <div className="bg-gray-700 h-4 rounded w-3/4"></div>
      <div className="bg-gray-700 h-4 rounded w-1/2"></div>
    </div>
  </div>
);

export const LazyComponent: React.FC<LazyComponentProps> = ({
  children,
  fallback = <DefaultSkeleton />,
  className = '',
}) => {
  return (
    <div className={className}>
      <Suspense fallback={fallback}>
        <div className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
          {children}
        </div>
      </Suspense>
    </div>
  );
};