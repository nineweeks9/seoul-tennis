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
    const raw = await kvGet(key);
    // groups: Array of Array<string>  e.g. [["삼청","주말"],["삼청","야간"]]
    const groups = raw ? JSON.parse(raw) : [];

    if (req.method === 'GET') {
      return res.status(200).json({ groups });
    }

    if (req.method === 'POST') {
      // keywords: string[] e.g. ["삼청","주말"]
      const { keywords } = req.body || {};
      if (!Array.isArray(keywords) || keywords.length === 0)
        return res.status(400).json({ error: 'keywords array required' });
      const cleaned = keywords.map(k => k.trim()).filter(Boolean);
      if (cleaned.length === 0) return res.status(400).json({ error: 'keywords required' });
      groups.push(cleaned);
      await kvSet(key, JSON.stringify(groups));
      return res.status(200).json({ ok: true, groups });
    }

    if (req.method === 'DELETE') {
      const { index } = req.body || {};
      if (typeof index !== 'number' || index < 0 || index >= groups.length)
        return res.status(400).json({ error: 'valid index required' });
      groups.splice(index, 1);
      await kvSet(key, JSON.stringify(groups));
      return res.status(200).json({ ok: true, groups });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('keywords error:', err);
    res.status(500).json({ error: err.message });
  }
};
