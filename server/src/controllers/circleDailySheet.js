// DAILY SHEET (Karsa Circle, 27 Nov 2026, pola sheet harian Mas Zakin) — satu layar kerja harian studio:
//   • Inbox: chat masuk calon klien per minggu (tabel InboxSheet, USD).
//   • Order Progress: order = OrderProduksi biasa (supaya Progres Omset, Leaderboard, Gaji, dan Bayar freelance tetap membaca datanya),
//     dengan progres sederhana WIP / Revisi / Waitlist / Done yang dipetakan ke tahap templat (Waitlist = Masuk, WIP = tahap kerja
//     pertama, Revisi = Revisi klien, Done = Selesai). Executor = marketerId (admin pemegang order), Talent 1 & 2 = tim order.
//   • Lempar kerjaan: baris freelance di tim order (AssignmentProduksi tanpa akun) — dibayar lewat Bayar freelance seperti biasa.
// Hanya pengelola unit (Koordinator, Admin Market terbatas akunnya; pemilik lihat saja). Talent tidak melihat uang (aturan keras 2).
import prisma from '../prisma.js'
import { studioBolehDilihat, peranStudio, pastikanTahap, akunUntukOrder, saringAkun, orderDalamAkun, peranKerja } from './circle.js'
import { kelolaStudio } from '../utils/roles.js'
import { hitungThp } from '../utils/payroll.js'
import { ORDER_KLIEN, hitungNilaiBersih } from '../utils/produksi.js'
import { validasiUsd, rupiahDariUsd, KURS_BAWAAN } from '../utils/uang.js'
import { anggotaStudio } from '../utils/penugasanDb.js'
import { catatAudit } from '../utils/auditOrder.js'
import { jenisNormal } from '../utils/alur.js'

const gagal = (res, kode, pesan) => res.status(kode).json({ success: false, message: pesan })
const wibAwal = (s) => new Date(s + 'T00:00:00+07:00')
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100
const AKUN_OTOMATIS = 'Order Internal'
export const PROGRES = ['WAITLIST', 'WIP', 'REVISI', 'DONE']
export const JALUR = ['VGen Payments', 'PayPal', 'Ko-fi', 'Transfer bank', 'Lainnya']
const STATUS_INBOX = ['TANYA', 'DEAL', 'BATAL']

function rentangBulan(bulan) {
  if (!/^\d{4}-\d{2}$/.test(String(bulan ?? ''))) return null
  const [t, b] = bulan.split('-').map(Number)
  if (b < 1 || b > 12) return null
  const berikut = b === 12 ? `${t + 1}-01` : `${t}-${String(b + 1).padStart(2, '0')}`
  return { gte: wibAwal(`${bulan}-01`), lt: wibAwal(`${berikut}-01`) }
}
const usdOrder = (o) => (o.nilaiUsd != null ? o.nilaiUsd : o.kurs > 0 ? o.nilaiKotor / o.kurs : o.nilaiKotor / KURS_BAWAAN)
const angkaUsd = (v) => (v === '' || v == null ? null : Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= 1e7 ? r2(v) : undefined)
const tanggalSah = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(String(s ?? '')) ? s : null)
const progresDari = (o) => o.progresSheet ?? (o.status === 'SELESAI' ? 'DONE' : o.status === 'MASUK' ? 'WAITLIST' : 'WIP')

async function akses(req, res, studioId, ubah = false) {
  if (!studioId) { gagal(res, 422, 'studioId wajib diisi'); return null }
  if (!(await studioBolehDilihat(req, studioId))) { gagal(res, 403, 'Bukan studio dalam wewenangmu'); return null }
  const p = await peranStudio(req, studioId)
  if (!p.manajer) { gagal(res, 403, 'Daily Sheet hanya untuk Koordinator dan Admin unit'); return null }
  if (ubah && p.lihatSaja) { gagal(res, 403, 'Mode lihat saja'); return null }
  return p
}

// Tahap templat untuk progres sederhana
async function tahapProgres(studioId, progres) {
  const daftar = await pastikanTahap(studioId)
  const cari = (...jenis) => daftar.find(t => jenis.includes(jenisNormal(t.jenis)))
  const tahap = progres === 'DONE' ? cari('SELESAI') : progres === 'WAITLIST' ? cari('MASUK') : progres === 'REVISI' ? (cari('REVISI_KLIEN') ?? cari('KERJA')) : cari('KERJA')
  const status = progres === 'DONE' ? 'SELESAI' : progres === 'WAITLIST' ? 'MASUK' : 'PROSES'
  return { tahap: tahap ?? null, status }
}

// GET /api/circle/daily-sheet?studioId=…&bulan=YYYY-MM
export const muat = async (req, res) => {
  try {
    const { studioId } = req.query
    const rentang = rentangBulan(req.query.bulan); if (!rentang) return gagal(res, 422, 'bulan (YYYY-MM) wajib diisi')
    const p = await akses(req, res, studioId); if (!p) return
    const filterAkun = saringAkun(p)
    const [akunList, anggota, inbox, orders, terakhir] = await Promise.all([
      prisma.akunProduksi.findMany({ where: { studioId, namaAkun: { not: AKUN_OTOMATIS }, ...(p.akunAdmin ? { id: { in: p.akunAdmin } } : {}) }, orderBy: [{ platform: 'asc' }, { namaAkun: 'asc' }], select: { id: true, namaAkun: true, platform: true, feePersen: true } }),
      anggotaStudio(studioId),
      prisma.inboxSheet.findMany({ where: { studioId, tanggal: rentang, ...(p.akunAdmin ? { akunId: { in: p.akunAdmin } } : {}) }, orderBy: [{ tanggal: 'desc' }, { createdAt: 'desc' }] }),
      // Order bulan ini + order bulan lalu yang belum Done (masih di antrean)
      prisma.orderProduksi.findMany({
        where: { ...ORDER_KLIEN, studioId, status: { not: 'BATAL' }, ...filterAkun, OR: [{ tanggalMasuk: rentang }, { status: { not: 'SELESAI' }, tanggalMasuk: { lt: rentang.gte } }] },
        orderBy: [{ tanggalMasuk: 'desc' }, { createdAt: 'desc' }],
        select: { id: true, tanggalMasuk: true, deadline: true, klien: true, judul: true, kategori: true, nilaiKotor: true, nilaiUsd: true, kurs: true, mataUang: true,
          status: true, progresSheet: true, partialUsd: true, tipUsd: true, jalurBayar: true, statusBayar: true, tanggalLunas: true, akunId: true, marketerId: true,
          marketer: { select: { nama: true } }, akun: { select: { namaAkun: true, platform: true } },
          assignments: { where: { berhentiPada: null }, orderBy: { createdAt: 'asc' }, select: { id: true, userId: true, namaEksternal: true, feeTalent: true, statusBayar: true, dpAmount: true, peran: true, user: { select: { nama: true } } } } },
      }),
      prisma.orderProduksi.findFirst({ where: { studioId, mataUang: 'USD', kurs: { not: null } }, orderBy: { createdAt: 'desc' }, select: { kurs: true } }),
    ])
    // Target bulanan (desain Karsa 28 Nov 2026): target unit + target per akun, sama dengan Progres Omset.
    const [th, bl] = req.query.bulan.split('-').map(Number)
    const [tUnit, tAkun, bolehTarget] = await Promise.all([
      prisma.targetOmsetUnit.findUnique({ where: { studioId_tahun_bulan: { studioId, tahun: th, bulan: bl } }, select: { targetUsd: true } }),
      prisma.targetOmsetAkun.findMany({ where: { akunId: { in: akunList.map(a => a.id) }, tahun: th, bulan: bl }, select: { akunId: true, targetUsd: true } }),
      kelolaStudio(peranKerja(req), studioId),
    ])
    const namaAkun = (o) => (!o.akun ? '—' : o.akun.namaAkun === AKUN_OTOMATIS ? 'Order internal' : o.akun.namaAkun)
    const baris = orders.map(o => {
      const tim = o.assignments.filter(a => a.userId)
      const fl = o.assignments.filter(a => !a.userId)
      return {
        id: o.id, tanggal: o.tanggalMasuk, deadline: o.deadline, klien: o.klien, produk: o.kategori ?? o.judul, akunId: o.akunId, akun: namaAkun(o), platform: o.akun?.platform ?? null,
        executorId: o.marketerId, executor: o.marketer?.nama ?? null,
        talent: tim.map(a => ({ id: a.userId, nama: a.user?.nama ?? '—' })),
        freelance: fl.map(a => ({ assignmentId: a.id, nama: a.namaEksternal, fee: a.feeTalent, lunas: a.statusBayar === 'LUNAS', dp: a.dpAmount, peran: a.peran })),
        realUsd: r2(usdOrder(o)), kurs: o.kurs ?? KURS_BAWAAN, nilaiRp: Math.round(o.nilaiKotor),
        progres: progresDari(o), partialUsd: o.partialUsd ?? 0, tipUsd: o.tipUsd ?? 0, jalurBayar: o.jalurBayar, lunas: o.statusBayar === 'LUNAS',
        bulanIni: o.tanggalMasuk >= rentang.gte,
      }
    })
    return res.json({ success: true, data: {
      inbox: inbox.map(x => ({ ...x, akun: akunList.find(a => a.id === x.akunId)?.namaAkun ?? (x.akunId ? '—' : 'Tanpa akun') })),
      order: baris,
      pilihan: {
        akun: akunList.map(a => ({ id: a.id, nama: a.namaAkun, platform: a.platform })),
        anggota: [...anggota].map(([id, nama]) => ({ id, nama })).sort((a, b) => a.nama.localeCompare(b.nama, 'id')),
        progres: PROGRES, jalur: JALUR, statusInbox: STATUS_INBOX, kursBawaan: terakhir?.kurs ?? KURS_BAWAAN,
      },
      bolehUbah: !p.lihatSaja,
      target: { tahun: th, bulan: bl, unitUsd: tUnit?.targetUsd ?? null, akun: Object.fromEntries(tAkun.map(t => [t.akunId, t.targetUsd])), bolehUbah: !!bolehTarget },
    } })
  } catch {
    return gagal(res, 500, 'Gagal memuat Daily Sheet')
  }
}

function isiInbox(body) {
  const tanggal = tanggalSah(body.tanggal); if (!tanggal) return { galat: 'Tanggal harus diisi' }
  const klien = String(body.klien ?? '').trim().slice(0, 200); if (!klien) return { galat: 'Nama klien wajib diisi' }
  const agreedUsd = angkaUsd(body.agreedUsd), realUsd = angkaUsd(body.realUsd)
  if (agreedUsd === undefined || realUsd === undefined) return { galat: 'Nilai harus angka dolar 0 ke atas' }
  const status = STATUS_INBOX.includes(body.status) ? body.status : 'TANYA'
  const jalurBayar = body.jalurBayar ? String(body.jalurBayar).slice(0, 40) : null
  return { data: { tanggal: new Date(tanggal + 'T00:00:00.000Z'), klien, produk: String(body.produk ?? '').trim().slice(0, 200) || null, agreedUsd, realUsd, status, jalurBayar } }
}
async function akunSah(p, studioId, akunId) {
  if (!akunId) return null
  const a = await prisma.akunProduksi.findFirst({ where: { id: String(akunId), studioId }, select: { id: true } })
  if (!a || (p.akunAdmin && !p.akunAdmin.includes(a.id))) return undefined
  return a.id
}

// POST /api/circle/daily-sheet/inbox
export const tambahInbox = async (req, res) => {
  try {
    const { studioId } = req.body
    const p = await akses(req, res, studioId, true); if (!p) return
    const v = isiInbox(req.body); if (v.galat) return gagal(res, 422, v.galat)
    const akunId = await akunSah(p, studioId, req.body.akunId); if (akunId === undefined) return gagal(res, 422, 'Akun jualan bukan milik unit ini')
    const x = await prisma.inboxSheet.create({ data: { ...v.data, studioId, akunId, olehId: req.user.id } })
    return res.status(201).json({ success: true, data: { id: x.id } })
  } catch { return gagal(res, 500, 'Gagal mencatat inbox') }
}
// PATCH /api/circle/daily-sheet/inbox/:id
export const ubahInbox = async (req, res) => {
  try {
    const ada = await prisma.inboxSheet.findUnique({ where: { id: req.params.id } }); if (!ada) return gagal(res, 404, 'Inbox tidak ditemukan')
    const p = await akses(req, res, ada.studioId, true); if (!p) return
    const v = isiInbox({ ...ada, tanggal: ada.tanggal.toISOString().slice(0, 10), ...req.body }); if (v.galat) return gagal(res, 422, v.galat)
    const akunId = req.body.akunId !== undefined ? await akunSah(p, ada.studioId, req.body.akunId) : ada.akunId
    if (akunId === undefined) return gagal(res, 422, 'Akun jualan bukan milik unit ini')
    await prisma.inboxSheet.update({ where: { id: ada.id }, data: { ...v.data, akunId } })
    return res.json({ success: true, data: { id: ada.id } })
  } catch { return gagal(res, 500, 'Gagal mengubah inbox') }
}
// DELETE /api/circle/daily-sheet/inbox/:id
export const hapusInbox = async (req, res) => {
  try {
    const ada = await prisma.inboxSheet.findUnique({ where: { id: req.params.id } }); if (!ada) return gagal(res, 404, 'Inbox tidak ditemukan')
    const p = await akses(req, res, ada.studioId, true); if (!p) return
    if (p.akunAdmin && !p.akunAdmin.includes(ada.akunId)) return gagal(res, 403, 'Bukan akun yang kamu pegang')
    await prisma.inboxSheet.delete({ where: { id: ada.id } })
    return res.json({ success: true, data: { id: ada.id } })
  } catch { return gagal(res, 500, 'Gagal menghapus inbox') }
}

// POST /api/circle/daily-sheet/order { studioId, tanggal, klien, produk, akunId, executorId?, talent1Id, talent2Id?, deadline?, realUsd, kurs, progres, partialUsd?, tipUsd?, jalurBayar?, lunas? }
export const tambahOrder = async (req, res) => {
  try {
    const { studioId } = req.body
    const p = await akses(req, res, studioId, true); if (!p) return
    const tanggal = tanggalSah(req.body.tanggal); if (!tanggal) return gagal(res, 422, 'Tanggal harus diisi')
    const klien = String(req.body.klien ?? '').trim().slice(0, 200); if (!klien) return gagal(res, 422, 'Nama klien wajib diisi')
    const produk = String(req.body.produk ?? '').trim().slice(0, 250); if (!produk) return gagal(res, 422, 'Produk / jasa wajib diisi')
    const galatUsd = validasiUsd({ mataUang: 'USD', nilaiUsd: req.body.realUsd, kurs: req.body.kurs }); if (galatUsd) return gagal(res, 422, galatUsd)
    const pilihAkun = await akunUntukOrder(studioId, req.body.akunId); if (pilihAkun.galat) return gagal(res, 422, pilihAkun.galat)
    if (p.akunAdmin && !p.akunAdmin.includes(pilihAkun.akun.id)) return gagal(res, 403, 'Bukan akun yang kamu pegang')
    const anggota = await anggotaStudio(studioId)
    const talentIds = [...new Set([req.body.talent1Id, req.body.talent2Id].filter(Boolean))]
    if (!talentIds.length) return gagal(res, 422, 'Pilih Talent 1 (yang mengerjakan)')
    if (talentIds.some(id => !anggota.has(id))) return gagal(res, 422, 'Talent harus anggota studio ini')
    const executorId = req.body.executorId || null
    if (executorId && !anggota.has(executorId)) return gagal(res, 422, 'Executor harus anggota studio ini')
    const progres = PROGRES.includes(req.body.progres) ? req.body.progres : 'WIP'
    const partialUsd = angkaUsd(req.body.partialUsd), tipUsd = angkaUsd(req.body.tipUsd)
    if (partialUsd === undefined || tipUsd === undefined) return gagal(res, 422, 'Partial dan tip harus angka dolar 0 ke atas')
    const deadline = req.body.deadline ? tanggalSah(req.body.deadline) : null
    if (req.body.deadline && !deadline) return gagal(res, 422, 'Deadline tidak sah')
    const lunas = !!req.body.lunas
    const { tahap, status } = await tahapProgres(studioId, progres)
    const akun = pilihAkun.akun, nilai = rupiahDariUsd(req.body.realUsd, req.body.kurs)
    const waktu = new Date(`${tanggal}T12:00:00+07:00`)
    const order = await prisma.orderProduksi.create({ data: {
      studioId, akunId: akun.id, tipeKlien: 'EKSTERNAL', klien, judul: produk, kategori: produk,
      nilaiDisepakati: nilai, nilaiKotor: nilai, nilaiBersih: hitungNilaiBersih(nilai, akun.feePersen),
      mataUang: 'USD', kurs: Number(req.body.kurs), nilaiUsd: Number(req.body.realUsd),
      status, subStatus: tahap?.nama ?? null, tahapId: tahap?.id ?? null, progresSheet: progres,
      partialUsd, tipUsd, jalurBayar: JALUR.includes(req.body.jalurBayar) ? req.body.jalurBayar : null,
      tanggalMasuk: waktu, tanggalSelesai: progres === 'DONE' ? waktu : null, deadline: deadline ? new Date(deadline + 'T00:00:00.000Z') : null,
      statusBayar: lunas ? 'LUNAS' : (partialUsd ?? 0) > 0 ? 'DP' : 'BELUM_LUNAS', tanggalLunas: lunas ? waktu : null,
      marketerId: executorId,
      assignments: { create: talentIds.map(userId => ({ userId })) },
    } })
    await catatAudit(order.id, req.user.id, 'BUAT', [{ field: 'daily-sheet', dari: null, ke: `${produk} · ${akun.namaAkun} · USD ${req.body.realUsd} · ${progres}` }])
    return res.status(201).json({ success: true, data: { id: order.id } })
  } catch { return gagal(res, 500, 'Gagal mencatat order') }
}

// PATCH /api/circle/daily-sheet/order/:id { progres?, partialUsd?, tipUsd?, jalurBayar?, lunas?, deadline?, executorId? }
export const ubahOrder = async (req, res) => {
  try {
    const o = await prisma.orderProduksi.findUnique({ where: { id: req.params.id }, select: { id: true, studioId: true, akunId: true, status: true, progresSheet: true, statusBayar: true, partialUsd: true } })
    if (!o || o.status === 'BATAL') return gagal(res, 404, 'Order tidak ditemukan')
    const p = await akses(req, res, o.studioId, true); if (!p) return
    if (!orderDalamAkun(p, o)) return gagal(res, 403, 'Bukan akun yang kamu pegang')
    const data = {}, jejak = []
    if (req.body.progres !== undefined) {
      if (!PROGRES.includes(req.body.progres)) return gagal(res, 422, 'Progres tidak dikenal')
      const { tahap, status } = await tahapProgres(o.studioId, req.body.progres)
      Object.assign(data, { progresSheet: req.body.progres, status, tahapId: tahap?.id ?? null, subStatus: tahap?.nama ?? null, tanggalSelesai: req.body.progres === 'DONE' ? new Date() : null })
      jejak.push({ field: 'progres', dari: o.progresSheet, ke: req.body.progres })
    }
    for (const k of ['partialUsd', 'tipUsd']) if (req.body[k] !== undefined) {
      const v = angkaUsd(req.body[k]); if (v === undefined) return gagal(res, 422, 'Nilai harus angka dolar 0 ke atas'); data[k] = v
    }
    if (req.body.jalurBayar !== undefined) data.jalurBayar = JALUR.includes(req.body.jalurBayar) ? req.body.jalurBayar : null
    if (req.body.deadline !== undefined) { const d = req.body.deadline ? tanggalSah(req.body.deadline) : null; if (req.body.deadline && !d) return gagal(res, 422, 'Deadline tidak sah'); data.deadline = d ? new Date(d + 'T00:00:00.000Z') : null }
    if (req.body.executorId !== undefined) {
      if (req.body.executorId && !(await anggotaStudio(o.studioId)).has(req.body.executorId)) return gagal(res, 422, 'Executor harus anggota studio ini')
      data.marketerId = req.body.executorId || null
    }
    if (req.body.lunas !== undefined) {
      const lunas = !!req.body.lunas, partial = data.partialUsd ?? o.partialUsd ?? 0
      data.statusBayar = lunas ? 'LUNAS' : partial > 0 ? 'DP' : 'BELUM_LUNAS'; data.tanggalLunas = lunas ? new Date() : null
      jejak.push({ field: 'statusBayar', dari: o.statusBayar, ke: data.statusBayar })
    } else if (data.partialUsd !== undefined && o.statusBayar !== 'LUNAS') data.statusBayar = (data.partialUsd ?? 0) > 0 ? 'DP' : 'BELUM_LUNAS'
    await prisma.orderProduksi.update({ where: { id: o.id }, data })
    if (jejak.length) await catatAudit(o.id, req.user.id, 'UBAH', jejak)
    return res.json({ success: true, data: { id: o.id } })
  } catch { return gagal(res, 500, 'Gagal mengubah order') }
}

// ── PERFORMA, BONUS & LEMBUR (Karsa Circle, 27 Nov 2026) ─────────────────────────────────────────────
// Pendapatan = uang masuk order bulan ini (lunas: nilai order; belum lunas: DP) + tip — sama dengan kotak "Total" di tab Inbox & Order.
//   Admin: order dari akun yang dipegangnya. Artist: order yang ia kerjakan (dibagi rata bila ada Talent 2).
// Bonus  = bila target > 0 dan pendapatan ≥ target → dana bonus × persentase; selain itu "SEMANGAT" (0).
// Komisi = bila target > 0 dan pendapatan > target → (pendapatan − target) × komisi% × kurs; selain itu "KEJAR BONUS DULU YA!" (0).
// Mengubah setelan & mengirim ke slip = Koordinator ke atas unit (aturan keras 7). Admin unit melihat saja.
const r0 = (n) => Math.round(Number(n) || 0)
export function hitungBonusKomisi({ pendapatanUsd, targetUsd, pool, persen, komisiPersen, kurs }) {
  const ok = targetUsd > 0
  const bonus = ok && pendapatanUsd >= targetUsd ? r0((pool * persen) / 100) : null
  const komisi = ok && pendapatanUsd > targetUsd ? r0((pendapatanUsd - targetUsd) * (komisiPersen / 100) * kurs) : null
  return { bonus, komisi }
}
const uangMasukUsd = (o) => (o.statusBayar === 'LUNAS' ? usdOrder(o) : (o.partialUsd ?? 0)) + (o.tipUsd ?? 0)
const kunciPeriode = (bulan) => { const [t, b] = bulan.split('-').map(Number); return { tahun: t, bulan: b } }

async function hitungPerforma(studioId, bulanKunci) {
  const rentang = rentangBulan(bulanKunci), { tahun, bulan } = kunciPeriode(bulanKunci)
  const [setelan, simpanan, orders, adminMarket, anggota, akun, terakhir, aturan, slip, lembur] = await Promise.all([
    prisma.performaSheet.findUnique({ where: { studioId_tahun_bulan: { studioId, tahun, bulan } } }),
    prisma.performaOrang.findMany({ where: { studioId, tahun, bulan } }),
    prisma.orderProduksi.findMany({ where: { ...ORDER_KLIEN, studioId, status: { not: 'BATAL' }, tanggalMasuk: rentang }, select: { akunId: true, nilaiKotor: true, nilaiUsd: true, kurs: true, mataUang: true, statusBayar: true, partialUsd: true, tipUsd: true, assignments: { where: { berhentiPada: null, userId: { not: null } }, select: { userId: true } } } }),
    prisma.produksiAdminMarket.findMany({ where: { studioId }, select: { userId: true, akunIds: true } }),
    prisma.userRole.findMany({ where: { studioId, roleType: { not: 'DIGNITY' }, user: { statusAktif: true } }, select: { user: { select: { id: true, nama: true, posisi: true } } } }),
    prisma.akunProduksi.findMany({ where: { studioId, namaAkun: { not: AKUN_OTOMATIS } }, select: { id: true, namaAkun: true, platform: true }, orderBy: { namaAkun: 'asc' } }),
    prisma.orderProduksi.findFirst({ where: { studioId, mataUang: 'USD', kurs: { not: null } }, orderBy: { createdAt: 'desc' }, select: { kurs: true } }),
    prisma.pengaturanLembur.findUnique({ where: { studioId }, select: { mode: true } }),
    prisma.penggajian.findMany({ where: { studioId, tahun, bulan }, select: { userId: true, status: true } }),
    prisma.lemburKehadiran.findMany({ where: { studioId, tanggalKerja: { gte: new Date(`${bulanKunci}-01T00:00:00.000Z`), lt: new Date(rentang.lt.getTime() + 7 * 3600000) } }, orderBy: { tanggalKerja: 'desc' }, select: { id: true, userId: true, tanggalKerja: true, menit: true, catatan: true, status: true, nilaiProyek: true, nilaiUsulan: true, sumber: true, ditinjauOleh: true, penggajianId: true } }),
  ])
  const orang = new Map(); for (const r of anggota) orang.set(r.user.id, r.user)
  const set = { poolAdmin: setelan?.poolAdmin ?? 0, poolArtis: setelan?.poolArtis ?? 0, komisiPersen: setelan?.komisiPersen ?? 5, kurs: setelan?.kurs ?? terakhir?.kurs ?? KURS_BAWAAN }
  const pendAkun = (akunId) => r2(orders.filter(o => o.akunId === akunId).reduce((s, o) => s + uangMasukUsd(o), 0))
  const pendArtis = (userId) => { let p = 0, n = 0; for (const o of orders) { const t = o.assignments.map(a => a.userId); if (!t.includes(userId)) continue; n++; p += uangMasukUsd(o) / new Set(t).size } return { p: r2(p), n } }
  const slipDari = (userId) => slip.find(x => x.userId === userId)?.status ?? null
  // Admin: yang tersimpan + Admin Market unit (akun pertama yang dipegangnya)
  const adminIds = new Map(simpanan.filter(x => x.jenis === 'ADMIN').map(x => [x.userId, x]))
  for (const a of adminMarket) if (!adminIds.has(a.userId) && orang.has(a.userId)) adminIds.set(a.userId, { userId: a.userId, akunId: a.akunIds[0] ?? null, targetUsd: 0, persen: 0 })
  const admin = [...adminIds.values()].filter(x => orang.has(x.userId)).map(x => {
    const pend = x.akunId ? pendAkun(x.akunId) : 0
    return { userId: x.userId, nama: orang.get(x.userId).nama, akunId: x.akunId, targetUsd: x.targetUsd, persen: x.persen, pendapatanUsd: pend, slip: slipDari(x.userId),
      ...hitungBonusKomisi({ pendapatanUsd: pend, targetUsd: x.targetUsd, pool: set.poolAdmin, persen: x.persen, komisiPersen: set.komisiPersen, kurs: set.kurs }) }
  }).sort((a, b) => a.nama.localeCompare(b.nama, 'id'))
  // Artist: yang tersimpan + siapa pun yang mengerjakan order bulan ini
  const artisIds = new Map(simpanan.filter(x => x.jenis === 'ARTIS').map(x => [x.userId, x]))
  for (const o of orders) for (const a of o.assignments) if (!artisIds.has(a.userId) && orang.has(a.userId)) artisIds.set(a.userId, { userId: a.userId, targetUsd: 0, persen: 0 })
  const artis = [...artisIds.values()].filter(x => orang.has(x.userId)).map(x => {
    const { p, n } = pendArtis(x.userId)
    return { userId: x.userId, nama: orang.get(x.userId).nama, peran: orang.get(x.userId).posisi ?? null, jumlahOrder: n, targetUsd: x.targetUsd, persen: x.persen, pendapatanUsd: p, slip: slipDari(x.userId),
      ...hitungBonusKomisi({ pendapatanUsd: p, targetUsd: x.targetUsd, pool: set.poolArtis, persen: x.persen, komisiPersen: set.komisiPersen, kurs: set.kurs }) }
  }).sort((a, b) => a.nama.localeCompare(b.nama, 'id'))
  return {
    tahun, bulan, setelan: set, admin, artis,
    lembur: lembur.map(l => ({ ...l, nama: orang.get(l.userId)?.nama ?? '—', durasiJam: l.menit ? r2(l.menit / 60) : null })),
    anggota: [...orang.values()].map(u => ({ id: u.id, nama: u.nama })).sort((a, b) => a.nama.localeCompare(b.nama, 'id')),
    akun: akun.map(a => ({ id: a.id, nama: a.namaAkun, platform: a.platform })),
    modeLembur: aturan?.mode ?? null,
  }
}

// GET /api/circle/daily-sheet/performa?studioId&bulan=YYYY-MM
export const muatPerforma = async (req, res) => {
  try {
    const { studioId } = req.query
    if (!rentangBulan(req.query.bulan)) return gagal(res, 422, 'bulan (YYYY-MM) wajib diisi')
    const p = await akses(req, res, studioId); if (!p) return
    const koordinator = !p.lihatSaja && (await kelolaStudio(peranKerja(req), studioId))
    const d = await hitungPerforma(studioId, req.query.bulan)
    return res.json({ success: true, data: { ...d, bolehUbah: koordinator, bolehCatatLembur: !p.lihatSaja, saya: req.user.id } })
  } catch { return gagal(res, 500, 'Gagal memuat performa') }
}

async function koordinatorUnit(req, res, studioId) {
  const p = await akses(req, res, studioId, true); if (!p) return false
  if (!(await kelolaStudio(peranKerja(req), studioId))) { gagal(res, 403, 'Target, dana bonus, dan komisi hanya diatur Koordinator unit'); return false }
  return true
}
const angka = (v, maks) => { const n = Number(v); return Number.isFinite(n) && n >= 0 && n <= maks ? n : undefined }

// PUT /api/circle/daily-sheet/performa { studioId, bulan, setelan?: {poolAdmin, poolArtis, komisiPersen, kurs}, orang?: [{userId, jenis, akunId?, targetUsd, persen}] }
export const simpanPerforma = async (req, res) => {
  try {
    const { studioId } = req.body
    if (!rentangBulan(req.body.bulan)) return gagal(res, 422, 'bulan (YYYY-MM) wajib diisi')
    if (!(await koordinatorUnit(req, res, studioId))) return
    const { tahun, bulan } = kunciPeriode(req.body.bulan)
    const oleh = (await prisma.user.findUnique({ where: { id: req.user.id }, select: { nama: true } }))?.nama ?? null
    if (req.body.setelan) {
      const s = req.body.setelan, data = {}
      for (const [k, maks] of [['poolAdmin', 1e10], ['poolArtis', 1e10], ['komisiPersen', 100], ['kurs', 100000]]) {
        if (s[k] === undefined) continue
        const n = angka(s[k], maks); if (n === undefined) return gagal(res, 422, `${k} tidak sah`); data[k] = n
      }
      await prisma.performaSheet.upsert({ where: { studioId_tahun_bulan: { studioId, tahun, bulan } }, update: { ...data, diubahOleh: oleh }, create: { studioId, tahun, bulan, ...data, diubahOleh: oleh } })
    }
    if (Array.isArray(req.body.orang)) {
      const anggota = await anggotaStudio(studioId)
      const akunUnit = new Set((await prisma.akunProduksi.findMany({ where: { studioId }, select: { id: true } })).map(a => a.id))
      for (const o of req.body.orang.slice(0, 100)) {
        if (!anggota.has(o.userId) || !['ADMIN', 'ARTIS'].includes(o.jenis)) return gagal(res, 422, 'Orang harus anggota unit ini')
        const targetUsd = angka(o.targetUsd ?? 0, 1e7), persen = angka(o.persen ?? 0, 100)
        if (targetUsd === undefined || persen === undefined) return gagal(res, 422, 'Target harus angka dolar, persentase 0–100')
        const akunId = o.jenis === 'ADMIN' && o.akunId && akunUnit.has(o.akunId) ? o.akunId : null
        const data = { targetUsd, persen, akunId }
        await prisma.performaOrang.upsert({ where: { studioId_tahun_bulan_userId_jenis: { studioId, tahun, bulan, userId: o.userId, jenis: o.jenis } }, update: data, create: { studioId, tahun, bulan, userId: o.userId, jenis: o.jenis, ...data } })
      }
    }
    return res.json({ success: true, message: 'Tersimpan' })
  } catch { return gagal(res, 500, 'Gagal menyimpan performa') }
}

// POST /api/circle/daily-sheet/performa/slip { studioId, bulan } — bonus & komisi bulan itu ditulis ke slip gaji DRAFT tiap orang
export const kirimKeSlip = async (req, res) => {
  try {
    const { studioId } = req.body
    if (!rentangBulan(req.body.bulan)) return gagal(res, 422, 'bulan (YYYY-MM) wajib diisi')
    if (!(await koordinatorUnit(req, res, studioId))) return
    const d = await hitungPerforma(studioId, req.body.bulan)
    const per = new Map()
    for (const x of [...d.admin, ...d.artis]) { const a = per.get(x.userId) ?? { nama: x.nama, bonus: 0, komisi: 0 }; a.bonus += x.bonus ?? 0; a.komisi += x.komisi ?? 0; per.set(x.userId, a) }
    const masuk = [], belumSlip = [], sudahFinal = []
    for (const [userId, v] of per) {
      const s = await prisma.penggajian.findFirst({ where: { userId, studioId, tahun: d.tahun, bulan: d.bulan } })
      if (!s) { if (v.bonus || v.komisi) belumSlip.push(v.nama); continue }
      if (s.status !== 'DRAFT') { if (v.bonus !== s.bonus || v.komisi !== s.komisi) sudahFinal.push(v.nama); continue }
      await prisma.penggajian.update({ where: { id: s.id }, data: { bonus: v.bonus, komisi: v.komisi } })
      const tunj = (await prisma.tunjanganPenggajian.aggregate({ where: { penggajianId: s.id }, _sum: { jumlah: true } }))._sum.jumlah ?? 0
      const baru = await prisma.penggajian.findUnique({ where: { id: s.id } })
      await prisma.penggajian.update({ where: { id: s.id }, data: { thp: hitungThp(baru, tunj) } })
      masuk.push(v.nama)
    }
    return res.json({ success: true, data: { masuk, belumSlip, sudahFinal } })
  } catch { return gagal(res, 500, 'Gagal mengirim ke slip gaji') }
}

// POST /api/circle/daily-sheet/lembur { studioId, userId, tanggal, catatan, durasiJam?, fee } — dicatat MENUNGGU, Koordinator menyetujui
// (lewat /lembur/:id/setujui yang sudah ada). Lembur = fee pekerjaan (aturan keras 11): fee usulan disimpan sebagai nilaiUsulan.
export const catatLembur = async (req, res) => {
  try {
    const { studioId, userId } = req.body
    const p = await akses(req, res, studioId, true); if (!p) return
    if (!(await anggotaStudio(studioId)).has(userId)) return gagal(res, 422, 'Pilih anggota unit ini')
    const tanggal = tanggalSah(req.body.tanggal); if (!tanggal) return gagal(res, 422, 'Tanggal harus diisi')
    const catatan = String(req.body.catatan ?? '').trim().slice(0, 300); if (!catatan) return gagal(res, 422, 'Tulis catatan pekerjaannya')
    const fee = angka(req.body.fee, 1e8); if (fee === undefined) return gagal(res, 422, 'Fee harus angka Rupiah 0 ke atas')
    const jam = req.body.durasiJam === '' || req.body.durasiJam == null ? 0 : angka(req.body.durasiJam, 24)
    if (jam === undefined) return gagal(res, 422, 'Durasi 0–24 jam')
    const waktu = new Date(`${tanggal}T12:00:00+07:00`)
    const l = await prisma.lemburKehadiran.create({ data: { userId, studioId, tanggalKerja: new Date(tanggal + 'T00:00:00.000Z'), sumber: 'MANUAL', mulai: waktu, selesai: waktu, menit: Math.round(jam * 60), catatan, status: 'MENUNGGU', nilaiUsulan: r0(fee), nilaiProyek: r0(fee) } })
    return res.status(201).json({ success: true, data: { id: l.id } })
  } catch { return gagal(res, 500, 'Gagal mencatat lembur') }
}
