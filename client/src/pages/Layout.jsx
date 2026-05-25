import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function Layout({ sections = [] }) {
  const { user, logout } = useAuth();
  const isBestuur = user.role === 'BESTUUR';

  return (
    <div className="layout">
      <aside className="sidebar">
        <h1><span className="heart">♥</span> Doetinchems Hart</h1>
        <div className="section">Algemeen</div>
        <nav>
          <NavLink to="/" end>Dashboard</NavLink>
          <NavLink to="/mededelingen">Mededelingen</NavLink>
          <NavLink to="/agenda">Agenda</NavLink>
        </nav>

        {sections.length > 0 && (
          <>
            <div className="section">Mappen</div>
            <nav>
              {sections.map((s) => (
                <NavLink key={s.key} to={`/files/${s.key}`}>{s.label}</NavLink>
              ))}
            </nav>
          </>
        )}

        {isBestuur && (
          <>
            <div className="section">Beheer</div>
            <nav>
              <NavLink to="/bestuur/leden">Leden &amp; accounts</NavLink>
            </nav>
          </>
        )}

        <div className="footer">
          <div>{user.name}</div>
          <div className="muted">
            <span className={`role-badge ${isBestuur ? 'bestuur' : ''}`}>{user.role}</span>
          </div>
          <NavLink to="/account" style={{ display: 'block', marginTop: '0.5rem', color: '#d1d5db' }}>
            Mijn account
          </NavLink>
          <button onClick={logout}>Uitloggen</button>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
