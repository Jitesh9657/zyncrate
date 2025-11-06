'use client';

import { useState, useEffect } from 'react';
import { BASE_CONFIG } from '@/lib/config'; // ✅ static fallback
import { getExpiryOptions } from '@/lib/getLimits'; // ✅ no getLimits here

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [link, setLink] = useState<string>('');
  const [expiryHours, setExpiryHours] = useState<number>(24);
  const [maxDownloads, setMaxDownloads] = useState<number>(5);
  const [oneTime, setOneTime] = useState<boolean>(false);
  const [locked, setLocked] = useState<boolean>(false);
  const [lockKey, setLockKey] = useState<string>('');
  const [expiryOptions, setExpiryOptions] = useState<number[]>([]);

  const userType = 'guest';
  const plan: string = 'free';
  const limits =
    userType === "guest"
      ? BASE_CONFIG.limits.guest
      : plan === "pro"
      ? BASE_CONFIG.limits.userPro
      : BASE_CONFIG.limits.userFree;

  useEffect(() => {
    setExpiryOptions(getExpiryOptions(userType, plan));
  }, []);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return alert('Select a file first.');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('expiry_hours', String(expiryHours));
    formData.append('max_downloads', String(maxDownloads));
    if (oneTime) formData.append('one_time', '1');
    if (locked) {
      formData.append('locked', '1');
      formData.append('lock_key', lockKey || '');
    }

    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    const data = await res.json();

    if (data.link) setLink(data.link);
    else alert(data.error || 'Upload failed');
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>Upload a File</h1>
      <p style={{ color: 'gray', marginBottom: 10 }}>
        Max upload: {limits.maxUploadSizeMB}MB | Max expiry: {limits.maxExpiryHours}h
      </p>

      <form onSubmit={handleUpload}>
        <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />

        <div style={{ marginTop: 8 }}>
          <label>Expiry:</label>
          <select
            value={expiryHours}
            onChange={(e) => setExpiryHours(Number(e.target.value))}
          >
            {expiryOptions.map((hrs) => (
              <option key={hrs} value={hrs}>
                {hrs >= 24
                  ? hrs === 168
                    ? '7 days'
                    : `${hrs / 24} days`
                  : `${hrs} hours`}
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginTop: 8 }}>
          <label>Max downloads:</label>
          <select
            value={maxDownloads}
            onChange={(e) => setMaxDownloads(Number(e.target.value))}
          >
            <option value={1}>1</option>
            <option value={3}>3</option>
            <option value={5}>5</option>
            <option value={0}>Unlimited</option>
          </select>
        </div>

        <div style={{ marginTop: 8 }}>
          <label>
            <input
              type="checkbox"
              checked={oneTime}
              onChange={(e) => setOneTime(e.target.checked)}
            />{' '}
            Delete after first download
          </label>
        </div>

        <div style={{ marginTop: 8 }}>
          <label>
            <input
              type="checkbox"
              checked={locked}
              onChange={(e) => setLocked(e.target.checked)}
            />{' '}
            Lock with key/password
          </label>
          {locked && (
            <div style={{ marginTop: 6 }}>
              <input
                placeholder="Enter a key (min 4 chars)"
                value={lockKey}
                onChange={(e) => setLockKey(e.target.value)}
              />
            </div>
          )}
        </div>

        <button type="submit" style={{ marginTop: 12 }}>
          Upload
        </button>
      </form>

      {link && (
        <div style={{ marginTop: 16 }}>
          <p>File uploaded successfully:</p>
          <a href={link} target="_blank" rel="noopener noreferrer">
            {link}
          </a>
        </div>
      )}
    </div>
  );
}
