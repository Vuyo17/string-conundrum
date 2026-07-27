import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import styles from "./styles/App.module.css";
import { TopBar } from "./components/TopBar";
import { Sidebar } from "./components/Sidebar";
import { Modules } from "./pages/Modules";
import { Visualiser } from "./pages/Visualiser";
import { CodeSpace } from "./pages/CodeSpace";
import { Exercise } from "./pages/Exercise";
import { Leaderboard } from "./pages/Leaderboard";
import { AuthPage } from "./pages/auth/AuthPage";
import auth from "./pages/auth/Auth.module.css";
import { useAuth } from "./context/AuthContext";

function App() {
  const [screen, setScreen] = useState("Visualiser");
  const { user, loading, emailLinkPending } = useAuth();

  const CurrentScreen = {
    Modules,
    Visualiser,
    "Code Space": CodeSpace,
    Exercise,
    Leaderboard,
  }[screen];

  if (loading) {
    return (
      <div className={auth.boot}>
        <Loader2 size={20} className={auth.spin} aria-hidden="true" />
        <p>Loading your account…</p>
      </div>
    );
  }

  // Opening an email link signs the student in before they have set a password,
  // so the auth flow stays in control until it explicitly hands over.
  if (!user || emailLinkPending) {
    return <AuthPage />;
  }

  return (
    <div className={styles.app}>
      <TopBar screen={screen} setScreen={setScreen} />
      <main className={styles.shell}>
        <Sidebar screen={screen} setScreen={setScreen} />
        <section className={styles.content}>
          <CurrentScreen setScreen={setScreen} />
        </section>
      </main>
    </div>
  );
}

export default App;
