import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/login" });
  },
  component: AuthLayout,
});

function AuthLayout() {
  const navigate = useNavigate();
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) navigate({ to: "/login", replace: true });
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
          <Link to="/cases" className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-primary shadow-[0_0_12px_oklch(0.62_0.18_258_/_0.6)]" />
            <span className="font-medium tracking-tight">OpsPilot</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground ml-1">Console</span>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <Link to="/cases" className="text-muted-foreground hover:text-foreground transition-colors">Cases</Link>
            <Link to="/demo" className="text-muted-foreground hover:text-foreground transition-colors">Demo</Link>
            <button
              onClick={async () => { await supabase.auth.signOut(); }}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
