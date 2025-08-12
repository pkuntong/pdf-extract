'use client';

import React, { Suspense } from 'react';
import { animated, useSpring } from '@react-spring/web';

const AnimatedDiv = animated('div');

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
  const fadeIn = useSpring({
    from: { opacity: 0, transform: 'translateY(10px)' },
    to: { opacity: 1, transform: 'translateY(0px)' },
    config: { tension: 280, friction: 20 },
  });

  return (
    <div className={className}>
      <Suspense fallback={fallback}>
        <AnimatedDiv style={fadeIn}>
          {children}
        </AnimatedDiv>
      </Suspense>
    </div>
  );
};