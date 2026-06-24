import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth-server';
import { expandMachineCode, parseSheet } from '@/lib/parse-plan';

export const runtime = 'nodejs';

const STORAGE_BUCKET = 'plan-files';
const MAX_KEPT_FILES = 3;

async function ensureBucket(): Promise<{ ok: true } | { error: string }> {
  const { data: buckets, error: listErr } = await supabaseAdmin.storage.listBuckets();
  if (listErr) return { error: listErr.message };
  if ((buckets ?? []).some((b) => b.name === STORAGE_BUCKET)) {
    return { ok: true };
  }
  const { error: createErr } = await supabaseAdmin.storage.createBucket(
    STORAGE_BUCKET,
    {
      public: false,
      fileSizeLimit: 10 * 1024 * 1024, // 10MB
      allowedMimeTypes: [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'application/octet-stream',
      ],
    },
  );
  if (createErr && !createErr.message.toLowerCase().includes('already exists')) {
    return { error: createErr.message };
  }
  return { ok: true };
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Chưa đăng nhập hoặc không có quyền' }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get('file');
  const sheetName = form.get('sheet');
  const planDate = form.get('plan_date');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Thiếu file' }, { status: 400 });
  }

  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });

  // Inspect mode: chưa chọn sheet → trả về danh sách sheets
  if (typeof sheetName !== 'string' || !sheetName) {
    return NextResponse.json({ sheets: wb.SheetNames });
  }

  if (typeof planDate !== 'string' || !planDate) {
    return NextResponse.json({ error: 'Thiếu ngày kế hoạch' }, { status: 400 });
  }

  const sheet = wb.Sheets[sheetName];
  if (!sheet) {
    return NextResponse.json(
      { error: `Không tìm thấy sheet "${sheetName}"` },
      { status: 400 },
    );
  }

  let parsed;
  try {
    parsed = parseSheet(sheet);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Lỗi parse sheet';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { data: knownEqs, error: eqErr } = await supabaseAdmin
    .from('equipments')
    .select('code')
    .eq('department', 'HD');
  if (eqErr) {
    return NextResponse.json({ error: eqErr.message }, { status: 500 });
  }
  const knownCodes = new Set((knownEqs ?? []).map((e) => e.code));

  const records: Array<{
    plan_date: string;
    equipment_code: string;
    item_code: string;
  }> = [];
  const warnings: string[] = [];

  for (const row of parsed) {
    const codes = expandMachineCode(row.machineShort);
    if (codes.length === 0) {
      warnings.push(`Bỏ qua máy "${row.machineShort}" (không parse được)`);
      continue;
    }
    for (const code of codes) {
      if (!knownCodes.has(code)) {
        warnings.push(`Bỏ qua máy "${code}" (không có trong danh sách thiết bị)`);
        continue;
      }
      records.push({
        plan_date: planDate,
        equipment_code: code,
        item_code: row.itemCode,
      });
    }
  }

  const { error: delErr } = await supabaseAdmin
    .from('daily_plans')
    .delete()
    .eq('plan_date', planDate);
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  if (records.length > 0) {
    const { error: insErr } = await supabaseAdmin.from('daily_plans').insert(records);
    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }
  }

  // -----------------------------------------------------------
  // Lưu file gốc lên Storage + ghi metadata vào plan_files
  // Forward-compat: nếu migration 10 chưa chạy hoặc bucket fail
  // → vẫn return success cho phần parse (không block flow chính).
  // -----------------------------------------------------------
  let fileSavedNote: string | null = null;
  try {
    const bucketRes = await ensureBucket();
    if ('error' in bucketRes) {
      fileSavedNote = `Không tạo được bucket: ${bucketRes.error}`;
    } else {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `${planDate}/${Date.now()}-${safeName}`;
      const fileBuffer = Buffer.from(buf);
      const { error: uploadErr } = await supabaseAdmin.storage
        .from(STORAGE_BUCKET)
        .upload(storagePath, fileBuffer, {
          contentType:
            file.type ||
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          upsert: false,
        });
      if (uploadErr) {
        fileSavedNote = `Upload Storage lỗi: ${uploadErr.message}`;
      } else {
        // Xóa file cũ trùng plan_date (nếu có) — sau khi upload mới thành công
        const { data: oldSameDate } = await supabaseAdmin
          .from('plan_files')
          .select('id, storage_path')
          .eq('plan_date', planDate);
        if (oldSameDate && oldSameDate.length > 0) {
          const paths = oldSameDate.map((f) => f.storage_path);
          await supabaseAdmin.storage.from(STORAGE_BUCKET).remove(paths);
          await supabaseAdmin
            .from('plan_files')
            .delete()
            .in(
              'id',
              oldSameDate.map((f) => f.id),
            );
        }

        // Insert metadata mới
        const { error: insMetaErr } = await supabaseAdmin
          .from('plan_files')
          .insert({
            plan_date: planDate,
            file_name: file.name,
            storage_path: storagePath,
            sheet_name: sheetName,
            file_size_bytes: file.size,
            uploaded_by: session.userId,
          });
        if (insMetaErr) {
          fileSavedNote = `Lưu metadata lỗi: ${insMetaErr.message} (Có thể migration 10 chưa chạy)`;
          // Rollback file đã upload Storage
          await supabaseAdmin.storage.from(STORAGE_BUCKET).remove([storagePath]);
        } else {
          // Cleanup: nếu > MAX_KEPT_FILES plan_dates → xóa cũ nhất
          const { data: all } = await supabaseAdmin
            .from('plan_files')
            .select('id, plan_date, storage_path')
            .order('plan_date', { ascending: false });
          if (all && all.length > MAX_KEPT_FILES) {
            const toDelete = all.slice(MAX_KEPT_FILES);
            const paths = toDelete.map((f) => f.storage_path);
            await supabaseAdmin.storage.from(STORAGE_BUCKET).remove(paths);
            await supabaseAdmin
              .from('plan_files')
              .delete()
              .in(
                'id',
                toDelete.map((f) => f.id),
              );
          }
        }
      }
    }
  } catch (e) {
    fileSavedNote = `Lưu file gốc lỗi: ${e instanceof Error ? e.message : String(e)}`;
  }

  const distinctMachines = new Set(records.map((r) => r.equipment_code)).size;

  return NextResponse.json({
    inserted: records.length,
    distinct_machines: distinctMachines,
    warnings,
    plan_date: planDate,
    sheet: sheetName,
    file_saved_note: fileSavedNote,
  });
}
