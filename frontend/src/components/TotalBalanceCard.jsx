import { splitMoney } from '../utils/money.js';

export default function TotalBalanceCard({ totalBalance }) {
  const { sign, dollars, cents } = splitMoney(totalBalance);

  return (
    <section className="card total-card" aria-label="All envelopes total">
      <div className="label">All envelopes</div>
      <div className="money money--lg">
        {sign}${dollars}
        <span className="cents">.{cents}</span>
      </div>
    </section>
  );
}
