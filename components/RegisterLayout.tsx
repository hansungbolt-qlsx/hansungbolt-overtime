'use client';

import { useState } from 'react';
import OvertimeForm from './OvertimeForm';
import MaterialLabelsUpload from './MaterialLabelsUpload';
import OvertimeSummaryCard from './OvertimeSummaryCard';
import DepartmentRegistrationsList from './DepartmentRegistrationsList';
import TodayOvertimeCard from './TodayOvertimeCard';

const todayISO = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

type Tab = 'overtime' | 'labels' | 'summary' | 'today';

function OvertimeView({ department, isLeader }: { department: string; isLeader: boolean }) {
  return (
    <div className="space-y-6">
      {isLeader && <OvertimeForm department={department} />}
      <DepartmentRegistrationsList canEdit={isLeader} />
      <OvertimeSummaryCard />
    </div>
  );
}

function LabelsView({
  labelsDate,
  setLabelsDate,
  currentUserFullName,
}: {
  labelsDate: string;
  setLabelsDate: (d: string) => void;
  currentUserFullName?: string | null;
}) {
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
  // Tab "overtime" cho leader; tab "summary" cho worker (chỉ xem)
  // Tab "labels" cho HD (cả leader + worker)
  // Tab "today" — xem tổng hợp NV tăng ca cả HD+RL hôm nay (cả leader + worker)
  const showOvertimeTab = isLeader;
  const showSummaryTab = !isLeader;
  const showLabelsTab = isHD;
  const showTodayTab = true;
  const defaultTab: Tab = showOvertimeTab ? 'overtime' : showLabelsTab ? 'labels' : 'summary';

  const [activeTab, setActiveTab] = useState<Tab>(defaultTab);
  const [labelsDate, setLabelsDate] = useState(todayISO());

  const tabs: Array<{ key: Tab; label: string; color: 'teal' | 'navy' | 'green' }> = [];
  if (showOvertimeTab) tabs.push({ key: 'overtime', label: 'Đăng ký tăng ca', color: 'teal' });
  if (showSummaryTab) tabs.push({ key: 'summary', label: 'Tổng hợp tăng ca', color: 'teal' });
  if (showLabelsTab) tabs.push({ key: 'labels', label: 'Tem NVL', color: 'navy' });
  if (showTodayTab) tabs.push({ key: 'today', label: 'Tăng ca hôm nay', color: 'green' });

  // Chỉ 1 tab → bỏ tab bar, render trực tiếp
  if (tabs.length === 1) {
    if (tabs[0].key === 'overtime' || tabs[0].key === 'summary') {
      return <OvertimeView department={department} isLeader={isLeader} />;
    }
    if (tabs[0].key === 'today') return <TodayOvertimeCard />;
    return (
      <LabelsView
        labelsDate={labelsDate}
        setLabelsDate={setLabelsDate}
        currentUserFullName={currentUserFullName}
      />
    );
  }

  const cols =
    tabs.length === 2 ? 'grid-cols-2' : tabs.length === 3 ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-4';

  return (
    <>
      <div className={`grid ${cols} gap-2 mb-5`}>
        {tabs.map((t) => {
          const active = activeTab === t.key;
          const activeCls =
            t.color === 'teal'
              ? 'bg-brand-teal text-white border-brand-teal shadow-md shadow-brand-teal/30'
              : t.color === 'navy'
                ? 'bg-brand-navy text-white border-brand-navy shadow-md shadow-brand-navy/30'
                : 'bg-brand-green text-brand-navy border-brand-green shadow-md shadow-brand-green/30';
          const inactiveCls =
            t.color === 'teal'
              ? 'bg-white text-brand-teal border-brand-teal/30 hover:bg-brand-teal/10'
              : t.color === 'navy'
                ? 'bg-white text-brand-navy border-brand-navy/30 hover:bg-brand-navy/10'
                : 'bg-white text-brand-navy border-brand-green/50 hover:bg-brand-green/10';
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key)}
              className={`py-2.5 rounded-xl text-sm font-semibold transition border ${
                active ? activeCls : inactiveCls
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {(activeTab === 'overtime' || activeTab === 'summary') && (
        <OvertimeView department={department} isLeader={isLeader} />
      )}

      {activeTab === 'labels' && (
        <LabelsView
          labelsDate={labelsDate}
          setLabelsDate={setLabelsDate}
          currentUserFullName={currentUserFullName}
        />
      )}

      {activeTab === 'today' && <TodayOvertimeCard />}
    </>
  );
}
