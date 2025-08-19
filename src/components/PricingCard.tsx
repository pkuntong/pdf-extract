'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Check, Zap, Crown, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PricingPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  interval: 'month' | 'year';
  stripePriceId: string;
  features: string[];
  popular?: boolean;
  maxFiles?: number;
  maxFileSize?: string;
  priority?: 'standard' | 'high' | 'premium';
}

export const pricingPlans: PricingPlan[] = [
  {
    id: 'free',
    name: 'Free',
    description: 'Perfect for trying out our PDF extraction',
    price: 0,
    interval: 'month',
    stripePriceId: '',
    maxFiles: 5,
    maxFileSize: '2MB',
    priority: 'standard',
    features: [
      '5 PDF extractions per month',
      'Basic invoice data extraction',
      'Mobile-optimized interface',
      'Offline storage',
      'Standard processing speed'
    ]
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'For professionals who need more extractions',
    price: 9.99,
    interval: 'month',
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID || '',
    maxFiles: 100,
    maxFileSize: '10MB',
    priority: 'high',
    popular: true,
    features: [
      '100 PDF extractions per month',
      'Advanced data extraction patterns',
      'Bulk processing',
      'CSV/JSON export',
      'Priority processing',
      'Email support',
      'Custom extraction templates'
    ]
  },
  {
    id: 'business',
    name: 'Business',
    description: 'For teams and businesses with high volume needs',
    price: 29.99,
    interval: 'month',
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_BUSINESS_PRICE_ID || '',
    maxFiles: 1000,
    maxFileSize: '50MB',
    priority: 'premium',
    features: [
      'Unlimited PDF extractions',
      'All extraction patterns',
      'Batch processing (up to 50 files)',
      'API access',
      'Premium processing speed',
      'Analytics dashboard',
      'Team collaboration',
      'Priority support',
      'Custom integrations'
    ]
  }
];

interface PricingCardProps {
  plan: PricingPlan;
  onSelectPlan: (plan: PricingPlan) => void;
  currentPlan?: string;
  loading?: boolean;
}

export const PricingCard: React.FC<PricingCardProps> = ({
  plan,
  onSelectPlan,
  currentPlan,
  loading = false
}) => {
  const isCurrentPlan = currentPlan === plan.id;
  const isFree = plan.price === 0;

  const getIcon = () => {
    switch (plan.id) {
      case 'free':
        return <Users className="h-6 w-6" />;
      case 'pro':
        return <Zap className="h-6 w-6" />;
      case 'business':
        return <Crown className="h-6 w-6" />;
      default:
        return <Users className="h-6 w-6" />;
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(price);
  };

  return (
    <Card className={cn(
      'relative overflow-hidden transition-all duration-200',
      plan.popular && 'ring-2 ring-blue-500 scale-105',
      isCurrentPlan && 'ring-2 ring-green-500'
    )}>
      {plan.popular && (
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-center py-2 text-sm font-semibold">
          Most Popular
        </div>
      )}
      
      <CardHeader className={cn(plan.popular && 'pt-12')}>
        <div className="flex items-center gap-3">
          <div className={cn(
            'p-2 rounded-lg',
            plan.id === 'free' && 'bg-gray-100 text-gray-600',
            plan.id === 'pro' && 'bg-blue-100 text-blue-600',
            plan.id === 'business' && 'bg-purple-100 text-purple-600'
          )}>
            {getIcon()}
          </div>
          <div>
            <CardTitle className="text-xl">{plan.name}</CardTitle>
            <CardDescription>{plan.description}</CardDescription>
          </div>
        </div>
        
        <div className="mt-4">
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-bold">
              {isFree ? 'Free' : formatPrice(plan.price)}
            </span>
            {!isFree && (
              <span className="text-gray-600 dark:text-gray-400">
                /{plan.interval}
              </span>
            )}
          </div>
          {plan.maxFiles && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Up to {plan.maxFiles} {plan.maxFiles === 1000 ? 'files' : 'files'} per month
            </p>
          )}
        </div>
      </CardHeader>

      <CardContent>
        <ul className="space-y-3">
          {plan.features.map((feature, index) => (
            <li key={index} className="flex items-start gap-3">
              <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span className="text-sm text-gray-700 dark:text-gray-300">{feature}</span>
            </li>
          ))}
        </ul>
      </CardContent>

      <CardFooter>
        <Button
          variant={plan.popular ? 'premium' : isCurrentPlan ? 'secondary' : 'default'}
          size="lg"
          className="w-full"
          onClick={() => onSelectPlan(plan)}
          disabled={isCurrentPlan || loading || (!isFree && !plan.stripePriceId)}
          loading={loading}
        >
          {isCurrentPlan
            ? 'Current Plan'
            : isFree
            ? 'Get Started'
            : !plan.stripePriceId
            ? 'Unavailable'
            : 'Upgrade Now'}
        </Button>
      </CardFooter>
    </Card>
  );
};