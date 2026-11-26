// LEMBUR DARI TUGAS YANG DITUNDA — sisi admin (22 Nov 2026, ATURAN LEMBUR 3D ARTIST, keputusan user: admin mengusulkan, Koordinator memutuskan).
// Penilai = pengelola order unit (Koordinator/Pendamping & Admin Market; admin per akun hanya order akunnya). BUKAN PM/QC (ada uang),
// bukan pemilik lihat-saja, dan tidak bisa menilai lembur sendiri. Persetujuan & nilai akhir tetap di tinjauLembur (Koordinator).
import prisma from '../prisma.js'
import { peranStudio, orderDalamAkun, saringAkun, studioBolehDilihat } from './circle.js'
import { nilaiTahapLembur } from '../utils/lembur.js'
import { catatCalonLembur, unitLemburTunda } from '../utils/lemburTunda.js'
import { kunciTanggalWIB } from '../utils/jamKerja.js'

const gagal = (res, kode, message) => res.status(kode).json({ success: false, message })
const wrap = (fn) => async (req, res) => { try { await fn(req, res) } catch (e) { console.error('[lembur-tunda]', e?.message); gagal(res, 500, 'Terjadi kesalahan, coba lagi') } }
const jamTeks = (d) => new Date(new Date(d).getTime() + 7 * 3600000).toISOString().slice(11, 16)

async function penilai(req, res, studioId) {
  if (!studioId || !(await studioBolehDilihat(req, studioId))) { gagal(res, 403, 'Bukan unit dalam wewenangmu'); return null }
  const p = await peranStudio(req, studioId)
  if (!p.manajer || p.lihatSaja) { gagal(res, 403, 'Penilaian lembur hanya untuk Koordinator & Admin Market unit ini'); return null }
  return p
}
// Bagian tiap tahap (persen − persen tahap sebelumnya), urut seperti daftar Koordinator
const daftarTahap = (studioId) => prisma.tahapLembur.findMany({ where: { studioId }, orderBy: [{ urutan: 'asc' }, { persen: 'asc' }], select: { id: true, nama: true, persen: true } })

export const getLemburCalon = wrap(async (req, res) => {
  const { studioId } = req.query
  const p = await penilai(req, res, studioId); if (!p) return
  const [aturan, level, tahap] = await Promise.all([
    prisma.pengaturanLembur.findUnique({ where: { studioId }, select: { mode: true, lemburDariTunda: true } }),
    prisma.levelLembur.findMany({ where: { studioId, aktif: true }, orderBy: [{ urutan: 'asc' }, { nama: 'asc' }], select: { id: true, nama: true, produk: true, keterangan: true, fee: true } }),
    daftarTahap(studioId),
  ])
  const baris = await prisma.lemburKehadiran.findMany({ where: { studioId, sumber: 'TUNDA', status: { in: ['CALON', 'MENUNGGU'] }, penggajianId: null }, orderBy: [{ tanggalKerja: 'asc' }, { mulai: 'asc' }] })
  const order = new Map((await prisma.orderProduksi.findMany({ where: { id: { in: baris.map(b => b.orderId).filter(Boolean) }, ...saringAkun(p) }, select: { id: true, judul: true, klien: true, akunId: true, tautan: true } })).map(o => [o.id, o]))
  const tugas = new Map((await prisma.penugasanTahap.findMany({ where: { id: { in: baris.map(b => b.penugasanId).filter(Boolean) } }, select: { id: true, namaTahap: true } })).map(t => [t.id, t]))
  const nama = new Map((await prisma.user.findMany({ where: { id: { in: [...new Set(baris.map(b => b.userId))] } }, select: { id: true, nama: true } })).map(u => [u.id, u.nama]))
  const data = baris.filter(b => order.has(b.orderId)).map(b => {
    const o = order.get(b.orderId)
    return {
      id: b.id, status: b.status, userId: b.userId, nama: nama.get(b.userId) ?? '—', milikSaya: b.userId === req.user.id,
      orderId: o.id, judul: o.judul, klien: o.klien, folder: o.tautan?.[0] ?? null, tahap: tugas.get(b.penugasanId)?.namaTahap ?? null,
      tanggal: b.tanggalKerja.toISOString().slice(0, 10), jam: jamTeks(b.selesai), catatan: b.catatan,
      levelId: b.levelId, levelNama: b.levelNama, tahapDinilai: Array.isArray(b.tahapDinilai) ? b.tahapDinilai : [], nilaiUsulan: b.nilaiUsulan, diusulkanOleh: b.diusulkanOleh,
    }
  })
  let sebelum = 0
  const tahapBagian = tahap.map(t => { const bagian = Math.max(0, t.persen - sebelum); sebelum = Math.max(sebelum, t.persen); return { ...t, bagian } })
  return res.json({ success: true, data: { aktif: !!aturan?.lemburDariTunda, mode: aturan?.mode ?? null, level, tahap: tahapBagian, baris: data, jumlahCalon: data.filter(x => x.status === 'CALON' && !x.milikSaya).length } })
})

// Usulan admin: level + tahap yang dicentang → nilai otomatis (fee level × jumlah bagian tahap); admin boleh menyesuaikan nilainya.
export const usulLembur = wrap(async (req, res) => {
  const l = await prisma.lemburKehadiran.findUnique({ where: { id: req.params.id } })
  if (!l || l.sumber !== 'TUNDA') return gagal(res, 404, 'Calon lembur tidak ditemukan')
  const p = await penilai(req, res, l.studioId); if (!p) return
  const order = l.orderId ? await prisma.orderProduksi.findUnique({ where: { id: l.orderId }, select: { id: true, akunId: true } }) : null
  if (!order || !orderDalamAkun(p, order)) return gagal(res, 403, 'Order ini di luar akun jualan yang kamu pegang')
  if (l.userId === req.user.id) return gagal(res, 403, 'Tidak bisa menilai lembur sendiri')
  if (l.penggajianId || !['CALON', 'MENUNGGU'].includes(l.status)) return gagal(res, 409, 'Lembur ini sudah diputuskan koordinator')
  const b = req.body ?? {}
  let lv = {}, hasil = null
  if (b.levelId) {
    const level = await prisma.levelLembur.findUnique({ where: { id: String(b.levelId) } })
    if (!level || level.studioId !== l.studioId || !level.aktif) return gagal(res, 422, 'Pilih level lembur yang masih aktif di unit ini')
    lv = { levelId: level.id, levelNama: level.produk ? `${level.nama} — ${level.produk}` : level.nama, feeLevel: level.fee }
    hasil = nilaiTahapLembur(level.fee, await daftarTahap(l.studioId), b.tahap)
    if (hasil.galat) return gagal(res, 422, hasil.galat)
  }
  const manual = b.nilai !== undefined && b.nilai !== null && b.nilai !== ''
  const n = manual ? Number(b.nilai) : hasil?.nilai
  if (n == null) return gagal(res, 422, 'Pilih level & centang tahap yang dikerjakan, atau isi nilai lembur (Rp)')
  if (!Number.isFinite(n) || n < 0 || n > 100000000) return gagal(res, 422, 'Nilai lembur harus 0 – 100.000.000')
  const nilai = Math.round(n)
  const catatan = String(b.catatan ?? '').trim().slice(0, 200)
  const nama = (await prisma.user.findUnique({ where: { id: req.user.id }, select: { nama: true } }))?.nama ?? null
  await prisma.lemburKehadiran.update({ where: { id: l.id }, data: {
    status: 'MENUNGGU', ...lv, tahapDinilai: hasil ? hasil.tahap.map(t => ({ nama: t.nama, bagian: t.bagian })) : [],
    nilaiUsulan: nilai, nilaiProyek: nilai, diusulkanOlehId: req.user.id, diusulkanOleh: nama, diusulkanPada: new Date(),
    catatan: catatan ? `${(l.catatan ?? '').split(' · Penilaian: ')[0]} · Penilaian: ${catatan}`.slice(0, 300) : l.catatan,
  } })
  return res.json({ success: true, data: { nilai, otomatis: hasil?.nilai ?? null, persen: hasil?.persen ?? null }, message: 'Usulan lembur dikirim — menunggu persetujuan koordinator' })
})

// "🌙 Tandai lembur" dari Kurasi QC: tugas DITUNDA sudah selesai tetapi talent baru mengklik di jam kerja (mis. dikerjakan malam, dikirim pagi)
export const tandaiLembur = wrap(async (req, res) => {
  const pt = await prisma.penugasanTahap.findUnique({ where: { id: String(req.body?.penugasanId ?? '') }, include: { order: { select: { id: true, judul: true, studioId: true, akunId: true } } } })
  if (!pt) return gagal(res, 404, 'Tugas tidak ditemukan')
  const p = await penilai(req, res, pt.order.studioId); if (!p) return
  if (!orderDalamAkun(p, pt.order)) return gagal(res, 403, 'Order ini di luar akun jualan yang kamu pegang')
  if (!(await unitLemburTunda(pt.order.studioId))) return gagal(res, 409, 'Unit ini tidak memakai lembur dari tugas yang ditunda (atur di Kehadiran › Jam kerja & lembur)')
  if (!pt.tunda || pt.status !== 'SELESAI') return gagal(res, 422, 'Hanya tugas yang DITUNDA admin dan sudah diselesaikan talent yang bisa dihitung lembur')
  if (pt.userId === req.user.id) return gagal(res, 403, 'Tidak bisa menandai lembur sendiri')
  const l = await catatCalonLembur({ penugasan: pt, order: pt.order, waktu: pt.selesaiPada ?? new Date(), catatan: `Ditandai lembur oleh admin — ${pt.namaTahap} · ${pt.order.judul ?? ''}` })
  if (!l) return gagal(res, 409, 'Tugas ini sudah tercatat sebagai lembur')
  return res.status(201).json({ success: true, data: { id: l.id, tanggal: kunciTanggalWIB(l.tanggalKerja) }, message: '🌙 Ditandai lembur — isi penilaiannya' })
})
