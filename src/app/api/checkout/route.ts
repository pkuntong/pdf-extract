import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { absoluteUrl } from '@/lib/utils';

export async function GET() {
  return NextResponse.json({ 
    message: 'Checkout API endpoint. Use POST to create checkout sessions.' 
  });
}

export async function POST(request: NextRequest) {
  try {
    // Check if Stripe is properly configured
    if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'sk_test_dummy_key') {
      return NextResponse.json(
        { error: 'Stripe not configured. Please set up your Stripe keys.' },
        { status: 503 }
      );
    }

    const { priceId, userId = 'anonymous' } = await request.json();

    if (!priceId) {
      return NextResponse.json(
        { error: 'Price ID is required' },
        { status: 400 }
      );
    }

    // const origin = (await headers()).get('origin') || 'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: absoluteUrl('/dashboard?success=true'),
      cancel_url: absoluteUrl('/pricing?canceled=true'),
      metadata: {
        userId,
      },
      customer_email: undefined, // Let Stripe collect email
      allow_promotion_codes: true,
      billing_address_collection: 'required',
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('Stripe checkout error:', error);
    
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}