import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, ArrowRight, BookOpen, Check, Clock, Dumbbell, Eye,
  GraduationCap, Lightbulb, Signal, Target,
} from 'lucide-react';
import m from '../styles/ModulePage.module.css';
import { getModuleContent } from '../data/moduleContent';
import { modulePageContent } from '../utils/moduleCatalog';
import { useLanguage } from '../context/LanguageContext';
import { markSectionComplete } from '../api';
import { ContentBlocks } from '../components/module/ContentBlocks';
import { WorkedExample } from '../components/module/WorkedExample';
import { getVisualizer } from '../components/module/visualizers';
import { PracticeSection } from '../components/module/PracticeSection';
import { ExamSection } from '../components/module/ExamSection';

// The top-level sections a module page can have. Each one is now its own
// page: the sticky rail switches between them, and a Next/Back pager walks
// through them in order. Modules with `visualizer: null` skip Visualize;
// modules with no `practice.exam` config skip Exam.
//
// Learn/Examples/Visualize are exposure-based: leaving one marks it complete.
// Practice/Exam are score-gated (see PASS_THRESHOLD in PracticeSection.jsx
// and ExamMode.jsx) — they mark themselves complete internally.
const ALL_SECTIONS = [
  { id: 'learn', labelKey: 'modulePage.learn', icon: BookOpen },
  { id: 'examples', labelKey: 'modulePage.examples', icon: Lightbulb },
  { id: 'visualize', labelKey: 'modulePage.visualize', icon: Eye },
  { id: 'practice', labelKey: 'modulePage.practice', icon: Dumbbell },
  { id: 'exam', labelKey: 'modulePage.exam', icon: GraduationCap },
];

// Sections whose completion is exposure-based: reaching past them is enough.
const EXPOSURE_SECTIONS = new Set(['learn', 'examples', 'visualize']);

// Sections stay mounted and are hidden with an inline style rather than being
// unmounted: a student sent from their exam results to the visualizer has to
// find those results still there when they come back.
const HIDDEN = { display: 'none' };

export function ModulePage({
  moduleId, moduleMetadata, moduleNumber, onBack, initialSection, anchor, entryKey, onProgressChange,
}) {
  const { lang, t } = useLanguage();
  const content = useMemo(() => modulePageContent(moduleMetadata, getModuleContent(moduleId, lang)), [moduleMetadata, moduleId, lang]);
  const [activeSection, setActiveSection] = useState(initialSection ?? 'learn');
  const [visualizerPreset, setVisualizerPreset] = useState(null);
  const orderedSectionIds = moduleMetadata?.section_ids && Array.isArray(moduleMetadata.section_ids)
    ? moduleMetadata.section_ids
    : ['learn', 'examples', 'visualize', 'practice', 'exam'];
  // Bumped each time the Visualize section becomes active, so the visualizer
  // replays on arrival instead of sitting still until a manual trigger
  // (cycle-1 feedback). A counter rather than a boolean: revisiting the
  // section has to re-fire even though "is active" hasn't changed value.
  const [visualizerPlayKey, setVisualizerPlayKey] = useState(0);
  useEffect(() => {
    if (activeSection === 'visualize') setVisualizerPlayKey((k) => k + 1);
  }, [activeSection]);
  const topRef = useRef(null);
  // An id to scroll to once its section is actually on screen; cleared as soon
  // as it has been used, so ordinary section changes go back to the top.
  const pendingAnchor = useRef(anchor ?? null);

  const Visualizer = useMemo(
    () => (content?.visualizer ? getVisualizer(content.visualizer.type) : null),
    [content],
  );
  const hasExam = Boolean(content?.practice?.exam);

  // Rail sections for THIS module; indices shift up when Visualize/Exam are absent.
  const sections = useMemo(
    () => orderedSectionIds
      .map((id) => ALL_SECTIONS.find((section) => section.id === id))
      .filter(Boolean)
      .filter((section) => {
        if (section.id === 'examples') return Boolean(content?.examples?.length);
        if (section.id === 'visualize') return Boolean(Visualizer);
        if (section.id === 'exam') return hasExam;
        return true;
      }),
    [orderedSectionIds, Visualizer, hasExam, content],
  );

  // Keep the active section valid (e.g. if Visualize drops out for a module).
  const activeIndex = Math.max(0, sections.findIndex((s) => s.id === activeSection));
  const current = sections[activeIndex];
  const atFirst = activeIndex === 0;
  const atLast = activeIndex === sections.length - 1;

  // Arriving from global search: jump to the section the hit lives in.
  useEffect(() => {
    if (entryKey === undefined) return;
    if (initialSection) setActiveSection(initialSection);
    pendingAnchor.current = anchor ?? null;
  }, [initialSection, anchor, entryKey]);

  // Exposure-based sections (Learn/Examples/Visualize) are marked complete the
  // moment a student navigates away from them — whether via Next or the rail.
  // Practice/Exam mark themselves complete internally, score-gated.
  const prevSectionRef = useRef(null);
  useEffect(() => {
    const prev = prevSectionRef.current;
    prevSectionRef.current = activeSection;
    if (prev && prev !== activeSection && EXPOSURE_SECTIONS.has(prev)) {
      markSectionComplete(moduleId, prev).then(() => onProgressChange?.());
    }
  }, [activeSection, moduleId, onProgressChange]);

  // Each section is a page, so bring the reader back to the top on a change —
  // unless a search sent us to something further down.
  useEffect(() => {
    const targetId = pendingAnchor.current;
    if (targetId) {
      const el = document.getElementById(targetId);
      // `offsetParent` is null while the owning section is still hidden; leave
      // the anchor pending and retry when that section becomes visible.
      if (!el || !el.offsetParent) return;
      pendingAnchor.current = null;
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [activeSection, entryKey]);

  if (!content) {
    return (
      <div className={m.missing}>
        <h2>{t('modulePage.missingTitle')}</h2>
        <p>{t('modulePage.missingBlurb')}</p>
        <button type="button" className={m.solidButton} onClick={onBack}>
          <ArrowLeft size={15} /> {t('modulePage.backToModules')}
        </button>
      </div>
    );
  }

  const goTo = (id) => setActiveSection(id);

  // Jump to the Visualize page with a question's own values loaded. A fresh
  // object every time, so asking twice for the same values still replays.
  const showInVisualizer = (values) => {
    setVisualizerPreset({ ...values });
    setActiveSection('visualize');
  };

  const goPrev = () => { if (!atFirst) setActiveSection(sections[activeIndex - 1].id); };
  const goNext = () => { if (!atLast) setActiveSection(sections[activeIndex + 1].id); };
  const sectionIndex = (id) => sections.findIndex((s) => s.id === id);

  return (
    <div className={m.page}>
      {/* ── hero ── */}
      <header className={m.hero}>
        <button type="button" className={m.backLink} onClick={onBack}>
          <ArrowLeft size={15} /> {t('modulePage.allModules')}
        </button>

        <div className={m.heroMain}>
          <div className={m.heroText}>
            <span className={m.heroEyebrow}>
              {t('modulePage.eyebrow', { number: moduleNumber ?? '' })}
            </span>
            <h1 className={m.heroTitle}>{moduleMetadata?.title ?? t(`modules.items.${moduleId}.title`)}</h1>

            <div className={m.heroMeta}>
              <span><Clock size={14} /> {t('modulePage.minutes', { count: content.minutes })}</span>
              <span><Signal size={14} /> {content.level}</span>
              {content.prerequisite && (
                <span>
                  <GraduationCap size={14} />{' '}
                  {t('modulePage.after', { prerequisite: content.prerequisite })}
                </span>
              )}
            </div>
          </div>

          {content.outcomes.length > 0 && <aside className={m.outcomesCard}>
            <h2 className={m.outcomesTitle}><Target size={15} /> {t('modulePage.outcomesTitle')}</h2>
            <ul>
              {content.outcomes.map((outcome) => <li key={outcome}>{outcome}</li>)}
            </ul>
          </aside>}
        </div>
      </header>

      <div className={m.layout}>
        {/* ── sticky section rail: press an icon to jump straight to that page ── */}
        <nav className={m.rail} aria-label={t('modulePage.sectionsNav')}>
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
                <span className={m.railLabel}>{t(section.labelKey)}</span>
              </button>
            );
          })}
        </nav>

        {/* ── main content: every section is mounted, one is shown ── */}
        <div className={m.sections}>
          <span ref={topRef} aria-hidden="true" />

          <SectionPage active={current.id === 'learn'}>
            <SectionHeading
              index={sectionIndex('learn')}
              title={t('modulePage.learn')}
              subtitle={t('modulePage.learnSubtitle')}
            />
            {content.learnSections.length === 0 && <p>{t('modulePage.noLessonYet')}</p>}
            {content.learnSections.map((learnSection) => (
              // id doubles as the global-search scroll target (see searchIndex).
              <div key={learnSection.id} id={`learn-${learnSection.id}`} className={m.learnBlock}>
                <h2 className={m.learnTitle}>{learnSection.title}</h2>
                <ContentBlocks blocks={learnSection.blocks} />
              </div>
            ))}
          </SectionPage>

          <SectionPage active={current.id === 'examples'}>
            <SectionHeading
              index={sectionIndex('examples')}
              title={t('modulePage.examplesTitle')}
              subtitle={t('modulePage.examplesSubtitle')}
            />
            <div className={m.exampleStack}>
              {content.examples.map((example, i) => (
                <WorkedExample
                  key={example.id}
                  id={`example-${example.id}`}
                  example={example}
                  number={i + 1}
                />
              ))}
            </div>
          </SectionPage>

          {Visualizer && (
            <SectionPage active={current.id === 'visualize'}>
              <SectionHeading
                index={sectionIndex('visualize')}
                title={content.visualizer.title ?? t('modulePage.visualize')}
                subtitle={content.visualizer.description}
              />
              <Visualizer
                config={content.visualizer}
                preset={visualizerPreset}
                autoPlayKey={visualizerPlayKey}
              />
            </SectionPage>
          )}

          <SectionPage active={current.id === 'practice'}>
            <SectionHeading
              index={sectionIndex('practice')}
              title={t('modulePage.practice')}
              subtitle={t('modulePage.practiceSubtitle')}
            />
            <PracticeSection
              practice={content.practice}
              onSectionComplete={onProgressChange}
            />
          </SectionPage>

          {hasExam && (
            <SectionPage active={current.id === 'exam'}>
              <SectionHeading
                index={sectionIndex('exam')}
                title={t('modulePage.exam')}
                subtitle={t('modulePage.examSubtitle')}
              />
              <ExamSection
                practice={content.practice}
                onVisualize={Visualizer ? showInVisualizer : undefined}
                onSectionComplete={onProgressChange}
                onGoToPractice={() => setActiveSection('practice')}
              />
            </SectionPage>
          )}

          {/* ── pager: Next to move on, or press an icon above ── */}
          <div className={m.pager}>
            <button
              type="button"
              className={`${m.pagerBtn} ${m.pagerGhost}`}
              onClick={atFirst ? onBack : goPrev}
            >
              <ArrowLeft size={15} />{' '}
              {atFirst
                ? t('modulePage.allModules')
                : t('modulePage.backTo', { section: t(sections[activeIndex - 1].labelKey) })}
            </button>

            <span className={m.pagerStatus}>
              {t('modulePage.step', { current: activeIndex + 1, total: sections.length })}
            </span>

            {atLast ? (
              <button type="button" className={`${m.pagerBtn} ${m.pagerPrimary}`} onClick={onBack}>
                <Check size={15} /> {t('modulePage.finishModule')}
              </button>
            ) : (
              <button type="button" className={`${m.pagerBtn} ${m.pagerPrimary}`} onClick={goNext}>
                {t('modulePage.nextTo', { section: t(sections[activeIndex + 1].labelKey) })}{' '}
                <ArrowRight size={15} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Declared at module scope so the section keeps its identity across renders —
// inlining it would remount the practice runner every time you switch pages.
function SectionPage({ active, children }) {
  return (
    <section className={m.section} style={active ? undefined : HIDDEN} hidden={!active}>
      {children}
    </section>
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
