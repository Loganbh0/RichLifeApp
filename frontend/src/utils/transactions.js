import { formatMoney } from './money.js';

export function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

/** Label + signed amount relative to a specific envelope (detail page). */
export function describeTxForEnvelope(tx, envelopeId) {
  if (tx.type === 'income') {
    return { label: 'Income', signed: Number(tx.amount) };
  }
  if (tx.type === 'expense') {
    return { label: 'Expense', signed: -Number(tx.amount) };
  }
  if (tx.fromEnvelopeId === envelopeId) {
    return {
      label: `To ${tx.toEnvelopeName || 'envelope'}`,
      signed: -Number(tx.amount),
    };
  }
  return {
    label: `From ${tx.fromEnvelopeName || 'envelope'}`,
    signed: Number(tx.amount),
  };
}

/** Global label for all-transactions list (no signed relative context). */
export function describeTxGlobal(tx) {
  if (tx.type === 'income') {
    return {
      label: `Income → ${tx.envelopeName || 'envelope'}`,
      signed: Number(tx.amount),
    };
  }
  if (tx.type === 'expense') {
    return {
      label: `Expense ← ${tx.envelopeName || 'envelope'}`,
      signed: -Number(tx.amount),
    };
  }
  return {
    label: `${tx.fromEnvelopeName || 'envelope'} → ${tx.toEnvelopeName || 'envelope'}`,
    signed: Number(tx.amount),
  };
}

export function envelopeOptionLabel(env) {
  return `${env.name} — ${formatMoney(env.balance)}`;
}

export function flattenBudgetEnvelopes(budget) {
  if (!budget) return [];
  const list = [];
  if (budget.unallocated) list.push(budget.unallocated);
  for (const cat of budget.categories || []) {
    list.push(...(cat.envelopes || []));
  }
  return list;
}
