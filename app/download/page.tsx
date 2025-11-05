// app/download/page.tsx
'use client';

import { useEffect, useState } from 'react';

export default function DownloadPage() {
  const [file, setFile] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lockKey, setLockKey] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const key = urlParams.get('key');
    if (!key) {
      setError('Missing key');
      setLoading(false);
      return;
    }

    fetch(`/api/download?key=${encodeURIComponent(key)}&info=true`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setFile(data);
      })
      .catch((err) => {
        console.error("Fetch error:", err);
        setError('Failed to fetch file info');
      })
      .finally(() => setLoading(false));
  }, []);

  function formatBytes(bytes: number) {
    if (!bytes) return 'Unknown size';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
  }

  const startDownload = () => {
    if (!file) return;
    let url = `/api/download?key=${encodeURIComponent(file.key)}`;
    if (file.locked) {
      if (!lockKey || lockKey.length < 1) {
        return alert('Enter the download key for this file.');
      }
      url += `&lock_key=${encodeURIComponent(lockKey)}`;
    }
    setIsDownloading(true);
    // navigate to API download - browser will handle stream
    window.location.href = url;
    setTimeout(() => setIsDownloading(false), 2000);
  };

  if (loading) return <p style={{ padding: 20 }}>Loading...</p>;
  if (error) return <p style={{ padding: 20, color: 'red' }}>{error}</p>;
  if (!file) return null;

  const expiresInMs = file.expires_at ? Number(file.expires_at) - Date.now() : null;
  const hoursLeft = expiresInMs ? Math.floor(Math.max(0, expiresInMs) / (1000 * 60 * 60)) : 'Unknown';

  return (
    <div style={{ padding: 20 }}>
      <h1>File Details</h1>
      <p><strong>Name:</strong> {file.file_name}</p>
      <p><strong>Size:</strong> {formatBytes(file.file_size)}</p>
      <p><strong>Uploaded:</strong> {new Date(Number(file.created_at)).toLocaleString()}</p>
      <p><strong>Expires In:</strong> {hoursLeft} hours</p>
      <p><strong>Downloads:</strong> {file.download_count} / {file.max_downloads || 'Unlimited'}</p>

      {file.locked ? (
        <div style={{ marginTop: 12 }}>
          <p>This file is locked — enter the key to download:</p>
          <input value={lockKey} onChange={(e) => setLockKey(e.target.value)} placeholder="Enter key" />
        </div>
      ) : null}

      <div style={{ marginTop: 12 }}>
        <button onClick={startDownload} disabled={isDownloading} style={{ padding: '8px 16px' }}>
          {isDownloading ? 'Preparing...' : 'Download Now'}
        </button>
      </div>
    </div>
  );
}
