import React, { useState } from 'react';
import {
  AlertOctagon, ChevronLeft, ChevronRight, RotateCcw, Terminal,
} from 'lucide-react';
import m from '../../styles/ModulePage.module.css';
import { CodeBlock, InlineText, StringFigure } from './ContentBlocks';
import { useLanguage } from '../../context/LanguageContext';

// An interactive worked example: the learner steps through the reasoning while
// the string figure highlights the cells each step is talking about.
export function WorkedExample({ example, number, id }) {
  const { t } = useLanguage();
  const [stepIndex, setStepIndex] = useState(0);
  const step = example.steps[stepIndex];
  const isLast = stepIndex === example.steps.length - 1;

  return (
    <article id={id} className={m.exampleCard}>
      <header className={m.exampleHeader}>
        <span className={m.exampleBadge}>{t('modulePage.exampleBadge', { number })}</span>
        <h3 className={m.exampleTitle}>{example.title}</h3>
        <p className={m.exampleIntro}><InlineText text={example.intro} /></p>
      </header>

      <div className={m.exampleBody}>
        <CodeBlock code={example.code} />

        <StringFigure value={example.string} highlight={step.highlight} negative dense />

        <div className={m.exampleStep}>
          <div className={m.exampleStepMeta}>
            <span className={m.exampleStepCount}>
              {t('modulePage.step', { current: stepIndex + 1, total: example.steps.length })}
            </span>
            {step.state && (
              <code className={m.exampleState}>
                {step.error && <AlertOctagon size={13} />}
                {step.state}
              </code>
            )}
          </div>
          <p className={m.exampleStepText}><InlineText text={step.text} /></p>
          {step.output !== undefined && (
            <div className={`${m.exampleOutput} ${step.error ? m.exampleOutputError : ''}`}>
              <Terminal size={14} />
              <code>{step.output}</code>
            </div>
          )}
        </div>

        <div className={m.stepperRow}>
          <div className={m.stepDots} aria-hidden="true">
            {example.steps.map((_, i) => (
              <span key={i} className={`${m.stepDot} ${i <= stepIndex ? m.stepDotDone : ''}`} />
            ))}
          </div>
          <div className={m.stepperButtons}>
            <button
              type="button"
              className={m.ghostButton}
              onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
              disabled={stepIndex === 0}
            >
              <ChevronLeft size={16} /> {t('common.back')}
            </button>
            {isLast ? (
              <button type="button" className={m.ghostButton} onClick={() => setStepIndex(0)}>
                <RotateCcw size={15} /> {t('common.restart')}
              </button>
            ) : (
              <button
                type="button"
                className={m.solidButton}
                onClick={() => setStepIndex((i) => Math.min(example.steps.length - 1, i + 1))}
              >
                {t('exercise.nextStep')} <ChevronRight size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
