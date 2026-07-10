"use client";

import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, Eye, EyeOff, LockKeyhole } from "lucide-react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("setup")) {
      setError("Isi DASHBOARD_PASSWORD dan DASHBOARD_SESSION_SECRET pada environment server.");
    }
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Login gagal");
      window.location.assign("/");
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Login gagal");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-story" aria-label="Beauty Kendari sentiment intelligence">
        <div className="brand-mark" aria-hidden="true">BK</div>
        <div>
          <p className="eyebrow">Beauty Kendari · intelligence desk</p>
          <h1>Dengar pelanggan sebelum percakapan berlalu.</h1>
          <p className="login-intro">Komentar Instagram dan TikTok diringkas menjadi sinyal yang bisa ditindaklanjuti tim Markom.</p>
        </div>
        <div className="signal-preview" aria-hidden="true">
          <span>sentiment pulse</span>
          <strong>78.4%</strong>
          <small>percakapan positif minggu ini</small>
        </div>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <div className="login-icon"><LockKeyhole size={20} /></div>
          <p className="eyebrow">Akses internal</p>
          <h2>Masuk ke dashboard</h2>
          <p>Gunakan password bersama tim Beauty Kendari.</p>

          <form onSubmit={handleSubmit}>
            <label htmlFor="password">Password dashboard</label>
            <div className="password-field">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
              <button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}>
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="primary-button" type="submit" disabled={submitting}>
              {submitting ? "Memeriksa..." : "Masuk"}
              {!submitting && <ArrowRight size={17} />}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
