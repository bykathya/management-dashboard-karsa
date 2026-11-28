// LEADERBOARD (Karsa, 27 Nov 2026, pola web Mas Zakin) — satu endpoint baca-saja untuk menu Executive › Leaderboard:
//   • Global Revenue bulan ini per platform + bulan lalu — dari Laporan Omset resmi (WeeklyReport).
//   • Top Performing Studio — omset Laporan Omset bulan itu, diurutkan.
//   • Market Accounts (akun jualan) — dari ORDER web kerja harian (tanggal masuk, tanpa batal & order internal), nilai kotor.
//     Ko-fi/Artistree dan platform lain tampil apa adanya dari akun jualan.
//   • ATH/ATL — bulan omset tertinggi & terendah sepanjang riwayat Laporan Omset (bulan yang ada laporannya).
// Uang hanya untuk unit dalam wilayah peran (lingkupKeuangan); unit lain tidak ikut dihitung sama sekali.
import prisma from '../prisma.js'
import { getMonthAttributionRange, isReportInMonth } from '../utils/week.js'
import { STUDIO_DIHITUNG, LAPORAN_DIHITUNG } from '../utils/kolaborasi.js'
import { lingkupKeuangan, filterStudioId, infoLingkup } from '../utils/lingkup.js'
import { ORDER_KLIEN } from '../utils/produksi.js'
import { KOLOM } from '../utils/omsetBayangan.js'
import { kursRata, KURS_BAWAAN } from '../utils/uang.js'

const r2 = (n) => Math.round((n ?? 0) * 100) / 100
// Bulan atribusi satu laporan (sama dengan isReportInMonth): periode baru tidak pernah menyeberang bulan.
function bulanLaporan(r) {
  const a = new Date(r.periodeAwal), b = new Date(r.periodeAkhir)
  const t = a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear() ? a : new Date(a.getTime() + 3 * 86400000)
  return { bulan: t.getMonth() + 1, tahun: t.getFullYear() }
}
const kunci = (b, t) => `${t}-${String(b).padStart(2, '0')}`

export const getLeaderboard = async (req, res) => {
  try {
    const bulan = Number(req.query.bulan) || new Date().getMonth() + 1
    const tahun = Number(req.query.tahun) || new Date().getFullYear()
    const lalu = bulan === 1 ? { bulan: 12, tahun: tahun - 1 } : { bulan: bulan - 1, tahun }
    const lingkup = await lingkupKeuangan(req.userRoles)
    const { rangeStart } = getMonthAttributionRange(lalu.bulan, lalu.tahun)
    const { rangeEnd } = getMonthAttributionRange(bulan, tahun)

    const [studios, semuaLaporan] = await Promise.all([
      prisma.studio.findMany({ where: { statusAktif: true, ...STUDIO_DIHITUNG, ...(lingkup.semua ? {} : { id: { in: [...lingkup.studioIds] } }) }, select: { id: true, nama: true, userRoles: { where: { roleType: 'KOORDINATOR' }, select: { user: { select: { nama: true, fotoUrl: true } } } } } }),
      prisma.weeklyReport.findMany({
        where: { ...LAPORAN_DIHITUNG, ...filterStudioId(lingkup) },
        select: { studioId: true, periodeAwal: true, periodeAkhir: true, totalUsd: true, kurs: true, ...Object.fromEntries(KOLOM.map(k => [k.kolom, true])) },
      }),
    ])
    const idAktif = new Set(studios.map(s => s.id))
    const laporanBulan = semuaLaporan.filter(r => isReportInMonth(r, bulan, tahun))
    const laporanLalu = semuaLaporan.filter(r => isReportInMonth(r, lalu.bulan, lalu.tahun))
    const kurs = kursRata(laporanBulan.map(l => l.kurs)) || KURS_BAWAAN

    // Global Revenue per platform (USD)
    const perPlatform = KOLOM.map(k => ({ platform: k.label, usd: r2(laporanBulan.reduce((a, r) => a + (Number(r[k.kolom]) || 0), 0)) }))
    const totalUsd = r2(laporanBulan.reduce((a, r) => a + r.totalUsd, 0))
    const totalLaluUsd = r2(laporanLalu.reduce((a, r) => a + r.totalUsd, 0))
    const totalIdr = Math.round(laporanBulan.reduce((a, r) => a + r.totalUsd * r.kurs, 0))

    // Top Performing Studio
    const studioRank = studios.map(s => {
      const reps = laporanBulan.filter(r => r.studioId === s.id), repsLalu = laporanLalu.filter(r => r.studioId === s.id)
      const usd = r2(reps.reduce((a, r) => a + r.totalUsd, 0)), usdLalu = r2(repsLalu.reduce((a, r) => a + r.totalUsd, 0))
      return { studioId: s.id, nama: s.nama, koordinator: s.userRoles.map(r => r.user?.nama).filter(Boolean).join(', ') || null, koordinatorFoto: s.userRoles.find(r => r.user?.fotoUrl)?.user.fotoUrl ?? null, usd, idr: Math.round(reps.reduce((a, r) => a + r.totalUsd * r.kurs, 0)), usdLalu, jumlahLaporan: reps.length }
    }).sort((a, b) => b.usd - a.usd || a.nama.localeCompare(b.nama))

    // ATH / ATL per bulan (hanya bulan yang punya laporan)
    const perBulan = new Map()
    for (const r of semuaLaporan) {
      if (!idAktif.has(r.studioId) && !lingkup.semua) continue
      const { bulan: b, tahun: t } = bulanLaporan(r), k = kunci(b, t)
      const g = perBulan.get(k) ?? { bulan: b, tahun: t, usd: 0 }
      g.usd += r.totalUsd; perBulan.set(k, g)
    }
    const riwayat = [...perBulan.values()].map(g => ({ ...g, usd: r2(g.usd) })).sort((a, b) => kunci(a.bulan, a.tahun).localeCompare(kunci(b.bulan, b.tahun)))
    const ath = riwayat.length ? riwayat.reduce((m, x) => (x.usd > m.usd ? x : m)) : null
    const atl = riwayat.length ? riwayat.reduce((m, x) => (x.usd < m.usd ? x : m)) : null

    // Market Accounts — order web kerja harian bulan ini (tanggal masuk WIB)
    const awal = new Date(`${kunci(bulan, tahun)}-01T00:00:00+07:00`)
    const akhir = new Date(`${kunci(bulan === 12 ? 1 : bulan + 1, bulan === 12 ? tahun + 1 : tahun)}-01T00:00:00+07:00`)
    const akunList = await prisma.akunProduksi.findMany({
      where: { studioId: { in: [...idAktif] } },
      select: { id: true, platform: true, namaAkun: true, studioId: true, studio: { select: { nama: true } },
        orders: { where: { ...ORDER_KLIEN, status: { not: 'BATAL' }, tanggalMasuk: { gte: awal, lt: akhir } }, select: { nilaiKotor: true, mataUang: true, kurs: true, nilaiUsd: true } } },
    })
    const akun = akunList
      .filter(a => String(a.platform).toLowerCase() !== 'internal')
      .map(a => {
        const usd = a.orders.reduce((s, o) => s + (o.mataUang === 'USD' && o.nilaiUsd != null ? Number(o.nilaiUsd) : (o.nilaiKotor ?? 0) / (o.mataUang === 'USD' && o.kurs > 0 ? o.kurs : kurs)), 0)
        return { akunId: a.id, platform: a.platform, namaAkun: a.namaAkun, studioId: a.studioId, studio: a.studio?.nama ?? null, jumlahOrder: a.orders.length, usd: r2(usd) }
      })
      .sort((a, b) => b.usd - a.usd || b.jumlahOrder - a.jumlahOrder || a.namaAkun.localeCompare(b.namaAkun))
    const platformAkun = [...akun.reduce((m, a) => {
      const g = m.get(a.platform) ?? { platform: a.platform, jumlahAkun: 0, jumlahOrder: 0, usd: 0 }
      g.jumlahAkun++; g.jumlahOrder += a.jumlahOrder; g.usd = r2(g.usd + a.usd); m.set(a.platform, g); return m
    }, new Map()).values()].sort((a, b) => b.usd - a.usd)

    // Studio Standings (desain Karsa 28 Nov 2026): ATH/ATL tiap studio + akun jualannya.
    const perStudioBulan = new Map()
    for (const r of semuaLaporan) {
      if (!idAktif.has(r.studioId)) continue
      const { bulan: b, tahun: t } = bulanLaporan(r), k = `${r.studioId}|${kunci(b, t)}`
      perStudioBulan.set(k, (perStudioBulan.get(k) ?? 0) + r.totalUsd)
    }
    for (const s of studioRank) {
      const nilai = [...perStudioBulan].filter(([k]) => k.startsWith(`${s.studioId}|`)).map(([, v]) => r2(v))
      s.ath = nilai.length ? Math.max(...nilai) : null
      s.atl = nilai.length ? Math.min(...nilai) : null
      const milik = akun.filter(a => a.studioId === s.studioId)
      s.jumlahAkun = milik.length
      s.platform = [...new Set(milik.map(a => a.platform))]
    }

    return res.json({
      success: true,
      data: {
        bulan, tahun, kurs,
        global: { totalUsd, totalIdr, totalLaluUsd, perubahanPct: totalLaluUsd > 0 ? r2(((totalUsd - totalLaluUsd) / totalLaluUsd) * 100) : null, perPlatform },
        studio: studioRank,
        akun, platformAkun,
        ath, atl, jumlahBulanRiwayat: riwayat.length,
        lingkup: infoLingkup(lingkup),
      },
    })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}
