import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, ArrowRight, BookOpen, Check, Clock, Dumbbell, Eye,
  GraduationCap, Lightbulb, Signal, Target,
} from 'lucide-react';
import m from '../styles/ModulePage.module.css';
import { getModuleContent } from '../data/moduleContent';
import { ContentBlocks } from '../components/module/ContentBlocks';
import { WorkedExample } from '../components/module/WorkedExample';
import { getVisualizer } from '../components/module/visualizers';
import { PracticeSection } from '../components/module/PracticeSection';

// The top-level sections a module page can have. Each one is now its own
// page: the sticky rail switches between them, and a Next/Back pager walks
// through them in order. Modules with `visualizer: null` skip Visualize.
const ALL_SECTIONS = [
  { id: 'learn', label: 'Learn', icon: BookOpen },
  { id: 'examples', label: 'Examples', icon: Lightbulb },
  { id: 'visualize', label: 'Visualize', icon: Eye },
  { id: 'practice', label: 'Practice', icon: Dumbbell },
];

export function ModulePage({ moduleId, moduleNumber, onBack }) {
  const content = getModuleContent(moduleId);
  const [activeSection, setActiveSection] = useState('learn');
  const topRef = useRef(null);

  const Visualizer = useMemo(
    () => (content?.visualizer ? getVisualizer(content.visualizer.type) : null),
    [content],
  );

  // Rail sections for THIS module; indices shift up when Visualize is absent.
  const sections = useMemo(
    () => ALL_SECTIONS.filter((s) => s.id !== 'visualize' || Boolean(Visualizer)),
    [Visualizer],
  );

  // Keep the active section valid (e.g. if Visualize drops out for a module).
  const activeIndex = Math.max(0, sections.findIndex((s) => s.id === activeSection));
  const current = sections[activeIndex];
  const atFirst = activeIndex === 0;
  const atLast = activeIndex === sections.length - 1;

  // Each section is a page, so bring the reader back to the top on a change.
  useEffect(() => {
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [activeSection]);

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

  const goTo = (id) => setActiveSection(id);
  const goPrev = () => { if (!atFirst) setActiveSection(sections[activeIndex - 1].id); };
  const goNext = () => { if (!atLast) setActiveSection(sections[activeIndex + 1].id); };
  const sectionIndex = (id) => sections.findIndex((s) => s.id === id);

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
        {/* ── sticky section rail: press an icon to jump straight to that page ── */}
        <nav className={m.rail} aria-label="Module sections">
          {sections.map((section, i) => {
            const Icon = section.icon;
            const active = section.id === current.id;
            return (
              <button
                key={section.id}
                type="button"
                className={`${m.railItem} ${active ? m.railItemActive : ''}`}
                onClick={() => goTo(section.id)}
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

        {/* ── main content: only the active section renders ── */}
        <div className={m.sections}>
          <span ref={topRef} aria-hidden="true" />

          {current.id === 'learn' && (
            <section className={m.section}>
              <SectionHeading index={sectionIndex('learn')} title="Learn" subtitle="The core ideas, one small step at a time" />
              {content.learnSections.map((learnSection) => (
                <div key={learnSection.id} className={m.learnBlock}>
                  <h2 className={m.learnTitle}>{learnSection.title}</h2>
                  <ContentBlocks blocks={learnSection.blocks} />
                </div>
              ))}
            </section>
          )}

          {current.id === 'examples' && (
            <section className={m.section}>
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
          )}

          {current.id === 'visualize' && Visualizer && (
            <section className={m.section}>
              <SectionHeading
                index={sectionIndex('visualize')}
                title={content.visualizer.title ?? 'Visualize'}
                subtitle={content.visualizer.description}
              />
              <Visualizer config={content.visualizer} />
            </section>
          )}

          {current.id === 'practice' && (
            <section className={m.section}>
              <SectionHeading
                index={sectionIndex('practice')}
                title="Practice"
                subtitle="Graded questions with instant, misconception-aware feedback"
              />
              <PracticeSection practice={content.practice} />
            </section>
          )}

          {/* ── pager: Next to move on, or press an icon above ── */}
          <div className={m.pager}>
            <button
              type="button"
              className={`${m.pagerBtn} ${m.pagerGhost}`}
              onClick={atFirst ? onBack : goPrev}
            >
              <ArrowLeft size={15} /> {atFirst ? 'All modules' : `Back: ${sections[activeIndex - 1].label}`}
            </button>

            <span className={m.pagerStatus}>Step {activeIndex + 1} of {sections.length}</span>

            {atLast ? (
              <button type="button" className={`${m.pagerBtn} ${m.pagerPrimary}`} onClick={onBack}>
                <Check size={15} /> Finish module
              </button>
            ) : (
              <button type="button" className={`${m.pagerBtn} ${m.pagerPrimary}`} onClick={goNext}>
                Next: {sections[activeIndex + 1].label} <ArrowRight size={15} />
              </button>
            )}
          </div>
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
