import React, { useEffect, useState } from 'react';
import { api } from '../api';

const empty = { username: '', name: '', email: '', role: 'LEDEN', password: '' };

export default function Members() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');

  function load() {
    api.get('/api/members').then(setUsers).catch((e) => setError(e.message));
  }
  useEffect(load, []);

  function set(field, v) { setForm((f) => ({ ...f, [field]: v })); }

  async function save(e) {
    e.preventDefault();
    setError('');
    try {
      if (editing) {
        const payload = { name: form.name, email: form.email, role: form.role };
        if (form.password) payload.password = form.password;
        await api.put(`/api/members/${editing}`, payload);
      } else {
        await api.post('/api/members', form);
      }
      setForm(empty);
      setEditing(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  function edit(u) {
    setEditing(u.username);
    setForm({ username: u.username, name: u.name, email: u.email, role: u.role, password: '' });
  }

  async function del(username) {
    if (!confirm(`Account ${username} verwijderen?`)) return;
    try {
      await api.del(`/api/members/${username}`);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function reset2FA(username) {
    if (!confirm(`2FA resetten voor ${username}? Gebruiker moet opnieuw 2FA instellen bij volgende inlog.`)) return;
    try {
      await api.post(`/api/members/${username}/reset-2fa`);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  function twoFALabel(u) {
    if (u.authProvider === 'google') return 'Via Google';
    if (u.has2FA) return 'Aan';
    if (u.hasPassword) return 'Uit';
    return '—';
  }

  return (
    <>
      <h2>Leden &amp; accounts</h2>
      <p className="muted">Beheer accounts. Alleen bestuur kan deze pagina zien.</p>
      {error && <div className="error">{error}</div>}

      <form className="card" onSubmit={save}>
        <h3>{editing ? `Bewerken: ${editing}` : 'Nieuw account (wachtwoord-noodingang)'}</h3>
        <p className="muted">Voor Google-gebruikers hoef je hier niets aan te maken — zij komen automatisch bij hun eerste login. Dit formulier is voor de wachtwoord-noodingang.</p>
        <div className="grid-2">
          <div>
            <label>Gebruikersnaam</label>
            <input value={form.username} onChange={(e) => set('username', e.target.value)}
                   disabled={!!editing} required />
          </div>
          <div>
            <label>Naam</label>
            <input value={form.name} onChange={(e) => set('name', e.target.value)} />
          </div>
        </div>
        <div className="grid-2">
          <div>
            <label>E-mail</label>
            <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
          </div>
          <div>
            <label>Rol</label>
            <select value={form.role} onChange={(e) => set('role', e.target.value)}>
              <option value="LEDEN">LEDEN</option>
              <option value="BESTUUR">BESTUUR</option>
            </select>
          </div>
        </div>
        <label>{editing ? 'Nieuw wachtwoord (laat leeg om ongewijzigd te laten)' : 'Wachtwoord'}</label>
        <input type="password" value={form.password} onChange={(e) => set('password', e.target.value)}
               required={!editing} minLength={editing ? 0 : 6} />
        <div className="row">
          <button className="primary">{editing ? 'Opslaan' : 'Account aanmaken'}</button>
          {editing && (
            <button className="ghost" type="button" onClick={() => { setEditing(null); setForm(empty); }}>
              Annuleren
            </button>
          )}
        </div>
      </form>

      <div className="card">
        <h3>Accounts</h3>
        {users.length === 0 ? (
          <div className="empty">Geen accounts.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Gebruikersnaam</th><th>Naam</th><th>E-mail</th><th>Rol</th><th>Inlogmethode</th><th>2FA</th><th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.username}>
                  <td>{u.username}</td>
                  <td>{u.name}</td>
                  <td>{u.email || '—'}</td>
                  <td><span className={`role-badge ${u.role === 'BESTUUR' ? 'bestuur' : ''}`}>{u.role}</span></td>
                  <td>{u.authProvider === 'google' ? 'Google' : 'Wachtwoord'}</td>
                  <td>{twoFALabel(u)}</td>
                  <td className="actions">
                    <button className="ghost" onClick={() => edit(u)}>Bewerken</button>{' '}
                    {u.has2FA && u.authProvider !== 'google' && (
                      <>
                        <button className="ghost" onClick={() => reset2FA(u.username)}>Reset 2FA</button>{' '}
                      </>
                    )}
                    <button className="danger" onClick={() => del(u.username)}>Verwijderen</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
