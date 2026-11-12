'use client';

// Quét mã vạch tem cuộn NVL / phiếu di chuyển (dùng ở Xuất kho NVL, CO quét LOT, Gia công).
//
// 🔴 VIẾT LẠI 07/11/2026 (anh Hữu duyệt) — html5-qrcode cũ "hầu như không ăn" mã 1D:
//   · đo thật trên 5 tem mẫu NCC: html5-qrcode quét trực tiếp mã 1D 0/8; zxing-wasm 10/10.
//   · nguyên nhân: html5-qrcode thu nhỏ khung về ~640 px + bộ giải mã ZXing-js yếu với 1D.
// Cách làm mới:
//   1. Bộ đọc zxing-wasm (lib/barcode-reader.ts) — chạy cả iPhone lẫn Android. Android có
//      BarcodeDetector của hệ điều hành thì chạy SONG SONG, bên nào ra trước lấy bên đó.
//   2. Camera xin 1920×1080, Android bật lấy nét liên tục; nút 🔦 đèn; Android có thanh zoom
//      (iPhone Safari không cho web zoom camera).
//   3. KHUNG CHỮ NHẬT dẹt kiểu mã vạch (12:5): video hiển thị cắt đúng phần giữa, và CHỈ
//      giải mã đúng phần đang thấy, ở độ phân giải gốc (không thu nhỏ) ⇒ thấy gì đọc nấy.
//      Cứ 5 khung thì đọc cả khung hình 1 lần để bắt QR Vĩnh Thành (vuông) nằm lệch khung.
//      2 cách tách đen/trắng xen kẽ từng khung (xem lib/barcode-reader.ts).
//   4. Code39 (Nhuận Thái, phiếu di chuyển) không có số kiểm tra ⇒ đọc trùng 2 lần mới nhận.
//   5. Đọc được: rung (Android) + tiếng bíp.
//   6. Vẫn giữ "📸 Chụp ảnh tem" (camera gốc của máy) — giải mã ảnh bằng zxing-wasm.
//
// ⚠ Bố cục CHỐNG VỠ (bài học 28/7): khung cố định cả màn hình, đầu (Đóng) và chân (nút) không
// co ⇒ nút thoát luôn nhìn thấy.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ConfirmGate,
  NATIVE_FORMATS,
  loadZxing,
  nativeFormatName,
  readFrame,
  readPhotoPart,
  type ScanHit,
} from '@/lib/barcode-reader';

// Tỉ lệ khung quét (rộng : cao). Dẹt kiểu mã vạch nhưng vẫn đủ cao cho QR khi đứng xa ~20 cm.
const BOX_W = 12;
const BOX_H = 5;
// Cạnh dài tối đa của ảnh đưa vào bộ đọc (giữ nét, không để khung 4K làm chậm máy yếu)
const MAX_SIDE = 1920;
// Cứ N khung thì đọc cả khung hình (bắt QR nằm ngoài khung chữ nhật)
const FULL_EVERY = 5;
// Zoom mặc định trên Android (máy có zoom) — xem chỗ áp dụng
const DEFAULT_ZOOM = 2;
// Camera sau đã chọn (Android nhiều camera) — lưu trên máy để lần sau mở thẳng camera chính
const CAM_KEY = 'hsb-scan-cam-v1';
const VIDEO_RES = { width: { ideal: 1920 }, height: { ideal: 1080 } };

function loadCam(): string {
  try {
    return localStorage.getItem(CAM_KEY) || '';
  } catch {
    return '';
  }
}
function saveCam(id: string) {
  try {
    localStorage.setItem(CAM_KEY, id);
  } catch {
    /* chế độ ẩn danh — bỏ qua */
  }
}
// anh Hữu 09/11/2026: iPhone anh Hữu treo mãi "Đang mở camera…" (máy không trả camera, không báo lỗi)
// ⇒ chờ tối đa OPEN_TIMEOUT_MS rồi báo lỗi rõ + thông tin máy; camera trả về muộn thì tắt ngay.
const OPEN_TIMEOUT_MS = 8000;
function openStream(deviceId?: string): Promise<MediaStream> {
  const p = navigator.mediaDevices.getUserMedia({
    audio: false,
    video: deviceId
      ? { deviceId: { exact: deviceId }, ...VIDEO_RES }
      : { facingMode: { ideal: 'environment' }, ...VIDEO_RES },
  });
  return new Promise<MediaStream>((resolve, reject) => {
    let done = false;
    const t = setTimeout(() => {
      done = true;
      const e = new Error('hết thời gian chờ camera');
      e.name = 'TimeoutError';
      reject(e);
      p.then((s) => stopStream(s)).catch(() => {});
    }, OPEN_TIMEOUT_MS);
    p.then(
      (s) => {
        clearTimeout(t);
        if (done) stopStream(s);
        else resolve(s);
      },
      (e) => {
        clearTimeout(t);
        if (!done) reject(e);
      },
    );
  });
}
/** Xin camera yêu cầu TỐI GIẢN (chỉ camera sau, không độ phân giải) — lượt cứu khi luồng 1920×1080 không ra hình. */
function openStreamToiGian(): Promise<MediaStream> {
  const p = navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: 'environment' } });
  return Promise.race([
    p,
    new Promise<MediaStream>((_, rej) =>
      setTimeout(() => {
        p.then((s) => stopStream(s)).catch(() => {});
        const e = new Error('hết thời gian chờ camera (lần xin lại)');
        e.name = 'TimeoutError';
        rej(e);
      }, OPEN_TIMEOUT_MS),
    ),
  ]);
}
/** Gắn luồng vào video, gọi play (KHÔNG chờ mãi), đợi tới khi có khung hình thật hoặc hết `ms`. */
async function ganVaChoHinh(video: HTMLVideoElement, stream: MediaStream, ms: number): Promise<boolean> {
  try {
    video.pause();
  } catch {
    /* chưa phát */
  }
  video.muted = true;
  video.setAttribute('playsinline', '');
  video.setAttribute('webkit-playsinline', '');
  video.srcObject = null;
  video.srcObject = stream;
  void video.play().catch(() => {});
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (video.videoWidth > 0 && video.readyState >= 2) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return video.videoWidth > 0 && video.readyState >= 2;
}
/** Trạng thái luồng camera + video — chụp màn hình gửi lại là biết iPhone kẹt ở đâu. */
function chanDoanLuong(stream: MediaStream, video: HTMLVideoElement): string {
  const t = stream.getVideoTracks()[0];
  if (!t) return 'không có luồng video';
  return `luồng ${t.readyState}${t.muted ? ' · bị tắt tiếng hình' : ''}${t.enabled ? '' : ' · tắt'} · video rs${video.readyState} ${video.videoWidth}×${video.videoHeight}${video.paused ? ' · dừng' : ''}`;
}
/** Thông tin máy để chẩn đoán khi không mở được camera: iOS mấy · Safari hay chế độ ứng dụng · quyền camera. */
async function camDiag(): Promise<string> {
  const ua = navigator.userAgent;
  const ios = /OS (\d+)[_.](\d+)/.exec(ua);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const standalone = (navigator as any).standalone === true || window.matchMedia?.('(display-mode: standalone)').matches;
  let perm = '?';
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    perm = (await navigator.permissions.query({ name: 'camera' as any })).state;
  } catch {
    /* trình duyệt không hỗ trợ hỏi quyền */
  }
  const os = ios && isIOS() ? `iOS ${ios[1]}.${ios[2]}` : /Android [\d.]+/.exec(ua)?.[0] ?? 'máy khác';
  return `[${os} · ${standalone ? 'mở như ứng dụng' : 'trình duyệt'} · quyền camera: ${perm}]`;
}
function stopStream(s: MediaStream | null) {
  s?.getTracks().forEach((t) => {
    try {
      t.stop();
    } catch {
      /* đã dừng */
    }
  });
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function capsOf(s: MediaStream): any {
  const t = s.getVideoTracks()[0] as AnyTrack | undefined;
  try {
    return t?.getCapabilities?.() ?? {};
  } catch {
    return {};
  }
}
// Camera sau (nhãn có sau khi đã cho phép camera). Bỏ camera trước/selfie.
async function backCameras(): Promise<MediaDeviceInfo[]> {
  try {
    const ds = await navigator.mediaDevices.enumerateDevices();
    return ds.filter((d) => d.kind === 'videoinput' && d.deviceId && !/front|user|selfie/i.test(d.label));
  } catch {
    return [];
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTrack = MediaStreamTrack & { getCapabilities?: () => any };

type Caps = {
  torch: boolean;
  zoom: { min: number; max: number; step: number } | null;
};


function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

// Vùng video ĐANG HIỂN THỊ trong khung (video object-cover) — tính theo pixel gốc của video.
function visibleRect(vw: number, vh: number, boxW: number, boxH: number) {
  const scale = Math.max(boxW / vw, boxH / vh);
  const sw = Math.min(vw, boxW / scale);
  const sh = Math.min(vh, boxH / scale);
  return { sx: (vw - sw) / 2, sy: (vh - sh) / 2, sw, sh };
}

function errText(e: unknown): string {
  const name = e instanceof DOMException || e instanceof Error ? e.name : '';
  if (name === 'TimeoutError')
    return isIOS()
      ? 'iPhone chưa mở được camera sau 8 giây. Bấm “📸 Chụp ảnh tem” bên dưới để quét tiếp; hoặc vuốt tắt hẳn app rồi mở lại; kiểm tra Cài đặt › Safari › Camera = Cho phép (hoặc Hỏi).'
      : 'Máy chưa mở được camera sau 8 giây — bấm “📸 Chụp ảnh tem” bên dưới, hoặc đóng hẳn trình duyệt rồi mở lại.';
  if (name === 'NotAllowedError' || name === 'SecurityError')
    return isIOS()
      ? 'iPhone đang chặn camera với trang này — vào Cài đặt › Safari › Camera chọn Cho phép (hoặc Hỏi), rồi mở lại app. Tạm thời bấm “📸 Chụp ảnh tem”.'
      : 'Chưa cho phép dùng camera — vào cài đặt trình duyệt cho phép Camera với trang này rồi thử lại.';
  if (name === 'NotFoundError' || name === 'OverconstrainedError')
    return 'Không tìm thấy camera sau của máy.';
  if (name === 'NoFramesError')
    return `${isIOS() ? 'iPhone' : 'Máy'} đã cho camera nhưng không ra hình. Bấm “📸 Chụp ảnh tem” bên dưới để quét tiếp, và chụp màn hình này gửi anh Hữu. Chi tiết: ${e instanceof Error ? e.message : ''}`;
  if (name === 'NotReadableError')
    return 'Camera đang bị ứng dụng khác dùng — tắt ứng dụng camera khác rồi thử lại.';
  const msg = e instanceof Error ? e.message : typeof e === 'string' ? e : '';
  return `Không mở được camera — ${msg || name || 'không rõ nguyên nhân'}`;
}

export default function BarcodeScanButton({
  onScan,
  label = '📷 Quét tem',
}: {
  onScan: (text: string, format?: string) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState('');
  const [ready, setReady] = useState(false); // camera + bộ đọc đã sẵn sàng
  const [busy, setBusy] = useState(false); // đang đọc ảnh chụp
  const [step, setStep] = useState('');
  const [secs, setSecs] = useState(0);
  const [caps, setCaps] = useState<Caps>({ torch: false, zoom: null });
  const [torchOn, setTorchOn] = useState(false);
  const [torchMsg, setTorchMsg] = useState('');
  const [zoom, setZoom] = useState(1);
  const [camPick, setCamPick] = useState(''); // camera chọn tay bằng nút 🔄
  // iPhone "mở như ứng dụng" (màn hình chính) kẹt camera nếu xin SAU lần chạm (anh Hữu 09/11/2026: Safari
  // quét được, biểu tượng màn hình chính treo) ⇒ trên iPhone xin camera NGAY trong lần bấm nút, khung quét dùng lại.
  const preStream = useRef<Promise<MediaStream> | null>(null);
  const [backCams, setBackCams] = useState<MediaDeviceInfo[]>([]);
  const [probing, setProbing] = useState(false); // đang dò camera chính
  const [info, setInfo] = useState('');
  const [phase, setPhase] = useState(''); // bước đang làm khi chưa có hình (hiện thay "Đang mở camera…")

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  // Giữ onScan mới nhất mà không khởi động lại camera mỗi lần trang cha vẽ lại
  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  const stopCamera = useCallback(() => {
    const s = streamRef.current;
    streamRef.current = null;
    s?.getTracks().forEach((t) => {
      try {
        t.stop();
      } catch {
        /* đã dừng */
      }
    });
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const close = useCallback(() => {
    const pre = preStream.current; // đóng khi luồng xin trước chưa kịp dùng → tắt khi nó về
    preStream.current = null;
    pre?.then((st) => stopStream(st)).catch(() => {});
    stopCamera();
    setOpen(false);
    setSecs(0);
  }, [stopCamera]);

  // Báo hiệu đọc được: rung (Android; iPhone không hỗ trợ) + bíp ngắn
  const signal = useCallback(() => {
    try {
      navigator.vibrate?.(120);
    } catch {
      /* ignore */
    }
    const ctx = audioRef.current;
    if (!ctx) return;
    try {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'square';
      o.frequency.value = 1800;
      g.gain.value = 0.08;
      o.connect(g).connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.12);
    } catch {
      /* ignore */
    }
  }, []);

  const finish = useCallback(
    (hit: ScanHit) => {
      stopCamera();
      signal();
      setOpen(false);
      setSecs(0);
      onScanRef.current(hit.text, hit.format);
    },
    [signal, stopCamera],
  );

  // Đồng hồ đếm giây — để người dùng biết máy đang thử, không phải treo
  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [open]);

  // Mở camera + vòng đọc khung
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    (async () => {
      try {
        const zx = loadZxing(); // tải wasm song song với lúc xin camera
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('trình duyệt không hỗ trợ camera');
        const android = !isIOS();
        const saved = loadCam();
        let stream: MediaStream | null = null;
        const pre = preStream.current;
        preStream.current = null;
        if (pre) stream = await pre; // iPhone: luồng đã xin trong lần bấm (lỗi → catch dưới, báo rõ)
        const want = camPick || saved;
        if (!stream && want) stream = await openStream(want).catch(() => null);
        if (!stream) stream = await openStream();
        if (cancelled) {
          stopStream(stream);
          return;
        }
        let c = capsOf(stream);
        const cams = android ? await backCameras() : [];
        if (!cancelled) setBackCams(cams);

        // 🔴 Android nhiều camera sau (anh Hữu báo 07/11: máy anh Cường không quét được, không có
        // nút đèn): Chrome hay mở NHẦM ống kính phụ (góc rộng/tele) — không đèn, không lấy nét gần
        // ⇒ hình nhoè. Lần đầu (chưa lưu camera) mà camera đang mở KHÔNG có đèn → thử lần lượt các
        // camera sau khác, lấy cái CÓ ĐÈN (= camera chính). Lưu lại để lần sau mở thẳng.
        if (android && !camPick && !saved && !c.torch && cams.length > 1) {
          setProbing(true);
          const curId = stream.getVideoTracks()[0]?.getSettings().deviceId;
          for (const d of cams) {
            if (cancelled) break;
            if (d.deviceId === curId) continue;
            // nhiều máy Android không mở được 2 camera cùng lúc ⇒ tắt cái cũ trước
            stopStream(stream);
            stream = null;
            const s2 = await openStream(d.deviceId).catch(() => null);
            if (!s2) continue;
            if (capsOf(s2).torch) {
              stream = s2;
              break;
            }
            stopStream(s2);
          }
          if (!stream) stream = (curId ? await openStream(curId).catch(() => null) : null) ?? (await openStream());
          if (!cancelled) setProbing(false);
          c = capsOf(stream);
        }
        if (cancelled) {
          stopStream(stream);
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;

        // 🔴 anh Hữu 12/11/2026: iPhone mở từ MÀN HÌNH CHÍNH treo "Đang mở camera…" KHÔNG báo lỗi — camera đã cấp
        // (không chạm mốc 8 s xin camera) nhưng luồng không ra hình ⇒ video.play() chờ mãi. Không chờ mù nữa:
        // chờ hình tối đa vài giây → (1) gắn lại luồng → (2) xin lại camera yêu cầu tối giản → (3) báo lỗi kèm
        // chẩn đoán trạng thái luồng (để chụp màn hình gửi).
        setPhase('Đã có camera — đang chờ hình…');
        const coHinh = await ganVaChoHinh(video, stream, 3500);
        if (!coHinh && !cancelled) {
          setPhase('Chưa có hình — thử gắn lại camera…');
          if (!(await ganVaChoHinh(video, stream, 3000)) && !cancelled) {
            setPhase('Chưa có hình — xin lại camera…');
            const cu = chanDoanLuong(stream, video);
            stopStream(stream);
            stream = await openStreamToiGian();
            streamRef.current = stream;
            c = capsOf(stream);
            if (!(await ganVaChoHinh(video, stream, 4000))) {
              const e = new Error(`camera không ra hình (lần 1: ${cu} · lần 2: ${chanDoanLuong(stream, video)})`);
              e.name = 'NoFramesError';
              throw e;
            }
          }
        }
        if (cancelled) {
          stopStream(stream);
          return;
        }
        const track = stream.getVideoTracks()[0] as AnyTrack | undefined;
        const st = track?.getSettings();
        if (android && st?.deviceId) saveCam(st.deviceId);

        // Android: lấy nét liên tục (mặc định nhiều máy để "single shot" → nhoè khi đưa gần)
        const focusOk = Array.isArray(c.focusMode) && c.focusMode.includes('continuous');
        if (focusOk) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await track?.applyConstraints({ advanced: [{ focusMode: 'continuous' } as any] }).catch(() => {});
        }
        const z =
          c.zoom && typeof c.zoom.max === 'number' && c.zoom.max > (c.zoom.min ?? 1)
            ? {
                min: c.zoom.min ?? 1,
                max: Math.min(c.zoom.max, 5),
                step: c.zoom.step > 0 ? c.zoom.step : 0.1,
              }
            : null;
        // Mặc định zoom 2× (Android): đứng xa 20–30 cm camera mới lấy nét được, zoom bù lại cho
        // mã vạch vẫn to + nhiều pixel (zoom phần cứng cắt từ cảm biến, không phải phóng ảnh).
        const z0 = z ? Math.min(Math.max(DEFAULT_ZOOM, z.min), z.max) : 1;
        if (z && z0 !== 1) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await track?.applyConstraints({ advanced: [{ zoom: z0 } as any] }).catch(() => {});
        }
        if (!cancelled) {
          // iPhone: getCapabilities không phải lúc nào cũng báo torch dù bật được ⇒ vẫn hiện nút
          setCaps({ torch: !!c.torch || isIOS(), zoom: z });
          setZoom(z0);
          // Dòng chẩn đoán nhỏ — anh Hữu chụp màn hình gửi là biết máy đang mở camera nào
          setInfo(
            [
              (track?.label || 'camera').replace(/\s+/g, ' ').slice(0, 40),
              st?.width && st?.height ? `${st.width}×${st.height}` : '',
              `đèn ${c.torch ? 'có' : isIOS() ? '?' : 'không'}`,
              focusOk ? 'nét tự động' : '',
              cams.length > 1 ? `${cams.length} camera sau` : '',
            ]
              .filter(Boolean)
              .join(' · '),
          );
        }

        await zx;
        if (cancelled) return;
        setReady(true);

        // BarcodeDetector của hệ điều hành (Android Chrome) — chạy song song với zxing
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let native: any = null;
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const BD = (window as any).BarcodeDetector;
          if (BD) {
            const sup: string[] = await BD.getSupportedFormats();
            const fm = NATIVE_FORMATS.filter((f) => sup.includes(f));
            if (fm.length === NATIVE_FORMATS.length) native = new BD({ formats: fm });
          }
        } catch {
          native = null;
        }

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const gate = new ConfirmGate();
        let n = 0;

        const tick = async () => {
          if (cancelled || !streamRef.current) return;
          const vw = video.videoWidth;
          const vh = video.videoHeight;
          const box = boxRef.current;
          if (ctx && vw && vh && box && video.readyState >= 2) {
            n++;
            const full = n % FULL_EVERY === 0;
            const r = full
              ? { sx: 0, sy: 0, sw: vw, sh: vh }
              : visibleRect(vw, vh, box.clientWidth, box.clientHeight);
            const k = Math.min(1, MAX_SIDE / Math.max(r.sw, r.sh));
            const cw = Math.max(1, Math.round(r.sw * k));
            const ch = Math.max(1, Math.round(r.sh * k));
            if (canvas.width !== cw) canvas.width = cw;
            if (canvas.height !== ch) canvas.height = ch;
            ctx.drawImage(video, r.sx, r.sy, r.sw, r.sh, 0, 0, cw, ch);
            const img = ctx.getImageData(0, 0, cw, ch);
            const [a, b] = await Promise.all([
              readFrame(img, full || n % 2 === 0 ? 'LocalAverage' : 'FixedThreshold').catch(() => null),
              native
                ? native
                    .detect(canvas)
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    .then((rs: any[]) => {
                      const x = rs.find((q) => q.rawValue && String(q.rawValue).trim());
                      return x
                        ? ({ text: String(x.rawValue).trim(), format: nativeFormatName(x.format) } as ScanHit)
                        : null;
                    })
                    .catch(() => null)
                : Promise.resolve(null),
            ]);
            if (cancelled) return;
            const hit = a ?? b;
            if (hit && gate.accept(hit)) {
              finish(hit);
              return;
            }
          }
          timer = setTimeout(() => void tick(), 40);
        };
        void tick();
      } catch (e) {
        if (!cancelled) {
          const d = await camDiag().catch(() => '');
          if (!cancelled) setErr(`${errText(e)} ${d}`);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      stopCamera();
      setReady(false);
      setTorchOn(false);
      setTorchMsg('');
      setCaps({ torch: false, zoom: null });
      setInfo('');
      setPhase('');
      setProbing(false);
    };
  }, [open, camPick, finish, stopCamera]);

  // 🔄 Đổi sang camera sau kế tiếp (máy Android nhiều ống kính, tự dò vẫn chọn sai)
  const nextCamera = useCallback(() => {
    if (backCams.length < 2) return;
    const cur = streamRef.current?.getVideoTracks()[0]?.getSettings().deviceId;
    const i = backCams.findIndex((d) => d.deviceId === cur);
    const next = backCams[(i + 1) % backCams.length].deviceId;
    saveCam(next);
    setCamPick(next);
  }, [backCams]);

  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await track.applyConstraints({ advanced: [{ torch: next } as any] });
      setTorchOn(next);
      setTorchMsg('');
    } catch {
      setTorchMsg('Máy này không bật được đèn khi quét — dùng “📸 Chụp ảnh tem” (có đèn flash).');
      setCaps((c) => ({ ...c, torch: false }));
    }
  }, [torchOn]);

  const changeZoom = useCallback(async (v: number) => {
    setZoom(v);
    const track = streamRef.current?.getVideoTracks()[0];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await track?.applyConstraints({ advanced: [{ zoom: v } as any] }).catch(() => {});
  }, []);

  /** Giải mã từ ẢNH chụp bằng camera gốc của máy (nét + phân giải đầy đủ + có flash).
   * 1) cả ảnh (thư viện tự xoay/thu nhỏ nhiều mức)
   * 2) ảnh đã xoay đúng chiều EXIF, thu về cạnh dài ≤ 2400 px
   * 3) trượt DẢI NGANG từ đáy lên (mã vạch trên tem 5 NCC đều nằm ở đáy tem)
   */
  const onFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      setBusy(true);
      setErr('');
      setStep('đang đọc ảnh…');
      stopCamera();
      try {
        let hit: ScanHit | null = await readPhotoPart(file).catch(() => null);

        if (!hit) {
          const bmp = await createImageBitmap(file);
          const k = Math.min(1, 2400 / Math.max(bmp.width, bmp.height));
          const W = Math.round(bmp.width * k);
          const H = Math.round(bmp.height * k);
          const cv = document.createElement('canvas');
          const ctx = cv.getContext('2d', { willReadFrequently: true });
          if (ctx) {
            cv.width = W;
            cv.height = H;
            ctx.drawImage(bmp, 0, 0, W, H);
            setStep('đang dò…');
            hit = await readPhotoPart(ctx.getImageData(0, 0, W, H)).catch(() => null);

            if (!hit) {
              const bandH = Math.max(64, Math.round(H * 0.2));
              const stepPx = Math.max(32, Math.round(bandH / 2));
              const tops: number[] = [];
              for (let top = H - bandH; top > 0; top -= stepPx) tops.push(top);
              tops.push(0);
              for (let i = 0; i < tops.length && !hit; i++) {
                setStep(`đang dò ${i + 1}/${tops.length}…`);
                const band = ctx.getImageData(0, tops[i], W, Math.min(bandH, H - tops[i]));
                hit =
                  (await readFrame(band, 'FixedThreshold').catch(() => null)) ??
                  (await readFrame(band, 'LocalAverage').catch(() => null));
              }
            }
          }
          // 4) Lượt cuối: ảnh GỐC chưa thu nhỏ (mã chụp xa, vạch quá mảnh). Đo 07/11:
          //    cứu thêm ca Nhuận Thái chụp xa mà bản 2400 px không đọc được.
          if (!hit && Math.max(bmp.width, bmp.height) > 2400) {
            setStep('đang dò ảnh gốc…');
            const cv2 = document.createElement('canvas');
            const c2 = cv2.getContext('2d', { willReadFrequently: true });
            if (c2) {
              cv2.width = bmp.width;
              cv2.height = bmp.height;
              c2.drawImage(bmp, 0, 0);
              hit = await readFrame(c2.getImageData(0, 0, bmp.width, bmp.height), 'FixedThreshold').catch(
                () => null,
              );
              cv2.width = cv2.height = 0; // trả bộ nhớ sớm (máy yếu)
            }
          }
          bmp.close?.();
        }

        if (!hit) throw new Error('no-code');
        signal();
        setOpen(false);
        onScanRef.current(hit.text, hit.format);
      } catch {
        setErr(
          'Chưa đọc được mã vạch trong ảnh. Chụp lại sao cho MÃ VẠCH nằm ngang, ' +
            'chiếm gần hết chiều ngang ảnh, không bị nhăn/bóng, bật đèn nếu tối.',
        );
      } finally {
        setBusy(false);
        setStep('');
        if (fileRef.current) fileRef.current.value = '';
      }
    },
    [signal, stopCamera],
  );

  return (
    <>
      <button
        type="button"
        onClick={() => {
          // Tạo AudioContext ngay trong lần chạm (iPhone chỉ cho phát tiếng khi do người bấm)
          try {
            if (!audioRef.current) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const AC = window.AudioContext || (window as any).webkitAudioContext;
              if (AC) audioRef.current = new AC();
            }
            void audioRef.current?.resume();
          } catch {
            /* không có tiếng cũng không sao */
          }
          setErr('');
          setSecs(0);
          if (isIOS() && typeof navigator.mediaDevices?.getUserMedia === 'function') {
            const p = openStream();
            p.catch(() => {}); // lỗi được xử lý khi khung quét đọc lại promise
            preStream.current = p;
          }
          setOpen(true);
        }}
        className="px-3 py-2 rounded-lg text-sm font-semibold bg-brand-navy text-white active:scale-95 transition"
      >
        {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/85 flex flex-col p-3" data-testid="scan-modal">
          <div className="bg-white rounded-xl p-3 w-full max-w-md mx-auto my-auto flex flex-col max-h-full overflow-hidden">
            <div className="flex items-center justify-between mb-2 shrink-0">
              <span className="font-bold text-brand-navy">Quét mã vạch</span>
              <button
                type="button"
                onClick={close}
                className="text-base text-white bg-red-600 font-bold px-4 py-2 rounded-lg active:scale-95"
              >
                ✕ Đóng
              </button>
            </div>

            {/* KHUNG CHỮ NHẬT kiểu mã vạch — chỉ phần thấy trong khung mới được giải mã */}
            <div
              ref={boxRef}
              className="relative w-full rounded-lg overflow-hidden bg-black shrink-0"
              style={{ aspectRatio: `${BOX_W} / ${BOX_H}` }}
            >
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className="absolute inset-0 w-full h-full object-cover"
              />
              {/* 4 góc khung + vạch đỏ ngắm */}
              <div className="pointer-events-none absolute inset-2">
                <span className="absolute left-0 top-0 w-6 h-6 border-l-4 border-t-4 border-white rounded-tl" />
                <span className="absolute right-0 top-0 w-6 h-6 border-r-4 border-t-4 border-white rounded-tr" />
                <span className="absolute left-0 bottom-0 w-6 h-6 border-l-4 border-b-4 border-white rounded-bl" />
                <span className="absolute right-0 bottom-0 w-6 h-6 border-r-4 border-b-4 border-white rounded-br" />
                <span className="absolute left-3 right-3 top-1/2 h-0.5 -translate-y-1/2 bg-red-500 shadow-[0_0_6px_rgba(239,68,68,.9)]" />
              </div>
              {!ready && !err && (
                <div className="absolute inset-0 flex items-center justify-center text-white text-sm">
                  {probing ? 'Đang chọn camera chính…' : phase || 'Đang mở camera…'}
                </div>
              )}
            </div>

            {/* Đèn + zoom */}
            {(caps.torch || caps.zoom || backCams.length > 1) && (
              <div className="mt-2 flex items-center gap-2 shrink-0">
                {caps.torch && (
                  <button
                    type="button"
                    onClick={() => void toggleTorch()}
                    aria-pressed={torchOn}
                    className={`px-3 py-2 rounded-lg text-sm font-bold border-2 whitespace-nowrap ${
                      torchOn ? 'bg-amber-400 border-amber-500 text-black' : 'bg-white border-brand-navy/30 text-brand-navy'
                    }`}
                  >
                    🔦 {torchOn ? 'Tắt đèn' : 'Bật đèn'}
                  </button>
                )}
                {backCams.length > 1 && (
                  <button
                    type="button"
                    onClick={nextCamera}
                    title="Đổi camera"
                    aria-label="Đổi camera"
                    className="px-2.5 py-2 rounded-lg text-sm font-bold border-2 bg-white border-brand-navy/30 text-brand-navy whitespace-nowrap"
                  >
                    🔄
                  </button>
                )}
                {caps.zoom && (
                  <label className="flex-1 flex items-center gap-2 text-sm font-semibold text-brand-navy">
                    <span className="whitespace-nowrap tabular-nums w-12">{zoom.toFixed(1)}×</span>
                    <input
                      type="range"
                      min={caps.zoom.min}
                      max={caps.zoom.max}
                      step={caps.zoom.step}
                      value={zoom}
                      onChange={(e) => void changeZoom(Number(e.target.value))}
                      className="flex-1 accent-brand-teal"
                      aria-label="Phóng to camera"
                    />
                  </label>
                )}
              </div>
            )}

            <div className="mt-2 overflow-auto min-h-0">
              {info && <p className="text-[10px] text-slate-400 mb-1 break-words">{info}</p>}
              {err ? (
                <p className="text-sm text-red-600 font-semibold break-words">{err}</p>
              ) : (
                <p className="text-xs text-brand-navy-soft leading-relaxed">
                  Cách tem khoảng <b>{caps.zoom ? '20–30 cm' : '15–20 cm'}</b>, mã vạch nằm{' '}
                  <b>ngang trong khung</b>, vạch đỏ cắt ngang mã. Chỗ tối thì bật 🔦; tem bị chói thì
                  nghiêng máy một chút.
                  {backCams.length > 1 && !caps.torch && (
                    <span className="block mt-1 text-amber-700 font-semibold">
                      Hình mờ / không có nút đèn → bấm 🔄 đổi sang camera khác.
                    </span>
                  )}
                  {torchMsg && <span className="block mt-1 text-amber-700 font-semibold">{torchMsg}</span>}
                  {secs >= 10 && (
                    <span className="block mt-1 text-amber-700 font-semibold">
                      Đã thử {secs}s mà chưa đọc được — bấm “📸 Chụp ảnh tem” bên dưới.
                    </span>
                  )}
                </p>
              )}
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => void onFile(e.target.files?.[0])}
            />
            <div className="mt-2 shrink-0 space-y-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => fileRef.current?.click()}
                className="w-full py-3 rounded-xl bg-brand-teal text-white font-bold disabled:opacity-50"
              >
                {busy ? step || 'Đang đọc ảnh…' : '📸 Chụp ảnh tem'}
              </button>
              <button
                type="button"
                onClick={close}
                className="w-full py-3 rounded-xl border-2 border-red-500 text-red-600 font-bold"
              >
                ✕ Huỷ quét
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
