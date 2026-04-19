const KV = process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const kvHeaders = { Authorization: `Bearer ${KV_TOKEN}` };

const kvGet = async key => {
  const r = await fetch(`${KV}/get/${encodeURIComponent(key)}`, { headers: kvHeaders });
  const j = await r.json();
  return j.result;
};

module.exports = async (req, res) => {
  const auth = (req.headers['authorization'] || '').trim();
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { user } = req.query;
  if (!user) return res.status(400).json({ error: 'user required' });

  const chatId = await kvGet(`tennis_chatid:${user}`);
  if (!chatId) return res.status(404).json({ error: 'chatId not found for user' });

  const text = `✅ <b>테니스장 접수 시작!</b>\n\n🎾 <b>[테스트] 삼청테니스장 주말 야간</b>\n📍 종로구 · 삼청테니스장\n🔗 <a href="https://yeyak.seoul.go.kr">예약하기</a>`;

  const r = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
  });
  const j = await r.json();
  return res.status(200).json({ ok: j.ok, chatId, result: j });
};
