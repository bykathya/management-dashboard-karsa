// Ekspor laporan di layar (Karsa, 28 Nov 2026): PNG dan DOC tanpa pustaka tambahan.
// PNG: salin elemen + gaya hasil hitung peramban ke SVG foreignObject, lalu digambar ke kanvas.
// DOC: HTML yang dibuka Microsoft Word / Google Docs sebagai dokumen.

const unduhBlob = (blob, nama) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = nama; document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

// Salin elemen dengan semua gaya ditulis langsung di atribut style (supaya tetap sama di luar halaman).
function salinBergaya(asli) {
  const salin = asli.cloneNode(true)
  const a = [asli, ...asli.querySelectorAll('*')], b = [salin, ...salin.querySelectorAll('*')]
  a.forEach((el, i) => {
    const s = getComputedStyle(el), t = b[i]
    if (!t?.style) return
    let teks = ''
    for (const p of s) teks += `${p}:${s.getPropertyValue(p)};`
    t.setAttribute('style', teks)
    if (el.tagName === 'SELECT') { const sp = document.createElement('span'); sp.textContent = el.options[el.selectedIndex]?.text ?? ''; sp.setAttribute('style', teks); t.replaceWith(sp); b[i] = sp }
    if (el.tagName === 'INPUT') t.setAttribute('value', el.value)
  })
  salin.querySelectorAll('.no-print, button.no-ekspor').forEach(x => x.remove())
  return salin
}

export async function unduhPng(el, nama) {
  const lebar = el.scrollWidth, tinggi = el.scrollHeight
  const salin = salinBergaya(el)
  salin.style.margin = '0'
  const latar = getComputedStyle(document.querySelector('.main-area') ?? document.body).backgroundColor
  const xml = new XMLSerializer().serializeToString(salin)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${lebar}" height="${tinggi}"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" style="background:${latar};width:${lebar}px">${xml}</div></foreignObject></svg>`
  const img = new Image()
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
  await img.decode()
  const skala = 2, kanvas = document.createElement('canvas')
  kanvas.width = lebar * skala; kanvas.height = tinggi * skala
  const ctx = kanvas.getContext('2d'); ctx.scale(skala, skala); ctx.fillStyle = latar; ctx.fillRect(0, 0, lebar, tinggi); ctx.drawImage(img, 0, 0)
  await new Promise(ok => kanvas.toBlob(b => { unduhBlob(b, nama); ok() }, 'image/png'))
}

export function unduhDoc(el, nama, judul) {
  const salin = el.cloneNode(true)
  salin.querySelectorAll('.no-print, button, select, svg').forEach(x => x.remove())
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${judul}</title>
<style>body{font-family:Arial,sans-serif;font-size:11pt;color:#111}h1{font-size:20pt}h2{font-size:14pt;margin:14pt 0 4pt}table{border-collapse:collapse;width:100%}th,td{border:1px solid #999;padding:4pt 6pt;text-align:left;font-size:10pt}small{color:#555}</style></head><body>${salin.innerHTML}</body></html>`
  unduhBlob(new Blob(['﻿', html], { type: 'application/msword' }), nama)
}

export function unduhCsv(nama, baris) {
  const isi = baris.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
  unduhBlob(new Blob(['﻿' + isi], { type: 'text/csv;charset=utf-8' }), nama)
}
