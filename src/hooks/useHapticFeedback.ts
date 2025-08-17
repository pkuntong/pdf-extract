'use client';

import { useCallback } from 'react';

export interface HapticFeedbackOptions {
  type?: 'light' | 'medium' | 'heavy' | 'soft' | 'rigid';
  duration?: number;
}

export const useHapticFeedback = () => {
  const triggerHaptic = useCallback((options: HapticFeedbackOptions = {}) => {
    const { type = 'light' } = options;
    
    // Check if device supports haptic feedback
    if ('vibrate' in navigator) {
      // Map haptic types to vibration patterns
      const patterns = {
        light: [10],
        medium: [20],
        heavy: [30],
        soft: [5],
        rigid: [40],
      };
      
      navigator.vibrate(patterns[type]);
    }
    
    // For iOS devices with haptic feedback API
    interface WindowWithHaptics extends Window {
      haptics?: {
        impact: (options: { style: string }) => void;
      };
    }
    
    if ('haptics' in window && typeof (window as WindowWithHaptics).haptics?.impact === 'function') {
      (window as WindowWithHaptics).haptics?.impact({ style: type });
    }
  }, []);

  const triggerSelection = useCallback(() => {
    triggerHaptic({ type: 'light' });
  }, [triggerHaptic]);

  const triggerImpact = useCallback(() => {
    triggerHaptic({ type: 'medium' });
  }, [triggerHaptic]);

  const triggerNotification = useCallback(() => {
    triggerHaptic({ type: 'heavy' });
  }, [triggerHaptic]);

  const triggerError = useCallback(() => {
    // Error pattern: two quick pulses
    if ('vibrate' in navigator) {
      navigator.vibrate([100, 50, 100]);
    }
  }, []);

  const triggerSuccess = useCallback(() => {
    // Success pattern: single longer pulse
    if ('vibrate' in navigator) {
      navigator.vibrate([200]);
    }
  }, []);

  return {
    triggerHaptic,
    triggerSelection,
    triggerImpact,
    triggerNotification,
    triggerError,
    triggerSuccess,
  };
};