import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { formatMoney } from '../utils/money.js';
import {
  envelopeOptionLabel,
  flattenBudgetEnvelopes,
} from '../utils/transactions.js';

const TYPES = [
  { id: 'income', label: 'Income' },
  { id: 'expense', label: 'Expense' },
  { id: 'transfer', label: 'Move' },
];

export default function AddTransactionPage() {
  const navigate = useNavigate();
  const [type, setType] = useState('income');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [envelopeId, setEnvelopeId] = useState('');
  const [fromEnvelopeId, setFromEnvelopeId] = useState('');
  const [toEnvelopeId, setToEnvelopeId] = useState('');
  const [budget, setBudget] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .getBudget()
      .then((data) => {
        setBudget(data);
        if (data.unallocated) {
          setEnvelopeId(data.unallocated.id);
          setFromEnvelopeId(data.unallocated.id);
        }
        const first = data.categories.flatMap((c) => c.envelopes)[0];
        if (first) setToEnvelopeId(first.id);
      })
      .catch((err) => setError(err.message));
  }, []);

  const allEnvelopes = useMemo(
    () => flattenBudgetEnvelopes(budget),
    [budget]
  );

  const selectedEnvelope = useMemo(
    () => allEnvelopes.find((e) => e.id === envelopeId),
    [allEnvelopes, envelopeId]
  );
  const selectedFrom = useMemo(
    () => allEnvelopes.find((e) => e.id === fromEnvelopeId),
    [allEnvelopes, fromEnvelopeId]
  );
  const selectedTo = useMemo(
    () => allEnvelopes.find((e) => e.id === toEnvelopeId),
    [allEnvelopes, toEnvelopeId]
  );

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        type,
        amount: Number(amount),
      };
      const trimmedNotes = notes.trim();
      if (trimmedNotes) payload.notes = trimmedNotes;

      if (type === 'income' || type === 'expense') {
        payload.envelopeId = envelopeId;
      } else {
        payload.fromEnvelopeId = fromEnvelopeId;
        payload.toEnvelopeId = toEnvelopeId;
      }
      await api.createTransaction(payload);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const canSubmit =
    Number(amount) > 0 &&
    (type === 'transfer'
      ? fromEnvelopeId && toEnvelopeId && fromEnvelopeId !== toEnvelopeId
      : Boolean(envelopeId));

  return (
    <main className="page page--form">
      <button type="button" className="back-link" onClick={() => navigate('/')}>
        ← Back
      </button>
      <h1 className="form-title">Add transaction</h1>

      {error && <div className="error-banner">{error}</div>}

      <div className="segmented" role="tablist" aria-label="Transaction type">
        {TYPES.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={type === t.id}
            className={type === t.id ? 'is-active' : ''}
            onClick={() => setType(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="amount">Amount</label>
          <input
            id="amount"
            className="amount-input"
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            autoFocus
          />
        </div>

        {(type === 'income' || type === 'expense') && (
          <div className="field">
            <label htmlFor="envelope">
              {type === 'income' ? 'Deposit to' : 'Withdraw from'}
            </label>
            <select
              id="envelope"
              value={envelopeId}
              onChange={(e) => setEnvelopeId(e.target.value)}
              required
            >
              {allEnvelopes.map((env) => (
                <option key={env.id} value={env.id}>
                  {envelopeOptionLabel(env)}
                </option>
              ))}
            </select>
            {selectedEnvelope && (
              <p className="field-hint muted">
                Current: {formatMoney(selectedEnvelope.balance)}
              </p>
            )}
          </div>
        )}

        {type === 'transfer' && (
          <>
            <div className="field">
              <label htmlFor="from">From</label>
              <select
                id="from"
                value={fromEnvelopeId}
                onChange={(e) => setFromEnvelopeId(e.target.value)}
                required
              >
                {allEnvelopes.map((env) => (
                  <option key={env.id} value={env.id}>
                    {envelopeOptionLabel(env)}
                  </option>
                ))}
              </select>
              {selectedFrom && (
                <p className="field-hint muted">
                  Current: {formatMoney(selectedFrom.balance)}
                </p>
              )}
            </div>
            <div className="field">
              <label htmlFor="to">To</label>
              <select
                id="to"
                value={toEnvelopeId}
                onChange={(e) => setToEnvelopeId(e.target.value)}
                required
              >
                {allEnvelopes.map((env) => (
                  <option key={env.id} value={env.id}>
                    {envelopeOptionLabel(env)}
                  </option>
                ))}
              </select>
              {selectedTo && (
                <p className="field-hint muted">
                  Current: {formatMoney(selectedTo.balance)}
                </p>
              )}
            </div>
          </>
        )}

        <div className="field">
          <label htmlFor="notes">Notes (optional)</label>
          <textarea
            id="notes"
            rows={3}
            placeholder="Costco, paycheck, rent…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <button
          type="submit"
          className="submit-btn"
          disabled={!canSubmit || saving}
        >
          {saving ? 'Saving…' : 'Save transaction'}
        </button>
      </form>
    </main>
  );
}
