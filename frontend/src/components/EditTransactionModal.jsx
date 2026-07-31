import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { formatMoney } from '../utils/money.js';

export default function EditTransactionModal({ transaction, onClose, onSaved }) {
  const [amount, setAmount] = useState(String(Number(transaction.amount)));
  const [notes, setNotes] = useState(transaction.notes || '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setAmount(String(Number(transaction.amount)));
    setNotes(transaction.notes || '');
  }, [transaction]);

  const typeLabel =
    transaction.type === 'income'
      ? 'Income'
      : transaction.type === 'expense'
        ? 'Expense'
        : 'Move';

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.updateTransaction(transaction.id, {
        amount: Number(amount),
        notes: notes.trim() || null,
      });
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
        'Delete this transaction? Envelope balances will be adjusted.'
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
          Adjust the amount or notes. Deleting reverses the balance change.
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
            <button type="submit" className="primary" disabled={saving || deleting}>
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
          {deleting ? 'Deleting…' : `Delete (${formatMoney(transaction.amount)})`}
        </button>
      </div>
    </div>
  );
}
