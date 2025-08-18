'use client';

import React, { useState, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  disabled?: boolean;
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({
  onRefresh,
  children,
  disabled = false,
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { triggerSuccess } = useHapticFeedback();

  const handleRefresh = useCallback(async () => {
    if (disabled || isRefreshing) return;

    setIsRefreshing(true);
    triggerSuccess();
    
    try {
      await onRefresh();
    } finally {
      setTimeout(() => {
        setIsRefreshing(false);
      }, 300);
    }
  }, [disabled, isRefreshing, onRefresh, triggerSuccess]);

  return (
    <div className="relative">
      {/* Simple refresh button for now - can be enhanced later */}
      {isRefreshing && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10
                       flex items-center justify-center w-12 h-12 rounded-full
                       bg-blue-600 shadow-lg animate-in fade-in-0 slide-in-from-top-2">
          <RefreshCw className="h-6 w-6 text-white animate-spin" />
        </div>
      )}

      {/* Content */}
      <div className="w-full">
        {children}
      </div>
    </div>
  );
};