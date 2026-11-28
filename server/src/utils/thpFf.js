import prisma from '../prisma.js'

// THP dari Financial Forecasting (permintaan Kepala Circle 28 Nov 2026): THP seseorang di satu studio = jumlah pos
// atas namanya (Gaji, Komisi, Bonus, tunjangan) di estimasi FF bulan terbaru studio itu (tidak lewat bulan ini, WIB).
// Kalau studio itu belum punya FF untuknya, dipakai THP lama (UserRole.takeHomePay).
// kecuali = nama pos yang tidak dihitung (Penggajian: Komisi & Bonus sudah ditambahkan otomatis dari Daily Sheet).
export const POS_TIDAK_TETAP = ['Komisi', 'Bonus']
export async function thpDariFf(userIds = [], { kecuali = [] } = {}) {
  if (!userIds.length) return new Map()
  const k = new Date(Date.now() + 7 * 3600000), kini = k.getUTCFullYear() * 12 + k.getUTCMonth()
  const item = await prisma.ffItem.findMany({ where: { userId: { in: userIds } }, select: { userId: true, studioId: true, bulan: true, tahun: true, rupiah: true, nama: true } })
  const terbaru = new Map(), jumlah = new Map()
  for (const i of item) {
    const p = i.tahun * 12 + (i.bulan - 1), kunci = `${i.userId}|${i.studioId}`
    if (p > kini) continue
    if (!terbaru.has(kunci) || p > terbaru.get(kunci)) { terbaru.set(kunci, p); jumlah.set(kunci, 0) }
    if (p === terbaru.get(kunci) && !kecuali.includes(i.nama)) jumlah.set(kunci, jumlah.get(kunci) + (i.rupiah ?? 0))
  }
  return jumlah
}

// Ganti takeHomePay tiap peran studio dengan angka FF bila ada; tandai thpDariFf supaya layar bisa menjelaskan sumbernya.
export async function terapkanThpFf(userId, roles = []) {
  const peta = await thpDariFf([userId])
  return roles.map(r => {
    const v = r.studioId ? peta.get(`${userId}|${r.studioId}`) : undefined
    return v === undefined ? r : { ...r, takeHomePay: v, thpDariFf: true }
  })
}
