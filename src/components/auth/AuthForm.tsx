'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

type AuthMode = 'signin' | 'signup' | 'forgot';

interface AuthFormProps {
  mode?: AuthMode;
  onSuccess?: () => void;
}

export function AuthForm({ mode = 'signin', onSuccess }: AuthFormProps) {
  const [currentMode, setCurrentMode] = useState<AuthMode>(mode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const { signIn, signUp, resetPassword } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      let result;
      
      if (currentMode === 'signin') {
        result = await signIn(email, password);
        if (!result.error) {
          setMessage('Successfully signed in!');
          onSuccess?.();
        }
      } else if (currentMode === 'signup') {
        result = await signUp(email, password);
        if (!result.error) {
          setMessage('Check your email for a confirmation link!');
        }
      } else if (currentMode === 'forgot') {
        result = await resetPassword(email);
        if (!result.error) {
          setMessage('Password reset email sent!');
        }
      }

      if (result?.error) {
        setError(result.error.message);
      }
    } catch (err) {
      setError('An unexpected error occurred');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    switch (currentMode) {
      case 'signin': return 'Sign In';
      case 'signup': return 'Sign Up';
      case 'forgot': return 'Reset Password';
    }
  };

  const getSubmitText = () => {
    if (loading) return 'Loading...';
    switch (currentMode) {
      case 'signin': return 'Sign In';
      case 'signup': return 'Create Account';
      case 'forgot': return 'Send Reset Email';
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto p-6">
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {getTitle()}
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            {currentMode === 'signin' && 'Sign in to your account'}
            {currentMode === 'signup' && 'Create a new account'}
            {currentMode === 'forgot' && 'Enter your email to reset your password'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="Enter your email"
            />
          </div>

          {currentMode !== 'forgot' && (
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="Enter your password"
              />
            </div>
          )}

          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-lg">
              {error}
            </div>
          )}

          {message && (
            <div className="p-3 text-sm text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400 rounded-lg">
              {message}
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full"
            variant="default"
          >
            {getSubmitText()}
          </Button>
        </form>

        <div className="text-center space-y-2">
          {currentMode === 'signin' && (
            <>
              <button
                type="button"
                onClick={() => setCurrentMode('forgot')}
                className="text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400"
              >
                Forgot your password?
              </button>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Don&apos;t have an account?{' '}
                <button
                  type="button"
                  onClick={() => setCurrentMode('signup')}
                  className="text-blue-600 hover:text-blue-500 dark:text-blue-400 font-medium"
                >
                  Sign up
                </button>
              </div>
            </>
          )}

          {currentMode === 'signup' && (
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => setCurrentMode('signin')}
                className="text-blue-600 hover:text-blue-500 dark:text-blue-400 font-medium"
              >
                Sign in
              </button>
            </div>
          )}

          {currentMode === 'forgot' && (
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Remember your password?{' '}
              <button
                type="button"
                onClick={() => setCurrentMode('signin')}
                className="text-blue-600 hover:text-blue-500 dark:text-blue-400 font-medium"
              >
                Sign in
              </button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}