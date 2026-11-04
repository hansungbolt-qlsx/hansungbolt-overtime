'use client';

import {
  PM_HOURS_MAX, PM_HOURS_MIN, PM_HOURS_QUICK, hoursText, isValidPmHours, parseHoursInput, pmPresetFor,
} from '@/lib/overtime-shift';

// Chọn số giờ tăng ca CHIỀU cho từng nhân viên (anh Hữu 04/11/2026): 3h / 4h / Khác.
// Bắt đầu luôn 16:30, giờ kết thúc tự tính và hiện ngay dưới nút để tổ trưởng kiểm lại.
// Dùng chung cho form đăng ký (OvertimeForm) và form sửa phiếu của tổ trưởng (LeaderEditForm).
// 04/11 chiều: nút to hơn ~20% cho dễ bấm; ô nhập "Khác" chữ 16px — dưới 16px iPhone tự phóng to trang.

export type HoursChoice = { choice: 3 | 4 | 'other'; otherText: string };

export const DEFAULT_HOURS: HoursChoice = { choice: 3, otherText: '' };

/** Giờ mặc định cho các nhân viên thêm sau (anh Hữu 04/11/2026): Nhân viên 1 chọn 4h → ô sau mặc định 4h;
 *  Nhân viên 1 chọn 3h hoặc Khác → ô sau mặc định 3h. Ô nào tổ trưởng đã tự bấm thì giữ nguyên. */
export function theoNhanVien1(h: HoursChoice | null | undefined): HoursChoice {
  return h?.choice === 4 ? { choice: 4, otherText: '' } : DEFAULT_HOURS;
}

/** Số giờ đang chọn; "Khác" gõ sai/thiếu → null. */
export function hoursOf(h: HoursChoice): number | null {
  if (h.choice !== 'other') return h.choice;
  const v = parseHoursInput(h.otherText);
  return isValidPmHours(v) ? v : null;
}

/** Số giờ đã lưu → trạng thái nút (3/4 → nút nhanh, còn lại → Khác). */
export function choiceFromHours(h: number): HoursChoice {
  return h === 3 || h === 4 ? { choice: h, otherText: '' } : { choice: 'other', otherText: hoursText(h) };
}

export const HOURS_RULE_TEXT = `từ ${hoursText(PM_HOURS_MIN)} đến ${PM_HOURS_MAX} giờ, bước 0,5 giờ`;

export default function HoursPicker({
  value: valueIn,
  onChange,
  kept,
}: {
  value: HoursChoice;
  onChange: (v: HoursChoice) => void;
  /** Màn sửa phiếu: giờ đang lưu không biểu diễn được bằng nút (admin đã sửa tay, vd. 17:00–19:30)
   *  → không nút nào sáng, hiện nguyên giờ đang lưu; bấm nút nào thì mới đổi. */
  kept?: string | null;
}) {
  const value: HoursChoice = kept ? { choice: 'other', otherText: '' } : valueIn;
  const h = hoursOf(value);
  const end = h != null ? pmPresetFor(h).time_to.slice(0, 5) : null;
  const typed = value.choice === 'other' && value.otherText.trim() !== '';
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-1">
        {PM_HOURS_QUICK.map((q) => {
          const active = !kept && value.choice === q;
          return (
            <button
              key={q}
              type="button"
              onClick={() => onChange({ choice: q, otherText: value.otherText })}
              className={`px-3 py-[5px] rounded-md border text-sm font-bold transition ${
                active
                  ? 'bg-brand-teal text-white border-brand-teal'
                  : 'bg-white text-brand-navy border-gray-300 hover:border-brand-teal'
              }`}
            >
              {q}h
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => onChange({ choice: 'other', otherText: value.otherText })}
          className={`px-3 py-[5px] rounded-md border text-sm font-bold transition ${
            !kept && value.choice === 'other'
              ? 'bg-brand-teal text-white border-brand-teal'
              : 'bg-white text-brand-navy border-gray-300 hover:border-brand-teal'
          }`}
        >
          Khác
        </button>
      </div>
      <div className="flex items-center gap-1.5">
        {kept ? (
          <span className="text-[11px] font-semibold text-brand-navy whitespace-nowrap">
            Đang lưu: {kept}
          </span>
        ) : value.choice === 'other' && (
          <>
            <input
              type="text"
              inputMode="decimal"
              autoFocus
              value={value.otherText}
              onChange={(e) => onChange({ choice: 'other', otherText: e.target.value })}
              placeholder="Số giờ"
              className={`w-20 px-2 py-1 text-base border rounded focus:outline-none focus:ring-1 focus:ring-brand-teal bg-white ${
                typed && h == null ? 'border-red-400' : 'border-gray-300'
              }`}
            />
            <span className="text-[11px] text-brand-navy-soft">giờ</span>
          </>
        )}
        {kept ? null : end ? (
          <span className="text-[11px] font-semibold text-brand-teal whitespace-nowrap">
            16:30 – {end}
          </span>
        ) : (
          <span className="text-[11px] text-red-600 whitespace-nowrap">
            {typed ? 'Số giờ không hợp lệ' : 'Nhập số giờ'}
          </span>
        )}
      </div>
    </div>
  );
}
