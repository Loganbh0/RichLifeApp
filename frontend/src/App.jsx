import { Routes, Route } from 'react-router-dom';
import EnvelopesPage from './pages/EnvelopesPage.jsx';
import AddTransactionPage from './pages/AddTransactionPage.jsx';
import EnvelopeDetailPage from './pages/EnvelopeDetailPage.jsx';
import AllTransactionsPage from './pages/AllTransactionsPage.jsx';

export default function App() {
  return (
    <div className="app-shell">
      <Routes>
        <Route path="/" element={<EnvelopesPage />} />
        <Route path="/add" element={<AddTransactionPage />} />
        <Route path="/transactions" element={<AllTransactionsPage />} />
        <Route path="/envelopes/:id" element={<EnvelopeDetailPage />} />
      </Routes>
    </div>
  );
}
