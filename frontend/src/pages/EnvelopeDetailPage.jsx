import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import ProgressBar from '../components/ProgressBar.jsx';
import { formatMoney } from '../utils/money.js';

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

function describeTx(tx, envelopeId) {
  if (tx.type === 'income') {
    return { label: 'Income', signed: Number(tx.amount) };
  }
  if (tx.type === 'expense') {
    return { label: 'Expense', signed: -Number(tx.amount) };
  }
  // transfer
  if (tx.fromEnvelopeId === envelopeId) {
    return {
      label: `To ${tx.toEnvelopeName || 'envelope'}`,
      signed: -Number(tx.amount),
    };
  }
  return {
    label: `From ${tx.fromEnvelopeName || 'envelope'}`,
    signed: Number(tx.amount),
  };
}

export default function EnvelopeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState(null);
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [target, setTarget] = useState('0');
  const [categoryId, setCategoryId] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const [data, cats] = await Promise.all([
        api.getEnvelope(id),
        api.listCategories(),
      ]);
      setDetail(data);
      setCategories(cats);
      setName(data.envelope.name);
      setTarget(String(Number(data.envelope.target)));
      setCategoryId(data.envelope.categoryId || '');
    } catch (err) {
      setError(err.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function addCategory() {
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;
    try {
      const cat = await api.createCategory({
        name: trimmed,
        sortOrder: categories.length + 1,
      });
      setCategories((prev) => [...prev, cat]);
      setCategoryId(cat.id);
      setNewCategoryName('');
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const body = { name: name.trim() };
      if (!detail.envelope.isUnallocated) {
        body.target = Number(target);
        body.categoryId = categoryId || null;
      }
      await api.updateEnvelope(id, body);
      setEditing(false);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading && !detail) {
    return (
      <main className="page page--form">
        <div className="status-banner">Loading…</div>
      </main>
    );
  }

  if (!detail && error) {
    return (
      <main className="page page--form">
        <button type="button" className="back-link" onClick={() => navigate('/')}>
          ← Back
        </button>
        <div className="error-banner">{error}</div>
      </main>
    );
  }

  const { envelope, transactions } = detail;
  const isUnallocated = envelope.isUnallocated;

  return (
    <main className="page page--form">
      <button type="button" className="back-link" onClick={() => navigate('/')}>
        ← Back
      </button>

      {error && <div className="error-banner">{error}</div>}

      <section className="card detail-hero">
        <div className="detail-hero__meta muted">
          {isUnallocated
            ? 'Available to assign'
            : envelope.categoryName || 'Other'}
        </div>
        <h1 className="detail-hero__title">{envelope.name}</h1>
        <div className="money money--lg detail-hero__balance">
          {formatMoney(envelope.balance)}
        </div>
        {!isUnallocated && Number(envelope.target) > 0 && (
          <>
            <div className="muted detail-hero__target">
              Goal {formatMoney(envelope.target)}
            </div>
            <div className="detail-hero__progress">
              <ProgressBar balance={envelope.balance} target={envelope.target} />
            </div>
          </>
        )}
        <button
          type="button"
          className="detail-edit-toggle"
          onClick={() => setEditing((v) => !v)}
        >
          {editing ? 'Cancel edit' : 'Edit details'}
        </button>
      </section>

      {editing && (
        <section className="card detail-edit">
          <h2>Edit</h2>
          <form onSubmit={handleSave}>
            <div className="field">
              <label htmlFor="detail-name">Title</label>
              <input
                id="detail-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            {!isUnallocated && (
              <>
                <div className="field">
                  <label htmlFor="detail-target">Target amount</label>
                  <input
                    id="detail-target"
                    type="number"
                    min="0"
                    step="0.01"
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="detail-cat">Category</label>
                  <select
                    id="detail-cat"
                    value={categoryId || ''}
                    onChange={(e) => setCategoryId(e.target.value)}
                  >
                    <option value="">Other</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="detail-new-cat">New category</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      id="detail-new-cat"
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
            <button type="submit" className="submit-btn" disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </form>
        </section>
      )}

      <section className="detail-txs">
        <div className="section-head">
          <h3>Transactions</h3>
          <span className="subtotal">{transactions.length}</span>
        </div>

        {transactions.length === 0 ? (
          <div className="status-banner">No transactions yet</div>
        ) : (
          <ul className="tx-list">
            {transactions.map((tx) => {
              const { label, signed } = describeTx(tx, envelope.id);
              return (
                <li key={tx.id} className="tx-card">
                  <div className="tx-card__main">
                    <div>
                      <div className="tx-card__label">{label}</div>
                      <div className="tx-card__date muted">
                        {formatDate(tx.createdAt)}
                      </div>
                    </div>
                    <div className={`tx-card__amount money`}>
                      {signed >= 0 ? '+' : '−'}
                      {formatMoney(Math.abs(signed)).replace(/^\$/, '$')}
                    </div>
                  </div>
                  {tx.notes && <p className="tx-card__notes">{tx.notes}</p>}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
