'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ArrowLeft, User, Mail, Shield, CreditCard, Trash2, Save, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

interface ProfileFormData {
  displayName: string;
  email: string;
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}

function SettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, signOut } = useAuth();
  const { subscription, isPremium } = useSubscription();
  
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'billing' | 'danger'>('profile');
  const [loading, setLoading] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  const [profileData, setProfileData] = useState<ProfileFormData>({
    displayName: user?.user_metadata?.full_name || user?.user_metadata?.display_name || '',
    email: user?.email || '',
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: ''
  });

  // Set tab from URL parameter
  useEffect(() => {
    const tabParam = searchParams.get('tab') as 'profile' | 'security' | 'billing' | 'danger';
    if (tabParam && ['profile', 'security', 'billing', 'danger'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading('profile');

    try {
      const { data, error } = await supabase.auth.updateUser({
        data: {
          full_name: profileData.displayName,
          display_name: profileData.displayName
        }
      });

      if (error) throw error;

      toast.success('Profile updated successfully!');
    } catch (error) {
      console.error('Profile update error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update profile');
    } finally {
      setLoading(null);
    }
  };

  const handleEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (profileData.email === user?.email) {
      toast.error('New email must be different from current email');
      return;
    }

    setLoading('email');

    try {
      const { error } = await supabase.auth.updateUser({
        email: profileData.email
      });

      if (error) throw error;

      toast.success('Verification email sent! Please check your inbox to confirm the new email address.');
    } catch (error) {
      console.error('Email update error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update email');
    } finally {
      setLoading(null);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (profileData.newPassword !== profileData.confirmNewPassword) {
      toast.error('New passwords do not match');
      return;
    }

    if (profileData.newPassword.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }

    setLoading('password');

    try {
      const { error } = await supabase.auth.updateUser({
        password: profileData.newPassword
      });

      if (error) throw error;

      toast.success('Password updated successfully!');
      setProfileData(prev => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmNewPassword: ''
      }));
    } catch (error) {
      console.error('Password update error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update password');
    } finally {
      setLoading(null);
    }
  };

  const handleDeleteAccount = async () => {
    setLoading('delete');

    try {
      // First, cancel subscription if exists
      if (subscription) {
        const response = await fetch('/api/cancel-subscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscriptionId: subscription.subscription_id })
        });

        if (!response.ok) {
          throw new Error('Failed to cancel subscription');
        }
      }

      // Delete user account
      const { error } = await supabase.auth.admin.deleteUser(user!.id);

      if (error) throw error;

      toast.success('Account deleted successfully');
      await signOut();
      router.push('/');
    } catch (error) {
      console.error('Account deletion error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete account');
    } finally {
      setLoading(null);
      setShowDeleteConfirm(false);
    }
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'billing', label: 'Billing', icon: CreditCard },
    { id: 'danger', label: 'Danger Zone', icon: AlertTriangle }
  ] as const;

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <h2 className="text-xl font-semibold mb-4">Please sign in to access settings</h2>
            <Button onClick={() => router.push('/auth')}>Sign In</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Account Settings</h1>
            <p className="text-gray-600 dark:text-gray-400">
              Manage your account preferences and security settings
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <Card>
              <CardContent className="p-2">
                <nav className="space-y-1">
                  {tabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                          activeTab === tab.id
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        {tab.label}
                      </button>
                    );
                  })}
                </nav>
              </CardContent>
            </Card>
          </div>

          {/* Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Profile Tab */}
            {activeTab === 'profile' && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Profile Information
                  </CardTitle>
                  <CardDescription>
                    Update your personal information and preferences
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleProfileUpdate} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Display Name
                      </label>
                      <input
                        type="text"
                        value={profileData.displayName}
                        onChange={(e) => setProfileData(prev => ({ ...prev, displayName: e.target.value }))}
                        className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter your display name"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Account Type
                      </label>
                      <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">
                            {isPremium ? 'Premium Account' : 'Free Account'}
                          </span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            isPremium 
                              ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                          }`}>
                            {isPremium ? 'Pro' : 'Free'}
                          </span>
                        </div>
                        {subscription && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {subscription.status === 'active' ? 'Active subscription' : `Status: ${subscription.status}`}
                          </p>
                        )}
                      </div>
                    </div>

                    <Button
                      type="submit"
                      loading={loading === 'profile'}
                      className="w-full"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Save Profile
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}

            {/* Security Tab */}
            {activeTab === 'security' && (
              <div className="space-y-6">
                {/* Email Settings */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Mail className="h-5 w-5" />
                      Email Address
                    </CardTitle>
                    <CardDescription>
                      Change your email address. You'll need to verify the new email.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleEmailChange} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Current Email
                        </label>
                        <input
                          type="email"
                          value={user.email}
                          disabled
                          className="w-full p-3 border rounded-lg bg-gray-50 dark:bg-gray-800 cursor-not-allowed"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-1">
                          New Email Address
                        </label>
                        <input
                          type="email"
                          value={profileData.email}
                          onChange={(e) => setProfileData(prev => ({ ...prev, email: e.target.value }))}
                          className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Enter new email address"
                          required
                        />
                      </div>

                      <Button
                        type="submit"
                        loading={loading === 'email'}
                        disabled={profileData.email === user.email}
                      >
                        <Mail className="h-4 w-4 mr-2" />
                        Update Email
                      </Button>
                    </form>
                  </CardContent>
                </Card>

                {/* Password Settings */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5" />
                      Change Password
                    </CardTitle>
                    <CardDescription>
                      Update your password to keep your account secure
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handlePasswordChange} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          New Password
                        </label>
                        <input
                          type="password"
                          value={profileData.newPassword}
                          onChange={(e) => setProfileData(prev => ({ ...prev, newPassword: e.target.value }))}
                          className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Enter new password"
                          minLength={6}
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Confirm New Password
                        </label>
                        <input
                          type="password"
                          value={profileData.confirmNewPassword}
                          onChange={(e) => setProfileData(prev => ({ ...prev, confirmNewPassword: e.target.value }))}
                          className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Confirm new password"
                          minLength={6}
                          required
                        />
                      </div>

                      <Button
                        type="submit"
                        loading={loading === 'password'}
                        disabled={!profileData.newPassword || !profileData.confirmNewPassword}
                      >
                        <Shield className="h-4 w-4 mr-2" />
                        Update Password
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Billing Tab */}
            {activeTab === 'billing' && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Billing & Subscription
                  </CardTitle>
                  <CardDescription>
                    Manage your subscription and billing information
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Current Plan */}
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="font-semibold text-lg">
                          {isPremium ? 'Pro Plan' : 'Free Plan'}
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400">
                          {isPremium 
                            ? `$9.99/month • ${subscription?.status || 'Active'}`
                            : '5 extractions per month'
                          }
                        </p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        isPremium 
                          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                      }`}>
                        {isPremium ? 'Premium' : 'Free'}
                      </span>
                    </div>

                    {subscription && subscription.current_period_end && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {subscription.status === 'active' 
                          ? `Renews on ${new Date(subscription.current_period_end).toLocaleDateString()}`
                          : `Ends on ${new Date(subscription.current_period_end).toLocaleDateString()}`
                        }
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-4">
                    {!isPremium ? (
                      <Button 
                        onClick={() => router.push('/pricing')}
                        variant="premium"
                      >
                        <CreditCard className="h-4 w-4 mr-2" />
                        Upgrade to Pro
                      </Button>
                    ) : (
                      <div className="flex gap-2">
                        <Button 
                          variant="outline"
                          onClick={() => window.open('https://billing.stripe.com/p/login/test_YOUR_PORTAL_ID', '_blank')}
                        >
                          Manage Billing
                        </Button>
                        <Button 
                          variant="outline"
                          onClick={() => router.push('/pricing')}
                        >
                          Change Plan
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Usage Stats */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">
                        {/* You'd get this from your analytics */}
                        12
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Extractions this month
                      </div>
                    </div>
                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">
                        {isPremium ? '88' : '3'}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Remaining this month
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Danger Zone Tab */}
            {activeTab === 'danger' && (
              <Card className="border-red-200 dark:border-red-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-red-600">
                    <AlertTriangle className="h-5 w-5" />
                    Danger Zone
                  </CardTitle>
                  <CardDescription>
                    Irreversible actions that will permanently affect your account
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <h3 className="font-semibold text-red-800 dark:text-red-200 mb-2">
                      Delete Account
                    </h3>
                    <p className="text-sm text-red-600 dark:text-red-300 mb-4">
                      Once you delete your account, there is no going back. This will permanently delete your profile, 
                      cancel any active subscriptions, and remove all associated data.
                    </p>
                    
                    {!showDeleteConfirm ? (
                      <Button
                        variant="destructive"
                        onClick={() => setShowDeleteConfirm(true)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Account
                      </Button>
                    ) : (
                      <div className="space-y-4">
                        <div className="p-3 bg-white dark:bg-gray-900 rounded border">
                          <p className="font-medium text-red-800 dark:text-red-200 mb-2">
                            Are you absolutely sure?
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            This action cannot be undone. Type "DELETE" to confirm:
                          </p>
                          <input
                            type="text"
                            placeholder="Type DELETE to confirm"
                            className="w-full mt-2 p-2 border rounded focus:ring-2 focus:ring-red-500"
                            onChange={(e) => {
                              // You could add confirmation logic here
                            }}
                          />
                        </div>
                        
                        <div className="flex gap-2">
                          <Button
                            variant="destructive"
                            onClick={handleDeleteAccount}
                            loading={loading === 'delete'}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Yes, Delete My Account
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => setShowDeleteConfirm(false)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <SettingsContent />
    </Suspense>
  );
}