const BASE = process.env.API_BASE || 'http://localhost:3000/api/v1';
const API_KEY = process.env.API_KEY || '';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    throw new Error(body?.error || `Request failed (${res.status})`);
  }
  return body;
}

async function main() {
  console.log('Smoke: GET /envelopes');
  const before = await request('/envelopes');
  if (!before.unallocated) {
    throw new Error('Missing Unallocated envelope — run 0001_init.sql');
  }
  console.log('  totalBalance:', before.totalBalance);
  console.log('  unallocated:', before.unallocated.balance);

  const firstEnvelope = before.categories.flatMap((c) => c.envelopes)[0];
  if (!firstEnvelope) {
    throw new Error('No regular envelopes found');
  }

  console.log('Smoke: income $100 → Unallocated');
  await request('/transactions', {
    method: 'POST',
    body: JSON.stringify({
      type: 'income',
      amount: 100,
      envelopeId: before.unallocated.id,
    }),
  });

  console.log(`Smoke: transfer $40 Unallocated → ${firstEnvelope.name}`);
  await request('/transactions', {
    method: 'POST',
    body: JSON.stringify({
      type: 'transfer',
      amount: 40,
      fromEnvelopeId: before.unallocated.id,
      toEnvelopeId: firstEnvelope.id,
    }),
  });

  console.log(`Smoke: expense $10 from ${firstEnvelope.name}`);
  await request('/transactions', {
    method: 'POST',
    body: JSON.stringify({
      type: 'expense',
      amount: 10,
      envelopeId: firstEnvelope.id,
    }),
  });

  const after = await request('/envelopes');
  console.log('After:');
  console.log('  totalBalance:', after.totalBalance);
  console.log('  unallocated:', after.unallocated.balance);
  console.log('Smoke OK');
}

main().catch((err) => {
  console.error('Smoke failed:', err.message);
  process.exit(1);
});
