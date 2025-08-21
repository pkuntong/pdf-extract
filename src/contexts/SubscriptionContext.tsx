'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
// Supabase is imported dynamically when needed to avoid initializing a client without env vars

export interface Subscription {
  id: string;
  user_id: string;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  price_id: string;
  status: 'active' | 'canceled' | 'past_due' | 'unpaid';
  current_period_start: string;
  current_period_end: string;
  created_at: string;
  updated_at: string;
}

interface SubscriptionContextType {
  subscription: Subscription | null;
  loading: boolean;
  isPremium: boolean;
  refreshSubscription: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  // Skip Supabase if env vars are missing or if we're in development without a proper setup
  const supabaseEnabled = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && 
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    process.env.NODE_ENV === 'production' // Only enable in production for now
  );

  const refreshSubscription = useCallback(async () => {
    if (!user || !supabaseEnabled) {
      setSubscription(null);
      setLoading(false);
      return;
    }

    try {
      const { supabase } = await import('@/lib/supabase');
      if (!supabase) {
        console.warn('Supabase not available');
        setSubscription(null);
        return;
      }
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      if (error) {
        // Handle common Supabase errors gracefully
        if (error.code === 'PGRST116') {
          // No rows found - user has no subscription
          setSubscription(null);
        } else if (error.code === '42P01') {
          // Table doesn't exist yet - treat as no subscription
          console.warn('Subscriptions table not found - treating as no subscription');
          setSubscription(null);
        } else if (process.env.NODE_ENV === 'development' && (error as unknown as { message?: string }).message) {
          console.error('Error fetching subscription:', error);
        }
        setSubscription(null);
      } else {
        setSubscription(data || null);
      }
    } catch (error) {
      console.error('Error refreshing subscription:', error);
    } finally {
      setLoading(false);
    }
  }, [user, supabaseEnabled]);

  useEffect(() => {
    refreshSubscription();
  }, [user, refreshSubscription]);

  const isPremium = subscription?.status === 'active';

  const value = {
    subscription,
    loading,
    isPremium,
    refreshSubscription,
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
}