const KV = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

const kvHeaders = { Authorization: `Bearer ${KV_TOKEN}` };

const kvGet = async key => {
  const r = await fetch(`${KV}/get/${encodeURIComponent(key)}`, { headers: kvHeaders });
  const j = await r.json();
  return j.result;
};

const kvSet = async (key, val) => {
  await fetch(`${KV}/set/${encodeURIComponent(key)}/${encodeURIComponent(val)}`, {
    method: 'POST',
    headers: kvHeaders,
  });
};

const kvDel = async key => {
  await fetch(`${KV}/del/${encodeURIComponent(key)}`, { method: 'POST', headers: kvHeaders });
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  try {
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
  } catch (err) {
    console.error('chatid error:', err);
    res.status(500).json({ error: err.message });
  }
};
