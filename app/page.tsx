"use client";
import { useState } from "react";

export default function Home() {
  const [fileName, setFileName] = useState(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) setFileName(file.name);
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-gray-50 to-gray-100 text-gray-800 p-6">
      {/* Header */}
      <header className="w-full text-center mb-10">
        <h1 className="text-3xl font-bold">Zyncrate</h1>
        <p className="text-sm text-gray-500 mt-1">Temporary File Sharing — Simple, Private, Fast</p>
      </header>

      {/* Upload Box */}
      <div className="bg-white shadow-md rounded-2xl p-8 w-full max-w-md text-center">
        <h2 className="text-lg font-semibold mb-4">Upload your file</h2>

        <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl p-6 cursor-pointer hover:border-blue-400 transition">
          <input type="file" onChange={handleFileChange} className="hidden" />
          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5-5m0 0l5 5m-5-5v12" />
          </svg>
          <span className="text-gray-600">{fileName ? fileName : "Click to select a file"}</span>
        </label>

        {fileName && (
          <button className="mt-5 px-5 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition">
            Upload (Coming Soon)
          </button>
        )}
      </div>

      {/* Footer */}
      <footer className="mt-10 text-xs text-gray-400">
        Built with ❤️ using Next.js & Cloudflare
      </footer>
    </main>
  );
}
