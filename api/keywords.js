const KV = process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
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

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  try {
    const user = req.method === 'GET' ? req.query.user : (req.body || {}).user;
    if (!user) return res.status(400).json({ error: 'user required' });

    const key = `tennis_keywords:${user}`;

    if (req.method === 'GET') {
      const raw = await kvGet(key);
      const keywords = raw ? JSON.parse(raw) : [];
      return res.status(200).json({ keywords });
    }

    if (req.method === 'POST') {
      const { keyword } = req.body || {};
      if (!keyword || !keyword.trim()) return res.status(400).json({ error: 'keyword required' });
      const raw = await kvGet(key);
      const keywords = raw ? JSON.parse(raw) : [];
      const kw = keyword.trim();
      if (!keywords.includes(kw)) keywords.push(kw);
      await kvSet(key, JSON.stringify(keywords));
      return res.status(200).json({ ok: true, keywords });
    }

    if (req.method === 'DELETE') {
      const { keyword } = req.body || {};
      if (!keyword) return res.status(400).json({ error: 'keyword required' });
      const raw = await kvGet(key);
      const keywords = raw ? JSON.parse(raw).filter(k => k !== keyword) : [];
      await kvSet(key, JSON.stringify(keywords));
      return res.status(200).json({ ok: true, keywords });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('keywords error:', err);
    res.status(500).json({ error: err.message });
  }
};
