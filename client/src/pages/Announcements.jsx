import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth.jsx';

export default function Announcements() {
  const { user } = useAuth();
  const isBestuur = user.role === 'BESTUUR';
  const [items, setItems] = useState([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState('');

  function load() {
    api.get('/api/announcements').then(setItems).catch((e) => setError(e.message));
  }
  useEffect(load, []);

  async function add(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/api/announcements', { title, body });
      setTitle(''); setBody('');
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function del(id) {
    if (!confirm('Mededeling verwijderen?')) return;
    await api.del(`/api/announcements/${id}`);
    load();
  }

  return (
    <>
      <h2>Mededelingen</h2>
      {error && <div className="error">{error}</div>}

      {isBestuur && (
        <form className="card" onSubmit={add}>
          <h3>Nieuwe mededeling</h3>
          <label>Titel</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required />
          <label>Bericht</label>
          <textarea rows="4" value={body} onChange={(e) => setBody(e.target.value)} required />
          <button className="primary">Plaatsen</button>
        </form>
      )}

      {items.length === 0 ? (
        <div className="empty">Geen mededelingen.</div>
      ) : (
        items.map((m) => (
          <div className="card" key={m.id}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0 }}>{m.title}</h3>
              {isBestuur && <button className="danger" onClick={() => del(m.id)}>Verwijderen</button>}
            </div>
            <div className="muted" style={{ marginBottom: '0.5rem' }}>
              {new Date(m.createdAt).toLocaleString('nl-NL')} — {m.createdBy}
            </div>
            <div style={{ whiteSpace: 'pre-wrap' }}>{m.body}</div>
          </div>
        ))
      )}
    </>
  );
}
