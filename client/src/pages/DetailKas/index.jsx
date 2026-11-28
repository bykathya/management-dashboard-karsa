import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useApi } from '../../hooks/useApi'
import api from '../../services/api'
import { formatRp, formatUSD } from '../../utils/format'

// DETAIL KAS + EKUITAS (Karsa, 27 Nov 2026): semua tempat uang studio + screenshot saldonya.
// Rekening bank = kas resmi; pos lain (marketplace, dalam perjalanan, dana pengamanan) = Dana di luar kas.
// Totalnya otomatis jadi angka Kas + Ekuitas dan Runway di Overview. Screenshot tersimpan privat (hanya pengelola unit).
const JENIS = { MARKET: 'Saldo tertahan di marketplace', TRANSIT: 'Uang dalam perjalanan', AMAN: 'Dana pengamanan' }
// Pilihan cepat sesuai desain (BANK = rekening bank, sisanya pos di luar rekening).
const PRESET = [['Bank BCA', 'BANK'], ['Bank Jago', 'BANK'], ['Bank Mandiri', 'BANK'], ['SeaBank', 'BANK'], ['PayPal', 'TRANSIT'], ['Wise', 'TRANSIT'], ['VGen', 'MARKET'], ['Ko-fi', 'MARKET'], ['Artistree', 'MARKET'], ['Fiverr', 'MARKET'], ['Etsy', 'MARKET'], ['Dana pengamanan', 'AMAN']]
const pesanGalat = (e) => e?.response?.data?.message ?? 'Terjadi kesalahan, coba lagi'

function Gambar({ id, onBuka, onHapus, bolehHapus }) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    let u = null, batal = false
    api.get(`/api/kas-detail/bukti/${id}`, { responseType: 'blob' }).then(r => { if (!batal) { u = URL.createObjectURL(r.data); setUrl(u) } }).catch(() => {})
    return () => { batal = true; if (u) URL.revokeObjectURL(u) }
  }, [id])
  return (
    <figure>
      {url ? <img src={url} alt="Screenshot saldo" onClick={() => onBuka(url)} style={{ cursor: 'zoom-in' }} /> : <div className="arti" style={{ padding: 8 }}>Memuat…</div>}
      {bolehHapus && <button type="button" onClick={onHapus} aria-label="Hapus screenshot">×</button>}
    </figure>
  )
}

function KotakBukti({ studioId, pemilik, nama, bukti, onUbah, onBuka, setGalat }) {
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
      <div className="baris" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
        <b>Bukti screenshot ({bukti.length})</b>
        <button type="button" className="tombol k p" onClick={() => input.current?.click()} disabled={sibuk}>{sibuk ? 'Mengunggah…' : '+ Unggah'}</button>
        <input ref={input} type="file" accept="image/*" multiple hidden onChange={e => { unggah(e.target.files); e.target.value = '' }} />
      </div>
      <div className={`bukti${aktif ? ' aktif' : ''}`} tabIndex={0} role="button" aria-label="Kotak bukti screenshot: klik lalu tekan Ctrl+V untuk menempel"
        onFocus={() => setAktif(true)} onBlur={() => setAktif(false)}
        onPaste={e => { if (e.clipboardData?.files?.length) { e.preventDefault(); unggah(e.clipboardData.files) } }}
        onDragOver={e => { e.preventDefault(); setAktif(true) }} onDragLeave={() => setAktif(false)}
        onDrop={e => { e.preventDefault(); setAktif(false); unggah(e.dataTransfer.files) }}>
        {bukti.length > 0 && <div className="ss">{bukti.map(b => <Gambar key={b.id} id={b.id} onBuka={onBuka} onHapus={() => hapus(b.id)} bolehHapus />)}</div>}
        <div className="kosong-ss">{bukti.length ? 'Tempel atau tarik lagi untuk menambah.' : <>Belum ada screenshot untuk <b>{nama || 'pos ini'}</b>.<br />Klik kotak ini lalu tekan <kbd>Ctrl+V</kbd>, tarik gambar ke sini, atau klik + Unggah.</>}</div>
      </div>
    </div>
  )
}

function TandaValid({ x, jenis, boleh, onUbah, setGalat }) {
  const ubah = async () => { try { await api.put('/api/kas-detail/valid', { jenis, id: x.id, valid: !x.valid }); await onUbah() } catch (e) { setGalat(pesanGalat(e)) } }
  const label = x.valid ? 'VALID' : 'BELUM VALID'
  return (
    <label className={`valid${x.valid ? ' ya' : ''}`} title={boleh ? (x.valid ? `Dicek ${x.validOleh ?? ''}. Klik untuk membatalkan.` : 'Centang setelah mencocokkan screenshot') : (x.valid ? `Dicek ${x.validOleh ?? ''}` : 'Menunggu dicek Kepala Circle')}
      style={{ cursor: boleh ? 'pointer' : 'default' }}>
      <input type="checkbox" checked={!!x.valid} disabled={!boleh} onChange={ubah} />{label}
    </label>
  )
}

const Isian = ({ label, children }) => <label className="f">{label}{children}</label>
const simpanKalauBerubah = (lama, fn) => (e) => { const v = e.target.value; if (String(v) !== String(lama ?? '')) fn(v) }

export default function DetailKas({ studioId: studioAwal, onNavigate }) {
  const { data: ringkasan } = useApi('/api/monthly-data/summary')
  const daftarStudio = useMemo(() => (ringkasan?.perStudio ?? []).filter(s => s.kas !== null), [ringkasan])
  const [studioId, setStudioId] = useState(studioAwal ?? null)
  useEffect(() => { if (!studioId && daftarStudio.length) setStudioId(daftarStudio[0].studioId) }, [daftarStudio, studioId])
  const [d, setD] = useState(null), [galat, setGalat] = useState(''), [lihat, setLihat] = useState(null)
  const muat = useCallback(async () => {
    if (!studioId) return
    try { const r = await api.get(`/api/kas-detail?studioId=${studioId}`); setD(r.data.data) } catch (e) { setGalat(pesanGalat(e)); setD(null) }
  }, [studioId])
  useEffect(() => { setD(null); muat() }, [muat])
  const aksi = async (fn) => { setGalat(''); try { await fn(); await muat() } catch (e) { setGalat(pesanGalat(e)) } }

  if (ringkasan && !daftarStudio.length) return <div className="kd"><div className="kartu" style={{ padding: 24 }}>Detail Kas + Ekuitas hanya untuk pengelola studio.</div></div>

  const kurs = d?.kurs ?? 0
  const nilaiPos = (p) => p.rupiah + p.dolar * kurs
  const totalBank = (d?.rekening ?? []).reduce((s, r) => s + r.saldo, 0)
  const totalPos = (d?.pos ?? []).reduce((s, p) => s + nilaiPos(p), 0)
  const semua = [...(d?.rekening ?? []), ...(d?.pos ?? [])]
  const jumlahSs = semua.reduce((s, x) => s + x.bukti.length, 0)
  const ubahRek = (r, body) => aksi(() => api.put(`/api/kas-detail/rekening/${r.id}`, body))
  const ubahPos = (p, body) => aksi(() => api.put(`/api/kas-detail/pos/${p.id}`, body))
  const tambah = (nama, jenis) => jenis === 'BANK'
    ? aksi(() => api.post('/api/kas-detail/rekening', { studioId, namaBank: nama, atasNama: '', saldo: 0 }))
    : aksi(() => api.post('/api/kas-detail/pos', { studioId, jenis, nama }))
  const sekarang = new Date()
  const bulanIni = sekarang.toLocaleDateString('id-ID', { month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' })
  const namaStudio = d?.studio ?? daftarStudio.find(s => s.studioId === studioId)?.nama ?? ''

  return (
    <div className="kd">
      <p style={{ margin: '0 0 10px', fontSize: 14 }}>{onNavigate ? <button type="button" className="tautan" style={{ fontWeight: 500, color: 'var(--text-secondary)' }} onClick={() => onNavigate('Dashboard')}>Overview</button> : 'Overview'} › <b>Detail Kas + Ekuitas</b></p>
      <div className="kepala">
        <h1>Detail Kas + Ekuitas</h1>
        <select className="jenis" value={studioId ?? ''} onChange={e => setStudioId(e.target.value)} aria-label="Studio">
          {daftarStudio.map(s => <option key={s.studioId} value={s.studioId}>{s.nama}</option>)}
        </select>
        <div className="pita"><span style={{ fontWeight: 600 }}>{bulanIni}</span>{kurs > 0 && <span className="lime" title={`Kurs Rp ${kurs.toLocaleString('id-ID')} per USD`}>Rp {Math.round(kurs / 1000)}k</span>}</div>
      </div>
      <p className="sub">Catat semua tempat uang studio berada, lengkap dengan screenshot saldonya. Totalnya otomatis jadi angka <b>Kas + Ekuitas</b> di Overview.</p>
      {galat && <div className="login-error" style={{ marginBottom: 12 }}>{galat}</div>}
      {!d ? <div className="kartu" style={{ padding: 24, color: 'var(--text-muted)' }}>Memuat…</div> : (
        <>
          <div className="stats">
            <div className="stat lime"><span>Kas + Ekuitas studio ini</span><b>{formatRp(totalBank + totalPos)}</b><div className="bawah"><span>≈ {formatUSD(kurs ? (totalBank + totalPos) / kurs : 0)}</span></div></div>
            <div className="stat pink"><span>Rekening bank</span><b>{formatRp(totalBank)}</b><div className="bawah"><span>Marketplace, dalam perjalanan &amp; pengamanan: {formatRp(totalPos)}</span></div></div>
            <div className="stat"><span>Sudah dicek</span><b>{semua.filter(x => x.valid).length}/{semua.length} pos valid</b><div className="bawah"><span>{jumlahSs} screenshot terlampir</span></div></div>
          </div>

          <div className="kartu" style={{ padding: 22, marginBottom: 0 }}>
            <div className="baris" style={{ alignItems: 'flex-start' }}>
              <div style={{ flex: '1 1 380px' }}><h2 style={{ margin: 0, fontSize: 19 }}>Pos Saldo &amp; Bukti Screenshot ({namaStudio})</h2>
                <p style={{ margin: '6px 0 0', color: 'var(--text-secondary)', fontSize: 14.5 }}>Satu pos = satu tempat uang. Tiap pos boleh punya beberapa screenshot. Klik kotak bukti lalu tekan <kbd>Ctrl+V</kbd>, atau tarik gambar ke sana.</p></div>
              <button type="button" className="tombol hitam" onClick={() => tambah('Pos baru', 'MARKET')}>+ Tambah Pos</button>
            </div>
            <div className="alat" style={{ marginTop: 16 }}><span className="lbl">Pilihan cepat:</span>
              {PRESET.map(([n, j]) => <button key={n} type="button" className="tombol k" onClick={() => tambah(n, j)}>+ {n}</button>)}
            </div>
          </div>

          {semua.length === 0 && <div className="kartu" style={{ marginTop: 14, padding: 22 }}>Belum ada pos. Klik + Tambah Pos atau pilih dari pilihan cepat.</div>}
          {d.rekening.map((r, i) => (
            <div key={r.id} className="pos">
              <div>
                <div className="baris">
                  <span className="no">{i + 1}</span>
                  <select className="jenis" value="BANK" disabled aria-label="Jenis pos"><option value="BANK">Rekening bank</option></select>
                  <TandaValid x={r} jenis="rekening" boleh={d.bolehValidasi} onUbah={muat} setGalat={setGalat} />
                  <button type="button" className="hapus" disabled title="Rekening bank dihapus lewat Keuangan" aria-label="Hapus pos">×</button>
                </div>
                <div className="isian">
                  <Isian label="Bank / akun"><input defaultValue={r.namaBank} onBlur={simpanKalauBerubah(r.namaBank, v => v.trim() && ubahRek(r, { namaBank: v.trim() }))} maxLength={80} /></Isian>
                  <Isian label="Nominal Rupiah"><input type="number" min="0" inputMode="numeric" defaultValue={r.saldo} onBlur={simpanKalauBerubah(r.saldo, v => ubahRek(r, { saldo: Number(v) || 0 }))} /></Isian>
                  <Isian label="Dolar (kalau ada)"><input value="—" disabled title="Rekening bank dicatat dalam Rupiah" /></Isian>
                </div>
                <div className="isian">
                  <Isian label="Atas nama"><input placeholder="a.n. pemilik rekening/akun" defaultValue={r.atasNama === '-' ? '' : r.atasNama} onBlur={simpanKalauBerubah(r.atasNama === '-' ? '' : r.atasNama, v => ubahRek(r, { atasNama: v }))} /></Isian>
                  <Isian label="Catatan"><input placeholder="mis. rekening operasional" defaultValue={r.catatan ?? ''} onBlur={simpanKalauBerubah(r.catatan, v => ubahRek(r, { catatan: v }))} /></Isian>
                </div>
              </div>
              <KotakBukti studioId={studioId} pemilik={{ jenis: 'rekening', id: r.id }} nama={r.namaBank} bukti={r.bukti} onUbah={muat} onBuka={setLihat} setGalat={setGalat} />
            </div>
          ))}
          {d.pos.map((p, i) => (
            <div key={p.id} className="pos">
              <div>
                <div className="baris">
                  <span className="no">{d.rekening.length + i + 1}</span>
                  <select className="jenis" defaultValue={p.jenis} onChange={e => ubahPos(p, { jenis: e.target.value })} aria-label="Jenis pos">{Object.entries(JENIS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                  <TandaValid x={p} jenis="pos" boleh={d.bolehValidasi} onUbah={muat} setGalat={setGalat} />
                  <button type="button" className="hapus" aria-label="Hapus pos" onClick={() => { if (window.confirm(`Hapus pos ${p.nama} beserta screenshotnya?`)) aksi(() => api.delete(`/api/kas-detail/pos/${p.id}`)) }}>×</button>
                </div>
                <div className="isian">
                  <Isian label="Bank / akun"><input defaultValue={p.nama} onBlur={simpanKalauBerubah(p.nama, v => ubahPos(p, { nama: v }))} /></Isian>
                  <Isian label="Nominal Rupiah"><input type="number" min="0" inputMode="numeric" defaultValue={p.rupiah} onBlur={simpanKalauBerubah(p.rupiah, v => ubahPos(p, { rupiah: Number(v) || 0 }))} /></Isian>
                  <Isian label="Dolar (kalau ada)"><input type="number" min="0" step="0.01" inputMode="decimal" defaultValue={p.dolar} onBlur={simpanKalauBerubah(p.dolar, v => ubahPos(p, { dolar: Number(v) || 0 }))} /></Isian>
                </div>
                <div className="isian">
                  <Isian label="Atas nama"><input placeholder="a.n. pemilik rekening/akun" defaultValue={p.atasNama ?? ''} onBlur={simpanKalauBerubah(p.atasNama, v => ubahPos(p, { atasNama: v }))} /></Isian>
                  <Isian label="Catatan"><input placeholder="mis. saldo VGen belum dicairkan" defaultValue={p.catatan ?? ''} onBlur={simpanKalauBerubah(p.catatan, v => ubahPos(p, { catatan: v }))} /></Isian>
                </div>
              </div>
              <KotakBukti studioId={studioId} pemilik={{ jenis: 'pos', id: p.id }} nama={p.nama} bukti={p.bukti} onUbah={muat} onBuka={setLihat} setGalat={setGalat} />
            </div>
          ))}
          <p className="catatan">Centang <b>Valid</b> hanya bisa diisi Kepala Circle atau Super Admin setelah mencocokkan screenshot. Koordinator mengisi pos dan buktinya untuk studionya sendiri. Kalau nominal diubah, statusnya kembali belum valid.</p>
        </>
      )}
      {lihat && (
        <div role="dialog" aria-label="Screenshot" onClick={() => setLihat(null)} style={{ position: 'fixed', inset: 0, background: 'var(--backdrop)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, cursor: 'zoom-out' }}>
          <img src={lihat} alt="Screenshot saldo" style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 12 }} />
        </div>
      )}
    </div>
  )
}
