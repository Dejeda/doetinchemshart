import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth.jsx';

const empty = { title: '', date: '', time: '', location: '', description: '', visibility: 'ALL' };

export default function Agenda() {
  const { user } = useAuth();
  const isBestuur = user.role === 'BESTUUR';
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');

  function load() {
    api.get('/api/agenda').then(setItems).catch((e) => setError(e.message));
  }
  useEffect(load, []);

  function set(field, v) { setForm((f) => ({ ...f, [field]: v })); }

  async function save(e) {
    e.preventDefault();
    setError('');
    try {
      if (editingId) {
        await api.put(`/api/agenda/${editingId}`, form);
      } else {
        await api.post('/api/agenda', form);
      }
      setForm(empty);
      setEditingId(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  function editItem(item) {
    setEditingId(item.id);
    setForm({
      title: item.title, date: item.date, time: item.time || '',
      location: item.location || '', description: item.description || '',
      visibility: item.visibility || 'ALL',
    });
  }

  async function del(id) {
    if (!confirm('Weet je zeker dat je dit item wilt verwijderen?')) return;
    await api.del(`/api/agenda/${id}`);
    load();
  }

  return (
    <>
      <h2>Agenda</h2>
      {error && <div className="error">{error}</div>}

      {isBestuur && (
        <form className="card" onSubmit={save}>
          <h3>{editingId ? 'Item bewerken' : 'Nieuw agenda-item'}</h3>
          <label>Titel</label>
          <input value={form.title} onChange={(e) => set('title', e.target.value)} required />
          <div className="grid-2">
            <div>
              <label>Datum</label>
              <input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} required />
            </div>
            <div>
              <label>Tijd</label>
              <input type="time" value={form.time} onChange={(e) => set('time', e.target.value)} />
            </div>
          </div>
          <label>Locatie</label>
          <input value={form.location} onChange={(e) => set('location', e.target.value)} />
          <label>Omschrijving</label>
          <textarea rows="3" value={form.description} onChange={(e) => set('description', e.target.value)} />
          <label>Zichtbaarheid</label>
          <select value={form.visibility} onChange={(e) => set('visibility', e.target.value)}>
            <option value="ALL">Iedereen (leden + bestuur)</option>
            <option value="BESTUUR">Alleen bestuur</option>
          </select>
          <div className="row">
            <button className="primary" type="submit">{editingId ? 'Opslaan' : 'Toevoegen'}</button>
            {editingId && (
              <button className="ghost" type="button" onClick={() => { setEditingId(null); setForm(empty); }}>
                Annuleren
              </button>
            )}
          </div>
        </form>
      )}

      <div className="card">
        <h3>Alle items</h3>
        {items.length === 0 ? (
          <div className="empty">Geen agenda-items.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Datum</th>
                <th>Titel</th>
                <th>Locatie</th>
                <th>Zichtbaarheid</th>
                {isBestuur && <th></th>}
              </tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.id}>
                  <td>{a.date}{a.time ? ` ${a.time}` : ''}</td>
                  <td>
                    <strong>{a.title}</strong>
                    {a.description && <div className="muted">{a.description}</div>}
                  </td>
                  <td>{a.location || '—'}</td>
                  <td>{a.visibility === 'BESTUUR' ? 'Bestuur' : 'Iedereen'}</td>
                  {isBestuur && (
                    <td className="actions">
                      <button className="ghost" onClick={() => editItem(a)}>Bewerken</button>{' '}
                      <button className="danger" onClick={() => del(a.id)}>Verwijderen</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
