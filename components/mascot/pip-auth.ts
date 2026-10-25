type User = { id: string };
type Auth = {
  getUser: () => Promise<{ data: { user: User | null }; error: unknown }>;
  onAuthStateChange: (callback: (event: string, session: { user: User } | null) => void) => {
    data: { subscription: { unsubscribe: () => void } };
  };
};

/** Saved browser sessions are hints; only a verified user may see or use Pip. */
export function observePipUser(auth: Auth, onUser: (id: string | null) => void) {
  let active = true;
  let revision = 0;
  let userId: string | null = null;
  let timer: ReturnType<typeof setTimeout>;
  const publish = (id: string | null) => { userId = id; onUser(id); };
  const verify = () => {
    const request = ++revision;
    clearTimeout(timer);
    // Leave Supabase's auth callback before calling another auth method.
    timer = setTimeout(() => {
      void auth.getUser().then(({ data, error }) => {
        if (active && request === revision) publish(error ? null : data.user?.id ?? null);
      }).catch(() => { if (active && request === revision) publish(null); });
    }, 0);
  };
  const { data } = auth.onAuthStateChange((_event, session) => {
    if (!active) return;
    if (!session) {
      ++revision;
      clearTimeout(timer);
      publish(null);
    } else {
      if (session.user.id !== userId) publish(null);
      verify();
    }
  });
  verify();
  return () => { active = false; ++revision; clearTimeout(timer); data.subscription.unsubscribe(); };
}
