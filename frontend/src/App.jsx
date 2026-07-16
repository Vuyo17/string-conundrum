import React, { useState } from "react";
import styles from "./styles/App.module.css";
import { TopBar } from "./components/TopBar";
import { Sidebar } from "./components/Sidebar";
import { Modules } from "./pages/Modules";
import { ModulePage } from "./pages/ModulePage";
import { Visualiser } from "./pages/Visualiser";
import { CodeSpace } from "./pages/CodeSpace";
import { Exercise } from "./pages/Exercise";
import { Leaderboard } from "./pages/Leaderboard";

function App() {
  const [screen, setScreen] = useState("Modules");
  // Which module's learning page is open (null = none).
  const [activeModule, setActiveModule] = useState(null); // { id, number }

  function openModule(id, number) {
    setActiveModule({ id, number });
    setScreen("Module");
    window.scrollTo({ top: 0 });
  }

  function closeModule() {
    setActiveModule(null);
    setScreen("Modules");
  }

  function handleSetScreen(next) {
    if (next !== "Module") setActiveModule(null);
    setScreen(next);
  }

  const CurrentScreen = {
    Modules,
    Visualiser,
    "Code Space": CodeSpace,
    Exercise,
    Leaderboard,
  }[screen];

  return (
    <div className={styles.app}>
      <TopBar screen={screen} setScreen={handleSetScreen} />
      <main className={styles.shell}>
        <Sidebar screen={screen} setScreen={handleSetScreen} />
        <section className={styles.content}>
          {screen === "Module" && activeModule ? (
            <ModulePage
              moduleId={activeModule.id}
              moduleNumber={activeModule.number}
              onBack={closeModule}
            />
          ) : (
            <CurrentScreen setScreen={handleSetScreen} openModule={openModule} />
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
