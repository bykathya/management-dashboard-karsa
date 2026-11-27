import { Router } from 'express'
import { getAll, getStatusThisWeek, getMonthlyReport, create, update, remove } from '../controllers/weeklyReport.js'
import { authenticate } from '../middleware/auth.js'
import { checkRole, checkMinRole } from '../middleware/checkRole.js'
import { ROLE_KIRIM_LAPORAN, kelolaStudio } from '../utils/roles.js'
import { bayanganOmsetStudio, kolomDariPlatform, KOLOM } from '../utils/omsetBayangan.js'
import prisma from '../prisma.js'
import { ORDER_KLIEN } from '../utils/produksi.js'
import { getReportingPeriod } from '../utils/week.js'
import { KURS_BAWAAN } from '../utils/uang.js'

const router = Router()

// Omzet BAYANGAN (21 Okt 2026): omzet dari order web circle vs Laporan Omset, per periode — BACA saja, tidak menulis laporan.
// Pengelola unit itu saja (Koordinator/Pendamping unit, Kepala Circle/Rumah Usaha pemiliknya, Super Admin).
router.get('/bayangan', authenticate, checkMinRole('KOORDINATOR'), async (req, res) => {
  try {
    const { studioId } = req.query, bulan = Number(req.query.bulan), tahun = Number(req.query.tahun)
    if (!studioId || !(bulan >= 1 && bulan <= 12) || !(tahun >= 2024 && tahun <= 2100)) return res.status(422).json({ success: false, message: 'studioId, bulan, tahun wajib' })
    if (!(await kelolaStudio(req.userRoles, studioId))) return res.status(403).json({ success: false, message: 'Hanya pengelola unit ini' })
    return res.json({ success: true, data: await bayanganOmsetStudio(studioId, bulan, tahun) })
  } catch { return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' }) }
})

// ISI DARI DAILY SHEET (Karsa Circle, 27 Nov 2026, keputusan pemilik): tombol di form Laporan Omset mengisi omset per platform dari
// order Daily Sheet periode itu. Hanya MENGISI form; Koordinator tetap mengecek lalu mengirim sendiri (tidak menulis laporan).
// Uang masuk per order (tanggal masuk dalam periode, tanpa batal) = nilai order bila lunas, DP bila belum lunas, + tip — sama dengan
// kotak "Total" di Daily Sheet. Order internal tidak dihitung.
router.get('/dari-daily-sheet', authenticate, checkMinRole('KOORDINATOR'), async (req, res) => {
  try {
    const { studioId, periodeAwal } = req.query
    if (!studioId || !/^\d{4}-\d{2}-\d{2}$/.test(String(periodeAwal ?? ''))) return res.status(422).json({ success: false, message: 'studioId dan periodeAwal wajib' })
    if (!(await kelolaStudio(req.userRoles, studioId))) return res.status(403).json({ success: false, message: 'Hanya pengelola unit ini' })
    const { periodeAwal: a, periodeAkhir: b } = getReportingPeriod(new Date(periodeAwal + 'T12:00:00+07:00'))
    const kunci = (d) => new Date(new Date(d).getTime() + 7 * 3600000).toISOString().slice(0, 10)
    const awal = new Date(kunci(a) + 'T00:00:00+07:00'), akhir = new Date(new Date(kunci(b) + 'T00:00:00+07:00').getTime() + 86400000)
    const orders = await prisma.orderProduksi.findMany({ where: { ...ORDER_KLIEN, studioId, status: { not: 'BATAL' }, tanggalMasuk: { gte: awal, lt: akhir } }, select: { nilaiKotor: true, nilaiUsd: true, kurs: true, statusBayar: true, partialUsd: true, tipUsd: true, akun: { select: { platform: true } } } })
    const hasil = Object.fromEntries(KOLOM.map(k => [k.kolom, 0])); let jumlah = 0, internal = 0
    for (const o of orders) {
      const kol = kolomDariPlatform(o.akun?.platform); if (!kol) { internal++; continue }
      const nilai = o.nilaiUsd != null ? o.nilaiUsd : o.nilaiKotor / (o.kurs > 0 ? o.kurs : KURS_BAWAAN)
      const masuk = (o.statusBayar === 'LUNAS' ? nilai : (o.partialUsd ?? 0)) + (o.tipUsd ?? 0)
      if (masuk > 0) { hasil[kol] += masuk; jumlah++ }
    }
    for (const k of Object.keys(hasil)) hasil[k] = Math.round(hasil[k] * 100) / 100
    return res.json({ success: true, data: { omset: hasil, jumlahOrder: jumlah, orderInternal: internal, periodeAwal: kunci(a), periodeAkhir: kunci(b) } })
  } catch { return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' }) }
})

router.get('/',              authenticate, checkMinRole('KADER'), getAll)
router.get('/status/week',   authenticate, checkMinRole('KADER'), getStatusThisWeek)
router.get('/monthly',       authenticate, checkMinRole('KADER'), getMonthlyReport)
router.post('/',             authenticate, checkRole(ROLE_KIRIM_LAPORAN), create)
router.put('/:id',           authenticate, checkRole(ROLE_KIRIM_LAPORAN), update)
router.delete('/:id',        authenticate, checkRole(ROLE_KIRIM_LAPORAN), remove)

export default router
