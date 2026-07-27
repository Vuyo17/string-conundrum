import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen, Compass, Dumbbell, Eye, FileText, Lightbulb, Search, X,
} from 'lucide-react';
import styles from '../styles/App.module.css';
import { useAuth } from '../context/AuthContext';
import { searchAll } from '../data/searchIndex';

const KIND_ICON = {
  page: Compass,
  module: BookOpen,
  topic: FileText,
  example: Lightbulb,
  visualize: Eye,
  practice: Dumbbell,
};

const KIND_LABEL = {
  page: 'Page',
  module: 'Module',
  topic: 'Topic',
  example: 'Example',
  visualize: 'Visualize',
  practice: 'Practice',
};

/**
 * Top-bar search over screens, modules and everything inside them.
 * `onSelect` receives a result from `data/searchIndex` and is responsible for
 * the actual navigation.
 */
export function GlobalSearch({ onSelect }) {
  const { canAccess } = useAuth();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef(null);
  const inputRef = useRef(null);

  const results = useMemo(
    () => searchAll(query, { canAccess }),
    [query, canAccess],
  );

  // A fresh query means the first result is the one Enter should take.
  useEffect(() => { setActiveIndex(0); }, [query]);

  // Clicking anywhere else puts the panel away.
  useEffect(() => {
    if (!open) return undefined;
    function onPointerDown(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  // Ctrl/Cmd+K from anywhere jumps into the box, as in every other dev tool.
  useEffect(() => {
    function onKeyDown(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        setOpen(true);
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const showPanel = open && query.trim().length > 0;

  function choose(result) {
    if (!result) return;
    onSelect?.(result);
    setOpen(false);
    setQuery('');
    inputRef.current?.blur();
  }

  function reset() {
    setQuery('');
    setOpen(false);
    inputRef.current?.focus();
  }

  function onKeyDown(event) {
    if (event.key === 'Escape') {
      if (query) reset(); else inputRef.current?.blur();
      setOpen(false);
      return;
    }
    if (!showPanel || results.length === 0) {
      if (event.key === 'ArrowDown') setOpen(true);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((i) => (i - 1 + results.length) % results.length);
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setActiveIndex(results.length - 1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      choose(results[activeIndex]);
    }
  }

  return (
    <div className={styles.topSearch} ref={rootRef}>
      <div
        className={styles.topSearchField}
        role="combobox"
        aria-expanded={showPanel}
        aria-haspopup="listbox"
        aria-owns="global-search-results"
      >
        <Search className={styles.topSearchIcon} />
        <input
          ref={inputRef}
          className={styles.topSearchInput}
          placeholder="Search modules, topics…"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          type="text"
          autoComplete="off"
          spellCheck="false"
          aria-label="Search modules, topics and pages"
          aria-controls="global-search-results"
          aria-autocomplete="list"
          aria-activedescendant={
            showPanel && results[activeIndex] ? `search-option-${results[activeIndex].key}` : undefined
          }
        />
        {query && (
          <button
            type="button"
            className={styles.topSearchClear}
            onClick={reset}
            aria-label="Clear search"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {showPanel && (
        <div
          className={styles.searchPanel}
          id="global-search-results"
          role="listbox"
          // Keep focus in the input so the keyboard still drives the list.
          onMouseDown={(e) => e.preventDefault()}
        >
          {results.length === 0 ? (
            <p className={styles.searchEmpty}>
              No matches for “{query.trim()}”.
            </p>
          ) : (
            <>
              {results.map((result, i) => {
                const Icon = KIND_ICON[result.kind] ?? FileText;
                return (
                  <button
                    key={result.key}
                    id={`search-option-${result.key}`}
                    type="button"
                    role="option"
                    aria-selected={i === activeIndex}
                    className={`${styles.searchOption} ${i === activeIndex ? styles.searchOptionActive : ''}`}
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => choose(result)}
                  >
                    <span className={styles.searchOptionIcon}><Icon size={15} /></span>
                    <span className={styles.searchOptionBody}>
                      <span className={styles.searchOptionTitle}>{result.title}</span>
                      {result.subtitle && (
                        <span className={styles.searchOptionSub}>{result.subtitle}</span>
                      )}
                    </span>
                    <span className={styles.searchOptionKind}>{KIND_LABEL[result.kind]}</span>
                  </button>
                );
              })}
              <p className={styles.searchHint}>
                <kbd>↑</kbd><kbd>↓</kbd> to move · <kbd>Enter</kbd> to open · <kbd>Esc</kbd> to close
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
