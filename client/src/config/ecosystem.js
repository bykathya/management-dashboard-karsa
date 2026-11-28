// Satu-satunya tempat buat ganti branding ekosistem kalau app ini dipakai ulang buat
// ekosistem lain -- client adalah static build (di-build ulang tiap deploy), jadi cukup ganti
// 3 baris ini + `npm run build` ulang, gak perlu env var Vite.
export const ECOSYSTEM_NAME      = 'Karsa'
export const ECOSYSTEM_NAME_FULL = 'Karsa Circle'
export const APP_URL             = 'app.domain-anda.com'
// Alamat web kerja harian (menu Daily Sheet ↗ di web pusat).
export const WEB_KERJA           = 'https://kerja.karsa.network/'
export const TELEGRAM_BOT        = 'nama_bot_anda'   // username bot Telegram (tanpa @)

// Modul yang bisa disembunyikan dari menu (kode & tabel tetap ada).
// 21 Okt 2026: modul Produksi & Marketing Ekosistem dihapus (kerja harian ada di web circle, database yang sama).
// Karsa Circle (26 Nov 2026): koperasi tidak dipakai -> tab, notifikasi, dan pengingatnya disembunyikan.
// Dana Tengah: centang setoran bulanan tiap studio ke circle (tab di hub Keuangan).
export const FITUR = { payroll: true, koperasi: false, danaTengah: true }
