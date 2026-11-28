import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import api from '../../services/api'

// HR & DATABASE (Karsa, 28 Nov 2026): kartu anggota per studio — kontak, kontrak, rekening, dan 4 dokumen.
// Hanya Kepala Circle dan Koordinator studionya. Dokumen disimpan privat; dibuka lewat API yang memeriksa wewenang.
// Anggota baru tetap ditambahkan di menu SDM; nomor WhatsApp bisa diisi anggota sendiri di web kerja (Profil saya).
const DOK = [['KTP', 'Foto KTP'], ['NDA', 'Kontrak NDA'], ['SKCK', 'SKBB / SKCK'], ['BANK', 'Buku Rekening']]
const arti = { fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }
const pesan = (e) => e?.response?.data?.message ?? 'Terjadi kesalahan, coba lagi'
const tglId = (d) => (d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : null)
const hariIni = () => new Date(new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10) + 'T00:00:00Z')
const sisaHari = (o) => (o.kontrakAkhir ? Math.ceil((new Date(o.kontrakAkhir) - hariIni()) / 864e5) : null)
const nDok = (o) => DOK.filter(([k]) => o.dokumen[k]).length
const inisial = (n) => String(n ?? '?').trim().split(/\s+/).slice(0, 2).map(x => x[0]).join('').toUpperCase()
const warnaPeran = (o) => (o.manajemen ? ['var(--text)', 'var(--bg-card)'] : o.peranTipe === 'KOORDINATOR' || o.peranTipe === 'PENDAMPING' ? ['var(--pink-candy)', 'var(--on-pink)'] : o.peranTipe === 'ADMIN_FUNGSIONAL' ? ['var(--accent)', 'var(--on-accent)'] : ['var(--amber-subtle)', 'var(--text)'])

function Kontrak({ o }) {
  const s = sisaHari(o)
  if (!o.kontrakAkhir) return <span style={arti}>Belum diisi</span>
  if (s < 0) return <b style={{ color: 'var(--red)' }}>Sudah berakhir</b>
  if (s <= 30) return <b style={{ color: 'var(--red)' }}>{s} hari lagi</b>
  return <span>Aktif s/d {tglId(o.kontrakAkhir)}</span>
}

function Kartu({ o, onBuka }) {
  const [bg, fg] = warnaPeran(o), n = nDok(o)
  return (
    <button type="button" className="hr-kartu" onClick={() => onBuka(o.id)}>
      <div className="hr-foto">
        <span className="hr-tag" style={{ background: bg, color: fg }}>{o.peran}</span>
        <span className="hr-tag kanan" style={{ background: n === 4 ? 'var(--accent)' : 'var(--bg-card)', color: n === 4 ? 'var(--on-accent)' : 'var(--text)' }}>DOC {n}/4</span>
        {o.fotoUrl ? <img src={o.fotoUrl} alt="" referrerPolicy="no-referrer" /> : <span className="hr-inisial">{inisial(o.nama)}</span>}
      </div>
      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
        <b style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.nama}</b>
        <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{o.posisi || o.peran}</span>
        <small style={{ ...arti, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.email}</small>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 2 }}>{DOK.map(([k]) => <span key={k} className={`hr-dok${o.dokumen[k] ? ' ada' : ''}`}>{k}</span>)}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, fontSize: 12, borderTop: '1px solid var(--border)', paddingTop: 6, marginTop: 2 }}><span style={arti}>Kontrak</span><Kontrak o={o} /></div>
      </div>
    </button>
  )
}

function SlotDokumen({ o, jenis, label, onUbah, setGalat }) {
  const input = useRef(null), [sibuk, setSibuk] = useState(false), d = o.dokumen[jenis]
  const unggah = async (f) => {
    if (!f) return
    const fd = new FormData(); fd.append('jenis', jenis); fd.append('berkas', f)
    setSibuk(true); setGalat('')
    try { await api.post(`/api/hr/${o.id}/dokumen`, fd); await onUbah() } catch (e) { setGalat(pesan(e)) } finally { setSibuk(false) }
  }
  const lihat = async () => {
    const w = window.open('', '_blank')
    try { const r = await api.get(`/api/hr/dokumen/${d.id}`, { responseType: 'blob' }); const url = URL.createObjectURL(r.data); if (w) w.location.href = url; else window.location.href = url; setTimeout(() => URL.revokeObjectURL(url), 60000) } catch (e) { w?.close(); setGalat(pesan(e)) }
  }
  const hapus = async () => { if (!window.confirm(`Hapus ${label} milik ${o.nama}?`)) return; try { await api.delete(`/api/hr/dokumen/${d.id}`); await onUbah() } catch (e) { setGalat(pesan(e)) } }
  return (
    <div style={{ border: `1.5px ${d ? 'solid' : 'dashed'} var(--border-hover)`, borderRadius: 'var(--radius-sm)', padding: 10, background: d ? 'var(--accent-subtle)' : 'transparent', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}><b style={{ fontSize: 13 }}>{label}</b><span style={{ fontSize: 12, fontWeight: 700 }}>{d ? '✓ Ada' : 'Belum'}</span></div>
      {d && <span style={arti}>Diunggah {tglId(d.createdAt)}</span>}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {d && <button type="button" className="btn btn-secondary btn-sm" onClick={lihat}>Lihat</button>}
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => input.current?.click()} disabled={sibuk}>{sibuk ? 'Mengunggah…' : d ? 'Ganti' : '+ Unggah'}</button>
        {d && <button type="button" className="btn btn-secondary btn-sm" onClick={hapus}>Hapus</button>}
      </div>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,application/pdf" hidden onChange={e => { unggah(e.target.files?.[0]); e.target.value = '' }} />
    </div>
  )
}

function Detail({ o, studios, onTutup, onUbah }) {
  const [galat, setGalat] = useState(''), [info, setInfo] = useState('')
  const simpan = (k) => async (e) => {
    const v = e.target.value, lama = k.startsWith('kontrak') ? (o[k] ? String(o[k]).slice(0, 10) : '') : (o[k] ?? '')
    if (String(v) === String(lama)) return
    setGalat(''); setInfo('')
    try { await api.put(`/api/hr/${o.id}`, { [k]: v }); setInfo('Tersimpan'); await onUbah() } catch (er) { setGalat(pesan(er)) }
  }
  const Isian = ({ label, k, type = 'text', ph }) => (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{label}
      <input className="form-input" style={{ paddingLeft: 10 }} type={type} placeholder={ph} defaultValue={k.startsWith('kontrak') ? (o[k] ? String(o[k]).slice(0, 10) : '') : (o[k] ?? '')} onBlur={simpan(k)} />
    </label>
  )
  return (
    <div role="dialog" aria-modal="true" aria-label={`Data ${o.nama}`} onClick={onTutup} style={{ position: 'fixed', inset: 0, background: 'var(--backdrop)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '4vh 12px', overflowY: 'auto' }}>
      <div className="card" onClick={e => e.stopPropagation()} style={{ width: 'min(760px, 100%)', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span className="hr-inisial" style={{ width: 52, height: 52, fontSize: 18 }}>{inisial(o.nama)}</span>
          <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontFamily: 'var(--font-judul)', fontWeight: 600, fontSize: 18 }}>{o.nama}</div><div style={arti}>{o.peran}{o.posisi ? ` · ${o.posisi}` : ''} · {o.email}</div>
            <div style={arti}>Studio: {o.studioIds.map(id => studios.find(s => s.id === id)?.nama).filter(Boolean).join(', ') || '—'} · Bergabung {tglId(o.tanggalMasuk) ?? '—'}</div></div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onTutup} aria-label="Tutup">Tutup</button>
        </div>
        {galat && <div className="login-error">{galat}</div>}
        {info && <div style={{ ...arti, color: 'var(--green)' }}>{info}</div>}
        <div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Kontak & kontrak</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
            <Isian label="Nomor WhatsApp" k="nomorWa" type="tel" ph="08…" />
            <Isian label="Kontrak mulai" k="kontrakMulai" type="date" />
            <Isian label="Kontrak berakhir" k="kontrakAkhir" type="date" />
          </div>
          <div style={{ ...arti, marginTop: 4 }}>Nomor WhatsApp juga bisa diisi anggota sendiri di web kerja (Profil saya).</div>
        </div>
        <div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Rekening gaji</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
            <Isian label="Bank" k="namaBank" ph="mis. BCA" />
            <Isian label="Nomor rekening" k="noRekening" ph="angka saja" />
            <Isian label="Atas nama" k="atasNamaRekening" />
          </div>
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><span style={{ fontWeight: 700 }}>Dokumen</span><b>{nDok(o)}/4 lengkap</b></div>
          <div style={{ height: 7, borderRadius: 99, background: 'var(--track)', margin: '6px 0 10px' }}><div style={{ width: `${nDok(o) * 25}%`, height: '100%', borderRadius: 99, background: 'var(--accent)' }} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>{DOK.map(([k, l]) => <SlotDokumen key={k} o={o} jenis={k} label={l} onUbah={onUbah} setGalat={setGalat} />)}</div>
          <div style={{ ...arti, marginTop: 6 }}>Gambar (PNG/JPG/WebP) atau PDF, maks 8 MB. Tersimpan privat: hanya Kepala Circle dan Koordinator studionya yang bisa membuka.{o.ndaUrl ? ' NDA versi tautan juga ada di kartu Tim web kerja.' : ''}</div>
        </div>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Catatan HR
          <textarea className="form-input" style={{ paddingLeft: 10, paddingTop: 8, minHeight: 70 }} defaultValue={o.catatan ?? ''} onBlur={simpan('catatan')} maxLength={1000} />
        </label>
      </div>
    </div>
  )
}

export default function HrDatabase({ onNavigate }) {
  const [d, setD] = useState(null), [galat, setGalat] = useState(''), [unit, setUnit] = useState('SEMUA'), [saring, setSaring] = useState('semua'), [q, setQ] = useState(''), [buka, setBuka] = useState(null)
  const muat = useCallback(() => api.get('/api/hr').then(r => { setD(r.data.data); setGalat('') }).catch(e => setGalat(pesan(e))), [])
  useEffect(() => { muat() }, [muat])
  const lolos = useCallback((o) => {
    if (q && !`${o.nama} ${o.email} ${o.peran} ${o.posisi ?? ''}`.toLowerCase().includes(q.toLowerCase())) return false
    if (saring === 'lengkap') return nDok(o) === 4
    if (saring === 'belum') return nDok(o) < 4
    if (saring === 'kontrak') { const s = sisaHari(o); return s != null && s <= 30 }
    return true
  }, [q, saring])
  const grup = useMemo(() => {
    if (!d) return []
    const g = [['manajemen', 'Manajemen', d.orang.filter(o => o.manajemen)], ...d.studios.map(s => [s.id, s.nama, d.orang.filter(o => !o.manajemen && o.studioIds.includes(s.id))])]
    return g.filter(([id]) => unit === 'SEMUA' || id === unit).map(([id, nama, isi]) => [id, nama, isi.filter(lolos)]).filter(([, , isi]) => isi.length)
  }, [d, unit, lolos])
  if (!d) return <div className="card" style={{ padding: 24, color: 'var(--text-muted)' }}>{galat || 'Memuat…'}</div>
  const semua = d.orang, hitung = (f) => semua.filter(f).length
  const orangBuka = semua.find(o => o.id === buka)
  return (
    <>
      <div className="page-header" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <h1 style={{ margin: 0 }}>HR & Database</h1><span className="ff-chip">{semua.length} anggota</span><span className="ff-chip" style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}>{hitung(o => nDok(o) === 4)} dokumen lengkap</span>
          {onNavigate && <button type="button" className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto' }} onClick={() => onNavigate('SDM')}>+ Tambah anggota (menu SDM)</button>}
        </div>
        <p>Data anggota per studio: kontak, kontrak, rekening, dan dokumen (KTP, NDA, SKCK, buku rekening). Hanya Kepala Circle dan Koordinator studionya yang bisa membuka. Klik kartu untuk mengisi.</p>
      </div>
      {galat && <div className="login-error" style={{ marginBottom: 12 }}>{galat}</div>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginBottom: 16 }}>
        <select className="form-input" style={{ width: 170, paddingLeft: 10 }} value={unit} onChange={e => setUnit(e.target.value)} aria-label="Unit"><option value="SEMUA">Semua unit</option><option value="manajemen">Manajemen</option>{d.studios.map(s => <option key={s.id} value={s.id}>{s.nama}</option>)}</select>
        {[['semua', `Semua (${semua.length})`], ['lengkap', `Dokumen 4/4 (${hitung(o => nDok(o) === 4)})`], ['belum', `Belum lengkap (${hitung(o => nDok(o) < 4)})`], ['kontrak', `Kontrak ≤ 30 hari (${hitung(o => { const s = sisaHari(o); return s != null && s <= 30 })})`]].map(([k, l]) => (
          <button key={k} type="button" className={`btn btn-sm ${saring === k ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSaring(k)}>{l}</button>
        ))}
        <input className="form-input" style={{ flex: '1 1 220px', paddingLeft: 12, marginLeft: 'auto', maxWidth: 320 }} placeholder="Cari nama, email, peran…" value={q} onChange={e => setQ(e.target.value)} aria-label="Cari anggota" />
      </div>
      {grup.length === 0 && <div className="card" style={arti}>Tidak ada anggota yang cocok.</div>}
      {grup.map(([id, nama, isi]) => (
        <section key={id} style={{ marginBottom: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}><span className="hr-lambang">{id === 'manajemen' ? 'HQ' : nama[0]}</span><h2 style={{ margin: 0, fontSize: 18, flex: 1 }}>{nama}</h2><span className="ff-chip">{isi.length} anggota</span></div>
          <div className="hr-grid">{isi.map(o => <Kartu key={o.id} o={o} onBuka={setBuka} />)}</div>
        </section>
      ))}
      {orangBuka && <Detail o={orangBuka} studios={d.studios} onTutup={() => setBuka(null)} onUbah={muat} />}
    </>
  )
}
