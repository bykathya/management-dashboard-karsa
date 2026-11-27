// Hitungan bersama Daily Sheet (Karsa, 27 Nov 2026) — satu rumus untuk Daily Sheet, Financial Forecasting, Weekly & Monthly Report.
import { KURS_BAWAAN } from './uang.js'

/** Nilai order dalam USD (order Rupiah dibagi kursnya / kurs cadangan). */
export const nilaiUsd = (o, kursCadangan = KURS_BAWAAN) => (o.nilaiUsd != null ? o.nilaiUsd : o.nilaiKotor / (o.kurs > 0 ? o.kurs : kursCadangan))
/** Uang masuk: lunas = nilai order, belum lunas = DP; ditambah tip. */
export const uangMasukUsd = (o, kursCadangan) => (o.statusBayar === 'LUNAS' ? nilaiUsd(o, kursCadangan) : (o.partialUsd ?? 0)) + (o.tipUsd ?? 0)
/** Tanggal (1–31) WIB. */
export const tanggalWib = (d) => Number(new Date(new Date(d).getTime() + 7 * 3600000).toISOString().slice(8, 10))
/** Minggu ke dalam bulan: 0 = W1 (tgl 1–7), 1 = W2 (8–14), 2 = W3 (15–21), 3 = W4 (22–akhir). */
export const indeksMinggu = (d) => Math.min(3, Math.floor((tanggalWib(d) - 1) / 7))
/** Progres sederhana Daily Sheet. */
export const progresOrder = (o) => o.progresSheet ?? (o.status === 'SELESAI' ? 'DONE' : o.status === 'MASUK' ? 'WAITLIST' : 'WIP')
/** Rentang satu bulan kalender WIB. */
export function rentangBulanWib(bulan, tahun) {
  const pad = (n) => String(n).padStart(2, '0')
  return { gte: new Date(`${tahun}-${pad(bulan)}-01T00:00:00+07:00`), lt: new Date(`${bulan === 12 ? tahun + 1 : tahun}-${pad(bulan === 12 ? 1 : bulan + 1)}-01T00:00:00+07:00`) }
}
export const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100
