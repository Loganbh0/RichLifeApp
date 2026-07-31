import { query, withTransaction } from './db.js';
import { httpError } from './middleware.js';

function money(value) {
  return Number(value).toFixed(2);
}

function mapEnvelope(row) {
  return {
    id: row.id,
    categoryId: row.category_id,
    name: row.name,
    balance: money(row.balance),
    target: money(row.target),
    sortOrder: row.sort_order,
    isUnallocated: row.is_unallocated,
    createdAt: row.created_at,
  };
}

function mapCategory(row) {
  return {
    id: row.id,
    name: row.name,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

export async function listCategories() {
  const { rows } = await query(
    `SELECT id, name, sort_order, created_at
     FROM categories
     ORDER BY sort_order ASC, name ASC`
  );
  return rows.map(mapCategory);
}

export async function createCategory({ name, sortOrder = 0 }) {
  if (!name || !String(name).trim()) {
    throw httpError(400, 'Name is required');
  }
  const { rows } = await query(
    `INSERT INTO categories (name, sort_order)
     VALUES ($1, $2)
     RETURNING id, name, sort_order, created_at`,
    [String(name).trim(), Number(sortOrder) || 0]
  );
  return mapCategory(rows[0]);
}

export async function getBudgetOverview() {
  const [categoriesResult, envelopesResult] = await Promise.all([
    query(
      `SELECT id, name, sort_order, created_at
       FROM categories
       ORDER BY sort_order ASC, name ASC`
    ),
    query(
      `SELECT id, category_id, name, balance, target, sort_order, is_unallocated, created_at
       FROM envelopes
       ORDER BY sort_order ASC, name ASC`
    ),
  ]);

  const envelopes = envelopesResult.rows.map(mapEnvelope);
  const unallocated = envelopes.find((e) => e.isUnallocated) || null;
  const regular = envelopes.filter((e) => !e.isUnallocated);

  const totalBalance = money(
    envelopes.reduce((sum, e) => sum + Number(e.balance), 0)
  );

  const categories = categoriesResult.rows.map((cat) => {
    const catEnvelopes = regular.filter((e) => e.categoryId === cat.id);
    const subtotal = money(
      catEnvelopes.reduce((sum, e) => sum + Number(e.balance), 0)
    );
    return {
      ...mapCategory(cat),
      subtotal,
      envelopes: catEnvelopes,
    };
  });

  const uncategorized = regular.filter((e) => !e.categoryId);
  if (uncategorized.length > 0) {
    categories.push({
      id: null,
      name: 'Other',
      sortOrder: 9999,
      subtotal: money(
        uncategorized.reduce((sum, e) => sum + Number(e.balance), 0)
      ),
      envelopes: uncategorized,
      createdAt: null,
    });
  }

  return { totalBalance, unallocated, categories };
}

export async function createEnvelope({ name, target = 0, categoryId = null, sortOrder = 0 }) {
  if (!name || !String(name).trim()) {
    throw httpError(400, 'Name is required');
  }
  const targetNum = Number(target);
  if (Number.isNaN(targetNum) || targetNum < 0) {
    throw httpError(400, 'Target must be a non-negative number');
  }

  const { rows } = await query(
    `INSERT INTO envelopes (name, target, category_id, sort_order, is_unallocated)
     VALUES ($1, $2, $3, $4, false)
     RETURNING id, category_id, name, balance, target, sort_order, is_unallocated, created_at`,
    [String(name).trim(), targetNum, categoryId || null, Number(sortOrder) || 0]
  );
  return mapEnvelope(rows[0]);
}

export async function updateEnvelope(id, patch) {
  const { rows: existing } = await query(
    `SELECT id, category_id, name, balance, target, sort_order, is_unallocated, created_at
     FROM envelopes WHERE id = $1`,
    [id]
  );
  if (!existing[0]) {
    throw httpError(404, 'Envelope not found');
  }
  if (existing[0].is_unallocated) {
    const allowed = ['name'];
    const keys = Object.keys(patch).filter((k) => patch[k] !== undefined);
    if (keys.some((k) => !allowed.includes(k))) {
      throw httpError(400, 'Unallocated can only be renamed');
    }
  }

  const name =
    patch.name !== undefined ? String(patch.name).trim() : existing[0].name;
  if (!name) {
    throw httpError(400, 'Name is required');
  }

  let target = existing[0].target;
  if (patch.target !== undefined) {
    const targetNum = Number(patch.target);
    if (Number.isNaN(targetNum) || targetNum < 0) {
      throw httpError(400, 'Target must be a non-negative number');
    }
    target = targetNum;
  }

  let categoryId = existing[0].category_id;
  if (patch.categoryId !== undefined) {
    if (existing[0].is_unallocated) {
      throw httpError(400, 'Unallocated cannot have a category');
    }
    categoryId = patch.categoryId || null;
  }

  let sortOrder = existing[0].sort_order;
  if (patch.sortOrder !== undefined) {
    sortOrder = Number(patch.sortOrder) || 0;
  }

  const { rows } = await query(
    `UPDATE envelopes
     SET name = $2, target = $3, category_id = $4, sort_order = $5
     WHERE id = $1
     RETURNING id, category_id, name, balance, target, sort_order, is_unallocated, created_at`,
    [id, name, target, categoryId, sortOrder]
  );
  return mapEnvelope(rows[0]);
}

async function lockEnvelope(client, id) {
  const { rows } = await client.query(
    `SELECT id, category_id, name, balance, target, sort_order, is_unallocated, created_at
     FROM envelopes
     WHERE id = $1
     FOR UPDATE`,
    [id]
  );
  if (!rows[0]) {
    throw httpError(404, 'Envelope not found');
  }
  return rows[0];
}

function parseAmount(amount) {
  const n = Number(amount);
  if (Number.isNaN(n) || n <= 0) {
    throw httpError(400, 'Amount must be a positive number');
  }
  return Number(n.toFixed(2));
}

export async function createTransaction(body) {
  const type = body.type;
  if (!['income', 'expense', 'transfer'].includes(type)) {
    throw httpError(400, 'Type must be income, expense, or transfer');
  }
  const amount = parseAmount(body.amount);

  return withTransaction(async (client) => {
    if (type === 'income' || type === 'expense') {
      const envelopeId = body.envelopeId;
      if (!envelopeId) {
        throw httpError(400, 'envelopeId is required');
      }
      const env = await lockEnvelope(client, envelopeId);

      if (type === 'expense' && env.is_unallocated) {
        if (Number(env.balance) < amount) {
          throw httpError(400, 'Unallocated cannot go negative');
        }
      }

      const nextBalance =
        type === 'income'
          ? Number(env.balance) + amount
          : Number(env.balance) - amount;

      await client.query(
        `UPDATE envelopes SET balance = $2 WHERE id = $1`,
        [env.id, nextBalance]
      );

      const { rows } = await client.query(
        `INSERT INTO transactions (type, amount, envelope_id)
         VALUES ($1, $2, $3)
         RETURNING id, type, amount, envelope_id, from_envelope_id, to_envelope_id, created_at`,
        [type, amount, env.id]
      );

      return {
        id: rows[0].id,
        type: rows[0].type,
        amount: money(rows[0].amount),
        envelopeId: rows[0].envelope_id,
        fromEnvelopeId: rows[0].from_envelope_id,
        toEnvelopeId: rows[0].to_envelope_id,
        createdAt: rows[0].created_at,
      };
    }

    // transfer
    const fromId = body.fromEnvelopeId;
    const toId = body.toEnvelopeId;
    if (!fromId || !toId) {
      throw httpError(400, 'fromEnvelopeId and toEnvelopeId are required');
    }
    if (fromId === toId) {
      throw httpError(400, 'Cannot transfer to the same envelope');
    }

    // Lock in stable UUID order to avoid deadlocks
    const firstId = fromId < toId ? fromId : toId;
    const secondId = fromId < toId ? toId : fromId;
    const first = await lockEnvelope(client, firstId);
    const second = await lockEnvelope(client, secondId);
    const from = fromId === first.id ? first : second;
    const to = toId === first.id ? first : second;

    if (from.is_unallocated && Number(from.balance) < amount) {
      throw httpError(400, 'Unallocated cannot go negative');
    }

    await client.query(`UPDATE envelopes SET balance = $2 WHERE id = $1`, [
      from.id,
      Number(from.balance) - amount,
    ]);
    await client.query(`UPDATE envelopes SET balance = $2 WHERE id = $1`, [
      to.id,
      Number(to.balance) + amount,
    ]);

    const { rows } = await client.query(
      `INSERT INTO transactions (type, amount, from_envelope_id, to_envelope_id)
       VALUES ('transfer', $1, $2, $3)
       RETURNING id, type, amount, envelope_id, from_envelope_id, to_envelope_id, created_at`,
      [amount, from.id, to.id]
    );

    return {
      id: rows[0].id,
      type: rows[0].type,
      amount: money(rows[0].amount),
      envelopeId: rows[0].envelope_id,
      fromEnvelopeId: rows[0].from_envelope_id,
      toEnvelopeId: rows[0].to_envelope_id,
      createdAt: rows[0].created_at,
    };
  });
}

export async function listTransactions(limit = 50) {
  const { rows } = await query(
    `SELECT id, type, amount, envelope_id, from_envelope_id, to_envelope_id, created_at
     FROM transactions
     ORDER BY created_at DESC
     LIMIT $1`,
    [Math.min(Number(limit) || 50, 200)]
  );
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    amount: money(r.amount),
    envelopeId: r.envelope_id,
    fromEnvelopeId: r.from_envelope_id,
    toEnvelopeId: r.to_envelope_id,
    createdAt: r.created_at,
  }));
}
