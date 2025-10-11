import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

// DEV ONLY: Bypass Google OAuth for local testing
export function DevLogin() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleDevLogin = async () => {
    setError(null);
    setIsLoading(true);

    try {
      // Create a mock Google token for dev testing
      // The backend will need a dev bypass too
      const mockGoogleToken = 'DEV_BYPASS_TOKEN_david.aldworth@ringer.tel';

      await login(mockGoogleToken);
      navigate('/dashboard');
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Failed to login');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>WARP Platform - Dev Mode</CardTitle>
          <CardDescription>Development Login (OAuth Bypass)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button
            onClick={handleDevLogin}
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? 'Logging in...' : 'Login as david.aldworth@ringer.tel'}
          </Button>

          <p className="text-xs text-center text-gray-500">
            This is a development bypass.
            <br />
            Configure Google OAuth to use the real login flow.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
