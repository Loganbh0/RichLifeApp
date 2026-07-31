const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1';
const API_KEY = import.meta.env.VITE_API_KEY || '';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  getBudget: () => request('/envelopes'),
  listCategories: () => request('/categories'),
  createCategory: (body) =>
    request('/categories', { method: 'POST', body: JSON.stringify(body) }),
  createEnvelope: (body) =>
    request('/envelopes', { method: 'POST', body: JSON.stringify(body) }),
  updateEnvelope: (id, body) =>
    request(`/envelopes/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  createTransaction: (body) =>
    request('/transactions', { method: 'POST', body: JSON.stringify(body) }),
};
