import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import {
  asyncHandler,
  errorHandler,
  requireApiKey,
} from './middleware.js';
import * as queries from './queries.js';

const app = express();
const port = Number(process.env.PORT) || 3000;

const corsOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: corsOrigins.length ? corsOrigins : true,
  })
);
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

const api = express.Router();
api.use(requireApiKey);

api.get(
  '/envelopes',
  asyncHandler(async (_req, res) => {
    const overview = await queries.getBudgetOverview();
    res.json(overview);
  })
);

api.get(
  '/envelopes/:id',
  asyncHandler(async (req, res) => {
    const detail = await queries.getEnvelopeDetail(req.params.id);
    res.json(detail);
  })
);

api.post(
  '/envelopes',
  asyncHandler(async (req, res) => {
    const envelope = await queries.createEnvelope({
      name: req.body.name,
      target: req.body.target,
      categoryId: req.body.categoryId,
      sortOrder: req.body.sortOrder,
    });
    res.status(201).json(envelope);
  })
);

api.patch(
  '/envelopes/:id',
  asyncHandler(async (req, res) => {
    const envelope = await queries.updateEnvelope(req.params.id, {
      name: req.body.name,
      target: req.body.target,
      categoryId: req.body.categoryId,
      sortOrder: req.body.sortOrder,
    });
    res.json(envelope);
  })
);

api.delete(
  '/envelopes/:id',
  asyncHandler(async (req, res) => {
    await queries.deleteEnvelope(req.params.id);
    res.status(204).end();
  })
);

api.get(
  '/categories',
  asyncHandler(async (_req, res) => {
    const categories = await queries.listCategories();
    res.json(categories);
  })
);

api.post(
  '/categories',
  asyncHandler(async (req, res) => {
    const category = await queries.createCategory({
      name: req.body.name,
      sortOrder: req.body.sortOrder,
    });
    res.status(201).json(category);
  })
);

api.post(
  '/transactions',
  asyncHandler(async (req, res) => {
    const tx = await queries.createTransaction(req.body);
    res.status(201).json(tx);
  })
);

api.patch(
  '/transactions/:id',
  asyncHandler(async (req, res) => {
    const tx = await queries.updateTransaction(req.params.id, req.body);
    res.json(tx);
  })
);

api.delete(
  '/transactions/:id',
  asyncHandler(async (req, res) => {
    await queries.deleteTransaction(req.params.id);
    res.status(204).end();
  })
);

api.get(
  '/transactions',
  asyncHandler(async (req, res) => {
    const txs = await queries.listTransactions(req.query.limit);
    res.json(txs);
  })
);

app.use('/api/v1', api);
app.use(errorHandler);

app.listen(port, () => {
  console.log(`Rich Life API listening on http://localhost:${port}`);
});
