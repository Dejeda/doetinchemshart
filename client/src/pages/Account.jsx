import React, { useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth.jsx';

export default function Account() {
  const { user, refresh } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pwdMsg, setPwdMsg] = useState('');
  const [pwdError, setPwdError] = useState('');

  const [disableCode, setDisableCode] = useState('');
  const [disableError, setDisableError] = useState('');
  const [disableMsg, setDisableMsg] = useState('');

  const [regenCode, setRegenCode] = useState('');
  const [regenError, setRegenError] = useState('');
  const [newBackupCodes, setNewBackupCodes] = useState(null);

  async function submitPassword(e) {
    e.preventDefault();
    setPwdMsg(''); setPwdError('');
    if (next !== confirm) return setPwdError('Nieuwe wachtwoorden komen niet overeen.');
    if (next.length < 6) return setPwdError('Nieuw wachtwoord moet minimaal 6 tekens zijn.');
    try {
      await api.post('/api/auth/change-password', { currentPassword: current, newPassword: next });
      setPwdMsg('Wachtwoord gewijzigd.');
      setCurrent(''); setNext(''); setConfirm('');
    } catch (err) {
      setPwdError(err.message);
    }
  }

  async function disable2FA(e) {
    e.preventDefault();
    setDisableError(''); setDisableMsg('');
    try {
      await api.post('/api/auth/2fa/disable', { code: disableCode });
      setDisableMsg('2FA uitgeschakeld. Bij je volgende inlog moet je opnieuw instellen.');
      setDisableCode('');
      await refresh();
    } catch (err) {
      setDisableError(err.message);
    }
  }

  async function regenerateBackup(e) {
    e.preventDefault();
    setRegenError(''); setNewBackupCodes(null);
    try {
      const res = await api.post('/api/auth/2fa/regenerate-backup', { code: regenCode });
      setNewBackupCodes(res.backupCodes);
      setRegenCode('');
    } catch (err) {
      setRegenError(err.message);
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

      {user.hasPassword ? (
        <>
          <div className="card">
            <h3>Twee-factor-authenticatie (2FA)</h3>
            {user.has2FA ? (
              <>
                <p className="muted">2FA staat aan. Je hebt bij elke inlog een code uit je authenticator-app nodig.</p>

                <form onSubmit={disable2FA} style={{ marginTop: 16 }}>
                  <h4>2FA uitschakelen</h4>
                  {disableError && <div className="error">{disableError}</div>}
                  {disableMsg && <div className="error" style={{ background: '#ecfdf5', color: '#065f46' }}>{disableMsg}</div>}
                  <label>Huidige 6-cijferige code</label>
                  <input
                    value={disableCode}
                    onChange={(e) => setDisableCode(e.target.value)}
                    placeholder="000000"
                    inputMode="numeric"
                    maxLength={6}
                  />
                  <button className="danger" type="submit">Schakel 2FA uit</button>
                </form>

                <form onSubmit={regenerateBackup} style={{ marginTop: 24 }}>
                  <h4>Backup-codes opnieuw genereren</h4>
                  <p className="muted">Oude backup-codes worden ongeldig. Nieuwe codes worden eenmalig getoond.</p>
                  {regenError && <div className="error">{regenError}</div>}
                  <label>Huidige 6-cijferige code</label>
                  <input
                    value={regenCode}
                    onChange={(e) => setRegenCode(e.target.value)}
                    placeholder="000000"
                    inputMode="numeric"
                    maxLength={6}
                  />
                  <button className="ghost" type="submit">Genereer nieuwe codes</button>
                </form>

                {newBackupCodes && (
                  <div className="card" style={{ marginTop: 16, background: '#fffbeb' }}>
                    <p><strong>Nieuwe backup-codes</strong> — kopieer en bewaar veilig:</p>
                    <pre style={{ fontFamily: 'ui-monospace, monospace', fontSize: '1.05em', margin: 0 }}>
                      {newBackupCodes.join('\n')}
                    </pre>
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => navigator.clipboard && navigator.clipboard.writeText(newBackupCodes.join('\n'))}
                      style={{ marginTop: 8 }}
                    >
                      Kopieer naar klembord
                    </button>
                  </div>
                )}
              </>
            ) : (
              <p className="muted">2FA staat uit. Bij je volgende wachtwoord-inlog word je gevraagd om 2FA in te stellen.</p>
            )}
          </div>

          <form className="card" onSubmit={submitPassword}>
            <h3>Wachtwoord wijzigen</h3>
            {pwdMsg && <div className="error" style={{ background: '#ecfdf5', color: '#065f46' }}>{pwdMsg}</div>}
            {pwdError && <div className="error">{pwdError}</div>}
            <label>Huidig wachtwoord</label>
            <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
            <label>Nieuw wachtwoord</label>
            <input type="password" value={next} onChange={(e) => setNext(e.target.value)} required minLength={6} />
            <label>Bevestig nieuw wachtwoord</label>
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={6} />
            <button className="primary">Opslaan</button>
          </form>
        </>
      ) : (
        <div className="card">
          <h3>Inlogmethode</h3>
          <p>Je logt in met je Google-account. Wij beheren geen wachtwoord voor jou.</p>
          <p className="muted">
            Voor optimale beveiliging: zet 2-staps-verificatie aan op je Google-account via{' '}
            <a href="https://myaccount.google.com/security" target="_blank" rel="noopener noreferrer">
              myaccount.google.com/security
            </a>
            .
          </p>
        </div>
      )}
    </>
  );
}
