import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { formatMoney } from '../utils/money.js';
import {
  envelopeOptionLabel,
  flattenBudgetEnvelopes,
} from '../utils/transactions.js';

export default function EditTransactionModal({ transaction, onClose, onSaved }) {
  const [amount, setAmount] = useState(String(Number(transaction.amount)));
  const [notes, setNotes] = useState(transaction.notes || '');
  const [envelopeId, setEnvelopeId] = useState(transaction.envelopeId || '');
  const [fromEnvelopeId, setFromEnvelopeId] = useState(
    transaction.fromEnvelopeId || ''
  );
  const [toEnvelopeId, setToEnvelopeId] = useState(
    transaction.toEnvelopeId || ''
  );
  const [envelopes, setEnvelopes] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setAmount(String(Number(transaction.amount)));
    setNotes(transaction.notes || '');
    setEnvelopeId(transaction.envelopeId || '');
    setFromEnvelopeId(transaction.fromEnvelopeId || '');
    setToEnvelopeId(transaction.toEnvelopeId || '');
  }, [transaction]);

  useEffect(() => {
    api
      .getBudget()
      .then((budget) => setEnvelopes(flattenBudgetEnvelopes(budget)))
      .catch((err) => setError(err.message));
  }, []);

  const typeLabel =
    transaction.type === 'income'
      ? 'Income'
      : transaction.type === 'expense'
        ? 'Expense'
        : 'Move';

  const selectedEnvelope = useMemo(
    () => envelopes.find((e) => e.id === envelopeId),
    [envelopes, envelopeId]
  );
  const selectedFrom = useMemo(
    () => envelopes.find((e) => e.id === fromEnvelopeId),
    [envelopes, fromEnvelopeId]
  );
  const selectedTo = useMemo(
    () => envelopes.find((e) => e.id === toEnvelopeId),
    [envelopes, toEnvelopeId]
  );

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const body = {
        amount: Number(amount),
        notes: notes.trim() || null,
      };
      if (transaction.type === 'income' || transaction.type === 'expense') {
        body.envelopeId = envelopeId;
      } else {
        body.fromEnvelopeId = fromEnvelopeId;
        body.toEnvelopeId = toEnvelopeId;
      }
      await api.updateTransaction(transaction.id, body);
      await onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (
      !window.confirm(
        'Undo this transaction? Balances will be restored.'
      )
    ) {
      return;
    }
    setDeleting(true);
    setError('');
    try {
      await api.deleteTransaction(transaction.id);
      await onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  }

  const canSave =
    Number(amount) > 0 &&
    (transaction.type === 'transfer'
      ? fromEnvelopeId && toEnvelopeId && fromEnvelopeId !== toEnvelopeId
      : Boolean(envelopeId));

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-tx-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="edit-tx-title">Edit {typeLabel.toLowerCase()}</h2>
        <p className="muted" style={{ marginTop: -8, marginBottom: 16 }}>
          Change amount, notes, or envelopes. Undo restores balances.
        </p>
        {error && <div className="error-banner">{error}</div>}
        <form onSubmit={handleSave}>
          <div className="field">
            <label htmlFor="edit-tx-amount">Amount</label>
            <input
              id="edit-tx-amount"
              className="amount-input"
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              autoFocus
            />
          </div>

          {(transaction.type === 'income' || transaction.type === 'expense') && (
            <div className="field">
              <label htmlFor="edit-tx-envelope">
                {transaction.type === 'income' ? 'Deposit to' : 'Withdraw from'}
              </label>
              <select
                id="edit-tx-envelope"
                value={envelopeId}
                onChange={(e) => setEnvelopeId(e.target.value)}
                required
              >
                {envelopes.map((env) => (
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

          {transaction.type === 'transfer' && (
            <>
              <div className="field">
                <label htmlFor="edit-tx-from">From</label>
                <select
                  id="edit-tx-from"
                  value={fromEnvelopeId}
                  onChange={(e) => setFromEnvelopeId(e.target.value)}
                  required
                >
                  {envelopes.map((env) => (
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
                <label htmlFor="edit-tx-to">To</label>
                <select
                  id="edit-tx-to"
                  value={toEnvelopeId}
                  onChange={(e) => setToEnvelopeId(e.target.value)}
                  required
                >
                  {envelopes.map((env) => (
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
            <label htmlFor="edit-tx-notes">Notes (optional)</label>
            <textarea
              id="edit-tx-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Costco, paycheck…"
            />
          </div>
          <div className="modal-actions">
            <button type="button" className="ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="primary"
              disabled={!canSave || saving || deleting}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
        <button
          type="button"
          className="submit-btn submit-btn--danger"
          onClick={handleDelete}
          disabled={saving || deleting}
          style={{ marginTop: 12 }}
        >
          {deleting
            ? 'Undoing…'
            : `Undo (${formatMoney(transaction.amount)})`}
        </button>
      </div>
    </div>
  );
}
