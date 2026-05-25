import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import { api } from './api';
import Login from './pages/Login.jsx';
import Layout from './pages/Layout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Announcements from './pages/Announcements.jsx';
import Agenda from './pages/Agenda.jsx';
import Files from './pages/Files.jsx';
import Members from './pages/Members.jsx';
import Account from './pages/Account.jsx';

function Private({ children, role }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ padding: 24 }}>Laden…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const { user } = useAuth();
  const [sections, setSections] = useState([]);

  useEffect(() => {
    if (!user) return setSections([]);
    api.get('/api/files/sections').then(setSections).catch(() => setSections([]));
  }, [user]);

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <Private>
            <Layout sections={sections} />
          </Private>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="mededelingen" element={<Announcements />} />
        <Route path="agenda" element={<Agenda />} />
        <Route path="account" element={<Account />} />
        <Route path="files/:section" element={<Files sections={sections} />} />
        <Route
          path="bestuur/leden"
          element={<Private role="BESTUUR"><Members /></Private>}
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
