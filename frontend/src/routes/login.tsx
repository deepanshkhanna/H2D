import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Grain, Mono } from "@/components/forensic/primitives";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — OpsPilot AI" },
      { name: "description", content: "Sign in to the OpsPilot AI investigator console." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/cases", replace: true });
    });
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/cases` },
        });
        if (error) throw error;
        toast.success("Check your email to confirm your account.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/cases", replace: true });
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen relative bg-background flex items-center justify-center px-6">
      <Grain />
      <Link to="/" className="absolute top-6 left-6 flex items-center gap-2 text-foreground">
        <span className="size-2 rounded-full bg-primary" />
        <span className="font-medium tracking-tight">OpsPilot</span>
      </Link>
      <div className="relative w-full max-w-sm">
        <Mono>{mode === "signup" ? "Open Console · New Operator" : "Open Console"}</Mono>
        <h1 className="mt-3 text-2xl font-medium tracking-tight">
          {mode === "signup" ? "Create your operator account." : "Sign in to your cases."}
        </h1>
        <form onSubmit={submit} className="mt-8 space-y-4">
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground mb-1.5">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md bg-surface ring-1 ring-border/60 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-primary/60"
              placeholder="you@company.co"
            />
          </div>
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground mb-1.5">Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md bg-surface ring-1 ring-border/60 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-primary/60"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-primary text-primary-foreground ring-1 ring-primary/70 shadow-[0_0_30px_-8px_oklch(0.62_0.18_258_/_0.6)] px-4 py-2.5 text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors"
          >
            {busy ? "Working…" : mode === "signup" ? "Create account" : "Sign in"}
          </button>
        </form>
        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-5 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
        >
          {mode === "signin" ? "No account yet? Create one." : "Already have an account? Sign in."}
        </button>
      </div>
    </div>
  );
}
