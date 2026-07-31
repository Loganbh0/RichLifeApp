import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';

export default function ManageModal({ envelope, categories, onClose, onSaved }) {
  const isEdit = Boolean(envelope);
  const [name, setName] = useState(envelope?.name || '');
  const [target, setTarget] = useState(
    envelope ? String(Number(envelope.target)) : '0'
  );
  const [categoryId, setCategoryId] = useState(envelope?.categoryId || '');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [localCategories, setLocalCategories] = useState(categories);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLocalCategories(categories);
  }, [categories]);

  const isUnallocated = envelope?.isUnallocated;

  const title = useMemo(() => {
    if (isUnallocated) return 'Rename Unallocated';
    return isEdit ? 'Edit envelope' : 'New envelope';
  }, [isEdit, isUnallocated]);

  async function addCategory() {
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;
    setError('');
    try {
      const cat = await api.createCategory({
        name: trimmed,
        sortOrder: localCategories.length + 1,
      });
      setLocalCategories((prev) => [...prev, cat]);
      setCategoryId(cat.id);
      setNewCategoryName('');
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (isEdit) {
        const body = { name: name.trim() };
        if (!isUnallocated) {
          body.target = Number(target);
          body.categoryId = categoryId || null;
        }
        await api.updateEnvelope(envelope.id, body);
      } else {
        await api.createEnvelope({
          name: name.trim(),
          target: Number(target) || 0,
          categoryId: categoryId || null,
        });
      }
      await onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="manage-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="manage-title">{title}</h2>
        {error && <div className="error-banner">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="env-name">Title</label>
            <input
              id="env-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>

          {!isUnallocated && (
            <>
              <div className="field">
                <label htmlFor="env-target">Target amount</label>
                <input
                  id="env-target"
                  type="number"
                  min="0"
                  step="0.01"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                />
              </div>

              <div className="field">
                <label htmlFor="env-cat">Category</label>
                <select
                  id="env-cat"
                  value={categoryId || ''}
                  onChange={(e) => setCategoryId(e.target.value)}
                >
                  <option value="">Other</option>
                  {localCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="new-cat">New category</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    id="new-cat"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="e.g. Annual"
                  />
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={addCategory}
                    aria-label="Add category"
                    style={{ width: 48, flexShrink: 0, borderRadius: 12 }}
                  >
                    +
                  </button>
                </div>
              </div>
            </>
          )}

          <div className="modal-actions">
            <button type="button" className="ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
