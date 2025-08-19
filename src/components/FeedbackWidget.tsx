'use client';

import React, { useState } from 'react';
import { MessageSquare, X, Send, Star } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import toast from 'react-hot-toast';

interface FeedbackData {
  rating: number;
  feedback: string;
  email?: string;
  page: string;
  userAgent: string;
}

export const FeedbackWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (rating === 0) {
      toast.error('Please select a rating');
      return;
    }

    if (feedback.trim().length < 10) {
      toast.error('Please provide at least 10 characters of feedback');
      return;
    }

    setIsSubmitting(true);

    try {
      const feedbackData: FeedbackData = {
        rating,
        feedback: feedback.trim(),
        email: email.trim() || undefined,
        page: window.location.pathname,
        userAgent: navigator.userAgent
      };

      // Send to your feedback API endpoint
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(feedbackData)
      });

      if (!response.ok) throw new Error('Failed to submit feedback');

      toast.success('Thank you for your feedback!');
      setIsOpen(false);
      setRating(0);
      setFeedback('');
      setEmail('');
    } catch (error) {
      console.error('Feedback submission error:', error);
      toast.error('Failed to submit feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={() => setIsOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-full p-3 shadow-lg"
          size="sm"
        >
          <MessageSquare className="h-5 w-5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80">
      <Card className="shadow-xl">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-lg">Quick Feedback</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(false)}
              className="p-1"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Star Rating */}
            <div>
              <label className="block text-sm font-medium mb-2">
                How would you rate your experience?
              </label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className={`p-1 transition-colors ${
                      star <= rating 
                        ? 'text-yellow-500' 
                        : 'text-gray-300 hover:text-yellow-400'
                    }`}
                  >
                    <Star className="h-5 w-5" fill={star <= rating ? 'currentColor' : 'none'} />
                  </button>
                ))}
              </div>
            </div>

            {/* Feedback Text */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Tell us more (optional)
              </label>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="What did you like? What could be improved?"
                className="w-full p-2 border rounded-md resize-none h-20 text-sm"
                maxLength={500}
              />
              <div className="text-xs text-gray-500 mt-1">
                {feedback.length}/500 characters
              </div>
            </div>

            {/* Email (Optional) */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Email (optional - for follow-up)
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full p-2 border rounded-md text-sm"
              />
            </div>

            {/* Submit */}
            <Button
              type="submit"
              disabled={isSubmitting || rating === 0}
              className="w-full"
              size="sm"
            >
              {isSubmitting ? (
                'Sending...'
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Feedback
                </>
              )}
            </Button>
          </form>

          <p className="text-xs text-gray-500 mt-2 text-center">
            Your feedback helps us improve PDF Extract Pro
          </p>
        </CardContent>
      </Card>
    </div>
  );
};