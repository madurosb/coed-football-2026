// /api/live-scores.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const API_KEY = process.env.FOOTBALL_DATA_API_KEY;
  if (!API_KEY) return res.status(200).json({ matches: [], error: 'Missing API key' });

  try {
    const response = await fetch(
      'https://api.football-data.org/v4/competitions/WC/matches?status=IN_PLAY,PAUSED,HALFTIME,FINISHED',
      { headers: { 'X-Auth-Token': API_KEY } }
    );

    const text = await response.text();
    if (!response.ok) {
      return res.status(200).json({ matches: [], error: `football-data ${response.status}: ${text.substring(0,300)}` });
    }

    const data = JSON.parse(text);
    const matches = (data.matches || []).map(m => ({
      id: m.id,
      homeTeam: m.homeTeam.name,
      awayTeam: m.awayTeam.name,
      homeScore: m.score?.fullTime?.home ?? m.score?.halfTime?.home ?? null,
      awayScore: m.score?.fullTime?.away ?? m.score?.halfTime?.away ?? null,
      status: m.status,
      minute: m.minute || null,
      stage: m.stage,
      kickoff: m.utcDate,
    }));

    return res.status(200).json({ matches, updated: new Date().toISOString() });
  } catch(e) {
    return res.status(200).json({ matches: [], error: e.message });
  }
}
