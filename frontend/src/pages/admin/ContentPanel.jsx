import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Save, Trash2, X } from 'lucide-react';
import s from './Admin.module.css';
import { adminApi } from './adminApi';
import { Card, Empty, ErrorNote } from './AdminUI';

const TYPES = [
  { value: 'mcq', label: 'Multiple choice', hint: 'One correct option.' },
  { value: 'select_all', label: 'Select all that apply', hint: 'Several correct options.' },
  { value: 'fill_blank', label: 'Fill in the blank', hint: 'Typed answer, compared as text.' },
  { value: 'write_code', label: 'Write code', hint: 'Python run against test cases.' },
];

function blankExercise() {
  return {
    question_id: '',
    type: 'mcq',
    prompt: '',
    options: ['', ''],
    answer: '',
    answers: [],
    misconception_map: {},
    explanation: '',
    starter_code: '',
    test_cases: [],
    xp: 10,
    sort_order: 0,
  };
}

export function ContentPanel() {
  const [modules, setModules] = useState([]);
  const [moduleId, setModuleId] = useState('');
  const [exercises, setExercises] = useState([]);
  const [selected, setSelected] = useState(null);
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    adminApi.modules()
      .then((payload) => {
        setModules(payload.modules);
        setModuleId((current) => current || payload.modules[0]?.id || '');
      })
      .catch(setError);
  }, []);

  const loadExercises = useCallback(() => {
    if (!moduleId) return Promise.resolve();
    return adminApi.exercises(moduleId)
      .then((payload) => { setExercises(payload.exercises); setError(null); })
      .catch(setError);
  }, [moduleId]);

  useEffect(() => {
    setSelected(null);
    setDraft(null);
    loadExercises();
  }, [loadExercises]);

  function openExercise(exercise) {
    setSaved('');
    setSelected(exercise.question_id);
    setDraft({
      ...blankExercise(),
      ...exercise,
      // The API omits absent fields rather than sending nulls, and a null in
      // a controlled input makes React switch it to uncontrolled and warn.
      options: exercise.options ?? ['', ''],
      answers: exercise.answers ?? [],
      misconception_map: exercise.misconception_map ?? {},
      explanation: exercise.explanation ?? '',
      starter_code: exercise.starter_code ?? '',
      test_cases: exercise.test_cases ?? [],
    });
  }

  function startNew() {
    setSaved('');
    setSelected('__new__');
    const nextNumber = exercises.length + 1;
    setDraft({
      ...blankExercise(),
      question_id: `${moduleId}-${String(nextNumber).padStart(2, '0')}`,
      sort_order: nextNumber,
    });
  }

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSaved('');
    try {
      const { question_id: questionId, ...body } = draft;
      await adminApi.saveExercise(moduleId, questionId, body);
      await loadExercises();
      setSelected(questionId);
      setSaved(`Saved ${questionId}.`);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  async function remove(questionId) {
    const confirmed = window.confirm(
      `Delete ${questionId}?\n\nStudents who already answered it keep their stars, `
      + 'but the question disappears from practice and exams.',
    );
    if (!confirmed) return;

    setBusy(true);
    try {
      await adminApi.deleteExercise(moduleId, questionId);
      await loadExercises();
      setSelected(null);
      setDraft(null);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  const setField = (field) => (event) => setDraft({ ...draft, [field]: event.target.value });

  function setOption(index, value) {
    const options = draft.options.slice();
    const previous = options[index];
    options[index] = value;

    // The answer is stored as the option's TEXT, not its position, so renaming
    // the option a question's answer points at would silently orphan the
    // answer and make the question unanswerable. Carry it along instead.
    const patch = { options };
    if (draft.answer === previous) patch.answer = value;
    if (draft.answers?.includes(previous)) {
      patch.answers = draft.answers.map((a) => (a === previous ? value : a));
    }
    setDraft({ ...draft, ...patch });
  }

  return (
    <div className={s.wrap}>
      <div className={s.notice}>
        <strong>Module questions.</strong> Add and edit the questions students
        answer in Practice and Exam. Lesson content is edited in the Modules tab.
        Changes take effect immediately for students loading a module next.
      </div>

      <div className={s.toolbar}>
        <label className={s.muted} htmlFor="content-module">Module</label>
        <select
          id="content-module"
          className={s.select}
          style={{ width: 'auto', minWidth: 220 }}
          value={moduleId}
          onChange={(e) => setModuleId(e.target.value)}
        >
          {modules.map((m) => (
            <option key={m.id} value={m.id}>{m.title}</option>
          ))}
        </select>
        <span className={s.muted}>{exercises.length} questions</span>
        <button type="button" className={s.btn} style={{ marginLeft: 'auto' }} onClick={startNew}>
          <Plus size={14} /> New question
        </button>
      </div>

      {error && <ErrorNote error={error} />}
      {saved && <div className={s.success}>{saved}</div>}

      <div className={s.editorLayout}>
        <Card title="Questions">
          {exercises.length === 0 ? (
            <Empty>No questions in this module yet.</Empty>
          ) : (
            <div className={s.list}>
              {exercises.map((exercise) => (
                <button
                  key={exercise.question_id}
                  type="button"
                  className={`${s.listItem} ${selected === exercise.question_id ? s.listItemActive : ''}`}
                  onClick={() => openExercise(exercise)}
                >
                  <div className={s.listItemTitle}>{exercise.prompt}</div>
                  <div className={s.listItemMeta}>
                    {exercise.question_id} · {exercise.type}
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card title={selected === '__new__' ? 'New question' : selected || 'Editor'}>
          {!draft ? (
            <Empty>Pick a question to edit, or create a new one.</Empty>
          ) : (
            <form onSubmit={save}>
              <div className={s.fieldRow}>
                <div className={s.field}>
                  <label className={s.fieldLabel} htmlFor="q-id">Question id</label>
                  <input
                    id="q-id"
                    className={s.input}
                    value={draft.question_id}
                    onChange={setField('question_id')}
                    required
                    disabled={selected !== '__new__'}
                  />
                  {selected !== '__new__' && (
                    <p className={s.fieldHint}>
                      Fixed — students' completed answers are recorded against it.
                    </p>
                  )}
                </div>
                <div className={s.field}>
                  <label className={s.fieldLabel} htmlFor="q-type">Type</label>
                  <select id="q-type" className={s.select} value={draft.type} onChange={setField('type')}>
                    {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  <p className={s.fieldHint}>
                    {TYPES.find((t) => t.value === draft.type)?.hint}
                  </p>
                </div>
              </div>

              <div className={s.field}>
                <label className={s.fieldLabel} htmlFor="q-prompt">Prompt</label>
                <textarea
                  id="q-prompt"
                  className={s.textarea}
                  value={draft.prompt}
                  onChange={setField('prompt')}
                  required
                />
              </div>

              {(draft.type === 'mcq' || draft.type === 'select_all') && (
                <div className={s.field}>
                  <span className={s.fieldLabel}>
                    Options — {draft.type === 'mcq' ? 'select the correct one' : 'tick every correct one'}
                  </span>
                  {draft.options.map((option, index) => (
                    // eslint-disable-next-line react/no-array-index-key
                    <div className={s.optionRow} key={index}>
                      <input
                        type={draft.type === 'mcq' ? 'radio' : 'checkbox'}
                        name="correct-option"
                        checked={draft.type === 'mcq'
                          ? draft.answer === option
                          : (draft.answers ?? []).includes(option)}
                        onChange={() => {
                          if (draft.type === 'mcq') {
                            setDraft({ ...draft, answer: option });
                          } else {
                            const answers = (draft.answers ?? []).includes(option)
                              ? draft.answers.filter((a) => a !== option)
                              : [...(draft.answers ?? []), option];
                            setDraft({ ...draft, answers });
                          }
                        }}
                        aria-label={`Mark option ${index + 1} correct`}
                      />
                      <input
                        type="text"
                        className={s.input}
                        value={option}
                        onChange={(e) => setOption(index, e.target.value)}
                        placeholder={`Option ${index + 1}`}
                      />
                      <button
                        type="button"
                        className={s.iconBtn}
                        onClick={() => setDraft({
                          ...draft,
                          options: draft.options.filter((_, i) => i !== index),
                        })}
                        disabled={draft.options.length <= 2}
                        aria-label={`Remove option ${index + 1}`}
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className={`${s.btn} ${s.btnGhost} ${s.btnSmall}`}
                    onClick={() => setDraft({ ...draft, options: [...draft.options, ''] })}
                  >
                    <Plus size={13} /> Add option
                  </button>
                </div>
              )}

              {draft.type === 'fill_blank' && (
                <div className={s.field}>
                  <label className={s.fieldLabel} htmlFor="q-answer">Correct answer</label>
                  <input id="q-answer" className={s.input} value={draft.answer} onChange={setField('answer')} />
                </div>
              )}

              {draft.type === 'write_code' && (
                <>
                  <div className={s.field}>
                    <label className={s.fieldLabel} htmlFor="q-starter">Starter code</label>
                    <textarea id="q-starter" className={s.textarea}
                      value={draft.starter_code} onChange={setField('starter_code')} />
                  </div>
                  <div className={s.field}>
                    <label className={s.fieldLabel} htmlFor="q-tests">Test cases (JSON)</label>
                    <textarea
                      id="q-tests"
                      className={s.textarea}
                      value={JSON.stringify(draft.test_cases ?? [], null, 2)}
                      onChange={(e) => {
                        // Invalid JSON mid-typing is normal, so the field keeps
                        // whatever was typed and only commits when it parses.
                        try {
                          setDraft({ ...draft, test_cases: JSON.parse(e.target.value) });
                        } catch {
                          /* keep the previous parsed value until it is valid again */
                        }
                      }}
                    />
                    <p className={s.fieldHint}>
                      A list of {'{"input": ..., "expected": ...}'} objects, matching the existing bank.
                    </p>
                  </div>
                </>
              )}

              <div className={s.field}>
                <label className={s.fieldLabel} htmlFor="q-explanation">Explanation shown after answering</label>
                <textarea id="q-explanation" className={s.textarea}
                  value={draft.explanation} onChange={setField('explanation')} />
              </div>

              <div className={s.fieldRow}>
                <div className={s.field}>
                  <label className={s.fieldLabel} htmlFor="q-xp">XP</label>
                  <input id="q-xp" type="number" min="0" max="100" className={s.input}
                    value={draft.xp} onChange={setField('xp')} />
                  <p className={s.fieldHint}>Stars awarded are XP ÷ 10, rounded, minimum 1.</p>
                </div>
                <div className={s.field}>
                  <label className={s.fieldLabel} htmlFor="q-order">Sort order</label>
                  <input id="q-order" type="number" className={s.input}
                    value={draft.sort_order} onChange={setField('sort_order')} />
                </div>
              </div>

              <div className={s.formActions}>
                {selected !== '__new__' && (
                  <button
                    type="button"
                    className={`${s.btn} ${s.btnDanger}`}
                    onClick={() => remove(draft.question_id)}
                    disabled={busy}
                  >
                    <Trash2 size={13} /> Delete
                  </button>
                )}
                <button type="submit" className={s.btn} disabled={busy}>
                  <Save size={14} /> {busy ? 'Saving…' : 'Save question'}
                </button>
              </div>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
