'use client';

import React from 'react';

// Instructions to create Google Form:
// 1. Go to forms.google.com
// 2. Create a new form with these fields:
//    - Rating (Linear scale 1-5)
//    - Feedback (Long answer)
//    - Email (Short answer, optional)
//    - Page URL (Short answer, prefilled)
// 3. Click Send > Embed HTML
// 4. Replace FORM_ID below with your actual form ID

const GOOGLE_FORM_ID = 'YOUR_GOOGLE_FORM_ID_HERE';
const GOOGLE_FORM_URL = `https://docs.google.com/forms/d/e/${GOOGLE_FORM_ID}/viewform`;

export const GoogleFormsFeedback = ({ className = '' }: { className?: string }) => {
  return (
    <div className={`w-full ${className}`}>
      <iframe
        src={`${GOOGLE_FORM_URL}?embedded=true&usp=pp_url&entry.123456789=${encodeURIComponent(window.location.href)}`}
        width="100%"
        height="600"
        frameBorder="0"
        marginHeight={0}
        marginWidth={0}
        className="rounded-lg"
      >
        Loading feedback form...
      </iframe>
      
      {/* Fallback link */}
      <div className="mt-2 text-center">
        <a
          href={GOOGLE_FORM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline text-sm"
        >
          Open form in new tab
        </a>
      </div>
    </div>
  );
};

// Usage example for a dedicated feedback page:
export const FeedbackPage = () => {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-4">We'd Love Your Feedback!</h1>
        <p className="text-gray-600">
          Help us improve PDF Extract Pro by sharing your thoughts and suggestions.
        </p>
      </div>
      
      <GoogleFormsFeedback />
      
      <div className="mt-8 text-center text-sm text-gray-500">
        <p>Your responses help us build a better product. Thank you!</p>
      </div>
    </div>
  );
};