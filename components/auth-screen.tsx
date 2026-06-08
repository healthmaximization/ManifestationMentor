"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import BrandLogo from "@/components/brand-logo";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export default function AuthScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedNext = searchParams.get("next");
  const nextPath = requestedNext?.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "/";
  const initialMode = searchParams.get("authMode") === "signup" ? "signup" : "signin";
  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
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
        router.push(nextPath);
        router.refresh();
      }

      return;
    }

    const signupResponse = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: normalizedEmail, password })
    });
    const signupData = await signupResponse.json().catch(() => ({ error: "Could not create account." }));

    if (!signupResponse.ok) {
      setLoading(false);
      setError(signupData.error ?? "Could not create account.");
      return;
    }

    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password
    });

    setLoading(false);

    if (signInError || !signInData.session) {
      setNotice("Account created. Log in with your email and password to open the studio.");
      setMode("signin");
      return;
    }

    router.push(nextPath);
    router.refresh();
  }

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <div className="auth-card-top">
          <BrandLogo />
          <span>Member access</span>
        </div>
        <h1>{mode === "signin" ? "Welcome back." : "Start creating."}</h1>
        <p>{mode === "signin" ? "Log in to start creating subliminals." : "Create your account and start building your first subliminal."}</p>
        <div className="auth-tabs" role="tablist" aria-label="Authentication mode">
          <button className={mode === "signin" ? "active" : ""} onClick={() => setMode("signin")} type="button">
            Existing account
          </button>
          <button className={mode === "signup" ? "active" : ""} onClick={() => setMode("signup")} type="button">
            New account
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
            {loading ? "Working..." : mode === "signin" ? "Enter studio" : "Create free account"}
          </button>
        </form>
        {notice && <p className="notice">{notice}</p>}
        {error && <p className="error">{error}</p>}
      </section>
    </main>
  );
}
