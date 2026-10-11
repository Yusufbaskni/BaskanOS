"use client";

import { useEffect, useState } from "react";

type Props = {
  onAuthed: () => void;
};

export function AuthGate({ onAuthed }: Props) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [required, setRequired] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth");
        const data = await res.json();
        if (cancelled) return;
        if (!data.pinRequired || data.authenticated) {
          onAuthed();
          return;
        }
        setRequired(true);
      } catch {
        if (!cancelled) onAuthed();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [onAuthed]);

  if (loading) {
    return (
      <div className="flex h-dvh items-center justify-center text-sm text-[var(--muted)]">
        BaskanOS açılıyor…
      </div>
    );
  }

  if (!required) return null;

  return (
    <div className="flex h-dvh items-center justify-center bg-[var(--bg)] px-4">
      <form
        className="w-full max-w-sm rounded-2xl border border-[var(--line)] bg-[var(--bg-elevated)] p-6"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          const res = await fetch("/api/auth", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pin, action: "login" }),
          });
          const data = await res.json();
          if (!res.ok) {
            setError(data.error || "Giriş başarısız");
            return;
          }
          onAuthed();
        }}
      >
        <p className="font-[family-name:var(--font-display)] text-[11px] font-semibold tracking-[0.22em] text-[var(--brand)] uppercase">
          Baskani Yazılım
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-2xl font-semibold">
          BaskanOS
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">Yerel PIN ile kilidi aç.</p>
        <input
          type="password"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          autoFocus
          className="mt-4 w-full rounded-xl border border-[var(--line)] bg-[var(--bg-panel)] px-3 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
          placeholder="PIN"
        />
        {error ? <p className="mt-2 text-xs text-[var(--danger)]">{error}</p> : null}
        <button
          type="submit"
          className="mt-4 w-full rounded-xl bg-[var(--brand)] py-2.5 text-sm font-semibold text-[#1a1405]"
        >
          Giriş
        </button>
      </form>
    </div>
  );
}
