import { formatMoney } from '../utils/money.js';
import EnvelopeRow from './EnvelopeRow.jsx';

export default function CategorySection({ category, onEditEnvelope }) {
  if (!category.envelopes?.length) return null;

  return (
    <section className="section" aria-label={category.name}>
      <div className="section-head">
        <h3>{category.name}</h3>
        <span className="subtotal money">{formatMoney(category.subtotal)}</span>
      </div>
      <div className="envelope-list">
        {category.envelopes.map((env) => (
          <EnvelopeRow key={env.id} envelope={env} onEdit={onEditEnvelope} />
        ))}
      </div>
    </section>
  );
}
