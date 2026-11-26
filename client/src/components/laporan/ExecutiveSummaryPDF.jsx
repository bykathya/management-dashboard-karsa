// ─────────────────────────────────────────────────────────────────────────
// EXECUTIVE SUMMARY BULANAN (Karsa Circle, tahap 7, 26 Nov 2026): ringkasan satu circle yang dikirim Kepala Circle
// tiap awal bulan. PDF 16:9, gaya hijau tua + krem (keputusan pemilik — warna tetap, tidak ikut tema laporan lain).
// Data: GET /api/reports/executive-summary (controllers/laporanExsum.js). Angka apa adanya dari server; kalimat
// "Kondisi" dirangkai otomatis dari angka itu (tidak menebak). Daftar Leader & Key Person diisi di pembuat laporan.
// ─────────────────────────────────────────────────────────────────────────
import React from 'react'
import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer'
import { daftarkanFontPdf } from './fontPdf'
import { HURUF } from './pdf/primitif'

daftarkanFontPdf()

const HIJAU = '#1f7354', KREM = '#f6f5ea', HITAM = '#16201b', REDUP = '#5d6b63', GARIS = '#cfd6c9', MERAH_MUDA = '#b0268f'
const W = 960, H = 540
const rp = (n) => (n == null ? '—' : (n < 0 ? '−' : '') + 'Rp ' + Math.abs(Math.round(n)).toLocaleString('id-ID'))
const rpRingkas = (n) => { if (n == null) return '—'; const a = Math.abs(n), t = a >= 1e9 ? (a / 1e9).toFixed(1) + ' M' : a >= 1e6 ? (a / 1e6).toFixed(1) + ' jt' : a >= 1e3 ? Math.round(a / 1e3) + ' rb' : String(Math.round(a)); return (n < 0 ? '−' : '') + 'Rp ' + t.replace('.', ',') }
const usd = (n) => '$' + Number(n ?? 0).toLocaleString('en-US', { maximumFractionDigits: 0 })
const persen = (p) => (p == null ? '—' : `${p > 0 ? '+' : ''}${String(p).replace('.', ',')}%`)

const s = StyleSheet.create({
  hal: { width: W, height: H, backgroundColor: KREM, fontFamily: HURUF.jakarta, color: HITAM, padding: 40 },
  kepala: { flexDirection: 'row', justifyContent: 'space-between', fontSize: 9, fontWeight: 700, color: HIJAU, marginBottom: 14 },
  judul: { fontFamily: HURUF.sora, fontSize: 30, fontWeight: 700, color: HIJAU, marginBottom: 4 },
  sub: { fontSize: 11, color: REDUP, marginBottom: 18 },
  kartu: { backgroundColor: '#ffffff', borderRadius: 14, borderWidth: 1, borderColor: GARIS, padding: 14 },
  label: { fontSize: 9, color: REDUP, fontWeight: 600 },
  angka: { fontFamily: HURUF.sora, fontSize: 22, fontWeight: 700, marginTop: 4 },
  kecil: { fontSize: 8.5, color: REDUP, marginTop: 3 },
  kaki: { position: 'absolute', bottom: 18, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', fontSize: 8, color: REDUP },
})

function Kepala({ d }) {
  return <View style={s.kepala}><Text>• Executive Summary</Text><Text>{d.circle ?? ''} · {d.labelBulan}</Text></View>
}
function Kaki({ no }) {
  return <View style={s.kaki} fixed><Text>Angka diambil dari web pusat & web kerja harian.</Text><Text>{no}</Text></View>
}
function Hal({ d, no, judul, sub, children }) {
  return (
    <Page size={[W, H]} style={s.hal}>
      <Kepala d={d} />
      {judul && <Text style={s.judul}>{judul}</Text>}
      {sub && <Text style={s.sub}>{sub}</Text>}
      {children}
      <Kaki no={no} />
    </Page>
  )
}

function Sampul({ d, foto }) {
  return (
    <Page size={[W, H]} style={{ width: W, height: H, flexDirection: 'row', backgroundColor: KREM, fontFamily: HURUF.jakarta }}>
      <View style={{ width: foto ? 420 : W, backgroundColor: HIJAU, padding: 48, justifyContent: 'space-between' }}>
        <Text style={{ color: KREM, fontSize: 11, fontWeight: 700, letterSpacing: 2 }}>{(d.circle ?? '').toUpperCase()}</Text>
        <View>
          <Text style={{ color: KREM, fontFamily: HURUF.sora, fontSize: 44, fontWeight: 700, lineHeight: 1.05 }}>Executive{'\n'}Summary</Text>
          <Text style={{ color: KREM, fontSize: 16, marginTop: 14 }}>{d.labelBulan}</Text>
        </View>
        <Text style={{ color: KREM, fontSize: 9 }}>{d.studio.length} studio · {d.total.anggota} anggota</Text>
      </View>
      {foto && <View style={{ flex: 1, padding: 24 }}><Image src={foto} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 18 }} /></View>}
    </Page>
  )
}

function Tokoh({ d, tokoh, no }) {
  return (
    <Hal d={d} no={no} judul="Leader & Key Person" sub="Orang-orang yang menggerakkan circle bulan ini">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {tokoh.map((t, i) => (
          <View key={i} style={[s.kartu, { width: (W - 80 - 36) / 4, minHeight: 130, backgroundColor: i === 0 ? HIJAU : '#ffffff', borderColor: i === 0 ? HIJAU : GARIS }]}>
            <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: i === 0 ? KREM : HIJAU, alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
              <Text style={{ color: i === 0 ? HIJAU : KREM, fontSize: 15, fontWeight: 700 }}>{(t.nama || '?').trim().split(/\s+/).slice(0, 2).map(x => x[0]).join('').toUpperCase()}</Text>
            </View>
            <Text style={{ fontSize: 13, fontWeight: 700, color: i === 0 ? KREM : HITAM }}>{t.nama}</Text>
            <Text style={{ fontSize: 9.5, marginTop: 3, color: i === 0 ? KREM : HIJAU, fontWeight: 600 }}>{t.peran}</Text>
            {t.studio ? <Text style={{ fontSize: 8.5, marginTop: 3, color: i === 0 ? KREM : REDUP }}>{t.studio}</Text> : null}
          </View>
        ))}
      </View>
    </Hal>
  )
}

function Ringkasan({ d, no }) {
  const t = d.total, laba = t.pengeluaranRp ? t.pemasukanRp - t.pengeluaranRp : null
  const ubah = t.pemasukanLaluRp > 0 ? Math.round(((t.pemasukanRp - t.pemasukanLaluRp) / t.pemasukanLaluRp) * 1000) / 10 : null
  const kotak = [
    ['Pemasukan', rpRingkas(t.pemasukanRp), `${usd(t.pemasukanUsd)} · ${t.order} order · ${persen(ubah)} dari ${d.labelBulanLalu}`, true],
    ['Pengeluaran', rpRingkas(t.pengeluaranRp), t.studioBelumArusKas.length ? `${t.studioBelumArusKas.length} studio belum isi Arus Kas` : 'semua studio sudah isi Arus Kas'],
    ['Laba', laba == null ? '—' : rpRingkas(laba), laba == null ? 'menunggu Arus Kas' : laba < 0 ? 'masih minus' : 'sudah untung'],
    ['Kas akhir semua studio', rpRingkas(t.kasAkhirRp), 'total saldo rekening studio'],
  ]
  return (
    <Hal d={d} no={no} judul="Ringkasan Circle" sub={`${d.studio.length} studio · ${t.anggota} anggota`}>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {kotak.map(([l, a, k, utama]) => (
          <View key={l} style={[s.kartu, { flex: 1, minHeight: 150, justifyContent: 'space-between' }, utama ? { backgroundColor: HIJAU, borderColor: HIJAU } : null]}>
            <Text style={[s.label, utama ? { color: KREM } : null]}>{l}</Text>
            <Text style={[s.angka, { fontSize: 24 }, utama ? { color: KREM } : l === 'Laba' && laba < 0 ? { color: MERAH_MUDA } : null]}>{a}</Text>
            <Text style={[s.kecil, utama ? { color: KREM } : null]}>{k}</Text>
          </View>
        ))}
      </View>
      <Tren d={d} />
    </Hal>
  )
}

function Tren({ d }) {
  const maks = Math.max(1, ...d.tren.map(x => x.rp))
  return (
    <View style={[s.kartu, { marginTop: 14, flex: 1 }]}>
      <Text style={s.label}>Pemasukan 6 bulan terakhir</Text>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 18, flex: 1, marginTop: 8 }}>
        {d.tren.map(x => (
          <View key={x.bulan} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
            <Text style={{ fontSize: 8, color: REDUP, marginBottom: 3 }}>{x.rp ? rpRingkas(x.rp) : '—'}</Text>
            <View style={{ width: '70%', height: `${Math.max(2, (x.rp / maks) * 70)}%`, backgroundColor: x.bulan === d.bulan ? HIJAU : GARIS, borderRadius: 4 }} />
            <Text style={{ fontSize: 9, marginTop: 4, fontWeight: x.bulan === d.bulan ? 700 : 400 }}>{x.label}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

function Tabel({ d, no }) {
  const kol = [['Studio', 1.3], ['Koordinator', 1.5], ['Pemasukan', 1.2], [`vs ${d.labelBulanLalu.slice(0, 3)}`, 0.8], ['Pengeluaran', 1.2], ['Laba', 1.2], ['Kas akhir', 1.2], ['Dana Tengah', 0.9]]
  const sel = (isi, i, gaya) => <Text key={i} style={[{ flex: kol[i][1], fontSize: 9.5, paddingVertical: 6, paddingHorizontal: 4, textAlign: i >= 2 && i <= 6 ? 'right' : 'left' }, gaya]}>{isi}</Text>
  return (
    <Hal d={d} no={no} judul="Omset & Kas per Studio" sub="Pemasukan dari order bulan ini; pengeluaran, laba, dan kas dari Arus Kas tiap studio">
      <View style={[s.kartu, { padding: 8 }]}>
        <View style={{ flexDirection: 'row', backgroundColor: HIJAU, borderRadius: 8 }}>{kol.map(([l], i) => sel(l, i, { color: KREM, fontWeight: 700, fontSize: 9 }))}</View>
        {d.studio.map((x, r) => (
          <View key={x.studioId} style={{ flexDirection: 'row', borderBottomWidth: r === d.studio.length - 1 ? 0 : 1, borderBottomColor: GARIS }}>
            {[x.nama, x.koordinator.join(', ') || '—', rp(x.pemasukanRp), persen(x.perubahanPersen), rp(x.pengeluaranRp), rp(x.labaRp), rp(x.kasAkhirRp), x.danaTengah ? 'Sudah' : 'Belum'].map((v, i) => sel(v, i, i === 0 ? { fontWeight: 700 } : i === 5 && x.labaRp < 0 ? { color: MERAH_MUDA } : i === 7 && !x.danaTengah ? { color: MERAH_MUDA } : null))}
          </View>
        ))}
        <View style={{ flexDirection: 'row', backgroundColor: KREM, borderRadius: 8 }}>
          {['Total', '', rp(d.total.pemasukanRp), '', rp(d.total.pengeluaranRp), d.total.pengeluaranRp ? rp(d.total.pemasukanRp - d.total.pengeluaranRp) : '—', rp(d.total.kasAkhirRp), `${d.danaTengah.sudah}/${d.danaTengah.studio}`].map((v, i) => sel(v, i, { fontWeight: 700 }))}
        </View>
      </View>
      {d.total.studioBelumArusKas.length > 0 && <Text style={[s.kecil, { marginTop: 8, color: MERAH_MUDA }]}>Belum mengisi Arus Kas: {d.total.studioBelumArusKas.join(', ')} — pengeluaran & laba studio itu tampil "—".</Text>}
    </Hal>
  )
}

export function kalimatKondisi(x, labelLalu) {
  const k = []
  if (x.order === 0) k.push('Belum ada pemasukan bulan ini.')
  else if (x.perubahanPersen == null) k.push(`Pemasukan ${rp(x.pemasukanRp)} dari ${x.order} order (bulan ${labelLalu} belum ada pemasukan).`)
  else k.push(`Pemasukan ${rp(x.pemasukanRp)} dari ${x.order} order, ${x.perubahanPersen >= 0 ? 'naik' : 'turun'} ${String(Math.abs(x.perubahanPersen)).replace('.', ',')}% dibanding ${labelLalu}.`)
  if (!x.arusKasDiisi) k.push('Arus Kas belum diisi, jadi laba belum bisa dihitung.')
  else if (x.labaRp != null) k.push(x.labaRp < 0 ? `Masih minus ${rp(-x.labaRp)}.` : `Untung ${rp(x.labaRp)}.`)
  if (!x.danaTengah) k.push('Dana Tengah bulan ini belum disetor.')
  return k.join(' ')
}

function Kondisi({ d, no, potong }) {
  return (
    <Hal d={d} no={no} judul="Progres & Kondisi Studio" sub="Dirangkai otomatis dari angka tiap studio">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {potong.map(x => (
          <View key={x.studioId} style={[s.kartu, { width: (W - 80 - 12) / 2, minHeight: 110 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 13, fontWeight: 700, color: HIJAU }}>{x.nama}</Text>
              <Text style={{ fontSize: 9, color: REDUP }}>{x.anggota} anggota</Text>
            </View>
            <Text style={{ fontSize: 10.5, lineHeight: 1.45, marginTop: 6 }}>{kalimatKondisi(x, d.labelBulanLalu)}</Text>
          </View>
        ))}
      </View>
    </Hal>
  )
}

function DanaTengah({ d, no }) {
  const dt = d.danaTengah, pakai = dt.pakai.reduce((t, p) => t + p.jumlah, 0)
  return (
    <Hal d={d} no={no} judul="Dana Tengah" sub={`Setoran ${rp(dt.nominal)} per studio per bulan`}>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={[s.kartu, { flex: 1, backgroundColor: HIJAU, borderColor: HIJAU }]}><Text style={[s.label, { color: KREM }]}>Saldo di bank</Text><Text style={[s.angka, { color: KREM }]}>{dt.saldo ? rp(dt.saldo.jumlah) : '—'}</Text><Text style={[s.kecil, { color: KREM }]}>{dt.saldo ? `dicatat per ${dt.saldo.tanggal.split('-').reverse().join('/')}` : 'belum dicatat'}</Text></View>
        <View style={[s.kartu, { flex: 1 }]}><Text style={s.label}>Sudah setor bulan ini</Text><Text style={s.angka}>{dt.sudah} / {dt.studio} studio</Text><Text style={s.kecil}>{rp(dt.sudah * dt.nominal)} terkumpul</Text></View>
        <View style={[s.kartu, { flex: 1 }]}><Text style={s.label}>Dipakai bulan ini</Text><Text style={s.angka}>{rp(pakai)}</Text><Text style={s.kecil}>{dt.pakai.length} catatan</Text></View>
      </View>
      <View style={[s.kartu, { marginTop: 14 }]}>
        <Text style={s.label}>Catatan pemakaian</Text>
        {dt.pakai.length === 0 ? <Text style={[s.kecil, { marginTop: 6 }]}>Tidak ada pemakaian bulan ini.</Text> : dt.pakai.slice(0, 10).map((p, i) => (
          <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: i ? 1 : 0, borderTopColor: GARIS, paddingVertical: 5, marginTop: i ? 0 : 6 }}>
            <Text style={{ fontSize: 10 }}>{p.tanggal.split('-').reverse().join('/')} · {p.keperluan}{p.oleh ? ` (${p.oleh})` : ''}</Text><Text style={{ fontSize: 10, fontWeight: 700 }}>{rp(p.jumlah)}</Text>
          </View>
        ))}
      </View>
    </Hal>
  )
}

function Penutup({ d, catatan }) {
  return (
    <Page size={[W, H]} style={{ width: W, height: H, backgroundColor: HIJAU, padding: 56, justifyContent: 'center', fontFamily: HURUF.jakarta }}>
      <Text style={{ color: KREM, fontFamily: HURUF.sora, fontSize: 44, fontWeight: 700 }}>Terima kasih</Text>
      {catatan ? <Text style={{ color: KREM, fontSize: 13, marginTop: 16, lineHeight: 1.5, maxWidth: 640 }}>{catatan}</Text> : null}
      <Text style={{ color: KREM, fontSize: 11, marginTop: 28 }}>{d.circle ?? ''} · {d.labelBulan}</Text>
    </Page>
  )
}

export default function ExecutiveSummaryPDF({ data: d, tokoh = [], foto = null, catatan = '' }) {
  const per4 = []; for (let i = 0; i < d.studio.length; i += 6) per4.push(d.studio.slice(i, i + 6))
  let no = 1
  return (
    <Document title={`Executive Summary ${d.circle ?? ''} ${d.labelBulan}`}>
      <Sampul d={d} foto={foto} />
      {tokoh.length > 0 && <Tokoh d={d} tokoh={tokoh} no={++no} />}
      <Ringkasan d={d} no={++no} />
      <Tabel d={d} no={++no} />
      {per4.map((p, i) => <Kondisi key={i} d={d} potong={p} no={++no} />)}
      <DanaTengah d={d} no={++no} />
      <Penutup d={d} catatan={catatan} />
    </Document>
  )
}
