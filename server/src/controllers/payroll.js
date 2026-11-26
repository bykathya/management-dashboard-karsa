import prisma from '../prisma.js'
// Wewenang Payroll PER UNIT (21 Okt 2026, keputusan user): Koordinator/Pendamping unit itu, Kepala Circle/Rumah Usaha pemiliknya, atau
// Super Admin. `canManageStudio` biasa terlalu longgar di sini (Koordinator unit A yang hanya Kader di unit B ikut lolos untuk B).
import { kelolaStudio as canManageStudio, STAFF_PLUS } from '../utils/roles.js'
import { hitungLembur } from '../utils/lembur.js'

/** Hari libur/WFA global dalam periode → Map 'YYYY-MM-DD' → jenis (untuk pengali lembur hari libur). */
export async function hariKhususPeriode(awal, akhir) {
  const b = await prisma.hariLiburKerja.findMany({ where: { tanggal: { gte: awal, lt: akhir } }, select: { tanggal: true, jenis: true } })
  return new Map(b.map(x => [x.tanggal.toISOString().slice(0, 10), x.jenis]))
}
/** Lembur presensi DISETUJUI milik unit ini: tercatat di unit ini, atau belum berunit (data lama) bila orangnya hanya bekerja di unit ini. */
export async function lemburPresensiUnit(userId, studioId, awal, akhir, extra = {}) {
  const unitLain = await prisma.userRole.count({ where: { userId, roleType: { not: 'DIGNITY' }, studioId: { not: null, notIn: [studioId] } } })
  return prisma.lemburKehadiran.findMany({ where: { userId, status: 'DISETUJUI', tanggalKerja: { gte: awal, lt: akhir }, ...extra, OR: [{ studioId }, ...(unitLain ? [] : [{ studioId: null }])] } })
}

// LEMBUR SUSULAN (18 Nov 2026, audit alur): lembur yang disetujui/dicatat SETELAH slip bulannya Final/Dibayar dulu tak pernah masuk slip mana pun
// (slip hanya mengambil lembur bulannya sendiri; aturan 9a membolehkan lembur dicatat kapan saja). Sejak bulan ini, slip juga mengambil lembur
// DISETUJUI yang belum diklaim dari bulan-bulan SEBELUMNYA. Batas bawah: awal Penggajian web circle (data sebelumnya diurus Payroll di Management Dashboard lama).
export const SUSULAN_SEJAK = new Date(Date.UTC(2026, 10, 1)) // 1 Nov 2026
const kunciBulan = (d) => new Date(d).toISOString().slice(0, 7)
const rentangBulan = (k) => [new Date(Date.UTC(Number(k.slice(0, 4)), Number(k.slice(5)) - 1, 1)), new Date(Date.UTC(Number(k.slice(0, 4)), Number(k.slice(5)), 1))]
/**
 * SATU rumus uang lembur presensi untuk satu slip — dipakai Penggajian web circle & Payroll di Management Dashboard.
 * Mengambil lembur DISETUJUI milik unit yang belum diklaim slip mana pun: bulan slip ini + susulan bulan sebelumnya (≥ SUSULAN_SEJAK).
 * Uang dihitung PER BULAN ASAL: uang(sudah diklaim bulan itu + baru) − uang(sudah diklaim bulan itu), sehingga batas jam bulanan,
 * pembulatan, minimal menit & pengali libur tetap benar walau Siapkan/Generate diulang. Mengembalikan baris yang perlu ditautkan ke slip.
 */
export async function lemburUntukSlip({ userId, studioId, awal, akhir, aturan }) {
  const baru = await lemburPresensiUnit(userId, studioId, SUSULAN_SEJAK < awal ? SUSULAN_SEJAK : awal, akhir, { penggajianId: null })
  if (!baru.length) return { baris: [], uang: 0, susulan: 0, bulanSusulan: [] }
  const per = new Map(); for (const b of baru) { const k = kunciBulan(b.tanggalKerja); (per.get(k) ?? per.set(k, []).get(k)).push(b) }
  let uang = 0, susulan = 0; const bulanSusulan = []
  for (const [k, rows] of per) {
    const [a0, a1] = rentangBulan(k)
    const [sudah, hk] = await Promise.all([lemburPresensiUnit(userId, studioId, a0, a1, { penggajianId: { not: null } }), hariKhususPeriode(a0, a1)])
    const u = hitungLembur([...sudah, ...rows], aturan, hk).uang - hitungLembur(sudah, aturan, hk).uang
    uang += u
    if (a0 < awal) { susulan += u; bulanSusulan.push(k) }
  }
  return { baris: baru, uang, susulan, bulanSusulan: bulanSusulan.sort() }
}

/** Endpoint baca Payroll WAJIB satu unit yang dikelola pemanggil (sebelumnya tanpa studioId = semua studio se-ekosistem). */
async function unitPayroll(req, res) {
  const { studioId } = req.query
  if (!studioId) { res.status(422).json({ success: false, message: 'studioId wajib diisi' }); return null }
  if (!(await canManageStudio(req.userRoles, studioId))) { res.status(403).json({ success: false, message: 'Hanya Koordinator ke atas unit ini' }); return null }
  return studioId
}

// PAYROLL Ekosistem = BACA-SAJA (18 Nov 2026, keputusan user). Penggajian dikelola di web circle › Penggajian (controllers/circleGaji.js).
// Di sini hanya endpoint baca untuk pemantauan + helper lembur bersama (lemburUntukSlip dipakai circleGaji). Jalur tulis lama
// (Generate, ubah slip, tunjangan, Final, Tandai dibayar, rate card, catatan lembur, tarif lembur) dihapus — lihat routes/payroll.js.

export const getLembur = async (req, res) => {
  try {
    const { userId, bulan, tahun } = req.query
    const studioId = await unitPayroll(req, res); if (!studioId) return
    const where = {
      ...(userId && { userId }),
      rateCard: { studioId },
    }
    if (bulan && tahun) {
      const periodeAwal = new Date(Date.UTC(Number(tahun), Number(bulan) - 1, 1))
      const periodeAkhir = new Date(Date.UTC(Number(tahun), Number(bulan), 1))
      where.tanggal = { gte: periodeAwal, lt: periodeAkhir }
    }
    const lembur = await prisma.catatanLembur.findMany({
      where,
      include: {
        user: { select: { id: true, nama: true } },
        rateCard: { select: { id: true, level: true, studioId: true, fee: true } },
        order: { select: { id: true, judul: true } },
      },
      orderBy: { tanggal: 'desc' },
    })
    return res.json({ success: true, data: lembur })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

export const getPenggajianList = async (req, res) => {
  try {
    const { studioId, bulan, tahun } = req.query
    if (!studioId) return res.status(422).json({ success: false, message: 'studioId wajib diisi' })

    const isManager = await canManageStudio(req.userRoles, studioId)
    const isKoordinatorPlus = req.userRoles?.some(r => STAFF_PLUS.includes(r.roleType))
    const onlyMine = !isManager || !isKoordinatorPlus

    const penggajian = await prisma.penggajian.findMany({
      where: {
        studioId,
        ...(bulan && { bulan: Number(bulan) }),
        ...(tahun && { tahun: Number(tahun) }),
        // Pemilik hanya melihat baris miliknya yang sudah FINAL/DIBAYAR — DRAFT masih angka kerja koordinator.
        ...(onlyMine ? { userId: req.user.id, status: { not: 'DRAFT' } } : {}),
      },
      include: { user: { select: { id: true, nama: true } }, tunjangan: { orderBy: { createdAt: 'asc' } } },
      orderBy: [{ user: { nama: 'asc' } }],
    })
    return res.json({ success: true, data: penggajian })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

// Slip gaji -- JSON dulu (siap dipakai render UI/PDF nanti), belum PDF di langkah ini. Bisa
// diakses manager studio ATAU pemilik baris itu sendiri (bukan cuma manager -- karyawan biasa
// harus bisa lihat slip gajinya sendiri).
export const getSlip = async (req, res) => {
  try {
    const penggajian = await prisma.penggajian.findUnique({
      where: { id: req.params.id },
      include: {
        user: { select: { id: true, nama: true, posisi: true } },
        studio: { select: { id: true, nama: true } },
        catatanLembur: {
          include: {
            rateCard: { select: { level: true } },
            order: { select: { id: true, judul: true } },
          },
          orderBy: { tanggal: 'asc' },
        },
        tunjangan: { orderBy: { createdAt: 'asc' } },
      },
    })
    if (!penggajian) return res.status(404).json({ success: false, message: 'Penggajian tidak ditemukan' })

    // canManageStudio mengizinkan peran APA PUN di studio itu → harus juga Koordinator ke atas (STAFF_PLUS), sama seperti getPenggajianList.
    const isManager = (await canManageStudio(req.userRoles, penggajian.studioId)) && !!req.userRoles?.some(r => STAFF_PLUS.includes(r.roleType))
    const isOwner = penggajian.userId === req.user.id
    if (!isManager && !isOwner) {
      return res.status(403).json({ success: false, message: 'Tidak punya akses ke slip ini' })
    }
    if (!isManager && penggajian.status === 'DRAFT') {
      return res.status(403).json({ success: false, message: 'Slip belum final, belum bisa dilihat' })
    }

    const presensiTerklaim = await prisma.lemburKehadiran.findMany({ where: { penggajianId: penggajian.id } })
    const aturanSlip = await prisma.pengaturanLembur.findUnique({ where: { studioId: penggajian.studioId } })
    const periodeSlip = [new Date(Date.UTC(penggajian.tahun, penggajian.bulan - 1, 1)), new Date(Date.UTC(penggajian.tahun, penggajian.bulan, 1))]
    const lemburSlip = hitungLembur(presensiTerklaim, aturanSlip, await hariKhususPeriode(...periodeSlip))
    const debet = {
      gajiPokok: penggajian.gajiPokok, bonus: penggajian.bonus, komisi: penggajian.komisi,
      lembur: penggajian.lembur, shu: penggajian.shu,
    }
    // Kredit (tunjangan) sekarang baris DINAMIS per studio (lihat TunjanganTemplate), bukan 5
    // kolom tetap lagi -- kirim apa adanya sebagai array {nama, jumlah}, client yang render list.
    const kredit = penggajian.tunjangan.map(t => ({ id: t.id, nama: t.nama, jumlah: t.jumlah }))
    const totalDebet = Object.values(debet).reduce((a, b) => a + b, 0)
    const totalKredit = kredit.reduce((a, t) => a + t.jumlah, 0)

    return res.json({
      success: true,
      data: {
        penggajian, debet, totalDebet, kredit, totalKredit, lemburPresensi: { menit: lemburSlip.menit, hari: lemburSlip.hari, jam: lemburSlip.jam, uang: lemburSlip.uang, mode: aturanSlip?.mode ?? null, tarifPerJam: aturanSlip?.tarifPerJam ?? null },
        potongan: penggajian.potongan, thp: penggajian.thp,
      },
    })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

// Pilihan order untuk catatan lembur (pengganti GET /api/produksi/orders yang dihapus 21 Okt 2026): hanya id/judul/klien, tanpa nilai uang.
export const getLemburPresensi = async (req, res) => {
  try {
    const { studioId, bulan, tahun } = req.query
    if (!studioId || !bulan || !tahun) return res.status(422).json({ success: false, message: 'studioId, bulan, dan tahun wajib diisi' })
    const isManager = (await canManageStudio(req.userRoles, studioId)) && !!req.userRoles?.some(r => STAFF_PLUS.includes(r.roleType))
    if (!isManager) return res.status(403).json({ success: false, message: 'Hanya Koordinator ke atas studio ini' })
    const awal = new Date(Date.UTC(Number(tahun), Number(bulan) - 1, 1)), akhir = new Date(Date.UTC(Number(tahun), Number(bulan), 1))
    const [pengaturan, peran, hk] = await Promise.all([prisma.pengaturanLembur.findUnique({ where: { studioId } }), prisma.userRole.findMany({ where: { studioId, roleType: { not: 'DIGNITY' } }, select: { userId: true } }), hariKhususPeriode(awal, akhir)])
    const ids = [...new Set(peran.map(p => p.userId))]
    const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, nama: true } })
    const berbayar = hitungLembur([], pengaturan).adaTarif
    const orang = []
    for (const u of users) {
      const semua = await lemburPresensiUnit(u.id, studioId, awal, akhir)                       // DISETUJUI milik unit ini
      const menunggu = await prisma.lemburKehadiran.count({ where: { userId: u.id, status: 'MENUNGGU', tanggalKerja: { gte: awal, lt: akhir }, OR: [{ studioId }, { studioId: null }] } })
      const diklaim = semua.filter(x => x.penggajianId), belum = semua.filter(x => !x.penggajianId)
      const r = (b) => { const h = hitungLembur(b, pengaturan, hk); return { menit: h.menit, hari: h.hari, jam: h.jam, uang: h.uang } }
      if (semua.length || menunggu) orang.push({ userId: u.id, nama: u.nama, total: r(semua), sudahMasukSlip: r(diklaim), belumMasukSlip: r(belum), menungguPersetujuan: menunggu })
    }
    orang.sort((a, b) => b.total.menit - a.total.menit)
    return res.json({ success: true, data: { tarifPerJam: pengaturan?.tarifPerJam ?? null, mode: pengaturan?.mode ?? null, otomatis: berbayar, orang, catatan: berbayar ? 'Dihitung dengan aturan lembur unit (diatur koordinator di web circle). Hanya lembur DISETUJUI yang belum masuk slip ditambahkan ke komponen Lembur saat koordinator menyiapkan slip di web circle › Penggajian, sekali saja.' : 'Aturan lembur unit belum punya tarif (atau "Tidak dibayar"): lembur presensi hanya acuan dan TIDAK menambah slip. Koordinator mengatur aturan di web circle › Kehadiran › Jam kerja & lembur.' } })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}
