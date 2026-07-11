import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth-server';
import { expireStalePrintJobs } from '@/lib/print-jobs-expire';

export const runtime = 'nodejs';

// Giờ hành chính (VN) — chỉ nhận lệnh in trong khoảng này
const OFFICE_HOURS_START = 8; // 08:00
const OFFICE_HOURS_END = 17; // 17:00 (< 17)

function isWithinOfficeHours(): boolean {
  // Server timezone có thể khác VN → tính giờ VN qua offset +7
  const now = new Date();
  const utcHours = now.getUTCHours();
  const vnHours = (utcHours + 7) % 24;
  return vnHours >= OFFICE_HOURS_START && vnHours < OFFICE_HOURS_END;
}

// POST /api/print-jobs — tổ trưởng / admin tạo job in
// Body: { type: 'registration' | 'labels_day', ref_id: string }
//   registration: ref_id = registration.id (uuid)
//   labels_day: ref_id = 'YYYY-MM-DD' (in tất cả tem của ngày đó)
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
  }
  if (session.role !== 'admin' && session.role !== 'leader') {
    return NextResponse.json({ error: 'Không có quyền in' }, { status: 403 });
  }

  if (!isWithinOfficeHours()) {
    return NextResponse.json(
      {
        error:
          'Máy in đang tắt ngoài giờ hành chính. Chỉ in được từ 8h-17h.',
      },
      { status: 400 },
    );
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'Body JSON không hợp lệ' }, { status: 400 });
  }

  const { type } = body as { type?: string; ref_id?: string };
  let ref_id = (body as { ref_id?: string }).ref_id;
  if (
    type !== 'registration' &&
    type !== 'labels_day' &&
    type !== 'overtime_summary'
  ) {
    return NextResponse.json(
      { error: 'type phải là registration / labels_day / overtime_summary' },
      { status: 400 },
    );
  }
  if (!ref_id || typeof ref_id !== 'string') {
    return NextResponse.json({ error: 'Thiếu ref_id' }, { status: 400 });
  }

  // Validate ref_id + check quyền theo dept
  if (type === 'registration') {
    const { data: reg } = await supabaseAdmin
      .from('overtime_registrations')
      .select('id, department')
      .eq('id', ref_id)
      .maybeSingle();
    if (!reg) {
      return NextResponse.json({ error: 'Không tìm thấy phiếu' }, { status: 404 });
    }
    // Leader chỉ in được phiếu bộ phận mình
    if (
      session.role === 'leader' &&
      session.department !== reg.department
    ) {
      return NextResponse.json(
        { error: 'Chỉ in được phiếu của bộ phận mình' },
        { status: 403 },
      );
    }
  } else if (type === 'labels_day') {
    // labels_day: ref_id là YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ref_id)) {
      return NextResponse.json(
        { error: 'ref_id phải là YYYY-MM-DD' },
        { status: 400 },
      );
    }
    // Chỉ HD mới có tem
    if (session.role === 'leader' && session.department !== 'HD') {
      return NextResponse.json(
        { error: 'Chỉ leader HD in được tem NVL' },
        { status: 403 },
      );
    }
  } else if (type === 'overtime_summary') {
    // overtime_summary: ref_id = 'YYYY-MM' hoặc 'YYYY-MM|DEPT'
    const match = ref_id.match(/^(\d{4}-\d{2})(?:\|(HD|RL|QLSX))?$/);
    if (!match) {
      return NextResponse.json(
        { error: 'ref_id phải là YYYY-MM hoặc YYYY-MM|HD/RL/QLSX' },
        { status: 400 },
      );
    }
    const month = match[1];
    let dept: string | null = match[2] ?? null;
    // Leader không truyền dept -> auto điền dept của mình.
    // Leader truyền dept khác -> reject.
    if (session.role === 'leader') {
      if (!dept) {
        dept = session.department ?? null;
        if (!dept) {
          return NextResponse.json(
            { error: 'Leader không có bộ phận' },
            { status: 400 },
          );
        }
        ref_id = `${month}|${dept}`;
      } else if (dept !== session.department) {
        return NextResponse.json(
          { error: 'Leader chỉ in được tổng hợp bộ phận của mình' },
          { status: 403 },
        );
      }
    }
  }

  // Dọn job quá 2 phút trước, rồi mới xét trùng — job còn lại chắc chắn
  // đang "sống" (mới gửi hoặc đang in thật) nên dedupe an toàn tuyệt đối.
  await expireStalePrintJobs();

  // Chống gửi trùng: nếu đã có job giống hệt đang chờ/đang in thì trả về job đó
  // thay vì tạo mới — người dùng bấm lại nhiều lần khi chưa thấy giấy ra sẽ
  // không làm máy in ra nhiều bản giống nhau.
  const { data: dup } = await supabaseAdmin
    .from('print_jobs')
    .select('id, type, ref_id, status, created_at')
    .eq('type', type)
    .eq('ref_id', ref_id)
    .in('status', ['pending', 'printing'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (dup) {
    return NextResponse.json({ job: dup, duplicate: true });
  }

  const { data: job, error } = await supabaseAdmin
    .from('print_jobs')
    .insert({
      type,
      ref_id,
      requested_by: session.userId,
      status: 'pending',
    })
    .select('id, type, ref_id, status, created_at')
    .single();

  if (error || !job) {
    return NextResponse.json(
      {
        error:
          error?.message ??
          'Không tạo được job. Có thể migration 11 chưa chạy trên Supabase.',
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ job });
}

// GET /api/print-jobs?status=pending — agent poll (auth Bearer AGENT_SECRET)
// Trả về tối đa 5 job cùng lúc để agent xử lý tuần tự
export async function GET(req: Request) {
  const auth = req.headers.get('authorization') ?? '';
  const secret = process.env.AGENT_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: 'AGENT_SECRET chưa được cấu hình trên server' },
      { status: 500 },
    );
  }
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Sai AGENT_SECRET' }, { status: 401 });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get('status') ?? 'pending';
  if (status !== 'pending') {
    return NextResponse.json({ error: 'status chỉ hỗ trợ pending' }, { status: 400 });
  }

  // Dọn job quá 2 phút TRƯỚC khi trả danh sách — agent không bao giờ nhận
  // được lệnh đã tự hủy, nên không có chuyện bản in cũ bất ngờ chạy ra sau.
  await expireStalePrintJobs();

  const { data, error } = await supabaseAdmin
    .from('print_jobs')
    .select('id, type, ref_id, requested_by, status, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(5);

  if (error) {
    return NextResponse.json({ jobs: [], warning: error.message });
  }
  return NextResponse.json({ jobs: data ?? [] });
}
