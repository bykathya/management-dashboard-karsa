// CATATAN PEMASUKAN (Karsa Circle, 26 Nov 2026 — keputusan pemilik): sebagian studio tidak memakai alur tahapan order
// (brief → demo → QC → revisi → selesai). Mereka hanya mencatat PEMASUKAN: tanggal, jasa, nominal (USD), siapa yang mengerjakan.
// Satu catatan = satu OrderProduksi yang langsung di tahap Selesai, sehingga Penjualan, Analitik, Gaji, dan laporan
// yang membaca OrderProduksi tetap jalan tanpa diubah. Tahap 4 (26 Nov 2026): akun jualan WAJIB dipilih (aturan keras 10): akun sungguhan
// (fee platform → nilai bersih) atau 'INTERNAL' (akun sistem "Order Internal", fee 0). Progres Omset (Penjualan) membaca akun ini.
import prisma from '../prisma.js'
import { studioBolehDilihat, peranStudio, pastikanTahap, akunUntukOrder, tanggalSah } from './circle.js'
import { ORDER_KLIEN, hitungNilaiBersih } from '../utils/produksi.js'
import { validasiUsd, rupiahDariUsd, KURS_BAWAAN } from '../utils/uang.js'
import { anggotaStudio } from '../utils/penugasanDb.js'
import { kanonKategori, daftarKategori } from '../utils/kategori.js'
import { catatAudit } from '../utils/auditOrder.js'
import { jenisNormal } from '../utils/alur.js'

const gagal = (res, kode, pesan) => res.status(kode).json({ success: false, message: pesan })
const wibAwal = (s) => new Date(s + 'T00:00:00+07:00')
const r2 = (n) => Math.round(n * 100) / 100
const AKUN_OTOMATIS = 'Order Internal'

function rentangBulan(bulan) {
  if (!/^\d{4}-\d{2}$/.test(String(bulan ?? ''))) return null
  const [t, b] = bulan.split('-').map(Number)
  if (b < 1 || b > 12) return null
  const berikut = b === 12 ? `${t + 1}-01` : `${t}-${String(b + 1).padStart(2, '0')}`
  return { gte: wibAwal(`${bulan}-01`), lt: wibAwal(`${berikut}-01`) }
}

const usdDari = (o) => (o.mataUang === 'USD' && o.nilaiUsd != null ? o.nilaiUsd : o.kurs > 0 ? o.nilaiKotor / o.kurs : o.nilaiKotor / KURS_BAWAAN)

// GET /api/circle/pemasukan?studioId=…&bulan=YYYY-MM — hanya pengelola unit (dan pemilik, lihat saja). Talent tidak melihat nilai uang.
export const daftar = async (req, res) => {
  try {
    const { studioId } = req.query
    const rentang = rentangBulan(req.query.bulan)
    if (!studioId || !rentang) return gagal(res, 422, 'studioId dan bulan (YYYY-MM) wajib diisi')
    if (!(await studioBolehDilihat(req, studioId))) return gagal(res, 403, 'Bukan studio dalam wewenangmu')
    const p = await peranStudio(req, studioId)
    if (!p.manajer) return gagal(res, 403, 'Catatan pemasukan hanya untuk Koordinator dan Admin unit')

    const [orders, anggota, jasa, terakhirUsd, akunList] = await Promise.all([
      prisma.orderProduksi.findMany({
        where: { ...ORDER_KLIEN, studioId, status: { not: 'BATAL' }, tanggalMasuk: rentang },
        orderBy: [{ tanggalMasuk: 'desc' }, { createdAt: 'desc' }],
        select: { id: true, tanggalMasuk: true, kategori: true, judul: true, klien: true, nilaiKotor: true, nilaiUsd: true, kurs: true, mataUang: true, statusBayar: true,
          akun: { select: { namaAkun: true, platform: true } },
          assignments: { where: { berhentiPada: null }, select: { userId: true, namaEksternal: true, user: { select: { nama: true } } } } },
      }),
      anggotaStudio(studioId),
      daftarKategori(studioId),
      prisma.orderProduksi.findFirst({ where: { studioId, mataUang: 'USD', kurs: { not: null } }, orderBy: { createdAt: 'desc' }, select: { kurs: true } }),
      prisma.akunProduksi.findMany({ where: { studioId, namaAkun: { not: AKUN_OTOMATIS } }, orderBy: [{ platform: 'asc' }, { namaAkun: 'asc' }], select: { id: true, namaAkun: true, platform: true, feePersen: true } }),
    ])

    const baris = orders.map(o => ({
      id: o.id, tanggal: o.tanggalMasuk, jasa: o.kategori ?? o.judul, klien: o.klien,
      akun: o.akun ? (o.akun.namaAkun === AKUN_OTOMATIS ? 'Order internal' : `${o.akun.namaAkun} · ${o.akun.platform}`) : '—',
      nilaiUsd: r2(usdDari(o)), nilaiRp: Math.round(o.nilaiKotor), lunas: o.statusBayar === 'LUNAS',
      dikerjakan: o.assignments.map(a => a.user?.nama ?? a.namaEksternal).filter(Boolean),
    }))
    const perOrang = new Map()
    for (const o of orders) for (const a of o.assignments) {
      const nama = a.user?.nama ?? a.namaEksternal; if (!nama) continue
      const x = perOrang.get(nama) ?? { nama, order: 0, nilaiUsd: 0 }
      x.order += 1; x.nilaiUsd = r2(x.nilaiUsd + usdDari(o)); perOrang.set(nama, x)
    }
    return res.json({ success: true, data: {
      baris,
      ringkasan: {
        jumlah: baris.length,
        totalUsd: r2(baris.reduce((s, b) => s + b.nilaiUsd, 0)),
        lunasUsd: r2(baris.filter(b => b.lunas).reduce((s, b) => s + b.nilaiUsd, 0)),
        perOrang: [...perOrang.values()].sort((a, b) => b.nilaiUsd - a.nilaiUsd),
      },
      pilihan: { anggota: [...anggota].map(([id, nama]) => ({ id, nama })).sort((a, b) => a.nama.localeCompare(b.nama, 'id')), jasa, kursBawaan: terakhirUsd?.kurs ?? KURS_BAWAAN,
        akun: akunList.map(a => ({ id: a.id, nama: `${a.namaAkun} · ${a.platform}`, feePersen: Math.round((a.feePersen ?? 0) * 1000) / 10 })) },
      bolehUbah: p.manajer && !p.lihatSaja,
    } })
  } catch {
    return gagal(res, 500, 'Gagal memuat catatan pemasukan')
  }
}

// POST /api/circle/pemasukan { studioId, tanggal, jasa, akunId ('INTERNAL' boleh), nilaiUsd, kurs, talentUserId, klien?, lunas? }
export const tambah = async (req, res) => {
  try {
    const { studioId, tanggal, nilaiUsd, kurs, talentUserId } = req.body
    if (!studioId) return gagal(res, 422, 'studioId wajib diisi')
    if (!(await studioBolehDilihat(req, studioId))) return gagal(res, 403, 'Bukan studio dalam wewenangmu')
    const p = await peranStudio(req, studioId)
    if (!p.manajer || p.lihatSaja) return gagal(res, 403, 'Hanya Koordinator dan Admin unit yang bisa mencatat pemasukan')

    const tgl = tanggalSah(tanggal); if (!tgl) return gagal(res, 422, 'Tanggal harus diisi (YYYY-MM-DD)')
    const jasaTeks = String(req.body.jasa ?? '').trim(); if (!jasaTeks) return gagal(res, 422, 'Pilih atau tulis jenis jasa')
    const jasa = await kanonKategori(studioId, jasaTeks.slice(0, 250)); if (jasa?.galat) return gagal(res, 422, jasa.galat)
    const galatUsd = validasiUsd({ mataUang: 'USD', nilaiUsd, kurs }); if (galatUsd) return gagal(res, 422, galatUsd)
    if (!talentUserId) return gagal(res, 422, 'Pilih siapa yang mengerjakan')
    if (!(await anggotaStudio(studioId)).has(talentUserId)) return gagal(res, 422, 'Yang mengerjakan harus anggota studio ini')
    const pilihAkun = await akunUntukOrder(studioId, req.body.akunId); if (pilihAkun.galat) return gagal(res, 422, pilihAkun.galat)
    const klien = String(req.body.klien ?? '').trim().slice(0, 200) || 'Klien'
    const lunas = req.body.lunas !== false

    const akun = pilihAkun.akun
    const [tahap, pengguna] = await Promise.all([
      pastikanTahap(studioId),
      prisma.user.findUnique({ where: { id: req.user.id }, select: { nama: true } }),
    ])
    const selesai = tahap.find(t => jenisNormal(t.jenis) === 'SELESAI')
    const nilai = rupiahDariUsd(nilaiUsd, kurs)
    // Tanggal catatan dipakai untuk tanggal masuk & selesai (jam 12.00 WIB supaya tidak tergeser ke hari lain)
    const waktu = new Date(`${tanggal}T12:00:00+07:00`)
    const order = await prisma.orderProduksi.create({
      data: {
        studioId, akunId: akun.id, tipeKlien: 'EKSTERNAL', klien, judul: jasa, kategori: jasa,
        nilaiDisepakati: nilai, nilaiKotor: nilai, nilaiBersih: hitungNilaiBersih(nilai, akun.feePersen),
        mataUang: 'USD', kurs: Number(kurs), nilaiUsd: Number(nilaiUsd),
        status: 'SELESAI', subStatus: selesai?.nama ?? 'Selesai', tahapId: selesai?.id ?? null,
        tanggalMasuk: waktu, tanggalSelesai: waktu,
        statusBayar: lunas ? 'LUNAS' : 'BELUM_LUNAS', tanggalLunas: lunas ? waktu : null,
        assignments: { create: { userId: talentUserId } },
        ...(selesai ? { riwayatTahap: { create: { namaTahap: selesai.nama, jenis: 'SELESAI', userId: req.user.id, namaPengguna: pengguna?.nama ?? null } } } : {}),
      },
    })
    await catatAudit(order.id, req.user.id, 'BUAT', [{ field: 'pemasukan', dari: null, ke: `${jasa} · ${akun.namaAkun} · USD ${nilaiUsd} × ${kurs}` }])
    return res.status(201).json({ success: true, data: { id: order.id } })
  } catch {
    return gagal(res, 500, 'Gagal mencatat pemasukan')
  }
}

async function ambilUntukUbah(req, res) {
  const order = await prisma.orderProduksi.findUnique({ where: { id: req.params.id }, select: { id: true, studioId: true, status: true, statusBayar: true } })
  if (!order || order.status === 'BATAL') { gagal(res, 404, 'Catatan tidak ditemukan'); return null }
  if (!(await studioBolehDilihat(req, order.studioId))) { gagal(res, 403, 'Bukan studio dalam wewenangmu'); return null }
  const p = await peranStudio(req, order.studioId)
  if (!p.manajer || p.lihatSaja) { gagal(res, 403, 'Hanya Koordinator dan Admin unit yang bisa mengubah catatan'); return null }
  return order
}

// PATCH /api/circle/pemasukan/:id/lunas { lunas: true|false }
export const aturLunas = async (req, res) => {
  try {
    const order = await ambilUntukUbah(req, res); if (!order) return
    const lunas = !!req.body.lunas
    await prisma.orderProduksi.update({ where: { id: order.id }, data: { statusBayar: lunas ? 'LUNAS' : 'BELUM_LUNAS', tanggalLunas: lunas ? new Date() : null } })
    await catatAudit(order.id, req.user.id, 'UBAH', [{ field: 'statusBayar', dari: order.statusBayar, ke: lunas ? 'LUNAS' : 'BELUM_LUNAS' }])
    return res.json({ success: true, data: { id: order.id, lunas } })
  } catch {
    return gagal(res, 500, 'Gagal mengubah status bayar')
  }
}

// DELETE /api/circle/pemasukan/:id — tidak menghapus baris; ditandai BATAL (sama seperti order dibatalkan) supaya jejaknya tetap ada.
export const hapus = async (req, res) => {
  try {
    const order = await ambilUntukUbah(req, res); if (!order) return
    await prisma.orderProduksi.update({ where: { id: order.id }, data: { status: 'BATAL' } })
    await catatAudit(order.id, req.user.id, 'UBAH', [{ field: 'status', dari: order.status, ke: 'BATAL' }])
    return res.json({ success: true, data: { id: order.id } })
  } catch {
    return gagal(res, 500, 'Gagal menghapus catatan')
  }
}
