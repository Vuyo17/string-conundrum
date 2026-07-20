import React, { useState } from "react";
import styles from "./styles/App.module.css";
import { TopBar } from "./components/TopBar";
import { Sidebar } from "./components/Sidebar";
import { Modules } from "./pages/Modules";
import { Visualiser } from "./pages/Visualiser";
import { CodeSpace } from "./pages/CodeSpace";
import { Challenges } from "./pages/Challenges";
import { Leaderboard } from "./pages/Leaderboard";

function App() {
  const [screen, setScreen] = useState("Visualiser");

  const CurrentScreen = {
    Modules,
    Visualiser,
    "Code Space": CodeSpace,
    Challenges,
    Leaderboard,
  }[screen];

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
