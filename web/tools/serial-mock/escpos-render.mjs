// Minimal ESC/POS -> HTML renderer for the subset emitted by the web POS
// (react-thermal-printer: Text / Row / Line / Br / Cut / Cashdraw). Text-only;
// no raster/QR/barcode, which the app's receipts never use.

const escapeHtml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Parse a raw ESC/POS byte array into structured lines + flags.
 * @param {number[]|Uint8Array} bytes
 */
export function parseEscpos(bytes) {
  const dec = new TextDecoder('utf-8');
  const lines = [];
  let cur = [];
  const fresh = () => ({ align: 'left', bold: false, underline: false, invert: false, wMul: 1, hMul: 1 });
  let state = fresh();
  let drawerKick = false;
  let cut = false;

  const flush = () => {
    lines.push({ text: dec.decode(Uint8Array.from(cur)), ...state });
    cur = [];
  };

  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b === 0x1b) {
      const c = bytes[i + 1];
      if (c === 0x40) { state = fresh(); i += 1; }                                  // ESC @  init
      else if (c === 0x61) { const n = bytes[i + 2]; state.align = n === 1 ? 'center' : n === 2 ? 'right' : 'left'; i += 2; } // ESC a  align
      else if (c === 0x45) { state.bold = !!bytes[i + 2]; i += 2; }                 // ESC E  bold
      else if (c === 0x2d) { state.underline = !!bytes[i + 2]; i += 2; }            // ESC -  underline
      else if (c === 0x21) { const n = bytes[i + 2]; state.bold = !!(n & 0x08); state.underline = !!(n & 0x80); state.wMul = n & 0x20 ? 2 : 1; state.hMul = n & 0x10 ? 2 : 1; i += 2; } // ESC !  print mode
      else if (c === 0x64) { const n = bytes[i + 2] || 0; for (let k = 0; k < n; k++) flush(); i += 2; } // ESC d  feed n lines
      else if (c === 0x70) { drawerKick = true; i += 4; }                           // ESC p  drawer kick (m t1 t2)
      else { i += 1; }
    } else if (b === 0x1d) {
      const c = bytes[i + 1];
      if (c === 0x21) { const n = bytes[i + 2]; state.wMul = ((n >> 4) & 0x0f) + 1; state.hMul = (n & 0x0f) + 1; i += 2; } // GS !  char size
      else if (c === 0x42) { state.invert = !!bytes[i + 2]; i += 2; }               // GS B  reverse
      else if (c === 0x56) { cut = true; const m = bytes[i + 2]; i += m === 65 || m === 66 ? 3 : 2; } // GS V  cut
      else if (c === 0x4c || c === 0x57) { i += 3; }                                // GS L / GS W  (2-byte args)
      else { i += 1; }
    } else if (b === 0x0a) { flush(); }                                             // LF
    else if (b === 0x0d) { /* CR: ignore */ }
    else if (b >= 0x20) { cur.push(b); }                                            // printable
  }
  if (cur.length) flush();
  return { lines, drawerKick, cut };
}

/** Render parsed ESC/POS into a standalone 80mm-style receipt HTML page. */
export function renderEscposToHtml(bytes, { widthChars = 48, title = 'Receipt' } = {}) {
  const { lines, drawerKick, cut } = parseEscpos(bytes);

  const body = lines
    .map((l) => {
      const scale =
        l.wMul > 1 || l.hMul > 1
          ? `display:inline-block;transform:scale(${l.wMul},${l.hMul});transform-origin:${l.align === 'right' ? 'right' : l.align === 'center' ? 'center' : 'left'} bottom;`
          : '';
      let inner = escapeHtml(l.text) || '&nbsp;';
      if (l.bold) inner = `<b>${inner}</b>`;
      if (l.underline) inner = `<u>${inner}</u>`;
      const invert = l.invert ? 'background:#111;color:#fff;' : '';
      return `<div class="ln" style="text-align:${l.align};${invert}"><span style="${scale}">${inner}</span></div>`;
    })
    .join('\n');

  const cutRow = cut ? `<div class="cut">— — — — ✂ paper cut ✂ — — — —</div>` : '';
  const drawer = drawerKick
    ? `<div class="badge">💵 cash-drawer kick present (ESC p)</div>`
    : '';

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
  body { background:#e9edf2; margin:0; padding:24px; font-family: 'Courier New', monospace; }
  .paper { background:#fff; width:${widthChars}ch; margin:0 auto; padding:16px 14px; box-shadow:0 2px 14px rgba(0,0,0,.18); }
  .ln { white-space:pre; font-size:13px; line-height:1.45; color:#111; }
  .ln b { font-weight:800; }
  .cut { margin-top:10px; color:#94a3b8; font-size:11px; text-align:center; border-top:1px dashed #cbd5e1; padding-top:8px; }
  .badge { width:${widthChars}ch; margin:10px auto 0; text-align:center; font-family:system-ui; font-size:11px; color:#0a7; }
</style></head>
<body><div class="paper">${body}\n${cutRow}</div>${drawer}</body></html>`;
}
