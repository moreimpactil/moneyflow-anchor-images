// Renders the "צפי עוגנים עתידי" tab, one PNG per bank, from get_bank_anchors results.
// Markup mirrors src/components/advisor/financial-center/tabs/AnchorForecastTab.tsx;
// styles and tokens are read live from the Moneyflow repo.
// Usage: node render.mjs <data.json> <outDir> <repoDir> <fontDir>
// data.json: {"banks":[{"name":"בנק לאומי","results":[...data.results from get_bank_anchors, unchanged...]}, ...]}
// Rows whose `bank` differs from `name` are dropped (the לאומי query also returns הבנק הבינלאומי).
// Exits with code 2 if a bank ends up with no tracks.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const [dataPath, outDir, repo, fontDir] = process.argv.slice(2);
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
fs.mkdirSync(outDir, { recursive: true });

// ---------- CSS from the repo ----------
function blockAt(src, startIdx) {
  const open = src.indexOf('{', startIdx);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(startIdx, i + 1); }
  }
  throw new Error('unbalanced');
}
function rootBlocks(file) {
  const src = fs.readFileSync(path.join(repo, file), 'utf8');
  const out = [];
  const re = /(^|\n)\s*:root\s*\{/g;
  let m;
  while ((m = re.exec(src))) out.push(blockAt(src, m.index + m[1].length));
  return out.join('\n');
}
const tokens = [
  rootBlocks('src/styles/moneyflow-tokens.css'),
  rootBlocks('src/index.css'),
].join('\n');
const arena = fs.readFileSync(path.join(repo, 'src/components/advisor/financial-center/economicArena.css'), 'utf8');

const fontFaces = [400, 500, 600, 700].flatMap((w) =>
  ['hebrew', 'latin'].map((sub) => {
    const f = path.join(fontDir, `rubik-${sub}-${w}-normal.woff2`);
    const b64 = fs.readFileSync(f).toString('base64');
    return `@font-face{font-family:'Rubik';font-style:normal;font-weight:${w};src:url(data:font/woff2;base64,${b64}) format('woff2');}`;
  })
).join('\n');

// ---------- lucide icons (same as the component) ----------
const svg = (inner) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
const ICON = {
  up: svg('<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>'),
  down: svg('<polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/>'),
  flat: svg('<path d="M5 12h14"/>'),
  cal: svg('<path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h5"/><path d="M17.5 17.5 16 16.3V14"/><circle cx="16" cy="16" r="6"/>'),
};

// ---------- helpers mirroring the component ----------
const BANK_STYLE = {
  'בנק לאומי': { bg: '#2563eb', text: '#ffffff', initial: 'ל' },
  'בנק הפועלים': { bg: '#dc2626', text: '#ffffff', initial: 'פ' },
  'בנק מזרחי-טפחות': { bg: '#f97316', text: '#ffffff', initial: 'מ' },
  'בנק דיסקונט': { bg: '#16a34a', text: '#ffffff', initial: 'ד' },
  'בנק מרכנתיל': { bg: '#0066ff', text: '#ffffff', initial: 'מ' },
  'הבנק הבינלאומי': { bg: '#eab308', text: '#171717', initial: 'ב' },
  'בנק ירושלים': { bg: '#64748b', text: '#ffffff', initial: 'י' },
};
const CONF = { 'ידוע': 'exact', 'ביטחון גבוה': 'high', 'ביטחון בינוני': 'medium', 'ביטחון נמוך': 'low' };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const fmtDate = (iso) => { if (!iso) return null; const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };
const tenorMonths = (t) => (t.includes('מק') ? 0 : Math.round(parseFloat(t) * 12));
function daysText(used, total) {
  if (total <= 0) return '';
  const remaining = Math.max(total - used, 0);
  if (remaining > 0) return `חושב על ${used} מתוך ${total} ימי מסחר · נותרו ${remaining}`;
  return `חושב על כל ${total} ימי המסחר בחלון`;
}
function chip(r) {
  let change = r.expected_anchor.expected_change_pp;
  if (change === null || change === undefined) return `<span class="ecb flat">${ICON.flat}ללא שינוי צפוי</span>`;
  // The tool rounds to 2dp; recover the sign the engine had from the two values.
  const diff = r.expected_anchor.value_percent - r.current_anchor.value_percent;
  const sign = change !== 0 ? Math.sign(change) : Math.abs(diff) > 1e-9 ? Math.sign(diff) : 0;
  const tone = sign > 0 ? 'up' : sign < 0 ? 'down' : 'flat';
  return `<span class="ecb ${tone}">${ICON[tone]}${sign > 0 ? '+' : ''}${(sign < 0 && change === 0 ? '-' : '')}${change.toFixed(2)}%</span>`;
}

function cardHtml(r) {
  const isIndexed = r.linkage !== 'לא צמוד';
  const ea = r.expected_anchor;
  const level = CONF[ea.confidence];
  const conf = level
    ? `<span class="tag conf-${level}">${esc(ea.confidence)}${level !== 'exact' && typeof ea.typical_miss_pp === 'number' ? ` · ±${ea.typical_miss_pp.toFixed(2)}` : ''}</span>`
    : '';
  const m = /(\d+)\s*מתוך\s*(\d+)/.exec(ea.trading_days_counted || '');
  const used = m ? +m[1] : 0, total = m ? +m[2] : 0;
  const counted = daysText(used, total);
  const nextUpd = fmtDate(ea.next_update_date);
  const meta = counted + (nextUpd ? `${counted ? ' · ' : ''}עדכון הבא ${nextUpd}` : '');
  return `<div class="fc">
    <div class="fc-h">
      <span class="tg">
        <span class="tag ${isIndexed ? 'idx' : 'nom'}">${isIndexed ? 'צמוד' : 'לא צמוד'}</span>
        <span style="font-size:var(--text-13);font-weight:500">${esc(r.tenor)}</span>
        ${conf}
      </span>
      ${chip(r)}
    </div>
    <div class="fc-two">
      <div class="fc-box cur"><div class="lb">עוגן נוכחי</div><div class="vv">${r.current_anchor ? r.current_anchor.value_percent.toFixed(2) + '%' : '—'}</div></div>
      <div class="fc-box fut"><div class="lb">עוגן צפוי</div><div class="vv">${ea.value_percent.toFixed(2)}%</div></div>
    </div>
    ${total > 0 ? `<div class="bar"><i style="width:${Math.round((used / total) * 100)}%"></i></div>` : ''}
    ${meta ? `<div class="fc-meta">${ICON.cal}${esc(meta)}</div>` : ''}
  </div>`;
}

function bankHtml(name, results) {
  const st = BANK_STYLE[name] ?? { bg: '#64748b', text: '#fff', initial: name.replace('בנק ', '').charAt(0) };
  const items = results
    .filter((r) => r.bank === name && r.expected_anchor)
    .sort((a, b) => Number(a.linkage !== 'לא צמוד') - Number(b.linkage !== 'לא צמוד') || tenorMonths(a.tenor) - tenorMonths(b.tenor));
  return { count: items.length, html: `<div class="card" id="bank">
    <div class="card-h"><div class="tg">
      <span class="blogo blogo-sm" style="background:${st.bg};color:${st.text}">${st.initial}</span>
      <span class="card-t">${esc(name)}</span>
    </div></div>
    <div class="fc-grid">${items.map(cardHtml).join('')}</div>
  </div>` };
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 2600, height: 1600 }, deviceScaleFactor: 1 });
const written = [];
for (const [i, bank] of data.banks.entries()) {
  const { count, html } = bankHtml(bank.name, bank.results);
  if (!count) { console.error(`NO TRACKS for ${bank.name}`); process.exitCode = 2; continue; }
  await page.setContent(`<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8"><style>
${fontFaces}
${tokens}
${arena}
body{margin:0;background:#fff}
.mf-arena{background:#fff;padding:12px;width:1240px;zoom:2}
</style></head><body><div class="mf-arena">${html}</div></body></html>`, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  const SLUG = { 'בנק לאומי': 'leumi', 'בנק הפועלים': 'hapoalim', 'בנק מזרחי-טפחות': 'mizrahi-tefahot', 'בנק דיסקונט': 'discount' };
  const file = path.join(outDir, `${i + 1}-${SLUG[bank.name] ?? 'bank' + (i + 1)}.png`);
  await page.locator('#bank').screenshot({ path: file });
  written.push({ file, tracks: count });
}
await browser.close();
console.log(JSON.stringify(written, null, 1));
