import React, { useState } from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth.jsx';

export default function Verify2FA() {
  const { user, refresh } = useAuth();
  const loc = useLocation();
  const nav = useNavigate();
  const pendingToken = loc.state && loc.state.pendingToken;

  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (user) return <Navigate to="/" replace />;
  if (!pendingToken) return <Navigate to="/login" replace />;

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await api.post('/api/auth/2fa/login-verify', { pendingToken, code });
      await refresh();
      nav('/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card" style={{ maxWidth: 420 }}>
        <h1>Verificatie</h1>
        <p className="muted">Voer de 6-cijferige code uit je authenticator-app in, of gebruik een backup-code.</p>
        {error && <div className="error">{error}</div>}
        <form onSubmit={submit}>
          <label htmlFor="code">Code</label>
          <input
            id="code"
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="000000 of XXXXX-XXXXX"
            autoComplete="one-time-code"
          />
          <button className="primary" type="submit" disabled={busy} style={{ width: '100%', marginTop: 8 }}>
            {busy ? 'Bezig…' : 'Verifiëren'}
          </button>
        </form>
      </div>
    </div>
  );
}
