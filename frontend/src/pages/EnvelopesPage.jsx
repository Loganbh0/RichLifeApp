import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import TotalBalanceCard from '../components/TotalBalanceCard.jsx';
import UnallocatedCard from '../components/UnallocatedCard.jsx';
import CategorySection from '../components/CategorySection.jsx';
import Fab from '../components/Fab.jsx';
import ManageModal from '../components/ManageModal.jsx';

export default function EnvelopesPage() {
  const [data, setData] = useState(null);
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [manageOpen, setManageOpen] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const [budget, cats] = await Promise.all([
        api.getBudget(),
        api.listCategories(),
      ]);
      setData(budget);
      setCategories(cats);
    } catch (err) {
      setError(err.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSaved() {
    setManageOpen(false);
    await load();
  }

  return (
    <main className="page">
      <header className="page-header">
        <h1 className="brand">Rich Life</h1>
        <div className="header-actions">
          <button
            type="button"
            className="icon-btn"
            aria-label="Add envelope"
            onClick={() => setManageOpen(true)}
            title="Add envelope"
            style={{
              width: 'auto',
              padding: '0 14px',
              borderRadius: 20,
              fontSize: '0.85rem',
              fontWeight: 600,
            }}
          >
            + Envelope
          </button>
        </div>
      </header>

      {error && <div className="error-banner">{error}</div>}

      {loading && !data && (
        <div className="status-banner">Loading envelopes…</div>
      )}

      {data && (
        <div className="stack-gap">
          <TotalBalanceCard totalBalance={data.totalBalance} />
          <UnallocatedCard envelope={data.unallocated} />
          {data.categories.map((cat) => (
            <CategorySection key={cat.id ?? 'other'} category={cat} />
          ))}
        </div>
      )}

      <Fab />

      {manageOpen && (
        <ManageModal
          envelope={null}
          categories={categories}
          onClose={() => setManageOpen(false)}
          onSaved={handleSaved}
        />
      )}
    </main>
  );
}
