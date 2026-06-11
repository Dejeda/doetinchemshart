import React, { useState } from 'react';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function Login() {
  const { user, login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const nav = useNavigate();
  const loc = useLocation();

  if (user) return <Navigate to="/" replace />;

  const params = new URLSearchParams(loc.search);
  const oauthError = params.get('login_error');

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const data = await login(username, password);
      if (data && data.requires2FASetup) {
        nav('/setup-2fa', { replace: true, state: { pendingToken: data.pendingToken } });
      } else if (data && data.requires2FA) {
        nav('/verify-2fa', { replace: true, state: { pendingToken: data.pendingToken } });
      } else {
        nav('/', { replace: true });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>Doetinchems Hart</h1>
        <p className="muted">Log in om verder te gaan.</p>

        {oauthError && <div className="error">{oauthError}</div>}
        {error && <div className="error">{error}</div>}

        <a
          className="primary"
          href="/api/auth/google/start"
          style={{
            display: 'block',
            textAlign: 'center',
            textDecoration: 'none',
            padding: '10px 14px',
            marginBottom: 12,
          }}
        >
          Inloggen met Google
        </a>

        <button
          type="button"
          onClick={() => setShowPwd((s) => !s)}
          style={{
            background: 'none',
            border: 'none',
            color: '#666',
            cursor: 'pointer',
            padding: 0,
            fontSize: '0.9em',
            textDecoration: 'underline',
          }}
        >
          {showPwd ? 'Verberg wachtwoord-inlog' : 'Inloggen met wachtwoord (noodingang)'}
        </button>

        {showPwd && (
          <form onSubmit={submit} style={{ marginTop: 12 }}>
            <label htmlFor="username">Gebruikersnaam</label>
            <input id="username" autoFocus value={username} onChange={(e) => setUsername(e.target.value)} />
            <label htmlFor="password">Wachtwoord</label>
            <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <button className="primary" type="submit" disabled={busy} style={{ width: '100%' }}>
              {busy ? 'Bezig…' : 'Inloggen'}
            </button>
          </form>
        )}

        <p className="hint">Geen toegang? Vraag een bestuurslid om je e-mailadres toe te voegen.</p>
      </div>
    </div>
  );
}
