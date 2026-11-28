import { useEffect, useState } from 'react'
import api from '../../services/api'
import { ECOSYSTEM_NAME } from '../../config/ecosystem'
import { stikerNama } from '../../components/layout/Topbar'

// MANIFEST (web pusat, Karsa Circle, 27 Nov 2026): kumpulan manifestasi semua anggota per studio. Anggota menulis sendiri di
// web kerja harian (menu Manifest) selama bulan berjalan; mulai tanggal 1 bulan berikutnya terkunci. Di sini: rekap, salin format WA, unduh .txt.
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

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
  const batasPanjang = d ? new Date(d.batas + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long' }) : ''
  const urutNama = (d?.studio ?? []).map(s => s.id)
  const warna = (id) => ['var(--accent)', 'var(--pink-candy)', 'var(--kd-kuning)'][Math.max(0, urutNama.indexOf(id)) % 3]
  return (
    <div className="kd">
      <div className="kepala">
        <h1>Manifest</h1>
        <span className="chip">{label}</span>
        {d && <span className="chip">{d.sudahOrang}/{d.totalOrang} anggota sudah menulis</span>}
        <div className="pita"><button type="button" className="pita-panah" onClick={() => geser(-1)} aria-label="Bulan sebelumnya">‹</button><span style={{ fontWeight: 600 }}>{BULAN[p.bulan - 1].slice(0, 3)} {p.tahun}</span><button type="button" className="pita-panah" onClick={() => geser(1)} aria-label="Bulan berikutnya">›</button></div>
      </div>
      <p className="sub">Tiap anggota menulis manifestasinya sendiri di web kerja harian (menu <b>Manifest</b>), paling lambat tanggal 1. Di sini semuanya terkumpul per studio.</p>
      {galat && <div className="login-error" style={{ marginBottom: 12 }}>{galat}</div>}
      {!d ? (!galat && <div className="kartu" style={{ padding: 24, color: 'var(--text-muted)' }}>Memuat…</div>) : (
        <>
          <div className="kartu" style={{ padding: '22px 20px 20px' }}>
            <div className="judul-tabel" style={{ padding: '0 4px 14px' }}>
              <div><h2>Status Manifestasi per Studio</h2><p>Klik studio untuk membaca manifestasi anggotanya.</p></div>
              <div className="baris ml" style={{ justifyContent: 'flex-end' }}>
                <button type="button" className="tombol k p" onClick={salin} disabled={!d.sudahOrang}>Salin format WA</button>
                <button type="button" className="tombol k hitam" onClick={unduh}>Unduh semua (.txt)</button>
                <span className="tombol k" style={{ cursor: 'default' }}>{d.terkunci ? '🔒 Sudah terkunci' : `🔓 Terbuka sampai ${batasPanjang}`}</span>
              </div>
            </div>
            {info && <p className="catatan" style={{ margin: '0 4px 12px', color: 'var(--text)' }}>{info}</p>}
            <div className="mf-studio">
              {d.studio.map(s => {
                const n = s.anggota.filter(a => a.isi).length, lengkap = s.anggota.length > 0 && n === s.anggota.length
                return (
                  <button key={s.id} type="button" className={pilih === s.id ? 'on' : ''} onClick={() => setPilih(s.id)}>
                    <span className="lambang" style={{ background: warna(s.id), width: 36, height: 36, fontSize: 14, borderRadius: 12 }}>{s.nama?.[0]?.toUpperCase()}</span>
                    <span style={{ flex: 1, minWidth: 0 }}><b>{s.nama}</b><small>{n}/{s.anggota.length} anggota</small></span>
                    <span className={`pill ${lengkap ? 'aman' : 'waspada'}`} style={{ fontSize: 12.5 }}>{lengkap ? 'Lengkap' : 'Pending'}</span>
                  </button>
                )
              })}
            </div>
            {d.studio.length === 0 && <p className="kosong" style={{ margin: 4 }}>Belum ada studio yang kamu kelola.</p>}
          </div>
          {st && (
            <div className="kartu" style={{ padding: 22 }}>
              <div className="studio" style={{ marginBottom: 16 }}><span className="lambang" style={{ background: warna(st.id) }}>{st.nama?.[0]?.toUpperCase()}</span>
                <div><h2 style={{ margin: 0, fontSize: 19 }}>Manifestasi {st.nama}</h2><small className="arti">{st.anggota.filter(a => a.isi).length} dari {st.anggota.length} anggota sudah menulis</small></div></div>
              <div className="mf-isi">
                {st.anggota.map(a => (
                  <div key={a.id} className={a.isi ? 'ada' : ''}>
                    <div className="orang" style={{ justifyContent: 'space-between' }}><span className="orang"><img src={stikerNama(a.nama)} alt="" /><b>{a.nama}</b></span>{!a.isi && <span className="pill waspada" style={{ fontSize: 12 }}>Belum menulis</span>}</div>
                    {a.isi ? <><p>{a.isi}</p>{a.diubah && <small className="kosong">{new Date(a.diubah).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' })}</small>}</> : <p className="kosong">—</p>}
                  </div>
                ))}
                {st.anggota.length === 0 && <p className="kosong">Studio ini belum punya anggota aktif.</p>}
              </div>
            </div>
          )}
          <p className="catatan">Kepala Circle dan koordinator membaca di sini. Anggota menulis dan mengubah manifestasinya sendiri di web kerja harian sampai tanggal 1; setelah itu terkunci.</p>
        </>
      )}
    </div>
  )
}
