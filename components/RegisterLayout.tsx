'use client';

import { useEffect, useState } from 'react';
import { datDangNhapDo } from '@/lib/dang-nhap-do';
import OvertimeForm from './OvertimeForm';
import MaterialLabelsUpload from './MaterialLabelsUpload';
import OvertimeSummaryCard from './OvertimeSummaryCard';
import DepartmentRegistrationsList from './DepartmentRegistrationsList';
import TodayOvertimeCard from './TodayOvertimeCard';
import PlanView from './PlanView';
import StopReasonsView from './StopReasonsView';
import WarehouseSlipView from './WarehouseSlipView';
import CoDailyView from './CoDailyView';
import CoDccdCard from './CoDccdCard';
import CoProdSummaryView from './CoProdSummaryView';
import NvlCanhBaoCard from './NvlCanhBaoCard';
import DateButton from './DateButton';
import { chanNeuChuaLuu } from '@/lib/nvl-slips';
import { REMIND_DEADLINE, isoVN, remindDue } from '@/lib/stop-carry-shared';

// Nhắc tổ trưởng RL kiểm tra máy dừng (anh Hữu 06/11/2026): đã mở tab Máy dừng hôm nay
// thì ghi nhớ ngày vào máy (localStorage) — bị chặn/không có thì coi như chưa mở.
const STOP_SEEN_KEY = 'may-dung-da-kiem-tra';
function stopSeenToday(): boolean {
  try {
    return window.localStorage.getItem(STOP_SEEN_KEY) === isoVN();
  } catch {
    return false;
  }
}
function markStopSeen() {
  try {
    window.localStorage.setItem(STOP_SEEN_KEY, isoVN());
  } catch {
    /* trình duyệt chặn lưu → lần sau vẫn nhắc, không sao */
  }
}

const todayISO = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

type Tab = 'overtime' | 'labels' | 'summary' | 'today' | 'plan' | 'dccd' | 'co_day' | 'ab_day' | 'prod_sum' | 'stops' | 'wh_out' | 'wh_in';

function OvertimeView({ department, isLeader }: { department: string; isLeader: boolean }) {
  return (
    <div className="space-y-3">
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
    <div className="space-y-3">
      {/* Nhãn + ô ngày cùng 1 hàng (anh Hữu 07/11/2026) */}
      <div className="bg-white rounded-xl shadow-sm border border-brand-surface-alt px-3 py-2 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-brand-navy">Ngày chụp tem</span>
        <DateButton value={labelsDate} onChange={(v) => v && setLabelsDate(v)} />
      </div>
      <MaterialLabelsUpload date={labelsDate} currentUserFullName={currentUserFullName} />
    </div>
  );
}

export default function RegisterLayout({
  department,
  isLeader,
  isQlsx = false,
  currentUserFullName,
}: {
  department: string;
  isLeader: boolean;
  isQlsx?: boolean;
  currentUserFullName?: string | null;
}) {
  const isHD = department === 'HD';
  // Tab "overtime" cho leader; tab "summary" cho worker (chỉ xem)
  // Tab "labels" cho HD (cả leader + worker)
  // Tab "today" — xem tổng hợp NV tăng ca cả HD+RL hôm nay (cả leader + worker)
  // qlsx (user 24/7): KHSX + Máy dừng (chỉ xem) + Tổng hợp; KHÔNG tem/đăng ký
  const isCO = department === 'CO';
  const showOvertimeTab = isLeader;
  // Tổ trưởng CO có thêm tab Tổng hợp tăng ca riêng (anh Hữu 06/10/2026) — trước chỉ nằm cuối tab Đăng ký
  const showSummaryTab = !isLeader || isCO;
  const showLabelsTab = isHD;
  const showTodayTab = true;
  // KHSX: tổ trưởng xem + in (user 13/7). CO (anh Hữu 05/10/2026): KHÔNG xem KHSX, chỉ tab 'In phiếu DCCD' công đoạn 86
  const showPlanTab = (isLeader && !isCO) || isQlsx;
  // In phiếu DCCD: cả 4 người CO (anh Hữu 06/10/2026; trước chỉ tổ trưởng)
  const showDccdTab = isCO;
  // Sản lượng CO hàng ngày (anh Hữu 05/10/2026): cả 4 người CO (tổ trưởng + nhân viên) nhập được
  // + Sản lượng AB công đoạn 84 và Tổng hợp sản lượng theo ngày (06/10/2026), cũng cả 4 người
  const showCoDayTab = isCO;
  // Máy dừng: tổ trưởng HD/RL ghi; qlsx xem (24/7). CO (Coating, anh Hữu 05/10/2026) KHÔNG có tab này.
  const showStopsTab = (isLeader && department !== 'CO') || isQlsx;
  // Xuất/Trả kho NPL (user 28/7): nhân viên kho dùng role qlsx. App chính là chủ
  // kho — 2 tab này chỉ GỬI YÊU CẦU, duyệt bên app chính mới trừ/cộng tồn.
  const showWarehouseTabs = isQlsx;
  const defaultTab: Tab = showOvertimeTab
    ? 'overtime'
    : isQlsx
      ? 'plan'   // QLSX vào là thấy ngay KHSX (việc chính của họ)
      : showLabelsTab
        ? 'labels'
        : 'summary';

  const [activeTab, setActiveTab] = useState<Tab>(defaultTab);
  const [labelsDate, setLabelsDate] = useState(todayISO());
  /**
   * Số dòng phiếu kho đang treo CHƯA LƯU, do `WarehouseSlipView` báo lên
   * (vá 14/08/2026 — mất 6 dòng S18A của anh Cường).
   *
   * Nút chuyển tab nằm ở ĐÂY, còn giỏ dòng nằm trong màn kho; mà chạm tab là
   * React tháo luôn màn kho ⇒ dòng chưa lưu bay sạch, không kịp cảnh báo gì.
   * Nên cờ phải chạy ngược lên đây thì mới chặn được ĐÚNG LÚC — trước khi đổi tab.
   */
  const [khoChuaLuu, setKhoChuaLuu] = useState('');
  // Nhắc máy dừng: chỉ tổ trưởng RL; tính lại mỗi phút (qua 15:30 tự hiện)
  const remindOn = isLeader && department === 'RL' && showStopsTab;
  const [stopRemind, setStopRemind] = useState(false);
  useEffect(() => {
    if (!remindOn) return;
    if (activeTab === 'stops') markStopSeen();
    const tinh = () => setStopRemind(remindDue() && !stopSeenToday());
    tinh();
    const id = window.setInterval(tinh, 60 * 1000);
    return () => window.clearInterval(id);
  }, [remindOn, activeTab]);
  // Phiếu kho còn dòng chưa lưu → TaiBanMoi không tự tải lại trang (anh Hữu 04/11/2026)
  useEffect(() => {
    datDangNhapDo('phieu-kho', khoChuaLuu !== '');
    return () => datDangNhapDo('phieu-kho', false);
  }, [khoChuaLuu]);

  const tabs: Array<{ key: Tab; label: string; color: 'teal' | 'navy' | 'green' | 'red' }> = [];
  if (showOvertimeTab) tabs.push({ key: 'overtime', label: 'Đăng ký tăng ca', color: 'teal' });
  if (showSummaryTab) tabs.push({ key: 'summary', label: 'Tổng hợp tăng ca', color: 'teal' });
  if (showLabelsTab) tabs.push({ key: 'labels', label: 'Tem NVL', color: 'navy' });
  if (showTodayTab) tabs.push({ key: 'today', label: 'Tăng ca hôm nay', color: 'green' });
  if (showPlanTab) tabs.push({ key: 'plan', label: 'Kế hoạch SX', color: 'navy' });
  if (showDccdTab) tabs.push({ key: 'dccd', label: 'In phiếu DCCD', color: 'navy' });
  if (showCoDayTab) {
    tabs.push({ key: 'co_day', label: 'Sản lượng CO', color: 'red' });
    tabs.push({ key: 'ab_day', label: 'Sản lượng AB', color: 'red' });
    tabs.push({ key: 'prod_sum', label: 'Tổng hợp sản lượng', color: 'green' });
  }
  if (showStopsTab) tabs.push({ key: 'stops', label: 'Máy dừng hôm nay', color: 'red' });
  const moTabMayDung = () => {
    if (activeTab === 'stops') return;
    if (!chanNeuChuaLuu(khoChuaLuu)) return;
    setActiveTab('stops');
  };
  if (showWarehouseTabs) {
    tabs.push({ key: 'wh_out', label: '📤 Xuất kho', color: 'teal' });
    tabs.push({ key: 'wh_in', label: '📥 Trả kho', color: 'green' });
  }

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
    tabs.length === 2
      ? 'grid-cols-2'
      : tabs.length === 3
        ? 'grid-cols-3'
        : tabs.length === 4
          ? 'grid-cols-2 sm:grid-cols-4'
          : 'grid-cols-3'; // ≥5 tab: 3 cột mọi khổ (trang chỉ rộng max-w-lg) — chữ không tràn

  return (
    <>
      {/* Cảnh báo nhầm NVL theo KHSX hôm nay — mọi user HD; chỉ tổ trưởng chia sẻ Zalo (anh Hữu 30/10/2026) */}
      {isHD && <NvlCanhBaoCard canShare={isLeader} />}
      {stopRemind && (
        <button
          type="button"
          onClick={moTabMayDung}
          className="w-full mb-3 rounded-xl bg-red-600 text-white text-sm font-bold px-4 py-3 text-left shadow-md shadow-red-600/30 animate-pulse"
        >
          ⏸ Chưa kiểm tra danh sách máy dừng hôm nay — hạn {REMIND_DEADLINE}. Bấm vào đây để kiểm
          tra.
        </button>
      )}
      <div className={`grid ${cols} gap-1.5 mb-3`}>
        {tabs.map((t) => {
          const active = activeTab === t.key;
          const activeCls =
            t.color === 'teal'
              ? 'bg-brand-teal text-white border-brand-teal shadow-md shadow-brand-teal/30'
              : t.color === 'navy'
                ? 'bg-brand-navy text-white border-brand-navy shadow-md shadow-brand-navy/30'
                : t.color === 'red'
                  ? 'bg-red-600 text-white border-red-600 shadow-md shadow-red-600/30'
                  : 'bg-brand-green text-brand-navy border-brand-green shadow-md shadow-brand-green/30';
          const inactiveCls =
            t.color === 'teal'
              ? 'bg-white text-brand-teal border-brand-teal/30 hover:bg-brand-teal/10'
              : t.color === 'navy'
                ? 'bg-white text-brand-navy border-brand-navy/30 hover:bg-brand-navy/10'
                : t.color === 'red'
                  ? 'bg-white text-red-600 border-red-300 hover:bg-red-50'
                  : 'bg-white text-brand-navy border-brand-green/50 hover:bg-brand-green/10';
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => {
                if (t.key === activeTab) return;
                // Đang ở màn kho mà còn việc dở (dòng chưa Lưu, hoặc cuộn mới
                // tick chưa bấm ➕) → CHẶN HẲN, hộp một nút, bắt quay lại xử lý.
                if (!chanNeuChuaLuu(khoChuaLuu)) return;
                setActiveTab(t.key);
              }}
              className={`px-0.5 py-2 rounded-xl text-[12.5px] leading-tight tracking-tight whitespace-nowrap font-semibold transition border ${
                active ? activeCls : inactiveCls
              }`}
            >
              {t.label}
              {t.key === 'stops' && stopRemind && (
                <span
                  className="ml-1.5 inline-block w-2.5 h-2.5 rounded-full bg-red-600 ring-2 ring-white align-middle"
                  aria-label="Chưa kiểm tra"
                />
              )}
            </button>
          );
        })}
      </div>

      {(activeTab === 'overtime' || (activeTab === 'summary' && !isLeader)) && (
        <OvertimeView department={department} isLeader={isLeader} />
      )}

      {/* Tổ trưởng (CO): tab Tổng hợp chỉ có bảng tổng hợp tháng của tổ */}
      {activeTab === 'summary' && isLeader && <OvertimeSummaryCard />}

      {activeTab === 'labels' && (
        <LabelsView
          labelsDate={labelsDate}
          setLabelsDate={setLabelsDate}
          currentUserFullName={currentUserFullName}
        />
      )}

      {activeTab === 'today' && <TodayOvertimeCard />}

      {activeTab === 'plan' && (
        <PlanView department={department} isLeader={isLeader} isQlsx={isQlsx} />
      )}

      {activeTab === 'dccd' && <CoDccdCard />}

      {/* key theo công đoạn: đổi tab CO ↔ AB là dựng lại màn (không dùng lẫn danh sách LOT / phiếu) */}
      {activeTab === 'co_day' && <CoDailyView key="86" stage="86" canSend={isLeader} currentUserFullName={currentUserFullName} />}
      {activeTab === 'ab_day' && <CoDailyView key="84" stage="84" canSend={isLeader} currentUserFullName={currentUserFullName} />}
      {activeTab === 'prod_sum' && <CoProdSummaryView />}

      {activeTab === 'stops' && <StopReasonsView readOnly={isQlsx} department={department} />}

      {activeTab === 'wh_out' && <WarehouseSlipView kind="issue" onChuaLuu={setKhoChuaLuu} />}
      {activeTab === 'wh_in' && <WarehouseSlipView kind="return" onChuaLuu={setKhoChuaLuu} />}
    </>
  );
}
