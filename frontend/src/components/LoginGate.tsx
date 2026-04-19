import { useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

export function LoginGate({ children }: { children: ReactNode }) {
  const { session, loading, signOut, user } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] text-white/60">
        Loading…
      </div>
    );
  }

  if (!session) return <LoginForm />;

  return (
    <div className="relative">
      <button
        onClick={signOut}
        className="fixed right-4 top-4 z-50 rounded-md border border-white/10 bg-black/40 px-3 py-1 text-xs text-white/60 backdrop-blur hover:text-white"
        title={user?.email ?? ""}
      >
        Sign out
      </button>
      {children}
    </div>
  );
}

function LoginForm() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    setInfo("");

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
    } else {
      if (password.length < 12) {
        setError("Password must be at least 12 characters.");
        setBusy(false);
        return;
      }
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) {
        setError(error.message);
      } else if (data.session) {
        // Email confirmation disabled — session is live, AuthProvider will flip in.
      } else {
        setInfo(`We sent a confirmation link to ${email}. Click it to activate your account.`);
      }
    }
    setBusy(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl">
        <h1 className="mb-6 text-center text-2xl font-bold text-white">
          {mode === "signin" ? "Sign in to Icarus" : "Create your Icarus account"}
        </h1>

        {error && (
          <p className="mb-4 rounded-lg bg-red-500/10 px-4 py-2 text-sm text-red-400">
            {error}
          </p>
        )}
        {info && (
          <p className="mb-4 rounded-lg bg-amber-500/10 px-4 py-2 text-sm text-amber-300">
            {info}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-widest text-white/40">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@yourfirm.com"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-widest text-white/40">
              Password
            </label>
            <input
              type="password"
              required
              minLength={mode === "signup" ? 12 : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "signup" ? "Min. 12 characters" : "Your password"}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-amber-500 px-4 py-3 font-semibold text-black hover:bg-amber-400 disabled:opacity-50"
          >
            {busy ? "…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-white/40">
          {mode === "signin" ? "No account yet?" : "Already have an account?"}{" "}
          <button
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError("");
              setInfo("");
            }}
            className="text-amber-500 hover:text-amber-400"
          >
            {mode === "signin" ? "Sign up" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}
