import React, { useEffect, useState } from 'react';
import {
  ChevronDown, ChevronUp, Eye, EyeOff, Plus, Save, Trash2, X,
} from 'lucide-react';
import s from './Admin.module.css';
import { adminApi } from './adminApi';
import { Card, ErrorNote } from './AdminUI';
import { useModuleCatalog } from '../../context/ModuleCatalogContext';
import { getModuleContent } from '../../data/moduleContent';

const BLANK = { id: '', title: '', description: '', minutes: 20, level: 'Beginner' };
const SECTION_LABELS = {
  learn: 'Learn', examples: 'Examples', visualize: 'Visualize', practice: 'Practice', exam: 'Exam',
};
const DEFAULT_SECTION_IDS = Object.keys(SECTION_LABELS);

// The one field each block kind renders from (see ContentBlock in
// components/module/ContentBlocks.jsx).
const blockField = (kind) => (kind === 'code' ? 'code' : kind === 'keypoints' ? 'items' : 'text');

function blockText(block) {
  const value = block[blockField(block.kind)] ?? block.text ?? block.code ?? block.items ?? '';
  return Array.isArray(value) ? value.join('\n') : String(value);
}

export function ModulesPanel() {
  const { refresh: refreshCatalog } = useModuleCatalog();
  const [modules, setModules] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState(BLANK);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState(BLANK);
  const [contentModuleId, setContentModuleId] = useState('');
  const [contentText, setContentText] = useState('{}');
  const [sectionIds, setSectionIds] = useState(DEFAULT_SECTION_IDS);
  const [contentSaved, setContentSaved] = useState('');

  function load() {
    setLoading(true);
    return adminApi.modules()
      .then((payload) => {
        setModules(payload.modules);
        setContentModuleId((current) => current || payload.modules[0]?.id || '');
        setError(null);
      })
      .catch(setError)
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const module = modules.find((item) => item.id === contentModuleId);
    if (!module) return;
    setContentText(JSON.stringify(module.content ?? {}, null, 2));
    setSectionIds(module.section_ids?.length ? module.section_ids : DEFAULT_SECTION_IDS);
    setContentSaved('');
  }, [contentModuleId, modules]);

  // Every mutation reloads rather than patching local state. The server
  // decides sort order, publication defaults and the seed-on-first-write
  // behaviour, so a locally-guessed copy of the list would drift from it.
  async function mutate(action) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await load();
      await refreshCatalog();
      return true;
    } catch (err) {
      setError(err);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function createModule(event) {
    event.preventDefault();
    const ok = await mutate(() => adminApi.createModule(draft));
    if (ok) {
      setDraft(BLANK);
      setCreating(false);
    }
  }

  async function saveContent(event) {
    event.preventDefault();
    let content;
    try {
      content = JSON.parse(contentText);
    } catch {
      setError(new Error('Lesson content must be valid JSON.'));
      return;
    }
    if (!content || Array.isArray(content)) {
      setError(new Error('Lesson content must be a JSON object.'));
      return;
    }
    const ok = await mutate(() => adminApi.updateModuleContent(contentModuleId, {
      content,
      section_ids: sectionIds,
    }));
    if (ok) setContentSaved('Lesson content and section order saved.');
  }

  function contentObject() {
    try {
      const parsed = JSON.parse(contentText);
      return parsed && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  function updateContentObject(update) {
    setContentText(JSON.stringify(update(contentObject()), null, 2));
    setContentSaved('');
  }

  function addLearnSection() {
    updateContentObject((content) => ({
      ...content,
      learnSections: [...(content.learnSections ?? []), {
        id: `section-${(content.learnSections ?? []).length + 1}`,
        title: 'New lesson section',
        blocks: [{ kind: 'p', text: '' }],
      }],
    }));
  }

  function updateLearnSection(index, field, value) {
    updateContentObject((content) => ({
      ...content,
      learnSections: (content.learnSections ?? []).map((section, sectionIndex) => (
        sectionIndex === index ? { ...section, [field]: value } : section
      )),
    }));
  }

  function addLearnBlock(sectionIndex) {
    updateContentObject((content) => ({
      ...content,
      learnSections: (content.learnSections ?? []).map((section, index) => (
        index === sectionIndex
          ? { ...section, blocks: [...(section.blocks ?? []), { kind: 'p', text: '' }] }
          : section
      )),
    }));
  }

  function updateLearnBlock(sectionIndex, blockIndex, field, value) {
    updateContentObject((content) => ({
      ...content,
      learnSections: (content.learnSections ?? []).map((section, index) => (
        index === sectionIndex
          ? {
            ...section,
            blocks: (section.blocks ?? []).map((block, currentIndex) => (
              currentIndex === blockIndex ? { ...block, [field]: value } : block
            )),
          }
          : section
      )),
    }));
  }

  // A type change rewrites the block rather than merging into it, carrying the
  // text across; merging left the old field behind and the editor kept
  // showing it, so typing into a block switched to Code appeared to do nothing.
  function changeLearnBlockKind(sectionIndex, blockIndex, kind) {
    updateContentObject((content) => ({
      ...content,
      learnSections: (content.learnSections ?? []).map((section, index) => (
        index === sectionIndex
          ? {
            ...section,
            blocks: (section.blocks ?? []).map((block, currentIndex) => {
              if (currentIndex !== blockIndex) return block;
              const text = blockText(block);
              const field = blockField(kind);
              return { kind, [field]: field === 'items' ? text.split('\n') : text };
            }),
          }
          : section
      )),
    }));
  }

  function moveSection(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= sectionIds.length) return;
    const next = sectionIds.slice();
    [next[index], next[target]] = [next[target], next[index]];
    setSectionIds(next);
  }

  async function saveEdit(event) {
    event.preventDefault();
    const ok = await mutate(() => adminApi.updateModule(editingId, {
      title: editDraft.title,
      description: editDraft.description,
      minutes: Number(editDraft.minutes) || 20,
      level: editDraft.level,
    }));
    if (ok) setEditingId(null);
  }

  function move(index, direction) {
    const next = modules.slice();
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setModules(next); // optimistic; load() reconciles
    mutate(() => adminApi.reorderModules(next.map((m) => m.id)));
  }

  function archive(module) {
    // Archiving is reversible only through the database, so it asks first.
    // The wording says "hide", not "delete", because that is what happens:
    // the module's marks and attempts survive.
    const confirmed = window.confirm(
      `Hide "${module.title}" from students?\n\n`
      + 'Existing marks, attempts and progress for this module are kept, but it '
      + 'disappears from the course. This can only be undone in the database.',
    );
    if (confirmed) mutate(() => adminApi.archiveModule(module.id));
  }

  return (
    <div className={s.wrap}>
      <div className={s.notice}>
        <strong>Lecturer workspace.</strong> Create modules here, then write their
        lesson content in the Content tab before publishing.
      </div>

      {error && <ErrorNote error={error} />}

      <Card
        title="Modules"
        subtitle="Change order, visibility and details. Students see published modules in this order."
        action={(
          <button type="button" className={s.btn} onClick={() => setCreating((v) => !v)}>
            {creating ? <X size={14} /> : <Plus size={14} />}
            {creating ? 'Cancel' : 'New module'}
          </button>
        )}
      >
        {creating && (
          <form onSubmit={createModule} className={s.card} style={{ marginBottom: 16 }}>
            <div className={s.fieldRow}>
              <div className={s.field}>
                <label className={s.fieldLabel} htmlFor="new-module-id">Module id</label>
                <input
                  id="new-module-id"
                  className={s.input}
                  value={draft.id}
                  onChange={(e) => setDraft({ ...draft, id: e.target.value })}
                  placeholder="regex-basics"
                  required
                />
                <p className={s.fieldHint}>
                  Lowercase, no spaces. Used in URLs and to link exercises — it cannot be changed later.
                </p>
              </div>
              <div className={s.field}>
                <label className={s.fieldLabel} htmlFor="new-module-title">Title</label>
                <input
                  id="new-module-title"
                  className={s.input}
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  placeholder="Regular Expressions"
                  required
                />
              </div>
            </div>
            <div className={s.field}>
              <label className={s.fieldLabel} htmlFor="new-module-desc">Description</label>
              <input
                id="new-module-desc"
                className={s.input}
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                placeholder="Match patterns in text."
              />
            </div>
            <div className={s.fieldRow}>
              <div className={s.field}>
                <label className={s.fieldLabel} htmlFor="new-module-minutes">Estimated minutes</label>
                <input
                  id="new-module-minutes"
                  type="number"
                  min="5"
                  max="180"
                  className={s.input}
                  value={draft.minutes}
                  onChange={(e) => setDraft({ ...draft, minutes: e.target.value })}
                />
              </div>
              <div className={s.field}>
                <label className={s.fieldLabel} htmlFor="new-module-level">Level</label>
                <select
                  id="new-module-level"
                  className={s.select}
                  value={draft.level}
                  onChange={(e) => setDraft({ ...draft, level: e.target.value })}
                >
                  <option>Beginner</option>
                  <option>Intermediate</option>
                  <option>Advanced</option>
                </select>
              </div>
            </div>
            <p className={s.fieldHint}>
              New modules start hidden from students so you can add exercises before releasing them.
            </p>
            <div className={s.formActions}>
              <button type="submit" className={s.btn} disabled={busy}>
                <Plus size={14} /> Create module
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <p className={s.muted}>Loading modules…</p>
        ) : (
          modules.map((module, index) => (
            <div key={module.id} className={s.moduleRow}>
              <div className={s.moduleOrder}>
                <button
                  type="button"
                  className={s.orderBtn}
                  onClick={() => move(index, -1)}
                  disabled={index === 0 || busy}
                  aria-label={`Move ${module.title} earlier`}
                >
                  <ChevronUp size={15} />
                </button>
                <button
                  type="button"
                  className={s.orderBtn}
                  onClick={() => move(index, 1)}
                  disabled={index === modules.length - 1 || busy}
                  aria-label={`Move ${module.title} later`}
                >
                  <ChevronDown size={15} />
                </button>
              </div>

              <div className={s.moduleBody}>
                {editingId === module.id ? (
                  <form onSubmit={saveEdit}>
                    <div className={s.fieldRow}>
                      <input
                        className={s.input}
                        value={editDraft.title}
                        onChange={(e) => setEditDraft({ ...editDraft, title: e.target.value })}
                        aria-label="Title"
                        required
                      />
                      <input
                        className={s.input}
                        type="number"
                        min="5"
                        max="180"
                        value={editDraft.minutes}
                        onChange={(e) => setEditDraft({ ...editDraft, minutes: e.target.value })}
                        aria-label="Estimated minutes"
                      />
                    </div>
                    <input
                      className={s.input}
                      style={{ marginTop: 8 }}
                      value={editDraft.description ?? ''}
                      onChange={(e) => setEditDraft({ ...editDraft, description: e.target.value })}
                      aria-label="Description"
                      placeholder="Description"
                    />
                    <div className={s.formActions}>
                      <button type="button" className={`${s.btn} ${s.btnGhost} ${s.btnSmall}`}
                        onClick={() => setEditingId(null)}>
                        Cancel
                      </button>
                      <button type="submit" className={`${s.btn} ${s.btnSmall}`} disabled={busy}>
                        <Save size={13} /> Save
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className={s.moduleTitle}>
                      {module.title}{' '}
                      <span className={`${s.badge} ${module.published ? s.badgeGood : s.badgeMuted}`}>
                        {module.published ? 'Published' : 'Hidden'}
                      </span>
                      <LessonBadge module={module} />
                      {module.question_count === 0 && (
                        <span
                          className={`${s.badge} ${s.badgeRisk}`}
                          title="Practice and Exam stay empty until you add questions in the Content tab. Until then, students complete this module from its lesson alone."
                        >
                          No questions
                        </span>
                      )}
                    </div>
                    <div className={s.moduleMeta}>
                      <code>{module.id}</code>
                      {module.description ? ` · ${module.description}` : ''}
                      {` · ${module.minutes} min`}
                      {module.level ? ` · ${module.level}` : ''}
                    </div>
                  </>
                )}
              </div>

              {editingId !== module.id && (
                <div className={s.moduleActions}>
                  <button
                    type="button"
                    className={`${s.btn} ${s.btnGhost} ${s.btnSmall}`}
                    disabled={busy}
                    onClick={() => mutate(() => adminApi.updateModule(module.id, {
                      published: !module.published,
                    }))}
                  >
                    {module.published ? <EyeOff size={13} /> : <Eye size={13} />}
                    {module.published ? 'Hide' : 'Publish'}
                  </button>
                  <button
                    type="button"
                    className={`${s.btn} ${s.btnGhost} ${s.btnSmall}`}
                    onClick={() => { setEditingId(module.id); setEditDraft(module); }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className={`${s.btn} ${s.btnDanger} ${s.btnSmall}`}
                    disabled={busy}
                    onClick={() => archive(module)}
                    aria-label={`Remove ${module.title}`}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </Card>

      <Card title="Lesson content" subtitle="Build Learn content with form controls, then save it directly to the module.">
        <form onSubmit={saveContent}>
          <div className={s.toolbar}>
            <label className={s.muted} htmlFor="lesson-content-module">Module</label>
            <select
              id="lesson-content-module"
              className={s.select}
              value={contentModuleId}
              onChange={(event) => setContentModuleId(event.target.value)}
            >
              {modules.map((module) => <option key={module.id} value={module.id}>{module.title}</option>)}
            </select>
          </div>
          <div className={s.field}>
            <span className={s.fieldLabel}>Student section order</span>
            <div className={s.list}>
              {sectionIds.map((sectionId, index) => (
                <div key={sectionId} className={s.moduleRow}>
                  <span>{SECTION_LABELS[sectionId]}</span>
                  <div className={s.moduleActions}>
                    <button type="button" className={`${s.btn} ${s.btnGhost} ${s.btnSmall}`} onClick={() => moveSection(index, -1)} disabled={index === 0}>Move up</button>
                    <button type="button" className={`${s.btn} ${s.btnGhost} ${s.btnSmall}`} onClick={() => moveSection(index, 1)} disabled={index === sectionIds.length - 1}>Move down</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className={s.field}>
            <div className={s.formActions}>
              <span className={s.fieldLabel}>Learn sections</span>
              <button type="button" className={`${s.btn} ${s.btnGhost} ${s.btnSmall}`} onClick={addLearnSection}>
                <Plus size={13} /> Add section
              </button>
            </div>
            {(contentObject().learnSections ?? []).map((section, sectionIndex) => (
              <div key={section.id ?? sectionIndex} className={s.card} style={{ marginBottom: 12 }}>
                <input
                  className={s.input}
                  value={section.title ?? ''}
                  onChange={(event) => updateLearnSection(sectionIndex, 'title', event.target.value)}
                  placeholder="Section title"
                  aria-label={`Lesson section ${sectionIndex + 1} title`}
                />
                {(section.blocks ?? []).map((block, blockIndex) => (
                  <div key={blockIndex} className={s.fieldRow} style={{ marginTop: 8 }}>
                    <select
                      className={s.select}
                      value={block.kind ?? 'p'}
                      onChange={(event) => changeLearnBlockKind(sectionIndex, blockIndex, event.target.value)}
                      aria-label="Content block type"
                    >
                      <option value="p">Paragraph</option>
                      <option value="code">Code example</option>
                      <option value="callout">Callout</option>
                      <option value="keypoints">Key points</option>
                    </select>
                    <textarea
                      className={s.textarea}
                      rows={3}
                      value={blockText(block)}
                      onChange={(event) => {
                        const field = blockField(block.kind);
                        const value = field === 'items' ? event.target.value.split('\n') : event.target.value;
                        updateLearnBlock(sectionIndex, blockIndex, field, value);
                      }}
                      placeholder={block.kind === 'code' ? 'print("Hello")' : 'Write lesson content...'}
                    />
                  </div>
                ))}
                <button type="button" className={`${s.btn} ${s.btnGhost} ${s.btnSmall}`} onClick={() => addLearnBlock(sectionIndex)}>
                  <Plus size={13} /> Add content block
                </button>
              </div>
            ))}
            <p className={s.fieldHint}>Build the Learn page with sections and paragraphs, code examples, callouts, or key points.</p>
          </div>
          <div className={s.field}>
            <label className={s.fieldLabel} htmlFor="module-content-json">Advanced content JSON</label>
            <textarea
              id="module-content-json"
              className={s.textarea}
              rows={12}
              value={contentText}
              onChange={(event) => setContentText(event.target.value)}
              spellCheck="false"
            />
            <p className={s.fieldHint}>Use this for worked Examples, Visualize settings, or content that needs the full data format.</p>
          </div>
          {contentSaved && <div className={s.success}>{contentSaved}</div>}
          <button type="submit" className={s.btn} disabled={busy || !contentModuleId}>
            <Save size={14} /> Save lesson
          </button>
        </form>
      </Card>
    </div>
  );
}

function LessonBadge({ module }) {
  if (module.content && Object.keys(module.content).length) {
    return <span className={`${s.badge} ${s.badgeGood}`}>Lesson ready</span>;
  }
  if (getModuleContent(module.id)) {
    return <span className={`${s.badge} ${s.badgeGood}`}>Built-in lesson</span>;
  }
  return <span className={`${s.badge} ${s.badgeMuted}`}>No lesson content</span>;
}
