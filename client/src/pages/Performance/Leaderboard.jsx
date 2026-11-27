import { useApi } from '../../hooks/useApi'
import { formatUSD, formatRp, getBulanLabel } from '../../utils/format'

// Bagian atas menu Executive › Leaderboard (Karsa, 27 Nov 2026, pola web Mas Zakin).
// Data: GET /api/performance/leaderboard. Omset resmi dari Laporan Omset; akun jualan dari order web kerja harian.
const kartu = { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '14px 16px', minWidth: 0 }
const judulKecil = { fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }
const arti = { fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, marginTop: 4 }
const MEDALI = ['🥇', '🥈', '🥉']

function Persen({ v }) {
  if (v == null) return <span style={{ color: 'var(--text-muted)' }}>belum ada pembanding</span>
  const naik = v >= 0
  return <span style={{ color: naik ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>{naik ? '▲' : '▼'} {Math.abs(v).toLocaleString('id-ID', { maximumFractionDigits: 1 })}% dari bulan lalu</span>
}

function Baris({ no, nama, sub, nilai, maks }) {
  const pct = maks > 0 ? Math.max(2, (nilai / maks) * 100) : 0
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr auto', gap: 10, alignItems: 'center' }}>
      <span style={{ fontWeight: 800, textAlign: 'center' }}>{MEDALI[no - 1] ?? no}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nama}</div>
        {sub && <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{sub}</div>}
        <div style={{ height: 6, borderRadius: 99, background: 'var(--track)', marginTop: 4 }}>
          <div style={{ width: `${pct}%`, height: '100%', borderRadius: 99, background: 'var(--accent)' }} />
        </div>
      </div>
      <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{formatUSD(nilai)}</span>
    </div>
  )
}

export default function Leaderboard({ bulan, tahun }) {
  const { data, loading, error } = useApi(`/api/performance/leaderboard?bulan=${bulan}&tahun=${tahun}`, [bulan, tahun])
  if (loading) return <div className="card" style={{ marginBottom: 24, color: 'var(--text-muted)' }}>Memuat leaderboard…</div>
  if (error || !data) return error ? <div className="login-error" style={{ marginBottom: 16 }}>{error}</div> : null

  const topStudio = data.studio.find(s => s.usd > 0)
  const topAkun = data.akun.find(a => a.usd > 0 || a.jumlahOrder > 0)
  const maksStudio = Math.max(...data.studio.map(s => s.usd), 0)
  const maksAkun = Math.max(...data.akun.map(a => a.usd), 0)
  const label = getBulanLabel(bulan, tahun)

  return (
    <div style={{ marginBottom: 24 }}>
      {/* Tiga kartu utama */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 16 }}>
        <div style={kartu}>
          <div style={judulKecil}>🏆 Top Performing Studio</div>
          <div style={{ fontFamily: 'var(--font-judul)', fontSize: 18, fontWeight: 600 }}>{topStudio?.nama ?? '—'}</div>
          <div style={{ fontWeight: 700 }}>{formatUSD(topStudio?.usd ?? 0)}</div>
          <div style={arti}>Studio dengan omset terbesar di {label}.</div>
        </div>
        <div style={kartu}>
          <div style={judulKecil}>⭐ Top Market Account</div>
          <div style={{ fontFamily: 'var(--font-judul)', fontSize: 18, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{topAkun ? topAkun.namaAkun : '—'}</div>
          <div style={{ fontWeight: 700 }}>{topAkun ? `${formatUSD(topAkun.usd)} · ${topAkun.platform}` : formatUSD(0)}</div>
          <div style={arti}>Akun jualan dengan nilai order terbesar bulan ini.</div>
        </div>
        <div style={kartu}>
          <div style={judulKecil}>🌍 Global Revenue</div>
          <div style={{ fontFamily: 'var(--font-judul)', fontSize: 18, fontWeight: 600 }}>{formatUSD(data.global.totalUsd)}</div>
          <div style={{ fontSize: 12.5 }}>≈ {formatRp(data.global.totalIdr)} · <Persen v={data.global.perubahanPct} /></div>
          <div style={arti}>Total omset semua studio dari Laporan Omset.</div>
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: 16 }}>
        {/* Peringkat studio */}
        <div className="card">
          <div className="card-header"><span className="card-title">Peringkat Studio — {label}</span></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {data.studio.length === 0 ? <div style={{ color: 'var(--text-muted)' }}>Belum ada studio.</div>
              : data.studio.map((s, i) => <Baris key={s.studioId} no={i + 1} nama={s.nama} sub={`bulan lalu ${formatUSD(s.usdLalu)}`} nilai={s.usd} maks={maksStudio} />)}
          </div>
        </div>
        {/* Omset per platform */}
        <div className="card">
          <div className="card-header"><span className="card-title">Omset per Platform</span></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.global.perPlatform.map(p => (
              <div key={p.platform} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
                <span>{p.platform}</span><b>{formatUSD(p.usd)}</b>
              </div>
            ))}
          </div>
          <div style={arti}>Ko-fi, Artistree, dan platform lain masuk "Lainnya" di Laporan Omset. Rinciannya ada di Market Accounts di bawah.</div>
        </div>
      </div>

      {/* Market Accounts */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><span className="card-title">Market Accounts (akun jualan) — {label}</span><span className="card-action">{data.akun.length} akun</span></div>
        {data.platformAkun.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            {data.platformAkun.map(p => (
              <span key={p.platform} style={{ border: '1.5px solid var(--line)', borderRadius: 'var(--pill)', padding: '4px 12px', fontSize: 12.5 }}>
                <b>{p.platform}</b> · {p.jumlahAkun} akun · {formatUSD(p.usd)}
              </span>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {data.akun.length === 0 ? <div style={{ color: 'var(--text-muted)' }}>Belum ada akun jualan.</div>
            : data.akun.map((a, i) => <Baris key={a.akunId} no={i + 1} nama={a.namaAkun} sub={`${a.platform} · ${a.studio ?? '—'} · ${a.jumlahOrder} order`} nilai={a.usd} maks={maksAkun} />)}
        </div>
        <div style={arti}>Dihitung dari order yang dicatat di web kerja harian (tanggal masuk bulan ini, tanpa order batal), nilai sebelum potongan platform.</div>
      </div>

      {/* ATH / ATL */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        <div style={{ ...kartu, borderLeft: '4px solid var(--accent)' }}>
          <div style={judulKecil}>📈 ATH (bulan tertinggi)</div>
          <div style={{ fontFamily: 'var(--font-judul)', fontSize: 17, fontWeight: 600 }}>{data.ath ? formatUSD(data.ath.usd) : '—'}</div>
          <div>{data.ath ? getBulanLabel(data.ath.bulan, data.ath.tahun) : 'belum ada laporan'}</div>
          <div style={arti}>Omset bulanan paling tinggi sejak mulai lapor.</div>
        </div>
        <div style={{ ...kartu, borderLeft: '4px solid var(--pink)' }}>
          <div style={judulKecil}>📉 ATL (bulan terendah)</div>
          <div style={{ fontFamily: 'var(--font-judul)', fontSize: 17, fontWeight: 600 }}>{data.atl ? formatUSD(data.atl.usd) : '—'}</div>
          <div>{data.atl ? getBulanLabel(data.atl.bulan, data.atl.tahun) : 'belum ada laporan'}</div>
          <div style={arti}>Omset bulanan paling rendah dari {data.jumlahBulanRiwayat} bulan yang ada laporannya.</div>
        </div>
      </div>
    </div>
  )
}
