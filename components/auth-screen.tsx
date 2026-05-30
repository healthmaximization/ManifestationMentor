"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export default function AuthScreen() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createBrowserSupabase();
    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`
      }
    });

    setLoading(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    setSent(true);
  }

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <div className="brand-mark">
          <Sparkles size={22} />
        </div>
        <h1>AI Manifestation Advisor</h1>
        <p>Chat with a trained manifestation coach for clarity, alignment, and focused action.</p>
        <form onSubmit={signIn} className="auth-form">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            required
          />
          <button type="submit" disabled={loading}>
            {loading ? "Sending..." : "Send magic link"}
          </button>
        </form>
        {sent && <p className="notice">Check your inbox for the login link.</p>}
        {error && <p className="error">{error}</p>}
      </section>
    </main>
  );
}

