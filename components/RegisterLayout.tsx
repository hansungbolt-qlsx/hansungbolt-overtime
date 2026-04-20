'use client';

import { useState } from 'react';
import OvertimeForm from './OvertimeForm';
import MaterialLabelsUpload from './MaterialLabelsUpload';

const todayISO = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

type Tab = 'overtime' | 'labels';

export default function RegisterLayout({ department }: { department: string }) {
  const [activeTab, setActiveTab] = useState<Tab>('overtime');
  const [labelsDate, setLabelsDate] = useState(todayISO());

  // RL không có tab Tem NVL
  if (department !== 'HD') return <OvertimeForm department={department} />;

  return (
    <>
      {/* Tab bar */}
      <div className="grid grid-cols-2 gap-1 bg-brand-surface-alt rounded-xl p-1 mb-5">
        <button
          type="button"
          onClick={() => setActiveTab('overtime')}
          className={`py-2.5 rounded-lg text-sm font-semibold transition ${
            activeTab === 'overtime'
              ? 'bg-white text-brand-navy shadow-sm'
              : 'text-brand-navy-soft hover:text-brand-navy'
          }`}
        >
          Đăng ký tăng ca
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('labels')}
          className={`py-2.5 rounded-lg text-sm font-semibold transition ${
            activeTab === 'labels'
              ? 'bg-white text-brand-navy shadow-sm'
              : 'text-brand-navy-soft hover:text-brand-navy'
          }`}
        >
          Tem NVL
        </button>
      </div>

      {activeTab === 'overtime' && <OvertimeForm department={department} />}

      {activeTab === 'labels' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-brand-surface-alt p-4">
            <label className="block text-sm font-semibold text-brand-navy mb-1.5">
              Ngày chụp tem
            </label>
            <input
              type="date"
              value={labelsDate}
              onChange={(e) => setLabelsDate(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-transparent"
            />
          </div>
          <MaterialLabelsUpload date={labelsDate} />
        </div>
      )}
    </>
  );
}
