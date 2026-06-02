// /api/live-scores.js
// Fetches live World Cup 2026 match data from football-data.org
// Free tier: up to 10 calls/minute

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const API_KEY = process.env.FOOTBALL_DATA_API_KEY;
  if (!API_KEY) return res.status(500).json({ error: 'Missing API key' });

  // Cache for 60 seconds via response headers
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');

  try {
    // football-data.org — World Cup 2026 competition code: WC2026
    // Fetch today's matches + live matches
    const response = await fetch(
      'https://api.football-data.org/v4/competitions/WC2026/matches?status=LIVE,IN_PLAY,PAUSED,HALFTIME,FINISHED',
      {
        headers: {
          'X-Auth-Token': API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      const err = await response.json();
      return res.status(response.status).json({ error: err.message || 'API error' });
    }

    const data = await response.json();

    // Return simplified match data
    const matches = (data.matches || []).map(m => ({
      id: m.id,
      homeTeam: m.homeTeam.name,
      awayTeam: m.awayTeam.name,
      homeScore: m.score.fullTime.home ?? m.score.halfTime.home ?? null,
      awayScore: m.score.fullTime.away ?? m.score.halfTime.away ?? null,
      status: m.status, // SCHEDULED, IN_PLAY, PAUSED, HALFTIME, FINISHED, etc
      minute: m.minute || null,
      stage: m.stage,
      kickoff: m.utcDate,
    }));

    return res.status(200).json({ matches, updated: new Date().toISOString() });

  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
