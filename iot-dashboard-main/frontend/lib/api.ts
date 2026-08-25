const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

function authHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('iot_token') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handle(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed with status ${res.status}`);
  return data;
}

export async function apiGet(path: string) {
  const res = await fetch(`${API_URL}${path}`, { headers: { ...authHeaders() } });
  return handle(res);
}

export async function apiPost(path: string, body: unknown) {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  });
  return handle(res);
}

export async function apiPatch(path: string, body: unknown) {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  });
  return handle(res);
}

export async function apiDelete(path: string) {
  const res = await fetch(`${API_URL}${path}`, { method: 'DELETE', headers: { ...authHeaders() } });
  return handle(res);
}

/** Triggers a browser download for export endpoints (PDF/Excel), auth header included via fetch+blob. */
export async function downloadFile(path: string, filename: string) {
  const res = await fetch(`${API_URL}${path}`, { headers: { ...authHeaders() } });
  if (!res.ok) throw new Error('Export failed.');
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export { API_URL };
