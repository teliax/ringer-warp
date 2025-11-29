import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth/AuthContext';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL;

export function OAuthCallbackPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [status, setStatus] = useState('Processing...');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
        // 1. Extract access token from URL hash
        const hash = window.location.hash;
        if (!hash.includes('access_token=')) {
          throw new Error('No access token received from Google');
        }

        const params = new URLSearchParams(hash.substring(1));
        const accessToken = params.get('access_token');

        if (!accessToken) {
          throw new Error('Invalid OAuth response');
        }

        // 2. Get user info from Google
        setStatus('Getting user information...');
        const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!userInfoResponse.ok) {
          throw new Error('Failed to get user information from Google');
        }

        const userInfo = await userInfoResponse.json();

        // 3. Check if this is an invitation acceptance flow
        const returnPath = sessionStorage.getItem('oauth_return_path');
        const invitationToken = sessionStorage.getItem('invitation_token');

        if (invitationToken && returnPath?.includes('/invitations/accept/')) {
          // Invitation acceptance flow
          setStatus('Accepting invitation...');

          const response = await axios.post(
            `${API_URL}/invitations/${invitationToken}/accept`,
            {
              google_id: userInfo.sub,
              email: userInfo.email,
              name: userInfo.name || userInfo.email,
            }
          );

          // Store tokens
          const tokens = response.data.data.tokens;
          localStorage.setItem('access_token', tokens.access_token);
          localStorage.setItem('refresh_token', tokens.refresh_token);

          // Clear invitation token
          sessionStorage.removeItem('invitation_token');
          sessionStorage.removeItem('oauth_return_path');

          // Show success message
          setStatus('Welcome to WARP! Redirecting...');

          // Wait a moment then redirect
          setTimeout(() => {
            navigate('/dashboard');
          }, 1500);
        } else {
          // Regular login flow
          setStatus('Signing in...');

          await login({
            googleId: userInfo.sub,
            email: userInfo.email,
            name: userInfo.name || userInfo.email,
          });

          // Clear return path
          sessionStorage.removeItem('oauth_return_path');

          // Redirect to return path or dashboard
          const destination = returnPath || '/dashboard';
          navigate(destination);
        }
      } catch (err: any) {
        console.error('OAuth callback error:', err);
        const errorMsg = err?.response?.data?.error?.message || err.message || 'Authentication failed';
        setError(errorMsg);
      }
    };

    handleOAuthCallback();
  }, [navigate, login]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="text-red-600 text-5xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Authentication Failed</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => navigate('/login')}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-700 text-lg font-medium">{status}</p>
      </div>
    </div>
  );
}
