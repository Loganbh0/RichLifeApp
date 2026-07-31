import { formatMoney } from '../utils/money.js';

export default function UnallocatedCard({ envelope }) {
  if (!envelope) return null;

  return (
    <section className="card unallocated-card" aria-label="Unallocated">
      <div className="row">
        <div>
          <h2>{envelope.name}</h2>
          <p className="hint">Available to assign</p>
        </div>
        <div className="balance money">{formatMoney(envelope.balance)}</div>
      </div>
    </section>
  );
}
