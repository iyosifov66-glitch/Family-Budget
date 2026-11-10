import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { authFlows } from './flows';

type SessionState = { session: Session | null; loading: boolean; error?: unknown };
const Context = createContext<SessionState>({ session: null, loading: true });

export function SessionProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<SessionState>({ session: null, loading: true });

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      setState({ session, loading: false });
    });
    let mounted = true;
    client.auth.getSession().then(({ error }) => {
      if (mounted && error) setState({ session: null, loading: false, error });
    }).catch((error: unknown) => {
      if (mounted) setState({ session: null, loading: false, error });
    });
    function updateRefresh(status: typeof AppState.currentState) {
      if (status === 'active') void client!.auth.startAutoRefresh();
      else void client!.auth.stopAutoRefresh();
    }
    updateRefresh(AppState.currentState);
    const app = AppState.addEventListener('change', updateRefresh);
    return () => {
      mounted = false;
      app.remove();
      subscription.unsubscribe();
      void client.auth.stopAutoRefresh();
    };
  }, []);

  return <Context.Provider value={state}>{children}</Context.Provider>;
}

export const useSession = () => useContext(Context);
export const flows = supabase ? authFlows(supabase.auth) : null;
