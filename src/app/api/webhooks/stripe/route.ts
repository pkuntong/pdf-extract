import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { headers } from 'next/headers';
import { supabase } from '@/lib/supabase';
import Stripe from 'stripe';

export async function GET() {
  return NextResponse.json({ 
    message: 'Stripe webhook endpoint. Configure this URL in your Stripe dashboard.',
    status: 'ready'
  });
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = (await headers()).get('stripe-signature') as string;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log('Checkout session completed:', session.id);
        
        if (session.mode === 'subscription' && session.customer && session.metadata) {
          const customerId = session.customer as string;
          const userId = session.metadata.user_id;
          const priceId = session.metadata.price_id;
          
          // Get the subscription from Stripe
          const subscriptions = await stripe.subscriptions.list({
            customer: customerId,
            status: 'active',
            limit: 1,
          });
          
          if (subscriptions.data.length > 0) {
            const stripeSubscription = subscriptions.data[0];
            
            // Update or create subscription in Supabase
            const { error } = await supabase
              .from('subscriptions')
              .upsert({
                user_id: userId,
                stripe_customer_id: customerId,
                stripe_subscription_id: stripeSubscription.id,
                price_id: priceId,
                status: stripeSubscription.status,
                current_period_start: new Date(stripeSubscription.current_period_start * 1000).toISOString(),
                current_period_end: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
                updated_at: new Date().toISOString(),
              }, {
                onConflict: 'user_id',
              });
              
            if (error) {
              console.error('Error updating subscription:', error);
            } else {
              console.log('Subscription updated successfully for user:', userId);
            }
          }
        }
        
        break;
      }
      
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        console.log('Subscription updated:', subscription.id);
        
        // Get customer to find user_id
        const customer = await stripe.customers.retrieve(subscription.customer as string);
        if ('metadata' in customer && customer.metadata.supabase_user_id) {
          const userId = customer.metadata.supabase_user_id;
          const priceId = subscription.items.data[0]?.price.id;
          
          const { error } = await supabase
            .from('subscriptions')
            .upsert({
              user_id: userId,
              stripe_customer_id: subscription.customer as string,
              stripe_subscription_id: subscription.id,
              price_id: priceId,
              status: subscription.status === 'active' ? 'active' : subscription.status,
              current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'stripe_subscription_id',
            });
            
          if (error) {
            console.error('Error updating subscription:', error);
          }
        }
        
        break;
      }
      
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        console.log('Subscription cancelled:', subscription.id);
        
        // Update subscription status to cancelled
        const { error } = await supabase
          .from('subscriptions')
          .update({
            status: 'canceled',
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_subscription_id', subscription.id);
          
        if (error) {
          console.error('Error cancelling subscription:', error);
        }
        
        break;
      }
      
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        console.log('Payment succeeded:', invoice.id);
        
        // Send receipt email
        // Update payment history
        
        break;
      }
      
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        console.log('Payment failed:', invoice.id);
        
        // Send payment failure notification
        // Handle dunning management
        
        break;
      }
      
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}