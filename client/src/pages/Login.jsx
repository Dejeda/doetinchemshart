import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function Login() {
  const { user, login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();

  if (user) return <Navigate to="/" replace />;

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(username, password);
      nav('/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={submit}>
        <h1>Doetinchems Hart</h1>
        <p className="muted">Log in om verder te gaan.</p>
        {error && <div className="error">{error}</div>}
        <label htmlFor="username">Gebruikersnaam</label>
        <input id="username" autoFocus value={username} onChange={(e) => setUsername(e.target.value)} />
        <label htmlFor="password">Wachtwoord</label>
        <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button className="primary" type="submit" disabled={busy} style={{ width: '100%' }}>
          {busy ? 'Bezig…' : 'Inloggen'}
        </button>
        <p className="hint">Geen toegang? Vraag een bestuurslid om een account aan te maken.</p>
      </form>
    </div>
  );
}
