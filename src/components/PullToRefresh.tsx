'use client';

import React from 'react';

interface PullToRefreshProps {
  children: React.ReactNode;
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({
  children,
}) => {
  return (
    <div className="relative">
      {/* Content */}
      <div className="w-full">
        {children}
      </div>
    </div>
  );
};