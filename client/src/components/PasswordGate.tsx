import { useState, type ReactNode } from "react";

const SESSION_KEY = "inventum-team-access";
const TEAM_PASSWORD = import.meta.env.VITE_TEAM_PASSWORD as string | undefined;

function hasAccess() {
  return typeof window !== "undefined" && window.sessionStorage.getItem(SESSION_KEY) === "ok";
}

export default function PasswordGate({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(hasAccess);
  const [value, setValue] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  if (unlocked) return <>{children}</>;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!TEAM_PASSWORD) {
      setErrorMessage("VITE_TEAM_PASSWORD não configurada. Veja .env.example.");
      return;
    }
    if (value === TEAM_PASSWORD) {
      window.sessionStorage.setItem(SESSION_KEY, "ok");
      setUnlocked(true);
      return;
    }
    setErrorMessage("Senha incorreta.");
  };

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--background)" }}>
      <form
        onSubmit={submit}
        style={{ width: 340, maxWidth: "90vw", background: "#fffdf9", border: "1px solid var(--line)", borderRadius: 16, padding: 28, boxShadow: "0 20px 40px rgba(23,51,69,.08)" }}
      >
        <div className="brand-mark" style={{ marginBottom: 14 }}>
          <span>IN</span>
          <i />
        </div>
        <h1 style={{ fontSize: 18, margin: "0 0 4px" }}>INVENTUM 2026</h1>
        <p style={{ fontSize: 13, color: "#7a8a90", margin: "0 0 18px" }}>Acesso da equipe de operação.</p>
        <label className="field" style={{ display: "block", marginBottom: 14 }}>
          <span>Senha da equipe</span>
          <input
            autoFocus
            type="password"
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              setErrorMessage("");
            }}
            placeholder="••••••••"
          />
        </label>
        {errorMessage ? <p style={{ color: "#c0392b", fontSize: 13, margin: "0 0 14px" }}>{errorMessage}</p> : null}
        <button type="submit" className="button button-dark" style={{ width: "100%", justifyContent: "center" }}>
          Entrar
        </button>
      </form>
    </div>
  );
}
