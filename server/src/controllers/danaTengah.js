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
