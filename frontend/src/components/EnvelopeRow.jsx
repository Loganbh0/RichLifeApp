import { Link } from 'react-router-dom';
import { formatMoney } from '../utils/money.js';
import ProgressBar from './ProgressBar.jsx';

export default function EnvelopeRow({ envelope }) {
  const bal = Number(envelope.balance);
  const neg = bal < 0;

  return (
    <Link
      to={`/envelopes/${envelope.id}`}
      className="envelope-row"
      aria-label={`Open ${envelope.name}`}
    >
      <div className="top">
        <div className="title">{envelope.name}</div>
        <div className="amounts">
          <span className={`bal money${neg ? ' money--neg' : ''}`}>
            {formatMoney(envelope.balance)}
          </span>
          {Number(envelope.target) > 0 && (
            <span className="target money">{formatMoney(envelope.target)}</span>
          )}
        </div>
      </div>
      <ProgressBar balance={envelope.balance} target={envelope.target} />
    </Link>
  );
}
