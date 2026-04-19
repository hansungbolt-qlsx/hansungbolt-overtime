'use client';

import { useState, type ChangeEvent, type FormEvent } from 'react';
import Link from 'next/link';

type UploadResult = {
  inserted: number;
  distinct_machines: number;
  warnings: string[];
  plan_date: string;
  sheet: string;
};

export default function UploadPlanPage() {
  const [file, setFile] = useState<File | null>(null);
  const [sheets, setSheets] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState('');
  const [planDate, setPlanDate] = useState(new Date().toISOString().slice(0, 10));
  const [inspecting, setInspecting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<UploadResult | null>(null);

  async function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    setFile(f ?? null);
    setSheets([]);
    setSelectedSheet('');
    setResult(null);
    setError('');
    if (!f) return;

    setInspecting(true);
    try {
      const form = new FormData();
      form.append('file', f);
      const res = await fetch('/api/upload-plan', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Không đọc được file');
        return;
      }
      setSheets(data.sheets);
      setSelectedSheet(data.sheets[0] ?? '');
    } catch {
      setError('Không kết nối được máy chủ');
    } finally {
      setInspecting(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file || !selectedSheet || !planDate) return;
    setUploading(true);
    setError('');
    setResult(null);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('sheet', selectedSheet);
      form.append('plan_date', planDate);
      const res = await fetch('/api/upload-plan', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Có lỗi xảy ra');
        return;
      }
      setResult(data as UploadResult);
    } catch {
      setError('Không kết nối được máy chủ');
    } finally {
      setUploading(false);
    }
  }

  return (
    <main className="min-h-screen p-4 md:p-8 bg-gray-50">
      <header className="max-w-3xl mx-auto mb-6">
        <Link href="/dashboard" className="text-sm text-gray-600 hover:underline">
          ← Quay về Dashboard
        </Link>
        <h1 className="text-2xl font-bold mt-2">Upload kế hoạch sản xuất</h1>
        <p className="text-sm text-gray-500 mt-1">
          Chọn file Q401-02, chọn sheet và ngày kế hoạch. Nếu ngày này đã có kế hoạch
          cũ, dữ liệu cũ sẽ bị thay thế.
        </p>
      </header>

      <form
        onSubmit={onSubmit}
        className="max-w-3xl mx-auto bg-white rounded-xl shadow p-6 space-y-5"
      >
        <div>
          <label className="block text-sm font-medium mb-1">File Excel (.xlsx)</label>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={onFileChange}
            className="block w-full text-sm border border-gray-300 rounded-md file:mr-3 file:py-2 file:px-3 file:border-0 file:bg-gray-100 file:text-sm"
          />
          {inspecting && (
            <p className="text-xs text-gray-500 mt-1">Đang đọc file…</p>
          )}
        </div>

        {sheets.length > 0 && (
          <div>
            <label className="block text-sm font-medium mb-1">Chọn sheet</label>
            <select
              value={selectedSheet}
              onChange={(e) => setSelectedSheet(e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {sheets.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              File có {sheets.length} sheet. Chọn sheet chứa kế hoạch ngày cần upload.
            </p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">Ngày kế hoạch</label>
          <input
            type="date"
            value={planDate}
            onChange={(e) => setPlanDate(e.target.value)}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            required
          />
        </div>

        {error && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 p-3 rounded">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={!file || !selectedSheet || !planDate || uploading}
          className="w-full sm:w-auto bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-medium py-2.5 px-6 rounded-md transition"
        >
          {uploading ? 'Đang xử lý…' : 'Upload & Parse'}
        </button>
      </form>

      {result && (
        <section className="max-w-3xl mx-auto mt-6 bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-semibold mb-3">Kết quả</h2>
          <div className="space-y-1 text-sm">
            <p>
              ✅ Đã nạp <strong>{result.inserted}</strong> dòng cho ngày{' '}
              <strong>{result.plan_date}</strong> (sheet{' '}
              <code className="bg-gray-100 px-1 rounded">{result.sheet}</code>)
            </p>
            <p>
              Bao phủ <strong>{result.distinct_machines}</strong> máy HD khác nhau
            </p>
            {result.warnings.length > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer text-amber-700">
                  ⚠️ {result.warnings.length} cảnh báo
                </summary>
                <ul className="mt-2 ml-4 list-disc text-xs text-gray-600 space-y-0.5">
                  {result.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
