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
       WHERE deleted_at IS NULL
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
    `SELECT id, category_id, name, balance, target, sort_order, is_unallocated, created_at, deleted_at
     FROM envelopes WHERE id = $1`,
    [id]
  );
  if (!existing[0] || existing[0].deleted_at) {
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

export async function deleteEnvelope(id) {
  return withTransaction(async (client) => {
    // Peek without lock first for cheap guards, then lock in UUID order with Unallocated
    const { rows: peek } = await client.query(
      `SELECT id, name, balance, is_unallocated, deleted_at
       FROM envelopes WHERE id = $1`,
      [id]
    );
    if (!peek[0] || peek[0].deleted_at) {
      throw httpError(404, 'Envelope not found');
    }
    if (peek[0].is_unallocated) {
      throw httpError(400, 'Cannot delete Unallocated');
    }

    const balance = Number(peek[0].balance);
    if (balance < 0) {
      throw httpError(
        400,
        'Envelope is overdrawn; resolve the negative balance before deleting'
      );
    }

    const { rows: unallocRows } = await client.query(
      `SELECT id FROM envelopes
       WHERE is_unallocated = true AND deleted_at IS NULL`
    );
    if (!unallocRows[0]) {
      throw httpError(500, 'Unallocated envelope missing');
    }
    const unallocatedId = unallocRows[0].id;

    const firstId = id < unallocatedId ? id : unallocatedId;
    const secondId = id < unallocatedId ? unallocatedId : id;
    const first = await lockEnvelope(client, firstId);
    const second = await lockEnvelope(client, secondId);
    const env = id === first.id ? first : second;
    const unallocated = unallocatedId === first.id ? first : second;

    const liveBalance = Number(env.balance);
    if (liveBalance < 0) {
      throw httpError(
        400,
        'Envelope is overdrawn; resolve the negative balance before deleting'
      );
    }

    if (liveBalance > 0) {
      const amount = Number(liveBalance.toFixed(2));
      const note = `Deleted ${env.name}`;

      await setBalance(client, env.id, 0);
      await setBalance(
        client,
        unallocated.id,
        Number(unallocated.balance) + amount
      );

      await client.query(
        `INSERT INTO transactions (type, amount, from_envelope_id, to_envelope_id, notes)
         VALUES ('transfer', $1, $2, $3, $4)`,
        [amount, env.id, unallocated.id, note]
      );
    }

    await client.query(
      `UPDATE envelopes SET deleted_at = now(), balance = 0 WHERE id = $1`,
      [env.id]
    );

    return { ok: true };
  });
}

async function lockEnvelope(client, id) {
  const { rows } = await client.query(
    `SELECT id, category_id, name, balance, target, sort_order, is_unallocated, created_at, deleted_at
     FROM envelopes
     WHERE id = $1
     FOR UPDATE`,
    [id]
  );
  if (!rows[0] || rows[0].deleted_at) {
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

function mapTransaction(row) {
  return {
    id: row.id,
    type: row.type,
    amount: money(row.amount),
    envelopeId: row.envelope_id,
    fromEnvelopeId: row.from_envelope_id,
    toEnvelopeId: row.to_envelope_id,
    notes: row.notes || null,
    createdAt: row.created_at,
    fromEnvelopeName: row.from_envelope_name || null,
    toEnvelopeName: row.to_envelope_name || null,
    envelopeName: row.envelope_name || null,
  };
}

function normalizeNotes(notes) {
  if (notes === undefined || notes === null) return null;
  const trimmed = String(notes).trim();
  return trimmed || null;
}

export async function getEnvelopeDetail(id) {
  const { rows } = await query(
    `SELECT e.id, e.category_id, e.name, e.balance, e.target, e.sort_order,
            e.is_unallocated, e.created_at, e.deleted_at, c.name AS category_name
     FROM envelopes e
     LEFT JOIN categories c ON c.id = e.category_id
     WHERE e.id = $1`,
    [id]
  );
  if (!rows[0] || rows[0].deleted_at) {
    throw httpError(404, 'Envelope not found');
  }

  const row = rows[0];
  const envelope = {
    ...mapEnvelope(row),
    categoryName: row.is_unallocated
      ? null
      : row.category_name || 'Other',
  };

  const { rows: txRows } = await query(
    `SELECT t.id, t.type, t.amount, t.envelope_id, t.from_envelope_id, t.to_envelope_id,
            t.notes, t.created_at,
            env.name AS envelope_name,
            f.name AS from_envelope_name,
            dest.name AS to_envelope_name
     FROM transactions t
     LEFT JOIN envelopes env ON env.id = t.envelope_id
     LEFT JOIN envelopes f ON f.id = t.from_envelope_id
     LEFT JOIN envelopes dest ON dest.id = t.to_envelope_id
     WHERE t.envelope_id = $1
        OR t.from_envelope_id = $1
        OR t.to_envelope_id = $1
     ORDER BY t.created_at DESC`,
    [id]
  );

  return {
    envelope,
    transactions: txRows.map(mapTransaction),
  };
}

export async function createTransaction(body) {
  const type = body.type;
  if (!['income', 'expense', 'transfer'].includes(type)) {
    throw httpError(400, 'Type must be income, expense, or transfer');
  }
  const amount = parseAmount(body.amount);
  const notes = normalizeNotes(body.notes);

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
        `INSERT INTO transactions (type, amount, envelope_id, notes)
         VALUES ($1, $2, $3, $4)
         RETURNING id, type, amount, envelope_id, from_envelope_id, to_envelope_id, notes, created_at`,
        [type, amount, env.id, notes]
      );

      return mapTransaction(rows[0]);
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
      `INSERT INTO transactions (type, amount, from_envelope_id, to_envelope_id, notes)
       VALUES ('transfer', $1, $2, $3, $4)
       RETURNING id, type, amount, envelope_id, from_envelope_id, to_envelope_id, notes, created_at`,
      [amount, from.id, to.id, notes]
    );

    return mapTransaction(rows[0]);
  });
}

export async function listTransactions(limit = 200) {
  const { rows } = await query(
    `SELECT t.id, t.type, t.amount, t.envelope_id, t.from_envelope_id, t.to_envelope_id,
            t.notes, t.created_at,
            env.name AS envelope_name,
            f.name AS from_envelope_name,
            dest.name AS to_envelope_name
     FROM transactions t
     LEFT JOIN envelopes env ON env.id = t.envelope_id
     LEFT JOIN envelopes f ON f.id = t.from_envelope_id
     LEFT JOIN envelopes dest ON dest.id = t.to_envelope_id
     ORDER BY t.created_at DESC
     LIMIT $1`,
    [Math.min(Number(limit) || 200, 500)]
  );
  return rows.map(mapTransaction);
}

async function setBalance(client, id, balance) {
  await client.query(`UPDATE envelopes SET balance = $2 WHERE id = $1`, [
    id,
    balance,
  ]);
}

function assertUnallocatedOk(env, nextBalance) {
  if (env.is_unallocated && nextBalance < -0.001) {
    throw httpError(400, 'Unallocated cannot go negative');
  }
}

/** Reverse a stored transaction's effect on locked envelope rows (map by id). */
async function reverseTxEffect(client, tx, envelopesById) {
  const amount = Number(tx.amount);
  if (tx.type === 'income') {
    const env = envelopesById.get(tx.envelope_id);
    const next = Number(env.balance) - amount;
    assertUnallocatedOk(env, next);
    env.balance = next;
    await setBalance(client, env.id, next);
    return;
  }
  if (tx.type === 'expense') {
    const env = envelopesById.get(tx.envelope_id);
    const next = Number(env.balance) + amount;
    env.balance = next;
    await setBalance(client, env.id, next);
    return;
  }
  // transfer
  const from = envelopesById.get(tx.from_envelope_id);
  const to = envelopesById.get(tx.to_envelope_id);
  const fromNext = Number(from.balance) + amount;
  const toNext = Number(to.balance) - amount;
  assertUnallocatedOk(to, toNext);
  from.balance = fromNext;
  to.balance = toNext;
  await setBalance(client, from.id, fromNext);
  await setBalance(client, to.id, toNext);
}

async function applyTxEffect(client, type, amount, envelopeId, fromId, toId, envelopesById) {
  if (type === 'income') {
    const env = envelopesById.get(envelopeId);
    const next = Number(env.balance) + amount;
    env.balance = next;
    await setBalance(client, env.id, next);
    return;
  }
  if (type === 'expense') {
    const env = envelopesById.get(envelopeId);
    const next = Number(env.balance) - amount;
    assertUnallocatedOk(env, next);
    env.balance = next;
    await setBalance(client, env.id, next);
    return;
  }
  const from = envelopesById.get(fromId);
  const to = envelopesById.get(toId);
  const fromNext = Number(from.balance) - amount;
  const toNext = Number(to.balance) + amount;
  assertUnallocatedOk(from, fromNext);
  from.balance = fromNext;
  to.balance = toNext;
  await setBalance(client, from.id, fromNext);
  await setBalance(client, to.id, toNext);
}

async function lockEnvelopeIds(client, ids) {
  const sorted = [...new Set([...ids].filter(Boolean))].sort();
  const map = new Map();
  for (const id of sorted) {
    map.set(id, await lockEnvelope(client, id));
  }
  return map;
}

async function lockEnvelopesForTx(client, tx) {
  return lockEnvelopeIds(client, [
    tx.envelope_id,
    tx.from_envelope_id,
    tx.to_envelope_id,
  ]);
}

export async function updateTransaction(id, body) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT id, type, amount, envelope_id, from_envelope_id, to_envelope_id, notes, created_at
       FROM transactions
       WHERE id = $1
       FOR UPDATE`,
      [id]
    );
    if (!rows[0]) {
      throw httpError(404, 'Transaction not found');
    }
    const tx = rows[0];

    const amount =
      body.amount !== undefined ? parseAmount(body.amount) : Number(tx.amount);
    const notes =
      body.notes !== undefined ? normalizeNotes(body.notes) : tx.notes;

    let envelopeId = tx.envelope_id;
    let fromId = tx.from_envelope_id;
    let toId = tx.to_envelope_id;

    if (tx.type === 'income' || tx.type === 'expense') {
      if (body.envelopeId !== undefined) {
        if (!body.envelopeId) {
          throw httpError(400, 'envelopeId is required');
        }
        envelopeId = body.envelopeId;
      }
      fromId = null;
      toId = null;
    } else {
      if (body.fromEnvelopeId !== undefined) fromId = body.fromEnvelopeId;
      if (body.toEnvelopeId !== undefined) toId = body.toEnvelopeId;
      if (!fromId || !toId) {
        throw httpError(400, 'fromEnvelopeId and toEnvelopeId are required');
      }
      if (fromId === toId) {
        throw httpError(400, 'Cannot transfer to the same envelope');
      }
      envelopeId = null;
    }

    const amountChanged = Number(amount) !== Number(tx.amount);
    const refsChanged =
      envelopeId !== tx.envelope_id ||
      fromId !== tx.from_envelope_id ||
      toId !== tx.to_envelope_id;

    if (amountChanged || refsChanged) {
      const envelopesById = await lockEnvelopeIds(client, [
        tx.envelope_id,
        tx.from_envelope_id,
        tx.to_envelope_id,
        envelopeId,
        fromId,
        toId,
      ]);
      await reverseTxEffect(client, tx, envelopesById);
      await applyTxEffect(
        client,
        tx.type,
        amount,
        envelopeId,
        fromId,
        toId,
        envelopesById
      );
    }

    const { rows: updated } = await client.query(
      `UPDATE transactions
       SET amount = $2, notes = $3,
           envelope_id = $4, from_envelope_id = $5, to_envelope_id = $6
       WHERE id = $1
       RETURNING id, type, amount, envelope_id, from_envelope_id, to_envelope_id, notes, created_at`,
      [id, amount, notes, envelopeId, fromId, toId]
    );
    return mapTransaction(updated[0]);
  });
}

export async function deleteTransaction(id) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT id, type, amount, envelope_id, from_envelope_id, to_envelope_id, notes, created_at
       FROM transactions
       WHERE id = $1
       FOR UPDATE`,
      [id]
    );
    if (!rows[0]) {
      throw httpError(404, 'Transaction not found');
    }
    const tx = rows[0];
    const envelopesById = await lockEnvelopesForTx(client, tx);
    await reverseTxEffect(client, tx, envelopesById);
    await client.query(`DELETE FROM transactions WHERE id = $1`, [id]);
    return { ok: true };
  });
}
