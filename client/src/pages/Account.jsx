import React, { useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth.jsx';

export default function Account() {
  const { user } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setMsg(''); setError('');
    if (next !== confirm) return setError('Nieuwe wachtwoorden komen niet overeen.');
    if (next.length < 6) return setError('Nieuw wachtwoord moet minimaal 6 tekens zijn.');
    try {
      await api.post('/api/auth/change-password', { currentPassword: current, newPassword: next });
      setMsg('Wachtwoord gewijzigd.');
      setCurrent(''); setNext(''); setConfirm('');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <h2>Mijn account</h2>
      <div className="card">
        <p><strong>Gebruikersnaam:</strong> {user.username}</p>
        <p><strong>Naam:</strong> {user.name}</p>
        <p><strong>Rol:</strong> <span className={`role-badge ${user.role === 'BESTUUR' ? 'bestuur' : ''}`}>{user.role}</span></p>
      </div>

      <form className="card" onSubmit={submit}>
        <h3>Wachtwoord wijzigen</h3>
        {msg && <div className="error" style={{ background: '#ecfdf5', color: '#065f46' }}>{msg}</div>}
        {error && <div className="error">{error}</div>}
        <label>Huidig wachtwoord</label>
        <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
        <label>Nieuw wachtwoord</label>
        <input type="password" value={next} onChange={(e) => setNext(e.target.value)} required minLength={6} />
        <label>Bevestig nieuw wachtwoord</label>
        <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={6} />
        <button className="primary">Opslaan</button>
      </form>
    </>
  );
}
