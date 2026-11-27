import { useEffect, useState } from 'react'
import api from '../../services/api'

// SOP & ATURAN STUDIO (web pusat, Karsa Circle, 27 Nov 2026): LIHAT SAJA. SOP tiap studio berbeda dan ditulis Koordinator
// di web kerja harian (menu SOP & Aturan). Di sini Kepala Circle/Koordinator melihat SOP studio yang dikelolanya.
const KATEGORI = [['ADMIN', 'SOP Kerja Admin & Koordinator', 'Alur chat klien, serah terima shift, jadwal laporan'], ['AKUN', 'SOP Menjalankan Akun', 'VGen, Ko-fi, Artistree, keamanan akun'], ['ATURAN', "Aturan Studio (Do's & Don'ts)", 'Kedisiplinan, QC, NDA, tata tertib']]
const arti = { fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.5 }

export default function Sop() {
  const [studioId, setStudioId] = useState(null), [d, setD] = useState(null), [galat, setGalat] = useState(''), [kat, setKat] = useState('ADMIN'), [cari, setCari] = useState(''), [buka, setBuka] = useState({})
  useEffect(() => { api.get(`/api/sop${studioId ? `?studioId=${studioId}` : ''}`).then(r => { setD(r.data.data); if (!studioId && r.data.data.studioId) setStudioId(r.data.data.studioId) }).catch(e => setGalat(e?.response?.data?.message ?? 'Gagal memuat SOP')) }, [studioId])
  if (!d) return <div className="card" style={{ padding: 24, color: 'var(--text-muted)' }}>{galat || 'Memuat…'}</div>
  const tampil = d.daftar.filter(p => p.kategori === kat && (!cari || `${p.judul} ${p.ket ?? ''} ${p.poin ?? ''} ${p.tag ?? ''}`.toLowerCase().includes(cari.toLowerCase())))
  const nama = d.studios.find(s => s.id === studioId)?.nama ?? ''
  return (
    <>
      <div className="page-header" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div><h1>SOP & Aturan Studio</h1><p>SOP tiap studio berbeda. Koordinator menulisnya di web kerja harian (menu SOP & Aturan) supaya admin dan talent bisa membaca. Di sini hanya untuk dilihat.</p></div>
          <select className="form-input" style={{ width: 180, paddingLeft: 10 }} value={studioId ?? ''} onChange={e => setStudioId(e.target.value)} aria-label="Studio">{d.studios.map(s => <option key={s.id} value={s.id}>{s.nama}</option>)}</select>
        </div>
      </div>
      {galat && <div className="login-error" style={{ marginBottom: 12 }}>{galat}</div>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <input className="form-input" style={{ flex: '1 1 240px', paddingLeft: 12 }} placeholder="Cari SOP, VGen, NDA, QC…" value={cari} onChange={e => setCari(e.target.value)} aria-label="Cari panduan" />
        <span className="ff-chip" style={{ whiteSpace: 'normal' }}>Lihat saja · ditulis Koordinator {nama} di web kerja harian</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginBottom: 14 }}>
        {KATEGORI.map(([k, j, ket]) => (
          <button key={k} type="button" onClick={() => setKat(k)} style={{ textAlign: 'left', padding: '12px 14px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--border)', background: kat === k ? 'var(--accent)' : 'var(--bg-card)', color: kat === k ? 'var(--on-accent)' : 'var(--text)', cursor: 'pointer' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><b>{j}</b><span>{d.daftar.filter(p => p.kategori === k).length}</span></div>
            <div style={{ fontSize: 12, opacity: 0.75 }}>{ket}</div>
          </button>
        ))}
      </div>
      {tampil.length === 0 ? <div className="card" style={arti}>Belum ada panduan di bagian ini untuk {nama}.</div> : tampil.map((p, i) => (
        <div key={p.id} className="card" style={{ marginBottom: 10 }}>
          <button type="button" onClick={() => setBuka({ ...buka, [p.id]: !buka[p.id] })} aria-expanded={!!buka[p.id]} style={{ display: 'flex', width: '100%', justifyContent: 'space-between', gap: 10, textAlign: 'left', background: 'none', border: 0, padding: 0, color: 'var(--text)', cursor: 'pointer' }}>
            <span><b>{i + 1}. {p.judul}</b>{p.tag && <span className="ff-chip" style={{ marginLeft: 6, fontSize: 11.5, padding: '1px 8px' }}>{p.tag}</span>}{p.ket && <div style={arti}>{p.ket}</div>}</span><span>{buka[p.id] ? '▾' : '▸'}</span>
          </button>
          {buka[p.id] && p.poin && <ul style={{ margin: '10px 0 0', paddingLeft: 20, lineHeight: 1.6 }}>{p.poin.split('\n').filter(x => x.trim()).map((x, j) => <li key={j}>{x.replace(/^[-•*]\s*/, '')}</li>)}</ul>}
          {buka[p.id] && <div style={{ ...arti, marginTop: 8 }}>Terakhir diubah {p.olehNama ?? ''} · {new Date(p.updatedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</div>}
        </div>
      ))}
    </>
  )
}
