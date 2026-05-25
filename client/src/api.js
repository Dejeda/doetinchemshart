async function request(method, url, body) {
  const opts = {
    method,
    credentials: 'include',
    headers: {},
  };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(url, opts);
  const text = await res.text();
  const data = text ? safeParse(text) : null;
  if (!res.ok) {
    const msg = (data && data.error) || res.statusText || 'Onbekende fout';
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return data;
}

function safeParse(t) {
  try { return JSON.parse(t); } catch { return t; }
}

export const api = {
  get: (url) => request('GET', url),
  post: (url, body) => request('POST', url, body),
  put: (url, body) => request('PUT', url, body),
  del: (url) => request('DELETE', url),
  downloadUrl: (section, fileId) => `/api/files/download/${section}/${encodeURIComponent(fileId)}`,
};
