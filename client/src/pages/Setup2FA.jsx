import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth.jsx';

export default function Setup2FA() {
  const { user, refresh } = useAuth();
  const loc = useLocation();
  const nav = useNavigate();
  const pendingToken = loc.state && loc.state.pendingToken;

  const [setup, setSetup] = useState(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [backupCodes, setBackupCodes] = useState(null);

  useEffect(() => {
    if (!pendingToken) return;
    api.post('/api/auth/2fa/setup-start', { pendingToken })
      .then(setSetup)
      .catch((e) => setError(e.message));
  }, [pendingToken]);

  if (user) return <Navigate to="/" replace />;
  if (!pendingToken) return <Navigate to="/login" replace />;

  async function verify(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const res = await api.post('/api/auth/2fa/setup-verify', { pendingToken, code });
      setBackupCodes(res.backupCodes);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    await refresh();
    nav('/', { replace: true });
  }

  if (backupCodes) {
    return (
      <div className="login-page">
        <div className="login-card" style={{ maxWidth: 480 }}>
          <h1>2FA ingesteld ✓</h1>
          <p className="muted">Bewaar onderstaande backup-codes op een veilige plek (wachtwoordmanager, kluis of geprint).</p>
          <div className="error" style={{ background: '#fffbeb', color: '#92400e', borderColor: '#fcd34d' }}>
            Deze codes worden <strong>maar één keer</strong> getoond. Elke code kun je éénmaal gebruiken als je je telefoon kwijt bent.
          </div>
          <div className="card" style={{ background: '#f9fafb' }}>
            <pre style={{ fontFamily: 'ui-monospace, monospace', fontSize: '1.1em', margin: 0 }}>
              {backupCodes.join('\n')}
            </pre>
          </div>
          <button
            type="button"
            className="ghost"
            onClick={() => navigator.clipboard && navigator.clipboard.writeText(backupCodes.join('\n'))}
            style={{ marginTop: 8 }}
          >
            Kopieer naar klembord
          </button>
          <button className="primary" onClick={finish} style={{ width: '100%', marginTop: 16 }}>
            Ik heb de codes opgeslagen — ga verder
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-card" style={{ maxWidth: 480 }}>
        <h1>2FA instellen</h1>
        <p className="muted">Eenmalig: koppel een authenticator-app (Google Authenticator, Authy, 1Password, etc.).</p>
        {error && <div className="error">{error}</div>}

        {!setup ? (
          <p>Laden…</p>
        ) : (
          <>
            <ol>
              <li>Open je authenticator-app op je telefoon.</li>
              <li>Scan de QR-code hieronder, of voer de code handmatig in.</li>
              <li>Voer de 6-cijferige code in die de app toont.</li>
            </ol>

            <div style={{ textAlign: 'center', margin: '16px 0' }}>
              <img src={setup.qrDataUrl} alt="QR-code voor 2FA" style={{ maxWidth: 220 }} />
            </div>

            <div className="muted" style={{ fontSize: '0.85em', marginBottom: 16 }}>
              Handmatige invoer:{' '}
              <code style={{ fontFamily: 'ui-monospace, monospace', wordBreak: 'break-all' }}>
                {setup.secret}
              </code>
            </div>

            <form onSubmit={verify}>
              <label htmlFor="code">Verificatiecode</label>
              <input
                id="code"
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="000000"
                inputMode="numeric"
                maxLength={6}
              />
              <button className="primary" type="submit" disabled={busy} style={{ width: '100%', marginTop: 8 }}>
                {busy ? 'Bezig…' : 'Bevestigen'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
