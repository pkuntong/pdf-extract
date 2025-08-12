'use client';

import React, { useState, useRef, useCallback } from 'react';
import { useGesture } from '@use-gesture/react';
import { animated, useSpring } from '@react-spring/web';

const AnimatedDiv = animated('div');
import { RefreshCw } from 'lucide-react';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  disabled?: boolean;
  threshold?: number;
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({
  onRefresh,
  children,
  disabled = false,
  threshold = 80,
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { triggerSelection, triggerSuccess } = useHapticFeedback();

  const [{ y, rotateZ, scale, opacity }, api] = useSpring(() => ({
    y: 0,
    rotateZ: 0,
    scale: 0,
    opacity: 0,
    config: { tension: 300, friction: 30 },
  }));

  const handleRefresh = useCallback(async () => {
    if (disabled || isRefreshing) return;

    setIsRefreshing(true);
    triggerSuccess();
    
    // Animate to refreshing state
    api.start({
      y: threshold,
      rotateZ: 360,
      scale: 1,
      opacity: 1,
    });

    try {
      await onRefresh();
    } finally {
      // Animate back to normal
      api.start({
        y: 0,
        rotateZ: 0,
        scale: 0,
        opacity: 0,
      });
      
      setTimeout(() => {
        setIsRefreshing(false);
      }, 300);
    }
  }, [disabled, isRefreshing, onRefresh, api, threshold, triggerSuccess]);

  const bind = useGesture(
    {
      onDrag: ({ movement: [, my], velocity: [, vy], direction: [, dy], cancel }) => {
        if (disabled || isRefreshing) {
          cancel();
          return;
        }

        // Only allow pull down when at the top of the page
        if (window.scrollY > 10) {
          cancel();
          return;
        }

        // Only respond to downward pulls
        if (my < 0) {
          cancel();
          return;
        }

        const pullDistance = Math.min(my, threshold * 1.5);
        const progress = Math.min(pullDistance / threshold, 1);
        
        // Provide haptic feedback when threshold is reached
        if (pullDistance >= threshold && !isRefreshing) {
          triggerSelection();
        }

        api.start({
          y: pullDistance,
          rotateZ: progress * 180,
          scale: Math.min(progress, 1),
          opacity: Math.min(progress * 2, 1),
          immediate: true,
        });
      },
      onDragEnd: ({ movement: [, my] }) => {
        if (disabled || isRefreshing) return;

        const pullDistance = Math.min(my, threshold * 1.5);
        
        if (pullDistance >= threshold) {
          handleRefresh();
        } else {
          // Snap back to normal
          api.start({
            y: 0,
            rotateZ: 0,
            scale: 0,
            opacity: 0,
          });
        }
      },
    },
    {
      drag: {
        axis: 'y',
        rubberband: true,
        threshold: 10,
      }
    }
  );

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden"
      style={{ touchAction: 'pan-x pan-down' }}
      {...bind()}
    >
      {/* Pull to refresh indicator */}
      <AnimatedDiv
        style={{
          y: y.to(val => val - threshold),
          opacity,
        }}
        className="absolute top-0 left-1/2 transform -translate-x-1/2 z-10
                   flex items-center justify-center w-12 h-12 rounded-full
                   bg-blue-600 shadow-lg"
      >
        <AnimatedDiv
          style={{
            transform: rotateZ.to(r => `rotate(${r}deg)`),
            scale,
          }}
        >
          <RefreshCw 
            className={`h-6 w-6 text-white ${isRefreshing ? 'animate-spin' : ''}`} 
          />
        </AnimatedDiv>
      </AnimatedDiv>

      {/* Content */}
      <AnimatedDiv
        style={{
          y: y.to(val => Math.max(0, val * 0.5)),
        }}
        className="w-full"
      >
        {children}
      </AnimatedDiv>
    </div>
  );
};