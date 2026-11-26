// LOKASI KANTOR UNIT (20 Nov 2026, keputusan user): presensi MASUK di dalam radius kantor unit = WFO otomatis, di luar = WFA.
// Titik lokasi anggota hanya dipakai menghitung jarak lalu dibuang (tidak disimpan) — yang disimpan hasil & jarak (dibulatkan 10 m).
import prisma from '../prisma.js'

export const RADIUS_BAWAAN = 200
export const RADIUS_MIN = 50, RADIUS_MAX = 2000
// Lokasi dengan akurasi lebih buruk dari ini (mis. tebakan dari IP di PC) tidak dipakai memutuskan "di luar kantor"
export const AKURASI_MAKS = 1000

// Jarak dua titik di bumi (haversine), meter
export function jarakMeter(a, b) {
  const R = 6371000, rad = (x) => (x * Math.PI) / 180
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

export const koordinatSah = (lat, lng) => Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0)

export const lokasiKantor = (studioId) => (studioId ? prisma.lokasiKantorUnit.findUnique({ where: { studioId } }) : null)

/**
 * Hasil cek lokasi presensi MASUK. kantor = baris LokasiKantorUnit (null → tidak dicek); lokasi = { lat, lng, akurasi } dari browser atau null.
 * → { cekLokasi: null | 'COCOK' | 'DI_LUAR' | 'TIDAK_TERBACA', jarakMeter: null | angka, modeWajib: null | 'WFO' | 'WFA' }
 */
export function cekLokasiMasuk(kantor, lokasi) {
  if (!kantor) return { cekLokasi: null, jarakMeter: null, modeWajib: null }
  const lat = Number(lokasi?.lat), lng = Number(lokasi?.lng), akurasi = Number(lokasi?.akurasi)
  if (!lokasi || !koordinatSah(lat, lng)) return { cekLokasi: 'TIDAK_TERBACA', jarakMeter: null, modeWajib: null }
  const d = jarakMeter({ lat, lng }, kantor), dibulatkan = Math.round(d / 10) * 10
  if (d <= kantor.radius) return { cekLokasi: 'COCOK', jarakMeter: dibulatkan, modeWajib: 'WFO' }
  // di luar radius tetapi lokasinya sangat kasar (mis. PC tanpa GPS) → jangan dipaksa WFA; pilih sendiri & ditandai
  if (Number.isFinite(akurasi) && akurasi > AKURASI_MAKS) return { cekLokasi: 'TIDAK_TERBACA', jarakMeter: dibulatkan, modeWajib: null }
  return { cekLokasi: 'DI_LUAR', jarakMeter: dibulatkan, modeWajib: 'WFA' }
}
export const LABEL_CEK = { COCOK: 'di kantor', DI_LUAR: 'di luar kantor', TIDAK_TERBACA: 'lokasi tidak terbaca' }
