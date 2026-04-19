const KV = process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const TMAP_API_KEY = process.env.TMAP_API_KEY;
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  try {
    const user = req.method === 'GET' ? req.query.user : (req.body || {}).user;
    if (!user) return res.status(400).json({ error: 'user required' });

    const key = `tennis_home:${user}`;

    if (req.method === 'GET') {
      const raw = await kvGet(key);
      return res.status(200).json(raw ? JSON.parse(raw) : { address: null, lat: null, lng: null });
    }

    if (req.method === 'POST') {
      const { address } = req.body || {};
      if (!address) return res.status(400).json({ error: 'address required' });

      // T-map POI 검색으로 주소 → 좌표 변환
      const searchUrl = `https://apis.openapi.sk.com/tmap/pois?version=1&searchKeyword=${encodeURIComponent(address)}&appKey=${TMAP_API_KEY}&count=1&resCoordType=WGS84GEO`;
      const tmapRes = await fetch(searchUrl);
      const tmapData = await tmapRes.json();

      const poi = tmapData?.searchPoiInfo?.pois?.poi?.[0];
      if (!poi) return res.status(400).json({ error: '주소를 찾을 수 없습니다.' });

      const lat = parseFloat(poi.noorLat);
      const lng = parseFloat(poi.noorLon);
      if (!lat || !lng) return res.status(400).json({ error: '좌표를 찾을 수 없습니다.' });

      await kvSet(key, JSON.stringify({ address, lat, lng }));
      return res.status(200).json({ ok: true, address, lat, lng });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('home error:', err);
    res.status(500).json({ error: err.message });
  }
};
