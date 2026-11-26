import { useEffect, useState } from 'react'
import api from '../../services/api'

// PEMBUAT EXECUTIVE SUMMARY (Karsa Circle, tahap 7, 26 Nov 2026): pilih bulan → isi Leader & Key Person (tersimpan di perangkat ini,
// awalnya dari peran Kepala Circle/Koordinator) → pilih foto sampul dari perangkat (tidak diunggah ke server) → Unduh PDF.
const KUNCI = 'exsum-tokoh'
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const bacaTokoh = () => { try { return JSON.parse(localStorage.getItem(KUNCI) ?? 'null') } catch { return null } }

export default function PembuatExecutiveSummary() {
  const kini = new Date(), lalu = new Date(kini.getFullYear(), kini.getMonth() - 1, 1)
  const [bulan, setBulan] = useState(lalu.getMonth() + 1), [tahun, setTahun] = useState(lalu.getFullYear())
  const [d, setD] = useState(null), [galat, setGalat] = useState(''), [sibuk, setSibuk] = useState(false)
  const [tokoh, setTokoh] = useState(bacaTokoh), [foto, setFoto] = useState(null), [catatan, setCatatan] = useState('')
  const kunci = `${tahun}-${String(bulan).padStart(2, '0')}`

  useEffect(() => {
    setD(null); setGalat('')
    api.get('/api/reports/executive-summary', { params: { bulan: kunci } })
      .then(r => { setD(r.data.data); setTokoh(t => t ?? r.data.data.tokohBawaan.slice(0, 8)) })
      .catch(e => setGalat(e.response?.data?.message || 'Gagal memuat data'))
  }, [kunci])
  useEffect(() => { if (tokoh) try { localStorage.setItem(KUNCI, JSON.stringify(tokoh)) } catch { /* mode privat */ } }, [tokoh])

  const pilihFoto = (e) => {
    const f = e.target.files?.[0]; if (!f) return
    if (!/^image\/(jpeg|png)$/.test(f.type)) { setGalat('Foto harus JPG atau PNG'); return }
    const r = new FileReader(); r.onload = () => setFoto(r.result); r.readAsDataURL(f)
  }
  const unduh = async () => {
    setSibuk(true); setGalat('')
    try {
      const [{ pdf }, { default: ExecutiveSummaryPDF }] = await Promise.all([import('@react-pdf/renderer'), import('../../components/laporan/ExecutiveSummaryPDF')])
      const blob = await pdf(<ExecutiveSummaryPDF data={d} tokoh={(tokoh ?? []).filter(t => t.nama?.trim())} foto={foto} catatan={catatan.trim()} />).toBlob()
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `Executive Summary ${d.circle ?? ''} ${d.labelBulan}.pdf`.replace(/\s+/g, ' ').trim(); a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 4000)
    } catch { setGalat('Gagal membuat PDF') } finally { setSibuk(false) }
  }
  const ubahTokoh = (i, k, v) => setTokoh(t => t.map((x, j) => j === i ? { ...x, [k]: v } : x))

  return (
    <div className="card" style={{ padding: 24 }}>
      <h2 style={{ margin: '0 0 4px' }}>Executive Summary bulanan</h2>
      <p style={{ color: 'var(--text-secondary)', marginTop: 0, fontSize: 14 }}>Ringkasan circle untuk dikirim tiap awal bulan. Angka terisi otomatis dari Pemasukan, Arus Kas, dan Dana Tengah tiap studio.</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        <select className="form-input" style={{ width: 'auto' }} value={bulan} onChange={e => setBulan(Number(e.target.value))} aria-label="Bulan">{BULAN.map((b, i) => <option key={b} value={i + 1}>{b}</option>)}</select>
        <select className="form-input" style={{ width: 'auto' }} value={tahun} onChange={e => setTahun(Number(e.target.value))} aria-label="Tahun">{[0, 1, 2].map(i => <option key={i} value={kini.getFullYear() - i}>{kini.getFullYear() - i}</option>)}</select>
      </div>
      {galat && <div className="login-error" style={{ marginBottom: 12 }}>{galat}</div>}
      {!d ? (!galat && <div style={{ color: 'var(--text-muted)' }}>Memuat…</div>) : (
        <div style={{ display: 'grid', gap: 18 }}>
          {d.total.studioBelumArusKas.length > 0 && <div className="card" style={{ background: 'var(--pink-subtle)', padding: 12, fontSize: 14 }}>Belum mengisi Arus Kas {d.labelBulan}: <b>{d.total.studioBelumArusKas.join(', ')}</b>. Pengeluaran & laba studio itu akan tampil "—".</div>}
          <div>
            <b>Leader & Key Person</b> <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>· tersimpan di perangkat ini, dipakai lagi bulan depan</span>
            <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
              {(tokoh ?? []).map((t, i) => (
                <div key={i} style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <input className="form-input" style={{ flex: '1 1 160px' }} value={t.nama} onChange={e => ubahTokoh(i, 'nama', e.target.value)} placeholder="Nama" aria-label="Nama" />
                  <input className="form-input" style={{ flex: '1 1 140px' }} value={t.peran} onChange={e => ubahTokoh(i, 'peran', e.target.value)} placeholder="Peran (mis. Mentor, Pilar Pendamping)" aria-label="Peran" />
                  <input className="form-input" style={{ flex: '1 1 140px' }} value={t.studio ?? ''} onChange={e => ubahTokoh(i, 'studio', e.target.value)} placeholder="Studio (opsional)" aria-label="Studio" />
                  <button type="button" className="btn btn-ghost" onClick={() => setTokoh(tokoh.filter((_, j) => j !== i))}>Hapus</button>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8 }}>
                {(tokoh ?? []).length < 8 && <button type="button" className="btn btn-ghost" onClick={() => setTokoh([...(tokoh ?? []), { nama: '', peran: '', studio: '' }])}>+ Tambah orang</button>}
                <button type="button" className="btn btn-ghost" onClick={() => setTokoh(d.tokohBawaan.slice(0, 8))}>Isi ulang dari peran</button>
              </div>
            </div>
          </div>
          <label style={{ display: 'grid', gap: 6 }}><b>Foto sampul</b><span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Dipilih dari perangkatmu, hanya dipakai di PDF ini (tidak diunggah).</span>
            <input type="file" accept="image/jpeg,image/png" onChange={pilihFoto} /></label>
          {foto && <img src={foto} alt="Pratinjau foto sampul" style={{ maxWidth: 240, borderRadius: 12, border: '1.5px solid var(--line)' }} />}
          <label style={{ display: 'grid', gap: 6 }}><b>Pesan penutup (opsional)</b><textarea className="form-input" rows={2} value={catatan} onChange={e => setCatatan(e.target.value)} maxLength={300} placeholder="mis. Terima kasih kerja kerasnya bulan ini!" /></label>
          <div><button type="button" className="btn btn-primary" disabled={sibuk} onClick={unduh}>{sibuk ? 'Membuat PDF…' : 'Unduh Executive Summary (PDF)'}</button></div>
        </div>
      )}
    </div>
  )
}
