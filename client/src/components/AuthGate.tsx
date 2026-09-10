import { type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

const ALLOWED_DOMAIN = "@patobranco.tec.br";

export default function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading, signInWithGoogle, signOut } = useAuth();

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", gap: 12 }}>
        <Loader2 size={28} className="animate-spin" />
        <span>Verificando acesso…</span>
      </div>
    );
  }

  if (user && !user.email.toLowerCase().endsWith(ALLOWED_DOMAIN)) {
    signOut();
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--background)" }}>
        <div style={{ width: 340, maxWidth: "90vw", background: "#fffdf9", border: "1px solid var(--line)", borderRadius: 16, padding: 28, boxShadow: "0 20px 40px rgba(23,51,69,.08)", textAlign: "center" }}>
          <h1 style={{ fontSize: 18, margin: "0 0 8px" }}>Acesso restrito</h1>
          <p style={{ fontSize: 13, color: "#7a8a90", margin: 0 }}>
            Esse dashboard só aceita contas <b>{ALLOWED_DOMAIN}</b>. Saindo da conta…
          </p>
        </div>
      </div>
    );
  }

  if (user) return <>{children}</>;

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--background)" }}>
      <div style={{ width: 340, maxWidth: "90vw", background: "#fffdf9", border: "1px solid var(--line)", borderRadius: 16, padding: 28, boxShadow: "0 20px 40px rgba(23,51,69,.08)" }}>
        <div className="brand-mark" style={{ marginBottom: 14 }}>
          <span>IN</span>
          <i />
        </div>
        <h1 style={{ fontSize: 18, margin: "0 0 4px" }}>INVENTUM 2026</h1>
        <p style={{ fontSize: 13, color: "#7a8a90", margin: "0 0 18px" }}>
          Acesso da equipe de operação. Entre com sua conta {ALLOWED_DOMAIN}.
        </p>
        <button
          type="button"
          className="button button-dark"
          style={{ width: "100%", justifyContent: "center" }}
          onClick={signInWithGoogle}
        >
          Entrar com Google
        </button>
      </div>
    </div>
  );
}
