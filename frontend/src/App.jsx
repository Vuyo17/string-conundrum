import React, {
  Suspense, lazy, useEffect, useRef, useState,
} from "react";
import { Loader2 } from "lucide-react";
import styles from "./styles/App.module.css";
import { TopBar } from "./components/TopBar";
import { Sidebar } from "./components/Sidebar";
import { AuthPage } from "./pages/auth/AuthPage";
import auth from "./pages/auth/Auth.module.css";
import { useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { LanguageProvider, useLanguage } from "./context/LanguageContext";
import { NotificationProvider, useNotifications } from "./context/NotificationContext";
import { useProgress } from "./hooks/useProgress";
import { modules } from "./data/modules";

// Each screen is its own chunk, fetched only when a student actually opens
// it — the whole app used to ship as one ~650KB bundle regardless of which
// single screen someone landed on first. Named exports (not default), hence
// the `.then` unwrap; AuthPage stays a normal eager import above since it's
// the very first thing an unauthenticated visitor sees and lazy-loading it
// would just add a network round-trip before anyone can even sign in.
const Modules = lazy(() => import("./pages/Modules").then((m) => ({ default: m.Modules })));
const Visualiser = lazy(() => import("./pages/Visualiser").then((m) => ({ default: m.Visualiser })));
const CodeSpace = lazy(() => import("./pages/CodeSpace").then((m) => ({ default: m.CodeSpace })));
const Challenges = lazy(() => import("./pages/Challenges").then((m) => ({ default: m.Challenges })));
const Leaderboard = lazy(() => import("./pages/Leaderboard").then((m) => ({ default: m.Leaderboard })));
const Docs = lazy(() => import("./pages/Docs").then((m) => ({ default: m.Docs })));
const Settings = lazy(() => import("./pages/Settings").then((m) => ({ default: m.Settings })));
// Lazy like every other screen, and more so: the dashboard is a sizeable
// chunk that only lecturers ever open, so a student's bundle never includes it.
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard").then((m) => ({ default: m.AdminDashboard })));

// Same spinner as the auth-loading state, so a screen chunk still loading
// doesn't look like a different kind of "stuck" to a student.
function ScreenLoading() {
  const { t } = useLanguage();
  return (
    <div className={auth.boot}>
      <Loader2 size={20} className={auth.spin} aria-hidden="true" />
      <p>{t('common.loading')}</p>
    </div>
  );
}

// Watches for a module's `completed` flag flipping false -> true during this
// session and turns that into a notification. Comparing against `undefined`
// (a module's very first render) rather than `false` matters: it's what
// stops every module a student finished in a *previous* session from firing
// a notification the moment they load the app.
function ModuleUnlockNotifier({ progress }) {
  const { t } = useLanguage();
  const { addNotification } = useNotifications();
  const prevCompletedRef = useRef({});

  useEffect(() => {
    if (progress.loading) return;
    const prev = prevCompletedRef.current;

    modules.forEach(({ id }, i) => {
      const completed = progress.byModuleId[id]?.completed ?? false;
      if (completed && prev[id] === false) {
        const next = modules[i + 1];
        addNotification({
          title: t('notifications.moduleCompleteTitle'),
          message: next
            ? t('notifications.moduleUnlockedMessage', {
              module: t(`modules.items.${id}.title`),
              next: t(`modules.items.${next.id}.title`),
            })
            : t('notifications.allModulesCompleteMessage', {
              module: t(`modules.items.${id}.title`),
            }),
        });
      }
    });

    prevCompletedRef.current = Object.fromEntries(
      modules.map(({ id }) => [id, progress.byModuleId[id]?.completed ?? false]),
    );
  }, [progress.byModuleId, progress.loading, addNotification, t]);

  return null;
}

function Shell() {
  const { user, loading, emailLinkPending, isGuest, isAdmin, canAccess } = useAuth();
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
    // A plain object reference here (rather than `null`) so clicking
    // "Modules" in the sidebar while already inside a module reliably
    // clears it back to the overview grid. `moduleTarget` is often already
    // `null` at that point (any module opened by clicking its card, rather
    // than via search, never sets it) — setting it to `null` again is a
    // same-value no-op React skips, so the reset never reached Modules.jsx.
    // A fresh `{ nonce }` on every call always changes reference and always
    // fires the effect that closes the open module.
    setModuleTarget(next === "Modules" ? { nonce: Date.now() } : null);
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
    Docs,
    Settings,
    Dashboard: AdminDashboard,
  }[safeScreen];

  return (
    <NotificationProvider>
      <ModuleUnlockNotifier progress={progress} />
      <div className={styles.app}>
        <TopBar screen={safeScreen} setScreen={go} onSearchSelect={openSearchResult} />
        <main className={styles.shell}>
          <Sidebar
          screen={safeScreen}
          setScreen={go}
          modulesComplete={progress.allCompleted}
          isAdmin={isAdmin}
        />
          <section className={styles.content}>
            <Suspense fallback={<ScreenLoading />}>
              <CurrentScreen
                setScreen={go}
                {...(safeScreen === "Modules" ? { target: moduleTarget, progress } : {})}
                {...(safeScreen === "Settings" ? { progress } : {})}
                {...(safeScreen === "Leaderboard" ? { progress } : {})}
              />
            </Suspense>
          </section>
        </main>
      </div>
    </NotificationProvider>
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
