'use client';

import React, { useEffect } from 'react';

// Instructions for Typeform:
// 1. Create account at typeform.com
// 2. Build feedback form with rating, text, email fields
// 3. Get embed code from Share > Embed
// 4. Replace TYPEFORM_ID with your form ID

const TYPEFORM_ID = 'YOUR_TYPEFORM_ID';

export const TypeformFeedback = () => {
  useEffect(() => {
    // Load Typeform embed script
    const script = document.createElement('script');
    script.src = '//embed.typeform.com/next/embed.js';
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  return (
    <div
      data-tf-widget={TYPEFORM_ID}
      data-tf-opacity="100"
      data-tf-iframe-props="title=PDF Extract Pro Feedback"
      data-tf-transitive-search-params
      data-tf-medium="snippet"
      style={{ width: '100%', height: '400px' }}
    ></div>
  );
};

// Popup widget version
export const TypeformPopup = () => {
  const openPopup = () => {
    // @ts-ignore - Typeform global
    if (window.tf) {
      window.tf.createPopup(TYPEFORM_ID).open();
    }
  };

  useEffect(() => {
    const script = document.createElement('script');
    script.src = '//embed.typeform.com/next/embed.js';
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  return (
    <button
      onClick={openPopup}
      className="fixed bottom-4 right-4 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-3 shadow-lg z-50"
    >
      💬 Feedback
    </button>
  );
};