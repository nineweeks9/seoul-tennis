const http = require('http');

const KV = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SEOUL_KEY = process.env.SEOUL_API_KEY || 'sample';

const kvHeaders = { Authorization: `Bearer ${KV_TOKEN}` };

const kvGet = async key => {
  const r = await fetch(`${KV}/get/${encodeURIComponent(key)}`, { headers: kvHeaders });
  const j = await r.json();
  return j.result;
};

const kvSet = async (key, val) => {
  await fetch(`${KV}/set/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { ...kvHeaders, 'Content-Type': 'text/plain' },
    body: val,
  });
};

async function kvScanAll(pattern) {
  const keys = [];
  let cursor = 0;
  do {
    const r = await fetch(
      `${KV}/scan/${cursor}/match/${encodeURIComponent(pattern)}/count/100`,
      { headers: kvHeaders }
    );
    const j = await r.json();
    cursor = parseInt(j.result[0], 10);
    keys.push(...j.result[1]);
  } while (cursor !== 0);
  return keys;
}

// Seoul OpenAPI — http 모듈 사용 (http:// 엔드포인트)
function fetchSeoul(start, end) {
  return new Promise((resolve, reject) => {
    const keyword = encodeURIComponent('테니스');
    const url = `http://openapi.seoul.go.kr:8088/${SEOUL_KEY}/json/ListPublicReservationSport/${start}/${end}/${keyword}`;
    http.get(url, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}

async function fetchAllTennis() {
  const rows = [];
  let start = 1;
  const pageSize = 1000;
  while (true) {
    const data = await fetchSeoul(start, start + pageSize - 1);
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

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function sendTelegram(chatId, text) {
  return fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
  });
}

module.exports = async (req, res) => {
  const auth = (req.headers['authorization'] || '').trim();
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const rows = await fetchAllTennis();

    const currSnapshot = {};
    const rowMap = {};
    for (const row of rows) {
      currSnapshot[row.SVCID] = row.SVCSTATNM;
      rowMap[row.SVCID] = row;
    }

    const prevRaw = await kvGet('tennis_status_snapshot');
    const prevSnapshot = prevRaw ? JSON.parse(prevRaw) : {};

    await kvSet('tennis_status_snapshot', JSON.stringify(currSnapshot));

    const newlyOpen = Object.keys(currSnapshot).filter(id =>
      currSnapshot[id] === '접수중' && prevSnapshot[id] !== '접수중'
    );

    if (newlyOpen.length === 0) {
      return res.status(200).json({ ok: true, newlyOpen: 0, notified: 0 });
    }

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
        return `🎾 <b>${escapeHtml(r.SVCNM)}</b>\n📍 ${escapeHtml(r.AREANM)} · ${escapeHtml(r.PLACENM)}\n🔗 <a href="${escapeHtml(r.SVCURL)}">예약하기</a>`;
      }).filter(Boolean);

      if (lines.length === 0) continue;

      await sendTelegram(chatId, `✅ <b>테니스장 접수 시작!</b>\n\n${lines.join('\n\n')}`);
      notified++;
    }

    return res.status(200).json({ ok: true, newlyOpen: newlyOpen.length, notified });
  } catch (err) {
    console.error('check-status error:', err);
    return res.status(500).json({ error: err.message });
  }
};
