// Satu-satunya tempat buat ganti branding ekosistem kalau app ini dipakai ulang buat
// ekosistem lain -- sourced dari .env (opsional, ada default fallback).
export const ECOSYSTEM_NAME      = process.env.ECOSYSTEM_NAME      || 'Karsa'
export const ECOSYSTEM_NAME_FULL = process.env.ECOSYSTEM_NAME_FULL || 'Karsa Circle'
// Dana Tengah (Karsa Circle, 26 Nov 2026): setoran tetap tiap studio ke circle per bulan, dalam Rupiah. Dicatat dengan centang.
export const DANA_TENGAH_PER_BULAN = Number(process.env.DANA_TENGAH_PER_BULAN) || 500000
