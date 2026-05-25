import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';

function formatSize(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function Files({ sections }) {
  const params = useParams();
  const sectionKey = params.section;
  const section = (sections || []).find((s) => s.key === sectionKey);
  const title = section ? section.label : sectionKey;

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const d = await api.get(`/api/files/list/${sectionKey}`);
      setEntries(d.entries);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [sectionKey]);

  return (
    <>
      <h2>{title}</h2>
      <p className="muted">
        Bestanden uit Google Drive. Nieuwe bestanden toevoegen of verwijderen doe je direct in Google Drive
        zelf (vereniging Drive-account). De app toont automatisch de actuele lijst.
      </p>

      {error && <div className="error">{error}</div>}

      <div className="card">
        {loading ? (
          <div>Laden…</div>
        ) : entries.length === 0 ? (
          <div className="empty">Geen bestanden in deze map.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Bestand</th>
                <th>Gewijzigd</th>
                <th>Grootte</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td>{e.name}</td>
                  <td>{new Date(e.modified).toLocaleString('nl-NL')}</td>
                  <td>{formatSize(e.size)}</td>
                  <td className="actions">
                    <a className="btn-primary" style={{ padding: '0.4rem 0.8rem', borderRadius: 6 }}
                       href={api.downloadUrl(sectionKey, e.id)}>
                      Download
                    </a>
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
