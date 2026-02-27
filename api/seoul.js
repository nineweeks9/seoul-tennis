// api/seoul.js
// 서울시 공공서비스예약 API 프록시
// Vercel 환경변수 SEOUL_API_KEY 에 인증키를 설정하세요

const https = require('https');

module.exports = async (req, res) => {
  // CORS 허용
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

    // 5분 캐시
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(200).json(json);
  } catch (err) {
    res.status(500).json({ error: err.message });
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
