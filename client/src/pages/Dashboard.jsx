import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth.jsx';

export default function Dashboard() {
  const { user } = useAuth();
  const [agenda, setAgenda] = useState([]);
  const [announcements, setAnnouncements] = useState([]);

  useEffect(() => {
    api.get('/api/agenda').then(setAgenda).catch(() => {});
    api.get('/api/announcements').then(setAnnouncements).catch(() => {});
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = agenda.filter((a) => (a.date || '') >= today).slice(0, 5);
  const latest = announcements.slice(0, 3);

  return (
    <>
      <h2>Welkom, {user.name}</h2>
      <p className="muted">
        {user.role === 'BESTUUR'
          ? 'Je hebt toegang tot alle onderdelen, inclusief het bestuursplatform.'
          : 'Hier vind je activiteiten en mededelingen voor leden.'}
      </p>

      <div className="card">
        <h3>Komende agenda</h3>
        {upcoming.length === 0 ? (
          <div className="empty">Geen geplande items.</div>
        ) : (
          <ul>
            {upcoming.map((a) => (
              <li key={a.id}>
                <strong>{a.date}{a.time ? ` ${a.time}` : ''}</strong> — {a.title}
                {a.location ? ` (${a.location})` : ''}
              </li>
            ))}
          </ul>
        )}
        <Link to="/agenda">Alle agenda-items →</Link>
      </div>

      <div className="card">
        <h3>Laatste mededelingen</h3>
        {latest.length === 0 ? (
          <div className="empty">Nog geen mededelingen.</div>
        ) : (
          latest.map((m) => (
            <div key={m.id} style={{ marginBottom: '0.75rem' }}>
              <strong>{m.title}</strong>
              <div className="muted">{new Date(m.createdAt).toLocaleString('nl-NL')}</div>
              <div>{m.body}</div>
            </div>
          ))
        )}
        <Link to="/mededelingen">Alle mededelingen →</Link>
      </div>
    </>
  );
}
