import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import EditTransactionModal from '../components/EditTransactionModal.jsx';
import { formatMoney } from '../utils/money.js';
import { describeTxGlobal, formatDate } from '../utils/transactions.js';

export default function AllTransactionsPage() {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingTx, setEditingTx] = useState(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const txs = await api.listTransactions();
      setTransactions(txs);
    } catch (err) {
      setError(err.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleTxSaved() {
    setEditingTx(null);
    await load();
  }

  return (
    <main className="page page--form">
      <button type="button" className="back-link" onClick={() => navigate('/')}>
        ← Back
      </button>
      <h1 className="form-title">All transactions</h1>

      {error && <div className="error-banner">{error}</div>}

      {loading && (
        <div className="status-banner">Loading transactions…</div>
      )}

      {!loading && transactions.length === 0 && (
        <div className="status-banner">No transactions yet</div>
      )}

      {!loading && transactions.length > 0 && (
        <ul className="tx-list">
          {transactions.map((tx) => {
            const { label, signed } = describeTxGlobal(tx);
            return (
              <li key={tx.id}>
                <button
                  type="button"
                  className="tx-card tx-card--btn"
                  onClick={() => setEditingTx(tx)}
                >
                  <div className="tx-card__main">
                    <div>
                      <div className="tx-card__label">{label}</div>
                      <div className="tx-card__date muted">
                        {formatDate(tx.createdAt)}
                      </div>
                    </div>
                    <div className="tx-card__amount money">
                      {tx.type === 'transfer'
                        ? formatMoney(Math.abs(signed))
                        : `${signed >= 0 ? '+' : '−'}${formatMoney(Math.abs(signed))}`}
                    </div>
                  </div>
                  {tx.notes && <p className="tx-card__notes">{tx.notes}</p>}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {editingTx && (
        <EditTransactionModal
          transaction={editingTx}
          onClose={() => setEditingTx(null)}
          onSaved={handleTxSaved}
        />
      )}
    </main>
  );
}
