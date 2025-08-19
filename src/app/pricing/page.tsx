'use client';

import React, { useState } from 'react';
import { PricingCard, pricingPlans, PricingPlan } from '@/components/PricingCard';
import { Button } from '@/components/ui/Button';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import toast from 'react-hot-toast';
import { getStripeJs } from '@/lib/stripe';

export default function PricingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { subscription, isPremium } = useSubscription();
  const [loading, setLoading] = useState<string | null>(null);

  const handleSelectPlan = async (plan: PricingPlan) => {
    // Check if user is authenticated for paid plans
    if (plan.price > 0 && !user) {
      toast.error('Please sign in to upgrade your plan');
      router.push('/auth');
      return;
    }

    if (plan.price === 0) {
      // Handle free plan
      toast.success('You\'re all set with the free plan!');
      router.push('/dashboard');
      return;
    }

    setLoading(plan.id);

    try {
      // Create checkout session (fallback to simple endpoint if not authenticated)
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priceId: plan.stripePriceId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      // Redirect to Stripe Checkout
      const stripe = await getStripeJs();
      if (!stripe) {
        throw new Error('Stripe failed to load');
      }

      const { error } = await stripe.redirectToCheckout({ sessionId: data.sessionId });

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Checkout error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to start checkout');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to App
          </Button>
        </div>

        {/* Hero Section */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Sparkles className="h-8 w-8 text-blue-600" />
            <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Simple Pricing
            </h1>
          </div>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
            Choose the perfect plan for your PDF extraction needs. 
            Upgrade or downgrade at any time.
          </p>
          <div className="flex items-center justify-center gap-4 text-sm text-gray-600 dark:text-gray-400">
            <span className="flex items-center gap-2">
              ✓ No hidden fees
            </span>
            <span className="flex items-center gap-2">
              ✓ Cancel anytime
            </span>
            <span className="flex items-center gap-2">
              ✓ 14-day money back
            </span>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {pricingPlans.map((plan) => {
            // Determine if this is the current plan
            let isCurrentPlan = false;
            if (plan.price === 0 && !isPremium) {
              isCurrentPlan = true; // Free plan is current if no premium subscription
            } else if (subscription && plan.stripePriceId === subscription.price_id) {
              isCurrentPlan = true; // Paid plan matches current subscription
            }

            return (
              <PricingCard
                key={plan.id}
                plan={plan}
                onSelectPlan={handleSelectPlan}
                loading={loading === plan.id}
                currentPlan={isCurrentPlan ? plan.id : undefined}
              />
            );
          })}
        </div>

        {/* FAQ Section */}
        <div className="max-w-3xl mx-auto mt-20">
          <h2 className="text-3xl font-bold text-center mb-8">Frequently Asked Questions</h2>
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
              <h3 className="font-semibold mb-2">Can I change plans later?</h3>
              <p className="text-gray-600 dark:text-gray-300">
                Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately 
                with prorated billing.
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
              <h3 className="font-semibold mb-2">What happens if I exceed my monthly limits?</h3>
              <p className="text-gray-600 dark:text-gray-300">
                You&apos;ll be notified when approaching your limit. Extractions beyond your plan limit 
                will be paused until the next billing cycle or you can upgrade your plan.
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
              <h3 className="font-semibold mb-2">Is my data secure?</h3>
              <p className="text-gray-600 dark:text-gray-300">
                Absolutely. All files are processed securely and deleted after extraction. 
                We never store your sensitive documents.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}