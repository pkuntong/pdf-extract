import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Create a service role client for server-side operations
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export interface UserSubscription {
  userId: string | null;
  isPremium: boolean;
  plan: string;
  subscriptionId?: string;
  priceId?: string;
  status?: string;
}

export async function getUserSubscription(request: NextRequest): Promise<UserSubscription> {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return {
        userId: null,
        isPremium: false,
        plan: 'free'
      };
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Verify the JWT token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return {
        userId: null,
        isPremium: false,
        plan: 'free'
      };
    }

    // Check user's subscription
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (subError || !subscription) {
      return {
        userId: user.id,
        isPremium: false,
        plan: 'free'
      };
    }

    return {
      userId: user.id,
      isPremium: true,
      plan: 'premium',
      subscriptionId: subscription.subscription_id,
      priceId: subscription.price_id,
      status: subscription.status
    };

  } catch (error) {
    console.error('Error checking user subscription:', error);
    return {
      userId: null,
      isPremium: false,
      plan: 'free'
    };
  }
}

// Alternative function for checking subscription using user ID directly
export async function getSubscriptionByUserId(userId: string): Promise<UserSubscription> {
  try {
    const { data: subscription, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (error || !subscription) {
      return {
        userId,
        isPremium: false,
        plan: 'free'
      };
    }

    return {
      userId,
      isPremium: true,
      plan: 'premium',
      subscriptionId: subscription.subscription_id,
      priceId: subscription.price_id,
      status: subscription.status
    };

  } catch (error) {
    console.error('Error checking subscription by user ID:', error);
    return {
      userId,
      isPremium: false,
      plan: 'free'
    };
  }
}