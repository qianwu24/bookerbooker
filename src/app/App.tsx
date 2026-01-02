import { useState, useEffect } from 'react';
import { LoginScreen } from './components/login-screen';
import { Dashboard } from './components/dashboard';
import { supabase } from './utils/supabase-client';

export default function App() {
  const [user, setUser] = useState<{
    email: string;
    name: string;
    picture: string;
  } | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    checkSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          setUser({
            email: session.user.email || '',
            name: session.user.user_metadata?.name || session.user.email || 'User',
            picture: session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${session.user.email}`,
          });
          setAccessToken(session.access_token);
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
          email: session.user.email || '',
          name: session.user.user_metadata?.name || session.user.email || 'User',
          picture: session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${session.user.email}`,
        });
        setAccessToken(session.access_token);
      } else {
        console.log('No session found');
      }
    } catch (error) {
      console.error('Unexpected error checking session:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (userData: {
    email: string;
    name: string;
    picture: string;
  }) => {
    setUser(userData);
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setAccessToken(null);
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

  return (
    <div className="size-full">
      {user && accessToken ? (
        <Dashboard user={user} accessToken={accessToken} onLogout={handleLogout} />
      ) : (
        <LoginScreen onLogin={handleLogin} />
      )}
    </div>
  );
}