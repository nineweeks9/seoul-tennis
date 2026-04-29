// /api/favs.js
// GET /api/favs?user=닉네임 → 즐겨찾기 목록 반환
// POST /api/favs { user: "닉네임", favs: ["S001","S002"] } → 저장

export default async function handler(req, res) {
  const KV_URL = process.env.KV_REST_API_URL;
  const KV_TOKEN = process.env.KV_REST_API_TOKEN;

  if (!KV_URL || !KV_TOKEN) {
    return res.status(500).json({ error: 'KV not configured' });
  }

  // Redis REST API helper
  async function kvGet(key) {
    const r = await fetch(`${KV_URL}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` }
    });
    const data = await r.json();
    return data.result;
  }

  async function kvSet(key, value) {
    const encoded = encodeURIComponent(JSON.stringify(value));
    const r = await fetch(`${KV_URL}/set/${encodeURIComponent(key)}/${encoded}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KV_TOKEN}` }
    });
    return await r.json();
  }

  if (req.method === 'GET') {
    const user = req.query.user;
    if (!user || user.length < 1 || user.length > 20) {
      return res.status(400).json({ error: 'invalid user' });
    }
    const key = `tennis_favs:${user}`;
    const result = await kvGet(key);
    // result가 문자열로 올 수 있으므로 파싱 처리
    let favs = result;
    if (typeof result === 'string') {
      try { favs = JSON.parse(result); } catch { favs = []; }
    }
    return res.status(200).json({ favs: favs || [] });

  } else if (req.method === 'POST') {
    const { user, favs } = req.body || {};
    if (!user || user.length < 1 || user.length > 20) {
      return res.status(400).json({ error: 'invalid user' });
    }
    if (!Array.isArray(favs)) {
      return res.status(400).json({ error: 'favs must be array' });
    }
    const key = `tennis_favs:${user}`;
    await kvSet(key, favs);
    return res.status(200).json({ ok: true });

  } else {
    return res.status(405).json({ error: 'method not allowed' });
  }
}
