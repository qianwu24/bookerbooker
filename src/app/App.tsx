import { useState, useEffect } from 'react';
import { LoginScreen } from './components/login-screen';
import { Dashboard } from './components/dashboard';
import { HomePage } from './components/home-page';
import { BetaGate, useBetaAccess } from './components/beta-gate';
import { supabase } from './utils/supabase-client';

// Set to true to enable beta password protection
const BETA_MODE_ENABLED = import.meta.env.VITE_BETA_MODE === 'true';

export default function App() {
  const { hasAccess, grantAccess, revokeAccess } = useBetaAccess();
  const [user, setUser] = useState<{
    id: string;
    email: string;
    name: string;
    picture: string;
  } | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState<'home' | 'login'>('home');

  useEffect(() => {
    // Check for existing session
    checkSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          setUser({
              id: session.user.id,
            email: session.user.email || '',
            name: session.user.user_metadata?.name || session.user.email || 'User',
            picture: session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${session.user.email}`,
          });
          setAccessToken(session.access_token);
          setCurrentPage('dashboard'); // Hide login when user is authenticated
        } else {
          setUser(null);
          setAccessToken(null);
        }
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const checkSession = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      console.log('Checking session - Session exists:', !!session, 'Error:', error);
      
      if (error) {
        console.error('Error checking session:', error);
        setLoading(false);
        return;
      }

      if (session?.user) {
        console.log('Session found - User:', session.user.email, 'Token length:', session.access_token?.length);
        setUser({
            id: session.user.id,
          email: session.user.email || '',
          name: session.user.user_metadata?.name || session.user.email || 'User',
          picture: session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${session.user.email}`,
        });
        setAccessToken(session.access_token);
        setCurrentPage('dashboard'); // Hide login when user is authenticated
      } else {
        console.log('No session found');
      }
    } catch (error) {
      console.error('Unexpected error checking session:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setAccessToken(null);
      setCurrentPage('home');
      // Clear beta access on logout so password is required again
      if (BETA_MODE_ENABLED) {
        revokeAccess();
      }
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  if (loading) {
    return (
      <div className="size-full flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show beta gate if beta mode is enabled and user doesn't have access
  if (BETA_MODE_ENABLED && !hasAccess) {
    return <BetaGate onAccessGranted={grantAccess} />;
  }

  return (
    <div className="size-full">
      {user && accessToken ? (
        <Dashboard user={user} accessToken={accessToken} onLogout={handleLogout} />
      ) : currentPage === 'login' ? (
        <LoginScreen onBack={() => setCurrentPage('home')} />
      ) : (
        <HomePage onSignIn={() => setCurrentPage('login')} />
      )}
    </div>
  );
}