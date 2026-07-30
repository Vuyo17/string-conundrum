import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import styles from "./styles/App.module.css";
import { TopBar } from "./components/TopBar";
import { Sidebar } from "./components/Sidebar";
import { Modules } from "./pages/Modules";
import { Visualiser } from "./pages/Visualiser";
import { CodeSpace } from "./pages/CodeSpace";
import { Challenges } from "./pages/Challenges";
import { Leaderboard } from "./pages/Leaderboard";
import { Settings } from "./pages/Settings";
import { AuthPage } from "./pages/auth/AuthPage";
import auth from "./pages/auth/Auth.module.css";
import { useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { LanguageProvider, useLanguage } from "./context/LanguageContext";
import { useProgress } from "./hooks/useProgress";

function Shell() {
  const { user, loading, emailLinkPending, isGuest, canAccess } = useAuth();
  const { t } = useLanguage();
  const progress = useProgress();
  // Guests land on the Visualiser; signed-in users on Modules.
  const [screen, setScreen] = useState(isGuest ? "Visualiser" : "Modules");
  // Set by a search result so the Modules screen can open straight onto a
  // module — and, when the hit was a topic, onto the right section of it.
  const [moduleTarget, setModuleTarget] = useState(null);

  if (loading) {
    return (
      <div className={auth.boot}>
        <Loader2 size={20} className={auth.spin} aria-hidden="true" />
        <p>{t('auth.loadingAccount')}</p>
      </div>
    );
  }

  if (!user || emailLinkPending) return <AuthPage />;

  // Challenges is the capstone: locked until every module is complete, on
  // top of the guest/sign-in gating canAccess already handles.
  function canAccessScreen(target) {
    if (target === "Challenges" && !progress.allCompleted) return false;
    return canAccess(target);
  }

  // Navigation guard: guests can only open guest screens.
  function go(next) {
    if (!canAccessScreen(next)) return;
    setScreen(next);
    setModuleTarget(null);
  }

  // A search result carries its own destination (see data/searchIndex.js).
  function openSearchResult(result) {
    if (!canAccessScreen(result.screen)) return;
    setScreen(result.screen);
    setModuleTarget(
      result.moduleId
        // `nonce` makes every pick a new target, so choosing the same result
        // twice still re-opens and re-scrolls it.
        ? { ...result, nonce: Date.now() }
        : null,
    );
  }

  const safeScreen = canAccessScreen(screen) ? screen : "Visualiser";

  const CurrentScreen = {
    Modules,
    Visualiser,
    "Code Space": CodeSpace,
    Challenges,
    Leaderboard,
    Settings,
  }[safeScreen];

  return (
    <div className={styles.app}>
      <TopBar screen={safeScreen} setScreen={go} onSearchSelect={openSearchResult} />
      <main className={styles.shell}>
        <Sidebar screen={safeScreen} setScreen={go} modulesComplete={progress.allCompleted} />
        <section className={styles.content}>
          <CurrentScreen
            setScreen={go}
            {...(safeScreen === "Modules" ? { target: moduleTarget, progress } : {})}
            {...(safeScreen === "Settings" ? { progress } : {})}
          />
        </section>
      </main>
    </div>
  );
}

function App() {
  return (
    <LanguageProvider>
      <ThemeProvider>
        <Shell />
      </ThemeProvider>
    </LanguageProvider>
  );
}

export default App;
