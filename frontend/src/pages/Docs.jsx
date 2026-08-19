import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import styles from '../styles/App.module.css';
import { ScreenHeader } from '../components/ScreenHeader';
import { useLanguage } from '../context/LanguageContext';
import { KEYWORD_PAIRS, transpilePythonToIsiXhosa } from '../utils/isiXhosaTranspiler';

// Category display order — matches the grouping already used inside
// isiXhosaTranspiler.js's TO_XHOSA_REPLACEMENTS, just given a display order.
const CATEGORY_ORDER = [
  'controlFlow',
  'functionsClasses',
  'imports',
  'exceptions',
  'booleanOps',
  'literals',
  'builtins',
  'misc',
];

const EXAMPLE_PYTHON = `def describe(word):
    if len(word) > 5:
        print("long word:", word)
    elif word == "":
        print("empty")
    else:
        print("short word:", word)`;

// Generated from EXAMPLE_PYTHON by the real transpiler (not hand-copied), so
// this example can never quietly drift out of sync with what it actually does.
const EXAMPLE_XHOSA = transpilePythonToIsiXhosa(EXAMPLE_PYTHON);

// Student-facing reference for the isiXhosa <-> Python transpiler used in
// Code Space: every keyword and builtin it understands, grouped by category
// and searchable, plus one worked example so the substitution is concrete.
export function Docs() {
  const { t } = useLanguage();
  const [query, setQuery] = useState('');

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches = (pair) => (
      !needle || pair.python.toLowerCase().includes(needle) || pair.xhosa.toLowerCase().includes(needle)
    );

    return CATEGORY_ORDER
      .map((category) => ({
        category,
        pairs: KEYWORD_PAIRS.filter((pair) => pair.category === category && matches(pair)),
      }))
      .filter((group) => group.pairs.length > 0);
  }, [query]);

  const noResults = query.trim() && groups.length === 0;

  return (
    <div className={styles.screenStack}>
      <ScreenHeader title={t('docs.title')} subtitle={t('docs.subtitle')} />

      <section className={styles.card}>
        <div className={styles.docsSearch}>
          <Search size={15} />
          <input
            className={styles.docsSearchInput}
            placeholder={t('docs.searchPlaceholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={t('docs.searchPlaceholder')}
          />
        </div>
      </section>

      {noResults && (
        <section className={styles.card}>
          <p className={styles.muted}>{t('docs.searchEmpty', { query })}</p>
        </section>
      )}

      {groups.map(({ category, pairs }) => (
        <section key={category} className={styles.card}>
          <h2 className={styles.docsGroupTitle}>{t(`docs.categories.${category}`)}</h2>
          <div className={styles.docsTable}>
            <div className={`${styles.docsRow} ${styles.docsHeaderRow}`}>
              <span>{t('docs.pythonColumn')}</span>
              <span>{t('docs.xhosaColumn')}</span>
            </div>
            {pairs.map((pair) => (
              <div key={pair.python} className={styles.docsRow}>
                <code>{pair.python}</code>
                <code>{pair.xhosa}</code>
              </div>
            ))}
          </div>
        </section>
      ))}

      <section className={styles.card}>
        <h2 className={styles.docsGroupTitle}>{t('docs.exampleTitle')}</h2>
        <p className={styles.docsExampleIntro}>{t('docs.exampleIntro')}</p>
        <div className={styles.docsExampleGrid}>
          <div>
            <span className={styles.docsExampleLabel}>{t('docs.pythonColumn')}</span>
            <pre className={styles.docsCode}><code>{EXAMPLE_PYTHON}</code></pre>
          </div>
          <div>
            <span className={styles.docsExampleLabel}>{t('docs.xhosaColumn')}</span>
            <pre className={styles.docsCode}><code>{EXAMPLE_XHOSA}</code></pre>
          </div>
        </div>
      </section>
    </div>
  );
}
