const KV = process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const kvHeaders = { Authorization: `Bearer ${KV_TOKEN}` };

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { nickname } = req.body || {};
  if (!nickname || typeof nickname !== 'string') return res.status(400).json({ error: 'nickname required' });

  try {
    const r = await fetch(`${KV}/sismember/tennis_whitelist/${encodeURIComponent(nickname.trim())}`, {
      headers: kvHeaders
    });
    const j = await r.json();
    const allowed = j.result === 1;
    return res.status(200).json({ allowed });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
