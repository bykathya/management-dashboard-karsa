// DANA TENGAH (Karsa Circle, 26 Nov 2026 — keputusan pemilik): setiap studio menyetor jumlah tetap ke circle tiap bulan.
// Cukup dicentang per studio per bulan oleh Kepala Circle ke atas. Satu baris DanaTengahSetor = studio itu sudah setor bulan itu;
// centang dilepas = baris dihapus. Nominal dari DANA_TENGAH_PER_BULAN (config/ecosystem.js).
import prisma from '../prisma.js'
import { lingkupKeuangan } from '../utils/lingkup.js'
import { atasanStudio } from '../utils/roles.js'
import { STUDIO_DIHITUNG } from '../utils/kolaborasi.js'
import { DANA_TENGAH_PER_BULAN } from '../config/ecosystem.js'

const gagal = (res, kode, pesan) => res.status(kode).json({ success: false, message: pesan })
const bulanSah = (b) => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(b ?? ''))

// GET /api/dana-tengah?bulan=YYYY-MM — studio dalam wilayah peran (Kepala Circle: studio di circle-nya; Koordinator: studionya sendiri)
export const daftar = async (req, res) => {
  try {
    const { bulan } = req.query
    if (!bulanSah(bulan)) return gagal(res, 422, 'bulan harus YYYY-MM')
    const lingkup = await lingkupKeuangan(req.userRoles)
    const studios = await prisma.studio.findMany({
      where: { ...STUDIO_DIHITUNG, ...(lingkup.semua ? {} : { id: { in: [...lingkup.studioIds] } }) },
      select: { id: true, nama: true, circle: { select: { nama: true } } },
      orderBy: { nama: 'asc' },
    })
    const ids = studios.map(s => s.id)
    const setor = await prisma.danaTengahSetor.findMany({ where: { bulan, studioId: { in: ids } } })
    const penanda = [...new Set(setor.map(s => s.dicentangOleh).filter(Boolean))]
    const nama = new Map((await prisma.user.findMany({ where: { id: { in: penanda } }, select: { id: true, nama: true } })).map(u => [u.id, u.nama]))
    const peta = new Map(setor.map(s => [s.studioId, s]))
    const baris = await Promise.all(studios.map(async s => {
      const x = peta.get(s.id)
      return { studioId: s.id, nama: s.nama.trim(), circle: s.circle?.nama ?? null, sudah: !!x, oleh: x ? nama.get(x.dicentangOleh) ?? null : null, pada: x?.dicentangPada ?? null, bolehCentang: await atasanStudio(req.userRoles, s.id) }
    }))
    const sudah = baris.filter(b => b.sudah).length
    return res.json({ success: true, data: { bulan, nominal: DANA_TENGAH_PER_BULAN, baris, ringkasan: { studio: baris.length, sudah, belum: baris.length - sudah, terkumpul: sudah * DANA_TENGAH_PER_BULAN, target: baris.length * DANA_TENGAH_PER_BULAN } } })
  } catch {
    return gagal(res, 500, 'Gagal memuat Dana Tengah')
  }
}

// PUT /api/dana-tengah { studioId, bulan, sudah } — hanya Kepala Circle studio itu ke atas
export const centang = async (req, res) => {
  try {
    const { studioId, bulan, sudah } = req.body
    if (!studioId || !bulanSah(bulan)) return gagal(res, 422, 'studioId dan bulan (YYYY-MM) wajib diisi')
    if (!(await atasanStudio(req.userRoles, studioId))) return gagal(res, 403, 'Hanya Kepala Circle yang bisa mencentang Dana Tengah')
    if (sudah) {
      await prisma.danaTengahSetor.upsert({
        where: { studioId_bulan: { studioId, bulan } },
        create: { studioId, bulan, dicentangOleh: req.user.id },
        update: {},
      })
    } else {
      await prisma.danaTengahSetor.deleteMany({ where: { studioId, bulan } })
    }
    return res.json({ success: true, data: { studioId, bulan, sudah: !!sudah } })
  } catch {
    return gagal(res, 500, 'Gagal menyimpan Dana Tengah')
  }
}

// ── SALDO & PEMAKAIAN (tahap 7, 26 Nov 2026) ─────────────────────────────────────────────────────────────────────────
// Dibaca & dicatat oleh peran yang sama dengan route ini (Koordinator ke atas). Hapus pemakaian: pencatatnya sendiri
// atau Kepala Circle ke atas. Angka saldo diisi manual dari rekening Dana Tengah (bukan dihitung).
const tanggalSah = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s ?? '')) && !isNaN(new Date(`${s}T00:00:00Z`))
const PERAN_ATAS = ['ADVISOR', 'KEPALA_EKOSISTEM', 'KEPALA_CIRCLE', 'KEPALA_RUMAH_USAHA']
const namaSaya = async (req) => (await prisma.user.findUnique({ where: { id: req.user.id }, select: { nama: true } }))?.nama ?? null
const iso = (d) => d.toISOString().slice(0, 10)

// GET /api/dana-tengah/kas
export const kas = async (req, res) => {
  try {
    const [saldo, pakai] = await Promise.all([
      prisma.danaTengahSaldo.findMany({ orderBy: [{ tanggal: 'desc' }, { createdAt: 'desc' }], take: 24 }),
      prisma.danaTengahPakai.findMany({ orderBy: [{ tanggal: 'desc' }, { createdAt: 'desc' }], take: 200 }),
    ])
    const atas = (req.userRoles ?? []).some(r => PERAN_ATAS.includes(r.roleType))
    return res.json({ success: true, data: {
      saldoTerakhir: saldo[0] ? { tanggal: iso(saldo[0].tanggal), jumlah: saldo[0].jumlah, oleh: saldo[0].olehNama } : null,
      riwayatSaldo: saldo.map(s => ({ id: s.id, tanggal: iso(s.tanggal), jumlah: s.jumlah, catatan: s.catatan, oleh: s.olehNama })),
      pakai: pakai.map(p => ({ id: p.id, tanggal: iso(p.tanggal), keperluan: p.keperluan, jumlah: p.jumlah, oleh: p.olehNama, bisaHapus: atas || p.olehId === req.user.id })),
    } })
  } catch {
    return gagal(res, 500, 'Gagal memuat saldo Dana Tengah')
  }
}

// POST /api/dana-tengah/saldo { tanggal, jumlah, catatan? }
export const catatSaldo = async (req, res) => {
  try {
    const { tanggal } = req.body ?? {}
    const jumlah = Number(req.body?.jumlah)
    if (!tanggalSah(tanggal)) return gagal(res, 422, 'Tanggal harus YYYY-MM-DD')
    if (!Number.isFinite(jumlah) || jumlah < 0) return gagal(res, 422, 'Saldo tidak boleh negatif')
    const catatan = String(req.body.catatan ?? '').trim().slice(0, 200) || null
    await prisma.danaTengahSaldo.create({ data: { tanggal: new Date(`${tanggal}T00:00:00Z`), jumlah, catatan, olehId: req.user.id, olehNama: await namaSaya(req) } })
    return res.status(201).json({ success: true, message: 'Saldo disimpan' })
  } catch {
    return gagal(res, 500, 'Gagal menyimpan saldo')
  }
}

// POST /api/dana-tengah/pakai { tanggal, keperluan, jumlah }
export const catatPakai = async (req, res) => {
  try {
    const { tanggal } = req.body ?? {}
    const jumlah = Number(req.body?.jumlah)
    const keperluan = String(req.body?.keperluan ?? '').trim().slice(0, 200)
    if (!tanggalSah(tanggal)) return gagal(res, 422, 'Tanggal harus YYYY-MM-DD')
    if (!keperluan) return gagal(res, 422, 'Tulis dipakai untuk apa')
    if (!Number.isFinite(jumlah) || jumlah <= 0) return gagal(res, 422, 'Jumlah harus lebih dari 0')
    await prisma.danaTengahPakai.create({ data: { tanggal: new Date(`${tanggal}T00:00:00Z`), keperluan, jumlah, olehId: req.user.id, olehNama: await namaSaya(req) } })
    return res.status(201).json({ success: true, message: 'Pemakaian dicatat' })
  } catch {
    return gagal(res, 500, 'Gagal mencatat pemakaian')
  }
}

// DELETE /api/dana-tengah/pakai/:id
export const hapusPakai = async (req, res) => {
  try {
    const p = await prisma.danaTengahPakai.findUnique({ where: { id: req.params.id } })
    if (!p) return gagal(res, 404, 'Catatan tidak ditemukan')
    const atas = (req.userRoles ?? []).some(r => PERAN_ATAS.includes(r.roleType))
    if (!atas && p.olehId !== req.user.id) return gagal(res, 403, 'Hanya pencatatnya atau Kepala Circle yang bisa menghapus')
    await prisma.danaTengahPakai.delete({ where: { id: p.id } })
    return res.json({ success: true, message: 'Catatan dihapus' })
  } catch {
    return gagal(res, 500, 'Gagal menghapus catatan')
  }
}
