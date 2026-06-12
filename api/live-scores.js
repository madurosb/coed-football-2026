// /api/live-scores.js
// Fetches live World Cup 2026 match data from football-data.org

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const API_KEY = process.env.FOOTBALL_DATA_KEY; // ✅ matches Vercel env var name
  if (!API_KEY) return res.status(500).json({ error: 'Missing API key' });

  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');

  try {
    const response = await fetch(
      'https://api.football-data.org/v4/competitions/WC/matches?status=IN_PLAY,PAUSED,HALFTIME,FINISHED',
      {
        headers: {
          'X-Auth-Token': API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(response.status).json({ error: err.message || 'API error', status: response.status });
    }

    const data = await response.json();

    const matches = (data.matches || []).map(m => ({
      id: String(m.id),
      homeTeam: m.homeTeam?.name || '',
      awayTeam: m.awayTeam?.name || '',
      homeScore: m.score?.fullTime?.home ?? m.score?.halfTime?.home ?? null,
      awayScore: m.score?.fullTime?.away ?? m.score?.halfTime?.away ?? null,
      status: m.status,
      minute: m.minute || null,
      stage: m.stage,
      kickoff: m.utcDate,
    }));

    return res.status(200).json({ matches, updated: new Date().toISOString() });

  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
