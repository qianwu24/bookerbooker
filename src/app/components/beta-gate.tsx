import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

const BETA_PASSWORD = import.meta.env.VITE_BETA_PASSWORD || 'beta2026';
const STORAGE_KEY = 'scheduler_beta_access';

export function useBetaAccess() {
  const [hasAccess, setHasAccess] = useState(() => {
    // Check if user already has beta access
    return localStorage.getItem(STORAGE_KEY) === 'granted';
  });

  const grantAccess = () => {
    localStorage.setItem(STORAGE_KEY, 'granted');
    setHasAccess(true);
  };

  const revokeAccess = () => {
    localStorage.removeItem(STORAGE_KEY);
    setHasAccess(false);
  };

  return { hasAccess, grantAccess, revokeAccess };
}

interface BetaGateProps {
  onAccessGranted: () => void;
}

export function BetaGate({ onAccessGranted }: BetaGateProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // Small delay to prevent brute force
    setTimeout(() => {
      if (password === BETA_PASSWORD) {
        localStorage.setItem(STORAGE_KEY, 'granted');
        onAccessGranted();
      } else {
        setError('Invalid beta access code');
        setPassword('');
      }
      setIsLoading(false);
    }, 500);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-8 w-8 text-indigo-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <CardTitle className="text-2xl font-bold">Beta Access</CardTitle>
          <CardDescription>
            This app is currently in private beta testing. Please enter the access code to continue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Input
                type="password"
                placeholder="Enter beta access code"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="text-center text-lg tracking-widest"
                autoFocus
              />
              {error && (
                <p className="mt-2 text-sm text-red-600 text-center">{error}</p>
              )}
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || !password.trim()}
            >
              {isLoading ? 'Verifying...' : 'Enter Beta'}
            </Button>
          </form>
          <p className="mt-6 text-xs text-center text-gray-500">
            Contact the developer if you need access.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
