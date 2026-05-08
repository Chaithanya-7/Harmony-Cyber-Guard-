import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Safety timeout to prevent infinite loading screen
    const timeout = setTimeout(() => {
      // If still loading after 2 seconds, assume offline/local mode
      if (loading) {
        console.warn("Supabase connection timed out. Entering local/offline mode.");
        setSession({
          access_token: 'dummy',
          refresh_token: 'dummy',
          expires_in: 3600,
          token_type: 'bearer',
          user: { id: 'local-user', email: 'guest@local.ai' } as any
        });
        setUser({ id: 'local-user', email: 'guest@local.ai' } as any);
        setLoading(false);
      }
    }, 2000);

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSession(session);
        setUser(session.user);
      }
      setLoading(false);
    }).catch(err => {
      console.error("Auth initialization error:", err);
      // Fallback to local user
      setUser({ id: 'local-user', email: 'guest@local.ai' } as any);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
