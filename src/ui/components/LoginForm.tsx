"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailPassword } from "@/data/supabase/auth";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("Ingresá con tu usuario de Supabase Auth.");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("Validando credenciales...");

    try {
      await signInWithEmailPassword(email, password);
      setMessage("Ingreso correcto. Redirigiendo...");
      router.replace("/");
      router.refresh();
    } catch (error) {
      setMessage(`No se pudo iniciar sesión: ${getErrorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="brand auth-brand">
          <span className="brand-mark">GP</span>
          <span>
            <strong>Gestión Patrimonio</strong>
            <small>MVP</small>
          </span>
        </div>

        <div>
          <p className="eyebrow">Acceso</p>
          <h1>Iniciar sesión</h1>
          <p className="muted">
            Este login protege el dashboard. Los datos siguen compartidos hasta la próxima migración con usuarios y RLS.
          </p>
        </div>

        <form className="form" onSubmit={handleSubmit}>
          <label>
            Email
            <input
              autoComplete="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label>
            Contraseña
            <input
              autoComplete="current-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>

          <button disabled={loading} type="submit">
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
          <p className="message">{message}</p>
        </form>
      </section>
    </main>
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}
