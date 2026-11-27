import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useApi } from '../../hooks/useApi'
import api from '../../services/api'
import { formatRp, formatUSD } from '../../utils/format'

// DETAIL KAS + EKUITAS (Karsa, 27 Nov 2026): semua tempat uang studio + screenshot saldonya.
// Rekening bank = kas resmi; pos lain (marketplace, dalam perjalanan, dana pengamanan) = Dana di luar kas.
// Totalnya otomatis jadi angka Kas + Ekuitas dan Runway di Overview. Screenshot tersimpan privat (hanya pengelola unit).
const JENIS = { MARKET: 'Saldo tertahan di marketplace', TRANSIT: 'Uang dalam perjalanan', AMAN: 'Dana pengamanan' }
const PRESET_POS = [['VGen', 'MARKET'], ['Ko-fi', 'MARKET'], ['Artistree', 'MARKET'], ['Fiverr', 'MARKET'], ['Etsy', 'MARKET'], ['PayPal', 'TRANSIT'], ['Wise', 'TRANSIT'], ['Dana pengamanan', 'AMAN']]
const PRESET_BANK = ['Bank BCA', 'Bank Jago', 'Bank Mandiri', 'SeaBank', 'Bank BRI', 'Bank BNI']
const pesanGalat = (e) => e?.response?.data?.message ?? 'Terjadi kesalahan, coba lagi'
const kartu = { border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface)', padding: 14 }
const arti = { fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }

function Gambar({ id, onBuka, onHapus, bolehHapus }) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    let u = null, batal = false
    api.get(`/api/kas-detail/bukti/${id}`, { responseType: 'blob' }).then(r => { if (!batal) { u = URL.createObjectURL(r.data); setUrl(u) } }).catch(() => {})
    return () => { batal = true; if (u) URL.revokeObjectURL(u) }
  }, [id])
  return (
    <figure style={{ position: 'relative', margin: 0, width: 92, height: 92, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--bg-card)', flexShrink: 0 }}>
      {url ? <img src={url} alt="Screenshot saldo" onClick={() => onBuka(url)} style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'zoom-in' }} /> : <div style={{ ...arti, padding: 8 }}>Memuat…</div>}
      {bolehHapus && <button type="button" onClick={onHapus} aria-label="Hapus screenshot" style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: '50%', border: '1px solid var(--line)', background: 'var(--bg-card)', color: 'var(--text)', fontWeight: 700, lineHeight: '18px', cursor: 'pointer' }}>×</button>}
    </figure>
  )
}

function KotakBukti({ studioId, pemilik, bukti, onUbah, onBuka, setGalat }) {
  const [sibuk, setSibuk] = useState(false), [aktif, setAktif] = useState(false)
  const input = useRef(null)
  const unggah = async (files) => {
    const gambar = [...files].filter(f => f.type.startsWith('image/'))
    if (!gambar.length) return setGalat('Yang bisa dilampirkan hanya gambar (screenshot).')
    const fd = new FormData(); fd.append('studioId', studioId); fd.append(pemilik.jenis === 'rekening' ? 'rekeningId' : 'posId', pemilik.id)
    gambar.forEach((f, i) => fd.append('berkas', f, f.name || `screenshot-${i + 1}.png`))
    setSibuk(true); setGalat('')
    try { await api.post('/api/kas-detail/bukti', fd); await onUbah() } catch (e) { setGalat(pesanGalat(e)) } finally { setSibuk(false) }
  }
  const hapus = async (id) => { if (!window.confirm('Hapus screenshot ini?')) return; try { await api.delete(`/api/kas-detail/bukti/${id}`); await onUbah() } catch (e) { setGalat(pesanGalat(e)) } }
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <b style={{ fontSize: 13 }}>Bukti screenshot ({bukti.length})</b>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => input.current?.click()} disabled={sibuk}>{sibuk ? 'Mengunggah…' : '+ Unggah'}</button>
        <input ref={input} type="file" accept="image/*" multiple hidden onChange={e => { unggah(e.target.files); e.target.value = '' }} />
      </div>
      <div tabIndex={0} role="button" aria-label="Kotak bukti screenshot: klik lalu tekan Ctrl+V untuk menempel"
        onFocus={() => setAktif(true)} onBlur={() => setAktif(false)}
        onPaste={e => { if (e.clipboardData?.files?.length) { e.preventDefault(); unggah(e.clipboardData.files) } }}
        onDragOver={e => { e.preventDefault(); setAktif(true) }} onDragLeave={() => setAktif(false)}
        onDrop={e => { e.preventDefault(); setAktif(false); unggah(e.dataTransfer.files) }}
        style={{ border: `1.5px dashed ${aktif ? 'var(--accent)' : 'var(--border-hover)'}`, borderRadius: 12, padding: 10, minHeight: 92, background: aktif ? 'var(--accent-subtle)' : 'transparent', outline: 'none' }}>
        {bukti.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>{bukti.map(b => <Gambar key={b.id} id={b.id} onBuka={onBuka} onHapus={() => hapus(b.id)} bolehHapus />)}</div>}
        <div style={arti}>{bukti.length ? 'Tempel atau tarik gambar lagi untuk menambah.' : <>Belum ada screenshot. Klik kotak ini lalu tekan <kbd>Ctrl+V</kbd>, tarik gambar ke sini, atau klik + Unggah.</>}</div>
      </div>
    </div>
  )
}

function TandaValid({ x, jenis, boleh, onUbah, setGalat }) {
  const ubah = async () => { try { await api.put('/api/kas-detail/valid', { jenis, id: x.id, valid: !x.valid }); await onUbah() } catch (e) { setGalat(pesanGalat(e)) } }
  const gaya = { padding: '3px 10px', borderRadius: 'var(--pill)', fontSize: 11.5, fontWeight: 700, border: '1.5px solid var(--line)', background: x.valid ? 'var(--accent)' : 'var(--bg-card)', color: x.valid ? 'var(--on-accent)' : 'var(--text-secondary)', cursor: boleh ? 'pointer' : 'default', whiteSpace: 'nowrap' }
  const label = x.valid ? '✓ VALID' : 'BELUM VALID'
  return boleh
    ? <button type="button" style={gaya} onClick={ubah} title={x.valid ? `Dicek ${x.validOleh ?? ''}. Klik untuk membatalkan.` : 'Klik setelah mencocokkan screenshot'}>{label}</button>
    : <span style={gaya} title={x.valid ? `Dicek ${x.validOleh ?? ''}` : 'Menunggu dicek Kepala Circle'}>{label}</span>
}

const Isian = ({ label, children }) => <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', minWidth: 0 }}>{label}{children}</label>
const simpanKalauBerubah = (lama, fn) => (e) => { const v = e.target.value; if (String(v) !== String(lama ?? '')) fn(v) }

export default function DetailKas({ studioId: studioAwal, onNavigate }) {
  const { data: ringkasan } = useApi('/api/monthly-data/summary')
  const daftarStudio = useMemo(() => (ringkasan?.perStudio ?? []).filter(s => s.kas !== null), [ringkasan])
  const [studioId, setStudioId] = useState(studioAwal ?? null)
  useEffect(() => { if (!studioId && daftarStudio.length) setStudioId(daftarStudio[0].studioId) }, [daftarStudio, studioId])
  const [d, setD] = useState(null), [galat, setGalat] = useState(''), [lihat, setLihat] = useState(null)
  const [formRek, setFormRek] = useState(null)
  const muat = useCallback(async () => {
    if (!studioId) return
    try { const r = await api.get(`/api/kas-detail?studioId=${studioId}`); setD(r.data.data) } catch (e) { setGalat(pesanGalat(e)); setD(null) }
  }, [studioId])
  useEffect(() => { setD(null); muat() }, [muat])
  const aksi = async (fn) => { setGalat(''); try { await fn(); await muat() } catch (e) { setGalat(pesanGalat(e)) } }

  if (ringkasan && !daftarStudio.length) return <div className="card" style={{ padding: 24 }}>Detail Kas + Ekuitas hanya untuk pengelola studio.</div>

  const kurs = d?.kurs ?? 0
  const nilaiPos = (p) => p.rupiah + p.dolar * kurs
  const totalBank = (d?.rekening ?? []).reduce((s, r) => s + r.saldo, 0)
  const totalPos = (d?.pos ?? []).reduce((s, p) => s + nilaiPos(p), 0)
  const semua = [...(d?.rekening ?? []), ...(d?.pos ?? [])]
  const jumlahSs = semua.reduce((s, x) => s + x.bukti.length, 0)
  const ubahRek = (r, body) => aksi(() => api.put(`/api/kas-detail/rekening/${r.id}`, body))
  const ubahPos = (p, body) => aksi(() => api.put(`/api/kas-detail/pos/${p.id}`, body))
  const inputGaya = { width: '100%', paddingLeft: 10 }

  return (
    <>
      <div className="page-header" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1>Detail Kas + Ekuitas</h1>
            <p>Catat semua tempat uang studio, lengkap dengan screenshot saldonya. Totalnya otomatis jadi angka Kas + Ekuitas dan Runway di Overview.</p>
          </div>
          <select className="form-input" style={{ width: 200, paddingLeft: 10 }} value={studioId ?? ''} onChange={e => setStudioId(e.target.value)} aria-label="Studio">
            {daftarStudio.map(s => <option key={s.studioId} value={s.studioId}>{s.nama}</option>)}
          </select>
        </div>
      </div>
      {galat && <div className="login-error" style={{ marginBottom: 12 }}>{galat}</div>}
      {!d ? <div className="card" style={{ padding: 24, color: 'var(--text-muted)' }}>Memuat…</div> : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
            <div style={{ ...kartu, background: 'var(--accent)', color: 'var(--on-accent)', borderColor: 'var(--accent)' }}><div style={{ fontSize: 12, fontWeight: 700 }}>Kas + Ekuitas {d.studio}</div><div style={{ fontFamily: 'var(--font-judul)', fontSize: 20, fontWeight: 600 }}>{formatRp(totalBank + totalPos)}</div><div style={{ fontSize: 12, opacity: 0.75 }}>≈ {formatUSD(kurs ? (totalBank + totalPos) / kurs : 0)} · kurs {formatRp(kurs)}</div></div>
            <div style={kartu}><div style={arti}>Rekening bank (kas)</div><div style={{ fontWeight: 800, fontSize: 18 }}>{formatRp(totalBank)}</div><div style={arti}>{d.rekening.length} rekening</div></div>
            <div style={kartu}><div style={arti}>Di luar rekening (ekuitas)</div><div style={{ fontWeight: 800, fontSize: 18 }}>{formatRp(totalPos)}</div><div style={arti}>marketplace, dalam perjalanan, pengamanan</div></div>
            <div style={kartu}><div style={arti}>Sudah dicek</div><div style={{ fontWeight: 800, fontSize: 18 }}>{semua.filter(x => x.valid).length}/{semua.length} valid</div><div style={arti}>{jumlahSs} screenshot terlampir</div></div>
          </div>
          <div style={{ ...arti, marginBottom: 16 }}>Centang <b>VALID</b> hanya bisa diisi Kepala Circle atau Super Admin setelah mencocokkan screenshot. Kalau nominal diubah, statusnya kembali belum valid.</div>

          {/* REKENING BANK */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header" style={{ flexWrap: 'wrap', gap: 8 }}>
              <span className="card-title">Rekening bank <span style={{ ...arti, fontWeight: 400 }}>· uang kas studio</span></span>
              {!formRek && <button type="button" className="btn btn-primary btn-sm" onClick={() => setFormRek({ namaBank: '', atasNama: '', saldo: '' })}>+ Tambah rekening</button>}
            </div>
            {formRek && (
              <form style={{ ...kartu, marginBottom: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, alignItems: 'end' }}
                onSubmit={e => { e.preventDefault(); aksi(() => api.post('/api/kas-detail/rekening', { studioId, ...formRek, saldo: Number(formRek.saldo) || 0 })).then(() => setFormRek(null)) }}>
                <Isian label="Nama bank"><input className="form-input" style={inputGaya} list="preset-bank" value={formRek.namaBank} onChange={e => setFormRek({ ...formRek, namaBank: e.target.value })} required maxLength={80} /><datalist id="preset-bank">{PRESET_BANK.map(b => <option key={b} value={b} />)}</datalist></Isian>
                <Isian label="Atas nama"><input className="form-input" style={inputGaya} value={formRek.atasNama} onChange={e => setFormRek({ ...formRek, atasNama: e.target.value })} maxLength={120} /></Isian>
                <Isian label="Saldo (Rp)"><input className="form-input" style={inputGaya} type="number" min="0" value={formRek.saldo} onChange={e => setFormRek({ ...formRek, saldo: e.target.value })} /></Isian>
                <div style={{ display: 'flex', gap: 8 }}><button type="button" className="btn btn-secondary btn-sm" onClick={() => setFormRek(null)}>Batal</button><button className="btn btn-primary btn-sm">Simpan</button></div>
              </form>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {d.rekening.length === 0 && <div style={arti}>Belum ada rekening. Klik + Tambah rekening.</div>}
              {d.rekening.map(r => (
                <div key={r.id} className="dk-pos" style={kartu}>
                  <div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}><b>🏦 {r.namaBank}</b><TandaValid x={r} jenis="rekening" boleh={d.bolehValidasi} onUbah={muat} setGalat={setGalat} /></div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
                      <Isian label="Saldo (Rp)"><input className="form-input" style={inputGaya} type="number" min="0" defaultValue={r.saldo} onBlur={simpanKalauBerubah(r.saldo, v => ubahRek(r, { saldo: Number(v) || 0 }))} /></Isian>
                      <Isian label="Atas nama"><input className="form-input" style={inputGaya} defaultValue={r.atasNama === '-' ? '' : r.atasNama} onBlur={simpanKalauBerubah(r.atasNama === '-' ? '' : r.atasNama, v => ubahRek(r, { atasNama: v }))} /></Isian>
                      <Isian label="Catatan"><input className="form-input" style={inputGaya} defaultValue={r.catatan ?? ''} placeholder="mis. rekening operasional" onBlur={simpanKalauBerubah(r.catatan, v => ubahRek(r, { catatan: v }))} /></Isian>
                    </div>
                  </div>
                  <KotakBukti studioId={studioId} pemilik={{ jenis: 'rekening', id: r.id }} bukti={r.bukti} onUbah={muat} onBuka={setLihat} setGalat={setGalat} />
                </div>
              ))}
            </div>
          </div>

          {/* POS LAIN */}
          <div className="card">
            <div className="card-header" style={{ flexWrap: 'wrap', gap: 8 }}>
              <span className="card-title">Uang di luar rekening <span style={{ ...arti, fontWeight: 400 }}>· dihitung sebagai ekuitas (dana di luar kas)</span></span>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => aksi(() => api.post('/api/kas-detail/pos', { studioId, jenis: 'MARKET', nama: 'Pos baru' }))}>+ Tambah pos</button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12, alignItems: 'center' }}>
              <span style={arti}>Pilihan cepat:</span>
              {PRESET_POS.map(([n, j]) => <button key={n} type="button" className="btn btn-secondary btn-sm" onClick={() => aksi(() => api.post('/api/kas-detail/pos', { studioId, jenis: j, nama: n }))}>+ {n}</button>)}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {d.pos.length === 0 && <div style={arti}>Belum ada pos. Contoh: saldo VGen yang belum dicairkan, uang di PayPal, atau dana pengamanan.</div>}
              {d.pos.map((p, i) => (
                <div key={p.id} className="dk-pos" style={kartu}>
                  <div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
                      <b>{i + 1}.</b>
                      <select className="form-input" style={{ width: 'auto', paddingLeft: 10 }} defaultValue={p.jenis} onChange={e => ubahPos(p, { jenis: e.target.value })} aria-label="Jenis pos">{Object.entries(JENIS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                      <TandaValid x={p} jenis="pos" boleh={d.bolehValidasi} onUbah={muat} setGalat={setGalat} />
                      <button type="button" className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto' }} onClick={() => { if (window.confirm(`Hapus pos ${p.nama} beserta screenshotnya?`)) aksi(() => api.delete(`/api/kas-detail/pos/${p.id}`)) }}>Hapus</button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
                      <Isian label="Nama akun / tempat"><input className="form-input" style={inputGaya} defaultValue={p.nama} onBlur={simpanKalauBerubah(p.nama, v => ubahPos(p, { nama: v }))} /></Isian>
                      <Isian label="Nominal Rupiah"><input className="form-input" style={inputGaya} type="number" min="0" defaultValue={p.rupiah} onBlur={simpanKalauBerubah(p.rupiah, v => ubahPos(p, { rupiah: Number(v) || 0 }))} /></Isian>
                      <Isian label="Dolar (kalau ada)"><input className="form-input" style={inputGaya} type="number" min="0" step="0.01" defaultValue={p.dolar} onBlur={simpanKalauBerubah(p.dolar, v => ubahPos(p, { dolar: Number(v) || 0 }))} /></Isian>
                      <Isian label="Atas nama"><input className="form-input" style={inputGaya} defaultValue={p.atasNama ?? ''} onBlur={simpanKalauBerubah(p.atasNama, v => ubahPos(p, { atasNama: v }))} /></Isian>
                      <Isian label="Catatan"><input className="form-input" style={inputGaya} defaultValue={p.catatan ?? ''} placeholder="mis. belum dicairkan" onBlur={simpanKalauBerubah(p.catatan, v => ubahPos(p, { catatan: v }))} /></Isian>
                    </div>
                    <div style={{ ...arti, marginTop: 6 }}>Nilai: <b>{formatRp(nilaiPos(p))}</b></div>
                  </div>
                  <KotakBukti studioId={studioId} pemilik={{ jenis: 'pos', id: p.id }} bukti={p.bukti} onUbah={muat} onBuka={setLihat} setGalat={setGalat} />
                </div>
              ))}
            </div>
          </div>
          {onNavigate && <div style={{ marginTop: 14 }}><button type="button" className="btn btn-secondary btn-sm" onClick={() => onNavigate('Dashboard')}>← Kembali ke Overview</button></div>}
        </>
      )}
      {lihat && (
        <div role="dialog" aria-label="Screenshot" onClick={() => setLihat(null)} style={{ position: 'fixed', inset: 0, background: 'var(--backdrop)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, cursor: 'zoom-out' }}>
          <img src={lihat} alt="Screenshot saldo" style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 12 }} />
        </div>
      )}
    </>
  )
}
