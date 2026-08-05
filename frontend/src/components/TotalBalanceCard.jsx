import { Link } from 'react-router-dom';
import { splitMoney } from '../utils/money.js';

export default function TotalBalanceCard({ totalBalance }) {
  const { sign, dollars, cents } = splitMoney(totalBalance);

  return (
    <Link
      to="/transactions"
      className="card total-card total-card--link"
      aria-label="View all transactions"
    >
      <div className="label">All envelopes</div>
      <div className="money money--lg">
        {sign}${dollars}
        <span className="cents">.{cents}</span>
      </div>
      <div className="total-card__hint muted">Tap to see all transactions</div>
    </Link>
  );
}
