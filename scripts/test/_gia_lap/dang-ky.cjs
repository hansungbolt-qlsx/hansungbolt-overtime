// Nạp bằng `--require`: tsx biên dịch app sang CommonJS, nên chuyển hướng ở Module._resolveFilename.
// Đổi 4 module sang bản GIẢ: supabase / auth / next/image / next/link. Còn lại để nguyên.
/* eslint-disable @typescript-eslint/no-require-imports -- file CommonJS, bắt buộc require */
const Module = require('node:module');
const path = require('node:path');

const GIA = {
  '@/lib/supabase': path.join(__dirname, 'supabase-gia.mjs'),
  '@/lib/auth-server': path.join(__dirname, 'auth-gia.mjs'),
  'next/image': path.join(__dirname, 'next-gia.mjs'),
  'next/link': path.join(__dirname, 'next-gia.mjs'),
};
const goc = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (GIA[request]) return GIA[request];
  return goc.call(this, request, ...rest);
};
