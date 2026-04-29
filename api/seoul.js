const https = require('https');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const apiKey  = process.env.SEOUL_API_KEY || 'sample';
  const keyword = req.query.keyword || '테니스';
  const start   = req.query.start   || '1';
  const end     = req.query.end     || '1000';

  const url = `https://openapi.seoul.go.kr:8088/${apiKey}/json/ListPublicReservationSport/${start}/${end}/${encodeURIComponent(keyword)}`;

  try {
    const data = await fetchUrl(url);
    const json = JSON.parse(data);
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(200).json(json);
  } catch (err) {
    console.error('Seoul API error:', err.message);
    res.status(502).json({ error: err.message });
  }
};

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      let data = '';
      response.on('data', chunk => data += chunk);
      response.on('end', () => resolve(data));
    }).on('error', reject);
  });
}
