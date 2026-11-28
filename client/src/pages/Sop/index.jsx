import { useEffect, useState } from 'react'
import api from '../../services/api'

// SOP & ATURAN STUDIO (web pusat, Karsa Circle, 27 Nov 2026): LIHAT SAJA. SOP tiap studio berbeda dan ditulis Koordinator
// di web kerja harian (menu SOP & Aturan). Di sini Kepala Circle/Koordinator melihat SOP studio yang dikelolanya.
const KATEGORI = [['ADMIN', 'SOP Kerja Admin & Koordinator', 'Alur chat klien, serah terima shift, jadwal laporan harian/mingguan'], ['AKUN', 'SOP Menjalankan Akun', 'Cara menjalankan VGen, Ko-fi, Artistree, dan keamanan akun'], ['ATURAN', "Aturan Studio (Do's & Don'ts)", 'Kedisiplinan, kualitas QC, kerahasiaan NDA, tata tertib']]

export default function Sop() {
  const [studioId, setStudioId] = useState(null), [d, setD] = useState(null), [galat, setGalat] = useState(''), [kat, setKat] = useState('ADMIN'), [cari, setCari] = useState(''), [buka, setBuka] = useState({})
  useEffect(() => { api.get(`/api/sop${studioId ? `?studioId=${studioId}` : ''}`).then(r => { setD(r.data.data); if (!studioId && r.data.data.studioId) setStudioId(r.data.data.studioId) }).catch(e => setGalat(e?.response?.data?.message ?? 'Gagal memuat SOP')) }, [studioId])
  if (!d) return <div className="kd"><div className="kartu" style={{ padding: 24, color: 'var(--text-muted)' }}>{galat || 'Memuat…'}</div></div>
  const tampil = d.daftar.filter(p => p.kategori === kat && (!cari || `${p.judul} ${p.ket ?? ''} ${p.poin ?? ''} ${p.tag ?? ''}`.toLowerCase().includes(cari.toLowerCase())))
  const nama = d.studios.find(s => s.id === studioId)?.nama ?? ''
  const judulKat = KATEGORI.find(k => k[0] === kat)?.[1]
  return (
    <div className="kd">
      <div className="kepala">
        <h1>SOP &amp; Aturan Studio</h1>
        <span className="chip">{d.daftar.length} panduan</span>
        <div className="pita"><select value={studioId ?? ''} onChange={e => setStudioId(e.target.value)} aria-label="Studio">{d.studios.map(s => <option key={s.id} value={s.id}>{s.nama}</option>)}</select></div>
      </div>
      <p className="sub">SOP tiap studio berbeda. Koordinator menulisnya di <b>web kerja harian</b> (menu SOP &amp; Aturan) supaya admin dan talent bisa membaca. Di web pusat ini Kepala Circle bisa melihat SOP semua studio.</p>
      {galat && <div className="login-error" style={{ marginBottom: 12 }}>{galat}</div>}
      <div className="baris" style={{ marginBottom: 16 }}>
        <input className="kd-cari-isi" placeholder="Cari SOP, VGen, NDA, QC…" value={cari} onChange={e => setCari(e.target.value)} aria-label="Cari panduan" />
        <span className="chip" style={{ flex: '1 1 260px', whiteSpace: 'normal' }}>Lihat saja · ditulis koordinator {nama} di web kerja harian</span>
      </div>
      <div className="sop-kat">
        {KATEGORI.map(([k, j, ket]) => (
          <button key={k} type="button" className={kat === k ? 'on' : ''} onClick={() => setKat(k)}>
            <span className="baris" style={{ justifyContent: 'space-between', flexWrap: 'nowrap', alignItems: 'flex-start' }}><b>{j}</b><span className="jml">{d.daftar.filter(p => p.kategori === k).length}</span></span>
            <small>{ket}</small>
          </button>
        ))}
      </div>
      <h2 style={{ margin: '20px 0 4px', fontSize: 24 }}>{judulKat}</h2>
      <p style={{ margin: '0 0 14px', color: 'var(--text-secondary)' }}>{nama}</p>
      {tampil.length === 0 ? (
        <div className="kartu" style={{ padding: 32, textAlign: 'center' }}><b>Belum ada panduan di bagian ini.</b><p style={{ color: 'var(--text-secondary)', margin: '6px 0 0' }}>Koordinator {nama} belum menulis SOP di bagian ini.</p></div>
      ) : tampil.map((p, i) => (
        <div key={p.id} className="kartu sop-item">
          <button type="button" onClick={() => setBuka({ ...buka, [p.id]: !buka[p.id] })} aria-expanded={!!buka[p.id]}>
            <span className="no">{i + 1}</span>
            <span style={{ flex: 1 }}><b>{p.judul}</b>{p.tag && <span className="chip" style={{ marginLeft: 8, fontSize: 12, padding: '1px 10px' }}>{p.tag}</span>}{p.ket && <small className="arti">{p.ket}</small>}</span>
            <span aria-hidden>{buka[p.id] ? '▾' : '▸'}</span>
          </button>
          {buka[p.id] && p.poin && <ul>{p.poin.split('\n').filter(x => x.trim()).map((x, j) => <li key={j}>{x.replace(/^[-•*]\s*/, '')}</li>)}</ul>}
          {buka[p.id] && <small className="arti" style={{ padding: '0 20px 16px' }}>Terakhir diubah {p.olehNama ?? ''} · {new Date(p.updatedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</small>}
        </div>
      ))}
    </div>
  )
}
