const http = require('http');
const https = require('https');

const KV = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SEOUL_KEY = process.env.SEOUL_API_KEY || 'sample';

// Generic HTTP/HTTPS request → parsed JSON
function request(urlStr, opts = {}, bodyStr = null) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const mod = u.protocol === 'https:' ? https : http;
    const req = mod.request({
      hostname: u.hostname,
      port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname + u.search,
      method: opts.method || 'GET',
      headers: opts.headers || {},
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(d); } });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// Upstash KV helpers
const kvHeaders = { Authorization: `Bearer ${KV_TOKEN}` };

const kvGet = urlStr =>
  request(`${KV}/get/${encodeURIComponent(urlStr)}`, { headers: kvHeaders }).then(r => r.result);

const kvSet = (key, val) => {
  const body = JSON.stringify([['SET', key, val]]);
  return request(`${KV}/pipeline`, {
    method: 'POST',
    headers: { ...kvHeaders, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
  }, body);
};

async function kvScanAll(pattern) {
  const keys = [];
  let cursor = 0;
  do {
    const r = await request(
      `${KV}/scan/${cursor}/match/${encodeURIComponent(pattern)}/count/100`,
      { headers: kvHeaders }
    );
    cursor = parseInt(r.result[0], 10);
    keys.push(...r.result[1]);
  } while (cursor !== 0);
  return keys;
}

// Seoul OpenAPI — fetch all tennis rows with pagination
async function fetchAllTennis() {
  const keyword = encodeURIComponent('테니스');
  const rows = [];
  let start = 1;
  const pageSize = 1000;

  while (true) {
    const end = start + pageSize - 1;
    const url = `http://openapi.seoul.go.kr:8088/${SEOUL_KEY}/json/ListPublicReservationSport/${start}/${end}/${keyword}`;
    const data = await request(url);
    const section = data.ListPublicReservationSport;
    if (!section || !Array.isArray(section.row) || section.row.length === 0) break;

    const filtered = section.row.filter(r =>
      (r.MINCLASSNM && r.MINCLASSNM.includes('테니스')) ||
      (r.SVCNM && r.SVCNM.includes('테니스'))
    );
    rows.push(...filtered);

    if (section.row.length < pageSize) break;
    start += pageSize;
  }
  return rows;
}

// Telegram
function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function sendTelegram(chatId, text) {
  const body = JSON.stringify({
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  });
  return request(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
  }, body);
}

module.exports = async (req, res) => {
  // Authorization check
  const auth = (req.headers['authorization'] || '').trim();
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // 1. Fetch current tennis facility data
    const rows = await fetchAllTennis();

    // 2. Build current snapshot + lookup map
    const currSnapshot = {};
    const rowMap = {};
    for (const row of rows) {
      currSnapshot[row.SVCID] = row.SVCSTATNM;
      rowMap[row.SVCID] = row;
    }

    // 3. Load previous snapshot
    const prevRaw = await kvGet('tennis_status_snapshot');
    const prevSnapshot = prevRaw ? JSON.parse(prevRaw) : {};

    // 4. Save current snapshot
    await kvSet('tennis_status_snapshot', JSON.stringify(currSnapshot));

    // 5. Find newly opened facilities (not 접수중 before → 접수중 now)
    const newlyOpen = Object.keys(currSnapshot).filter(id =>
      currSnapshot[id] === '접수중' && prevSnapshot[id] !== '접수중'
    );

    if (newlyOpen.length === 0) {
      return res.status(200).json({ ok: true, newlyOpen: 0, notified: 0 });
    }

    // 6. Scan all user favorites, notify affected users
    const favKeys = await kvScanAll('tennis_favs:*');
    let notified = 0;

    for (const favKey of favKeys) {
      const username = favKey.replace('tennis_favs:', '');

      const favsRaw = await kvGet(favKey);
      if (!favsRaw) continue;

      let favIds;
      try { favIds = JSON.parse(favsRaw); } catch { continue; }
      if (!Array.isArray(favIds) || favIds.length === 0) continue;

      const matched = newlyOpen.filter(id => favIds.includes(id));
      if (matched.length === 0) continue;

      const chatId = await kvGet(`tennis_chatid:${username}`);
      if (!chatId) continue;

      const lines = matched.map(id => {
        const r = rowMap[id];
        if (!r) return null;
        return (
          `🎾 <b>${escapeHtml(r.SVCNM)}</b>\n` +
          `📍 ${escapeHtml(r.AREANM)} · ${escapeHtml(r.PLACENM)}\n` +
          `🔗 <a href="${escapeHtml(r.SVCURL)}">예약하기</a>`
        );
      }).filter(Boolean);

      if (lines.length === 0) continue;

      const text = `✅ <b>테니스장 접수 시작!</b>\n\n${lines.join('\n\n')}`;
      await sendTelegram(chatId, text);
      notified++;
    }

    return res.status(200).json({ ok: true, newlyOpen: newlyOpen.length, notified });
  } catch (err) {
    console.error('check-status error:', err);
    return res.status(500).json({ error: err.message });
  }
};
