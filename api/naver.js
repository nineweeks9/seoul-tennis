// Naver booking API proxy for tennis court availability
// GraphQL endpoint reverse-engineered from m.booking.naver.com

const NAVER_PLACES = {
  '18754970': {
    name: '매헌시민의숲테니스장',
    bizId: '210031',
    businessTypeId: 10,
    lat: 37.4716,
    lng: 127.0384,
    items: [
      { id: '7457885', name: 'A코트(실내)' },
      { id: '7457925', name: 'B코트(실내)' },
      { id: '7458001', name: 'C코트(실내)' },
      { id: '7458006', name: '1번코트(실외,인조잔디)' },
      { id: '7458009', name: '2번코트(실외,인조잔디)' },
      { id: '7458015', name: '3번코트(실외,인조잔디)' },
      { id: '7458018', name: '4번코트(실외,인조잔디)' },
      { id: '7458024', name: '5번코트(실외,인조잔디)' },
      { id: '7458029', name: '6번코트(실외,인조잔디)' },
      { id: '7458033', name: '7번코트(실외,인조잔디)' },
    ]
  }
};

const GQL_QUERY = `query hourlySchedule($scheduleParams: ScheduleParams) {
  schedule(input: $scheduleParams) {
    bizItemSchedule {
      hourly {
        unitStartTime
        unitBookingCount
        unitStock
        duration
        prices { price isDefault }
      }
    }
  }
}`;

async function fetchSchedule(bizId, bizItemId, businessTypeId, date) {
  const resp = await fetch('https://m.booking.naver.com/graphql?opName=hourlySchedule', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Referer': `https://m.booking.naver.com/booking/${businessTypeId}/bizes/${bizId}/items/${bizItemId}`,
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    },
    body: JSON.stringify({
      operationName: 'hourlySchedule',
      query: GQL_QUERY,
      variables: {
        scheduleParams: {
          businessId: bizId,
          bizItemId,
          businessTypeId,
          startDateTime: `${date}T00:00:00`,
          endDateTime: `${date}T23:59:59`,
          fixedTime: true
        }
      }
    })
  });
  const json = await resp.json();
  return json?.data?.schedule?.bizItemSchedule?.hourly || [];
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const placeId = req.query.placeId;
  const date = req.query.date || new Date().toISOString().slice(0, 10);

  if (!placeId) {
    // Return list of all supported places
    return res.status(200).json({ places: Object.entries(NAVER_PLACES).map(([id, p]) => ({ placeId: id, name: p.name, lat: p.lat, lng: p.lng })) });
  }

  const place = NAVER_PLACES[placeId];
  if (!place) return res.status(404).json({ error: `Unknown placeId: ${placeId}` });

  try {
    const courts = await Promise.all(
      place.items.map(async item => {
        const slots = await fetchSchedule(place.bizId, item.id, place.businessTypeId, date);
        const saleSlots = slots.filter(s => s.prices?.[0]?.price > 0);
        const available = saleSlots.filter(s => s.unitBookingCount < s.unitStock);
        const booked = saleSlots.filter(s => s.unitBookingCount >= s.unitStock);
        return {
          itemId: item.id,
          name: item.name,
          date,
          availableCount: available.length,
          totalSlots: saleSlots.length,
          available: available.map(s => ({
            time: s.unitStartTime.slice(11, 16),
            duration: s.duration,
            price: s.prices?.[0]?.price
          })),
          booked: booked.map(s => ({ time: s.unitStartTime.slice(11, 16) })),
        };
      })
    );

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    res.status(200).json({
      placeId,
      placeName: place.name,
      lat: place.lat,
      lng: place.lng,
      date,
      courts,
      availableCourts: courts.filter(c => c.availableCount > 0).length,
      totalCourts: courts.length,
    });
  } catch (err) {
    console.error('Naver API error:', err);
    res.status(502).json({ error: err.message });
  }
};
