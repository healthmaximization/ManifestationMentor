"use client";

import { useState } from "react";
import { Eye, EyeOff, Sparkles } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export default function AuthScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(searchParams.get("authError") ?? "");
  const [notice, setNotice] = useState(searchParams.get("authNotice") ?? "");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");

    const supabase = createBrowserSupabase();
    const normalizedEmail = email.trim().toLowerCase();

    if (mode === "signin") {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password
      });

      setLoading(false);

      if (authError) {
        setError(authError.message === "Invalid login credentials" ? "No account found with this email/password. Create an account first, or check the password." : authError.message);
        return;
      }

      if (data.session) {
        router.refresh();
      }

      return;
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`
      }
    });

    if (signUpError) {
      setLoading(false);
      setError(signUpError.message);
      return;
    }

    if (data.session) {
      setLoading(false);
      router.refresh();
      return;
    }

    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password
    });

    setLoading(false);

    if (signInData.session) {
      router.refresh();
      return;
    }

    if (signInError?.message === "Invalid login credentials") {
      setError("Supabase did not create an active password account. If this email already exists as unconfirmed, delete it in Supabase Auth Users or confirm it manually, then sign up again.");
      return;
    }

    setNotice("Account created, but Supabase still wants email confirmation. Turn off Confirm email in Supabase Auth or confirm this user manually.");
  }

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <div className="auth-card-top">
          <div className="brand-mark">
            <Sparkles size={22} />
          </div>
          <span>Private beta</span>
        </div>
        <h1>AI Manifestation Advisor</h1>
        <p>Chat with a trained manifestation coach for clarity, alignment, and focused action.</p>
        <div className="auth-tabs" role="tablist" aria-label="Authentication mode">
          <button className={mode === "signin" ? "active" : ""} onClick={() => setMode("signin")} type="button">
            Log in
          </button>
          <button className={mode === "signup" ? "active" : ""} onClick={() => setMode("signup")} type="button">
            Sign up
          </button>
        </div>
        <form onSubmit={submit} className="auth-form">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value.trim())}
            placeholder="you@example.com"
            required
          />
          <label htmlFor="password">Password</label>
          <div className="password-field">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={mode === "signin" ? "Your password" : "Create a strong password"}
              minLength={6}
              required
            />
            <button type="button" onClick={() => setShowPassword((current) => !current)} title="Toggle password visibility">
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <button type="submit" disabled={loading}>
            {loading ? "Working..." : mode === "signin" ? "Log in" : "Create account"}
          </button>
        </form>
        {notice && <p className="notice">{notice}</p>}
        {error && <p className="error">{error}</p>}
      </section>
    </main>
  );
}
