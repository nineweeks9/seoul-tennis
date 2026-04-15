const https = require('https');

const KV = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

function kvReq(urlStr, method = 'GET', bodyStr = null) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const opts = {
      hostname: u.hostname,
      port: u.port || 443,
      path: u.pathname,
      method,
      headers: {
        Authorization: `Bearer ${KV_TOKEN}`,
        ...(bodyStr ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
      },
    };
    const req = https.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(d); } });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

const kvGet = key => kvReq(`${KV}/get/${encodeURIComponent(key)}`).then(r => r.result);
const kvSet = (key, val) => kvReq(`${KV}/pipeline`, 'POST', JSON.stringify([['SET', key, val]]));
const kvDel = key => kvReq(`${KV}/del/${encodeURIComponent(key)}`, 'POST');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const user = (req.method === 'GET' || req.method === 'DELETE')
    ? req.query.user
    : (req.body || {}).user;

  if (!user) return res.status(400).json({ error: 'user required' });

  const key = `tennis_chatid:${user}`;

  if (req.method === 'GET') {
    const chatId = await kvGet(key);
    return res.status(200).json({ chatId: chatId || null });
  }

  if (req.method === 'POST') {
    const { chatId } = req.body || {};
    if (!chatId || !/^\d+$/.test(String(chatId))) {
      return res.status(400).json({ error: 'chatId must be a numeric string' });
    }
    await kvSet(key, String(chatId));
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'DELETE') {
    await kvDel(key);
    return res.status(200).json({ ok: true });
  }

  res.status(405).json({ error: 'Method not allowed' });
};
