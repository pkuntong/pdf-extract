import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: NextRequest) {
  try {
    const { rating, feedback, email, page, userAgent } = await request.json();

    // Validate input
    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: 'Invalid rating. Must be between 1 and 5.' },
        { status: 400 }
      );
    }

    if (!feedback || feedback.trim().length < 5) {
      return NextResponse.json(
        { error: 'Feedback must be at least 5 characters long.' },
        { status: 400 }
      );
    }

    // Store in Supabase
    const { error: dbError } = await supabase
      .from('feedback')
      .insert([
        {
          rating,
          feedback: feedback.trim(),
          email: email?.trim() || null,
          page: page || '/',
          user_agent: userAgent || '',
          created_at: new Date().toISOString(),
          ip_address: request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown'
        }
      ]);

    if (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json(
        { error: 'Failed to save feedback' },
        { status: 500 }
      );
    }

    // Optional: Send to external service (Slack, Discord, etc.)
    if (process.env.SLACK_WEBHOOK_URL) {
      try {
        await fetch(process.env.SLACK_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `📝 New Feedback (${rating}/5 stars)`,
            attachments: [
              {
                color: rating >= 4 ? 'good' : rating >= 3 ? 'warning' : 'danger',
                fields: [
                  { title: 'Rating', value: `${rating}/5 ⭐`, short: true },
                  { title: 'Page', value: page, short: true },
                  { title: 'Feedback', value: feedback, short: false },
                  ...(email ? [{ title: 'Email', value: email, short: true }] : [])
                ]
              }
            ]
          })
        });
      } catch (slackError) {
        console.warn('Failed to send to Slack:', slackError);
      }
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Feedback API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// SQL to create feedback table in Supabase:
/*
CREATE TABLE feedback (
  id SERIAL PRIMARY KEY,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  feedback TEXT NOT NULL,
  email VARCHAR(255),
  page VARCHAR(255),
  user_agent TEXT,
  ip_address VARCHAR(45),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS if needed
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Policy to allow inserts (adjust as needed)
CREATE POLICY "Allow anonymous feedback" ON feedback
  FOR INSERT TO anon WITH CHECK (true);
*/