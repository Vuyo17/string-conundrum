import React, { useState } from "react";
import styles from "./styles/App.module.css";
import { TopBar } from "./components/TopBar";
import { Sidebar } from "./components/Sidebar";
import { Modules } from "./pages/Modules";
import { Visualiser } from "./pages/Visualiser";
import { CodeSpace } from "./pages/CodeSpace";
import { Challenges } from "./pages/Challenges";
import { Leaderboard } from "./pages/Leaderboard";
import { Auth } from "./pages/Auth";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";

function Shell() {
  const { isAuthed, isGuest, canAccess } = useAuth();
  // Guests land on the Visualiser; signed-in users on Modules.
  const [screen, setScreen] = useState(isGuest ? "Visualiser" : "Modules");

  if (!isAuthed) return <Auth />;

  // Navigation guard: guests can only open guest screens.
  function go(next) {
    if (canAccess(next)) setScreen(next);
  }

  const safeScreen = canAccess(screen) ? screen : "Visualiser";

  const CurrentScreen = {
    Modules,
    Visualiser,
    "Code Space": CodeSpace,
    Challenges,
    Leaderboard,
  }[safeScreen];

  return (
    <div className={styles.app}>
      <TopBar screen={safeScreen} setScreen={go} />
      <main className={styles.shell}>
        <Sidebar screen={safeScreen} setScreen={go} />
        <section className={styles.content}>
          <CurrentScreen setScreen={go} />
        </section>
      </main>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Shell />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
