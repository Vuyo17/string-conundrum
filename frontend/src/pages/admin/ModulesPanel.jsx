import React, { useEffect, useState } from 'react';
import {
  ChevronDown, ChevronUp, Eye, EyeOff, Plus, Save, Trash2, X,
} from 'lucide-react';
import s from './Admin.module.css';
import { adminApi } from './adminApi';
import { Card, ErrorNote } from './AdminUI';

const BLANK = { id: '', title: '', description: '', minutes: 20, level: 'Beginner' };

export function ModulesPanel() {
  const [modules, setModules] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState(BLANK);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState(BLANK);

  function load() {
    setLoading(true);
    return adminApi.modules()
      .then((payload) => { setModules(payload.modules); setError(null); })
      .catch(setError)
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  // Every mutation reloads rather than patching local state. The server
  // decides sort order, publication defaults and the seed-on-first-write
  // behaviour, so a locally-guessed copy of the list would drift from it.
  async function mutate(action) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await load();
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
        <strong>What is editable here.</strong> Module titles, descriptions,
        ordering and whether students can see them. The lesson pages themselves
        (explanations, worked examples, visualisers) are still part of the app
        build — a module created here appears with its description and its
        exercises, but no lesson text until content is written for it.
      </div>

      {error && <ErrorNote error={error} />}

      <Card
        title="Modules"
        subtitle="Drag order, visibility and details. Students see published modules in this order."
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
    </div>
  );
}
