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

export default function RegisterLayout({
  department,
  isLeader,
  currentUserFullName,
}: {
  department: string;
  isLeader: boolean;
  currentUserFullName?: string | null;
}) {
  const isHD = department === 'HD';
  // Worker RL không có tab nào để đăng ký/upload — chỉ xem tổng hợp giờ
  // Worker HD chỉ có tab Tem NVL
  // Leader HD có cả 2 tab; Leader RL chỉ có tab đăng ký
  const showOvertimeTab = isLeader;
  const showLabelsTab = isHD;
  const defaultTab: Tab = showOvertimeTab ? 'overtime' : 'labels';

  const [activeTab, setActiveTab] = useState<Tab>(defaultTab);
  const [labelsDate, setLabelsDate] = useState(todayISO());

  // Cả 2 tab cùng false → worker RL: không hiển thị section nào ở đây (summary card ở ngoài)
  if (!showOvertimeTab && !showLabelsTab) return null;

  // Chỉ 1 tab hiển thị: bỏ tab bar
  if (showOvertimeTab && !showLabelsTab) return <OvertimeForm department={department} />;
  if (!showOvertimeTab && showLabelsTab) {
    return (
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
        <MaterialLabelsUpload date={labelsDate} currentUserFullName={currentUserFullName} />
      </div>
    );
  }

  // Cả 2 tab: hiển thị tab bar
  return (
    <>
      <div className="grid grid-cols-2 gap-2 mb-5">
        <button
          type="button"
          onClick={() => setActiveTab('overtime')}
          className={`py-2.5 rounded-xl text-sm font-semibold transition border ${
            activeTab === 'overtime'
              ? 'bg-brand-teal text-white border-brand-teal shadow-md shadow-brand-teal/30'
              : 'bg-white text-brand-teal border-brand-teal/30 hover:bg-brand-teal/10'
          }`}
        >
          Đăng ký tăng ca
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('labels')}
          className={`py-2.5 rounded-xl text-sm font-semibold transition border ${
            activeTab === 'labels'
              ? 'bg-brand-navy text-white border-brand-navy shadow-md shadow-brand-navy/30'
              : 'bg-white text-brand-navy border-brand-navy/30 hover:bg-brand-navy/10'
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
          <MaterialLabelsUpload date={labelsDate} currentUserFullName={currentUserFullName} />
        </div>
      )}
    </>
  );
}
