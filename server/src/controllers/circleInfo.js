// INFO & KALENDER di web kerja harian (Karsa, 27 Nov 2026): postingan Info & Dokumen dari web pusat (pengumuman, event, kontrak,
// dokumen & Drive) yang DITUJUKAN ke orang ini — semua anggota, circle/rumah usaha/studionya, atau perannya. Baca saja.
import prisma from '../prisma.js'
import { wherePengumumanUntuk } from './announcement.js'

export const getInfo = async (req, res) => {
  try {
    const where = await wherePengumumanUntuk(req.userRoles ?? [])
    const items = await prisma.announcement.findMany({ where, orderBy: { createdAt: 'desc' }, take: 60 })
    const pembuat = await prisma.user.findMany({ where: { id: { in: [...new Set(items.map(a => a.dibuatOleh))] } }, select: { id: true, nama: true } })
    const nama = Object.fromEntries(pembuat.map(u => [u.id, u.nama]))
    return res.json({ success: true, data: items.map(a => ({ id: a.id, jenis: a.jenis, judul: a.judul, konten: a.konten, tautan: a.tautan, tanggalEvent: a.tanggalEvent ? a.tanggalEvent.toISOString().slice(0, 10) : null, jamEvent: a.jamEvent, createdAt: a.createdAt, pembuat: nama[a.dibuatOleh] ?? '—' })) })
  } catch {
    return res.status(500).json({ success: false, message: 'Gagal memuat info' })
  }
}
