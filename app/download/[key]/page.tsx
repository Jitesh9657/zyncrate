'use client';

import { useEffect, useState } from 'react';

interface FileInfo {
  file_name: string;
  created_at: number;
  expires_in: number;
  download_count: number;
  max_downloads: number;
}

export default function DownloadPage({ params }: { params: { key: string } }) {
  const [file, setFile] = useState<FileInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    async function fetchFile() {
      try {
        const res = await fetch(`/api/file-info?key=${params.key}`);
        const data = await res.json();
        if (res.ok) setFile(data);
        else setError(data.error || 'File not found');
      } catch (err: any) {
        setError(err.message);
      }
    }
    fetchFile();
  }, [params.key]);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      window.location.href = `/api/download?key=${params.key}`;
    } catch (err) {
      console.error(err);
    } finally {
      setTimeout(() => setIsDownloading(false), 2000);
    }
  };

  if (error) return <div className="p-6 text-red-500">❌ {error}</div>;
  if (!file) return <div className="p-6 text-gray-500">Loading file info...</div>;

  const expiresIn = Math.max(0, file.expires_in - (Date.now() - file.created_at));
  const hoursLeft = Math.floor(expiresIn / (1000 * 60 * 60));
  const downloadsLeft = file.max_downloads - file.download_count;

  return (
    <div className="max-w-md mx-auto mt-10 p-6 border rounded-lg shadow-md">
      <h1 className="text-xl font-semibold mb-2">📄 {file.file_name}</h1>
      <p className="text-gray-600 text-sm mb-4">
        Expires in: <b>{hoursLeft}h</b> • Downloads left: <b>{downloadsLeft}</b>
      </p>

      <button
        onClick={handleDownload}
        disabled={isDownloading}
        className={`w-full py-2 mt-2 rounded-md text-white ${
          isDownloading ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'
        }`}
      >
        {isDownloading ? 'Preparing...' : 'Download Now'}
      </button>
    </div>
  );
}
