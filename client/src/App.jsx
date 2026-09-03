import { useState } from "react";
import { Header } from "./components/Header";
import { AdminPage } from "./pages/AdminPage";
import { CitizenPage } from "./pages/CitizenPage";
import { LoginPage } from "./pages/LoginPage";
import { clearSession, loadSession, saveSession } from "./session";

function browserStorage() {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

export default function App() {
  const [session, setSession] = useState(() => loadSession(browserStorage()));

  function handleLogin(nextSession) {
    saveSession(browserStorage(), nextSession);
    setSession(nextSession);
  }

  function handleLogout() {
    clearSession(browserStorage());
    setSession(null);
  }

  return (
    <>
      <Header user={session?.user} onLogout={handleLogout} />
      {!session && <LoginPage onLogin={handleLogin} />}
      {session?.user.role === "citizen" && <CitizenPage user={session.user} />}
      {session?.user.role === "admin" && <AdminPage user={session.user} />}
    </>
  );
}
