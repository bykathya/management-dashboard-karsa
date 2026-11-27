import { useEffect, useState } from 'react'
import api from '../../services/api'
import { ECOSYSTEM_NAME } from '../../config/ecosystem'

// MANIFEST (web pusat, Karsa Circle, 27 Nov 2026): kumpulan manifestasi semua anggota per studio. Anggota menulis sendiri di
// web kerja harian (menu Manifest) selama bulan berjalan; mulai tanggal 1 bulan berikutnya terkunci. Di sini: rekap, salin format WA, unduh .txt.
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const arti = { fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.5 }
const panah = { width: 28, height: 28, padding: 0, borderRadius: 8, border: '1px solid var(--border-hover)', background: 'var(--bg-card)', color: 'var(--text)', cursor: 'pointer' }
const inisial = (n) => String(n ?? '?').trim().split(/\s+/).slice(0, 2).map(x => x[0]).join('').toUpperCase()

export default function Manifest() {
  const kini = new Date(Date.now() + 7 * 3600000)
  const [p, setP] = useState({ bulan: kini.getUTCMonth() + 1, tahun: kini.getUTCFullYear() })
  const [d, setD] = useState(null), [galat, setGalat] = useState(''), [pilih, setPilih] = useState(null), [info, setInfo] = useState('')
  useEffect(() => { setD(null); api.get(`/api/manifest?bulan=${p.bulan}&tahun=${p.tahun}`).then(r => { setD(r.data.data); setGalat('') }).catch(e => setGalat(e?.response?.data?.message ?? 'Gagal memuat manifest')) }, [p])
  useEffect(() => { if (d && !d.studio.some(s => s.id === pilih)) setPilih(d.studio[0]?.id ?? null) }, [d, pilih])
  const geser = (n) => setP(x => { const t = x.tahun * 12 + (x.bulan - 1) + n; return { bulan: (t % 12) + 1, tahun: Math.floor(t / 12) } })
  const label = `${BULAN[p.bulan - 1]} ${p.tahun}`
  const teksWA = () => `*MANIFESTASI ${ECOSYSTEM_NAME.toUpperCase()} — ${label.toUpperCase()}*\n\n` + d.studio.filter(s => s.anggota.some(a => a.isi)).map(s => `*${s.nama}*\n` + s.anggota.filter(a => a.isi).map(a => `• _${a.nama}_: ${a.isi}`).join('\n')).join('\n\n')
  const salin = async () => { try { await navigator.clipboard.writeText(teksWA()); setInfo('Tersalin. Tinggal tempel di grup WhatsApp.') } catch { setInfo('Gagal menyalin. Coba unduh .txt.') } }
  const unduh = () => {
    const isi = `MANIFESTASI ${ECOSYSTEM_NAME} — ${label}\n\n` + d.studio.map(s => `== ${s.nama} ==\n` + s.anggota.map(a => `- ${a.nama}: ${a.isi ?? '(belum menulis)'}`).join('\n')).join('\n\n')
    const url = URL.createObjectURL(new Blob([isi], { type: 'text/plain;charset=utf-8' })), a = document.createElement('a')
    a.href = url; a.download = `manifest-${p.tahun}-${String(p.bulan).padStart(2, '0')}.txt`; a.click(); URL.revokeObjectURL(url)
  }
  const st = d?.studio.find(s => s.id === pilih)
  return (
    <>
      <div className="page-header" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div><h1>Manifest</h1><p>Tiap anggota menulis manifestasinya sendiri di web kerja harian (menu Manifest). Di sini semuanya terkumpul per studio.</p></div>
          <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><button type="button" style={panah} onClick={() => geser(-1)} aria-label="Bulan sebelumnya">‹</button><b style={{ minWidth: 120, textAlign: 'center' }}>{label}</b><button type="button" style={panah} onClick={() => geser(1)} aria-label="Bulan berikutnya">›</button></span>
        </div>
      </div>
      {galat && <div className="login-error" style={{ marginBottom: 12 }}>{galat}</div>}
      {!d ? (!galat && <div className="card" style={{ padding: 24, color: 'var(--text-muted)' }}>Memuat…</div>) : (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 12 }}>
              <div style={{ marginRight: 'auto' }}><div style={{ fontFamily: 'var(--font-judul)', fontWeight: 600, fontSize: 16 }}>Status per studio</div><div style={arti}>{d.sudahOrang}/{d.totalOrang} anggota sudah menulis · {d.terkunci ? '🔒 sudah terkunci' : `🔓 terbuka sampai ${new Date(d.batas + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long' })}`}</div></div>
              <button type="button" className="btn btn-primary btn-sm" onClick={salin} disabled={!d.sudahOrang}>Salin format WA</button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={unduh}>Unduh semua (.txt)</button>
            </div>
            {info && <div style={{ ...arti, color: 'var(--green)', marginBottom: 10 }}>{info}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 8 }}>
              {d.studio.map(s => {
                const n = s.anggota.filter(a => a.isi).length
                return (
                  <button key={s.id} type="button" onClick={() => setPilih(s.id)} style={{ textAlign: 'left', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: `1.5px solid ${pilih === s.id ? 'var(--line)' : 'var(--border)'}`, background: pilih === s.id ? 'var(--accent)' : 'var(--bg-surface)', color: pilih === s.id ? 'var(--on-accent)' : 'var(--text)', cursor: 'pointer' }}>
                    <b>{s.nama}</b><div style={{ fontSize: 12, opacity: 0.8 }}>{n}/{s.anggota.length} sudah menulis</div>
                    <div style={{ height: 5, borderRadius: 99, background: 'var(--track)', marginTop: 6 }}><div style={{ width: `${s.anggota.length ? (n / s.anggota.length) * 100 : 0}%`, height: '100%', borderRadius: 99, background: pilih === s.id ? 'var(--on-accent)' : 'var(--accent)' }} /></div>
                  </button>
                )
              })}
            </div>
          </div>
          {st && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
              {st.anggota.map(a => (
                <div key={a.id} className="card" style={{ borderStyle: a.isi ? 'solid' : 'dashed', background: a.isi ? undefined : 'transparent' }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}><span style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--pink-candy)', color: 'var(--on-pink)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12 }}>{inisial(a.nama)}</span><b>{a.nama}</b></div>
                  {a.isi ? <p style={{ whiteSpace: 'pre-wrap', margin: 0, lineHeight: 1.6 }}>{a.isi}</p> : <p style={{ ...arti, margin: 0 }}>Belum menulis.</p>}
                </div>
              ))}
            </div>
          )}
          {d.studio.length === 0 && <div className="card" style={arti}>Belum ada studio yang kamu kelola.</div>}
        </>
      )}
    </>
  )
}
