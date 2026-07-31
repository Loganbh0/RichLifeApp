import { Link } from 'react-router-dom';
import { formatMoney } from '../utils/money.js';

export default function UnallocatedCard({ envelope }) {
  if (!envelope) return null;

  return (
    <Link
      to={`/envelopes/${envelope.id}`}
      className="card unallocated-card unallocated-card--link"
      aria-label="Open Unallocated"
    >
      <div className="row">
        <div>
          <h2>{envelope.name}</h2>
          <p className="hint">Available to assign</p>
        </div>
        <div className="balance money">{formatMoney(envelope.balance)}</div>
      </div>
    </Link>
  );
}
