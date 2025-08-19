# Supabase Authentication Setup Guide

This guide will help you set up Supabase authentication for your PDF Extract Pro application.

## Prerequisites

1. Create a Supabase account at [supabase.com](https://supabase.com)
2. Create a new Supabase project

## Setup Steps

### 1. Configure Supabase Project

1. Go to your Supabase dashboard
2. Navigate to **Authentication > Settings**
3. Configure the following settings:
   - **Site URL**: `http://localhost:3001` (for development)
   - **Redirect URLs**: Add the following URLs:
     - `http://localhost:3001/auth/callback`
     - `http://localhost:3001/auth/reset-password`
     - `https://yourdomain.com/auth/callback` (for production)
     - `https://yourdomain.com/auth/reset-password` (for production)

### 2. Get API Keys

1. Go to **Settings > API**
2. Copy your **Project URL** and **anon public** key
3. Update your `.env.local` file:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_project_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

### 3. Email Templates (Optional)

Configure custom email templates in **Authentication > Email Templates**:
- **Confirm signup**
- **Reset password**
- **Magic link**

## Features Included

### Authentication Components
- `AuthForm` - Universal form for sign up, sign in, and forgot password
- `UserMenu` - User profile dropdown with sign out option
- Auth pages at `/auth` and `/auth/reset-password`

### Authentication Context
- `AuthProvider` - React context for managing auth state
- `useAuth` hook - Access user, session, and auth functions

### Main Features
- ✅ **Sign Up** - Email/password registration with email confirmation
- ✅ **Sign In** - Email/password login
- ✅ **Forgot Password** - Password reset via email
- ✅ **Protected Routes** - Dashboard access for authenticated users
- ✅ **Auto Redirect** - Seamless navigation after auth actions
- ✅ **Session Management** - Persistent auth state across page reloads

## Usage Examples

### Check if user is authenticated
```tsx
const { user, loading } = useAuth();

if (loading) return <div>Loading...</div>;
if (!user) return <div>Please sign in</div>;
```

### Sign out programmatically
```tsx
const { signOut } = useAuth();

const handleSignOut = async () => {
  const { error } = await signOut();
  if (error) console.error('Error signing out:', error);
};
```

## Security Notes

- Environment variables are automatically loaded in development
- Never commit real API keys to version control
- Use different Supabase projects for development/staging/production
- Configure Row Level Security (RLS) policies if you add user data tables

## Next Steps

1. Set up your Supabase project with the configuration above
2. Update your `.env.local` with real values
3. Test the authentication flow
4. Configure email templates for better branding
5. Consider adding user profiles or premium features

## Troubleshooting

- **Build errors**: Make sure all environment variables are set
- **Auth not working**: Check Supabase redirect URLs match exactly
- **Email not sending**: Verify email templates are configured
- **CORS errors**: Ensure Site URL is set correctly in Supabase