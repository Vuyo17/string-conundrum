import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, BookOpen, Clock, Dumbbell, Eye, GraduationCap,
  Lightbulb, Signal, Target,
} from 'lucide-react';
import m from '../styles/ModulePage.module.css';
import { getModuleContent } from '../data/moduleContent';
import { ContentBlocks } from '../components/module/ContentBlocks';
import { WorkedExample } from '../components/module/WorkedExample';
import { getVisualizer } from '../components/module/visualizers';
import { PracticeSection } from '../components/module/PracticeSection';

// The top-level sections a module page can have. The sticky rail renders
// them as zero-indexed cells — navigation styled like the very strings the
// app teaches. Modules with `visualizer: null` skip the Visualize section.
const ALL_SECTIONS = [
  { id: 'learn', label: 'Learn', icon: BookOpen },
  { id: 'examples', label: 'Examples', icon: Lightbulb },
  { id: 'visualize', label: 'Visualize', icon: Eye },
  { id: 'practice', label: 'Practice', icon: Dumbbell },
];

export function ModulePage({ moduleId, moduleNumber, onBack }) {
  const content = getModuleContent(moduleId);
  const [activeSection, setActiveSection] = useState('learn');
  const sectionRefs = useRef({});

  const Visualizer = useMemo(
    () => (content?.visualizer ? getVisualizer(content.visualizer.type) : null),
    [content],
  );

  // Rail sections for THIS module; indices shift up when Visualize is absent.
  const sections = useMemo(
    () => ALL_SECTIONS.filter((s) => s.id !== 'visualize' || Boolean(Visualizer)),
    [Visualizer],
  );
  const sectionIndex = (id) => sections.findIndex((s) => s.id === id);

  // Scroll-spy: keep the rail in sync with the section in view.
  useEffect(() => {
    if (!content) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveSection(visible[0].target.dataset.section);
      },
      { rootMargin: '-20% 0px -60% 0px' },
    );
    Object.values(sectionRefs.current).forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [content]);

  if (!content) {
    return (
      <div className={m.missing}>
        <h2>This module is still being written</h2>
        <p>Content for this module hasn't been added yet. Check back soon.</p>
        <button type="button" className={m.solidButton} onClick={onBack}>
          <ArrowLeft size={15} /> Back to modules
        </button>
      </div>
    );
  }

  function jumpTo(id) {
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className={m.page}>
      {/* ── hero ── */}
      <header className={m.hero}>
        <button type="button" className={m.backLink} onClick={onBack}>
          <ArrowLeft size={15} /> All modules
        </button>

        <div className={m.heroMain}>
          <div className={m.heroText}>
            <span className={m.heroEyebrow}>Module {moduleNumber ?? ''} · Python Strings</span>
            <h1 className={m.heroTitle}>{content.title}</h1>
            <p className={m.heroTagline}>{content.tagline}</p>

            <div className={m.heroMeta}>
              <span><Clock size={14} /> {content.minutes} min</span>
              <span><Signal size={14} /> {content.level}</span>
              {content.prerequisite && (
                <span><GraduationCap size={14} /> After: {content.prerequisite}</span>
              )}
            </div>
          </div>

          <aside className={m.outcomesCard}>
            <h2 className={m.outcomesTitle}><Target size={15} /> You'll be able to</h2>
            <ul>
              {content.outcomes.map((outcome) => <li key={outcome}>{outcome}</li>)}
            </ul>
          </aside>
        </div>
      </header>

      <div className={m.layout}>
        {/* ── sticky section rail: a zero-indexed "string" of sections ── */}
        <nav className={m.rail} aria-label="Module sections">
          {sections.map((section, i) => {
            const Icon = section.icon;
            const active = activeSection === section.id;
            return (
              <button
                key={section.id}
                type="button"
                className={`${m.railItem} ${active ? m.railItemActive : ''}`}
                onClick={() => jumpTo(section.id)}
                aria-current={active ? 'true' : undefined}
              >
                <span className={m.railCell}>
                  <Icon size={15} />
                  <span className={m.railIndex}>{i}</span>
                </span>
                <span className={m.railLabel}>{section.label}</span>
              </button>
            );
          })}
        </nav>

        {/* ── main content ── */}
        <div className={m.sections}>
          {/* 0 · Learn */}
          <section
            id="learn"
            data-section="learn"
            ref={(el) => { sectionRefs.current.learn = el; }}
            className={m.section}
          >
            <SectionHeading index={sectionIndex('learn')} title="Learn" subtitle="The core ideas, one small step at a time" />
            {content.learnSections.map((learnSection) => (
              <div key={learnSection.id} className={m.learnBlock}>
                <h2 className={m.learnTitle}>{learnSection.title}</h2>
                <ContentBlocks blocks={learnSection.blocks} />
              </div>
            ))}
          </section>

          {/* 1 · Examples */}
          <section
            id="examples"
            data-section="examples"
            ref={(el) => { sectionRefs.current.examples = el; }}
            className={m.section}
          >
            <SectionHeading
              index={sectionIndex('examples')}
              title="Worked examples"
              subtitle="Step through the reasoning, not just the answer"
            />
            <div className={m.exampleStack}>
              {content.examples.map((example, i) => (
                <WorkedExample key={example.id} example={example} number={i + 1} />
              ))}
            </div>
          </section>

          {/* Visualize — only when the module registers a visualizer */}
          {Visualizer && (
            <section
              id="visualize"
              data-section="visualize"
              ref={(el) => { sectionRefs.current.visualize = el; }}
              className={m.section}
            >
              <SectionHeading
                index={sectionIndex('visualize')}
                title={content.visualizer.title ?? 'Visualize'}
                subtitle={content.visualizer.description}
              />
              <Visualizer config={content.visualizer} />
            </section>
          )}

          {/* 3 · Practice */}
          <section
            id="practice"
            data-section="practice"
            ref={(el) => { sectionRefs.current.practice = el; }}
            className={m.section}
          >
            <SectionHeading
              index={sectionIndex('practice')}
              title="Practice"
              subtitle="Graded questions with instant, misconception-aware feedback"
            />
            <PracticeSection practice={content.practice} />
          </section>
        </div>
      </div>
    </div>
  );
}

function SectionHeading({ index, title, subtitle }) {
  return (
    <header className={m.sectionHeading}>
      <span className={m.sectionIndexCell}>{index}</span>
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
    </header>
  );
}
