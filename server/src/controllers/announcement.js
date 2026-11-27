import prisma from '../prisma.js'
import { notifyUser }  from '../bot.js'
import { parsePagination } from '../utils/roles.js'

export const JENIS_INFO = ['PENGUMUMAN', 'EVENT', 'KONTRAK', 'DOKUMEN']

/** Pengumuman yang ditujukan ke pengguna ini (dipakai web kerja harian). roles = baris UserRole lengkap. */
export async function wherePengumumanUntuk(roles = []) {
  const studioIds = roles.map(r => r.studioId).filter(Boolean)
  const studios = studioIds.length ? await prisma.studio.findMany({ where: { id: { in: studioIds } }, select: { circleId: true, rumahUsahaId: true } }) : []
  const circleIds = [...new Set([...roles.map(r => r.circleId), ...studios.map(s => s.circleId)].filter(Boolean))]
  const ruIds = [...new Set([...roles.map(r => r.rumahUsahaId), ...studios.map(s => s.rumahUsahaId)].filter(Boolean))]
  const peran = [...new Set(roles.map(r => r.roleType))]
  return { OR: [{ targetTipe: 'ALL' }, { targetTipe: 'CIRCLE', targetId: { in: circleIds } }, { targetTipe: 'RUMAH_USAHA', targetId: { in: ruIds } }, { targetTipe: 'STUDIO', targetId: { in: studioIds } }, { targetTipe: 'ROLE', targetId: { in: peran } }] }
}


async function sendToTelegram(targetTipe, targetId, judul, konten) {
  const msg = `📢 *${judul}*\n\n${konten}`

  let users = []

  if (targetTipe === 'ALL') {
    users = await prisma.user.findMany({
      where: { telegramId: { not: null }, statusAktif: true },
      select: { telegramId: true },
    })
  } else if (targetTipe === 'CIRCLE' && targetId) {
    users = await prisma.user.findMany({
      where: {
        telegramId: { not: null }, statusAktif: true,
        roles: { some: { circleId: targetId } },
      },
      select: { telegramId: true },
    })
  } else if (targetTipe === 'RUMAH_USAHA' && targetId) {
    users = await prisma.user.findMany({
      where: {
        telegramId: { not: null }, statusAktif: true,
        roles: { some: { rumahUsahaId: targetId } },
      },
      select: { telegramId: true },
    })
  } else if (targetTipe === 'STUDIO' && targetId) {
    users = await prisma.user.findMany({
      where: {
        telegramId: { not: null }, statusAktif: true,
        roles: { some: { studioId: targetId } },
      },
      select: { telegramId: true },
    })
  } else if (targetTipe === 'ROLE' && targetId) {
    const where = targetId === 'LIVE_IN'
      ? { telegramId: { not: null }, statusAktif: true, isLiveIn: true }
      : { telegramId: { not: null }, statusAktif: true, roles: { some: { roleType: targetId } } }
    users = await prisma.user.findMany({ where, select: { telegramId: true } })
  }

  let sent = 0
  for (const u of users) {
    const ok = await notifyUser(u.telegramId, msg)
    if (ok) sent++
  }
  return sent
}

export const getAll = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query, 20)

    const [items, total] = await Promise.all([
      prisma.announcement.findMany({ skip, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.announcement.count(),
    ])

    // Fetch semua pembuat sekaligus (2 queries total, bukan N+1)
    const userIds = [...new Set(items.map(a => a.dibuatOleh))]
    const users   = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, nama: true },
    })
    const userMap = Object.fromEntries(users.map(u => [u.id, u.nama]))

    const data = items.map(a => ({ ...a, namaPembuat: userMap[a.dibuatOleh] ?? 'Unknown' }))
    return res.json({ success: true, data, pagination: { page, limit, total } })
  } catch {
    return res.status(500).json({ success: false, message: 'Gagal mengambil pengumuman' })
  }
}

export const create = async (req, res) => {
  try {
    const { judul, targetTipe = 'ALL', targetId, kirimTelegram = false } = req.body
    const konten = String(req.body.konten ?? '').trim()
    // Info & Dokumen (Karsa, 27 Nov 2026): jenis, tautan http(s), tanggal & jam event
    const jenis = JENIS_INFO.includes(req.body.jenis) ? req.body.jenis : 'PENGUMUMAN'
    const tautan = req.body.tautan ? String(req.body.tautan).trim().slice(0, 500) : null
    if (tautan && !/^https?:\/\/\S+$/i.test(tautan)) return res.status(422).json({ success: false, message: 'Tautan harus diawali http:// atau https://' })
    const tanggalEvent = req.body.tanggalEvent ? String(req.body.tanggalEvent) : null
    if (tanggalEvent && !/^\d{4}-\d{2}-\d{2}$/.test(tanggalEvent)) return res.status(422).json({ success: false, message: 'Tanggal event tidak sah' })
    if (jenis === 'EVENT' && !tanggalEvent) return res.status(422).json({ success: false, message: 'Event wajib punya tanggal' })
    const jamEvent = req.body.jamEvent ? String(req.body.jamEvent).slice(0, 40) : null
    if (!judul || (!konten && !tautan && jenis !== 'EVENT')) {
      return res.status(422).json({ success: false, message: 'Judul dan isi (atau tautan) wajib diisi' })
    }
    if (['CIRCLE','RUMAH_USAHA','STUDIO','ROLE'].includes(targetTipe) && !targetId) {
      return res.status(422).json({ success: false, message: `targetId wajib diisi untuk targetTipe ${targetTipe}` })
    }

    const item = await prisma.announcement.create({
      data: {
        dibuatOleh: req.user.id,
        judul, konten, targetTipe,
        targetId: targetId ?? null,
        jenis, tautan, jamEvent, tanggalEvent: tanggalEvent ? new Date(tanggalEvent + 'T00:00:00.000Z') : null,
      },
    })

    let telegramSent = 0
    if (kirimTelegram && process.env.TELEGRAM_BOT_TOKEN) {
      telegramSent = await sendToTelegram(targetTipe, targetId, judul, konten)
    }

    return res.status(201).json({
      success: true,
      data: item,
      message: kirimTelegram
        ? `Pengumuman dibuat & dikirim ke ${telegramSent} anggota via Telegram`
        : 'Pengumuman berhasil dibuat',
      telegramSent,
    })
  } catch {
    return res.status(500).json({ success: false, message: 'Gagal membuat pengumuman' })
  }
}

export const remove = async (req, res) => {
  try {
    const item = await prisma.announcement.findUnique({ where: { id: req.params.id } })
    if (!item) return res.status(404).json({ success: false, message: 'Pengumuman tidak ditemukan' })

    const isOwner = item.dibuatOleh === req.user.id
    const userRoles = await prisma.userRole.findMany({ where: { userId: req.user.id }, select: { roleType: true } })
    const isAdmin = userRoles.some(r => ['KOORDINATOR','PENDAMPING','KEPALA_CIRCLE','KEPALA_RUMAH_USAHA','KEPALA_EKOSISTEM','ADVISOR'].includes(r.roleType))
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Tidak bisa menghapus pengumuman orang lain' })
    }

    await prisma.announcement.delete({ where: { id: req.params.id } })
    return res.json({ success: true, message: 'Pengumuman dihapus' })
  } catch {
    return res.status(500).json({ success: false, message: 'Gagal menghapus pengumuman' })
  }
}
