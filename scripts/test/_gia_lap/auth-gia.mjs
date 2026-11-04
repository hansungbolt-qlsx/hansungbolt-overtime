// Phiên đăng nhập GIẢ — thay `@/lib/auth-server` khi chạy bài kiểm route. Bài kiểm tự đặt vai trò.
let phien = null;
export function datPhien(p) { phien = p; }
export async function getSession() { return phien; }
export async function setSessionCookie() {}
export async function clearSessionCookie() {}
