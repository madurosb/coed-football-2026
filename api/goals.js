// api/goals.js
// Fetches goal scorers for a match from openfootball/worldcup.json
// Free, no API key, ~1-2h delay after matches end
// Usage: GET /api/goals?home=Mexico&away=South+Africa
//        GET /api/goals?date=2026-06-11   (all matches on date)

const WC_JSON_URL = 'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json';

// Cache the full dataset for 5 minutes (reduces GitHub requests)
let _cache = null;
let _cacheAt = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function fetchAllMatches() {
  const now = Date.now();
  if (_cache && now - _cacheAt < CACHE_TTL) return _cache;
  const resp = await fetch(WC_JSON_URL, {
    headers: { 'User-Agent': 'coed-football-2026/1.0' }
  });
  if (!resp.ok) throw new Error(`openfootball fetch failed: ${resp.status}`);
  const data = await resp.json();
  _cache = data.matches || [];
  _cacheAt = now;
  return _cache;
}

// Normalize team names for fuzzy matching
function norm(s) {
  return (s || '').toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/côte|cote/g, 'ivory')
    .replace(/ivorycoast/g, 'ivorycoast');
}

function teamsMatch(a, b) {
  return norm(a) === norm(b) ||
    norm(a).includes(norm(b).slice(0, 5)) ||
    norm(b).includes(norm(a).slice(0, 5));
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');

  try {
    const matches = await fetchAllMatches();
    const { home, away, date } = req.query || {};

    if (date) {
      // Return all matches on a date
      const dayMatches = matches.filter(m => m.date === date && m.score);
      return res.json({ matches: dayMatches.map(formatMatch) });
    }

    if (!home || !away) {
      return res.status(400).json({ error: 'Provide ?home=TeamA&away=TeamB or ?date=YYYY-MM-DD' });
    }

    // Find the match
    const match = matches.find(m =>
      teamsMatch(m.team1, home) && teamsMatch(m.team2, away)
    ) || matches.find(m =>
      teamsMatch(m.team1, away) && teamsMatch(m.team2, home)
    );

    if (!match) {
      return res.json({ found: false, message: `No match found: ${home} vs ${away}` });
    }

    if (!match.score) {
      return res.json({ found: true, finished: false, message: 'Match not yet played or no score data' });
    }

    return res.json({ found: true, finished: true, ...formatMatch(match) });

  } catch (e) {
    console.error('goals.js error:', e);
    return res.status(500).json({ error: e.message });
  }
}

function formatMatch(m) {
  // Normalise goals into a single array with team markers
  const goals = [
    ...(m.goals1 || []).map(g => ({ ...g, team: 'home', teamName: m.team1 })),
    ...(m.goals2 || []).map(g => ({ ...g, team: 'away', teamName: m.team2 })),
  ].sort((a, b) => (parseInt(a.minute) || 0) - (parseInt(b.minute) || 0));

  const firstScorer = goals[0]?.name || null;

  return {
    team1: m.team1,
    team2: m.team2,
    date: m.date,
    score: m.score,
    homeScore: m.score?.ft?.[0] ?? null,
    awayScore: m.score?.ft?.[1] ?? null,
    goals,
    firstScorer,
  };
}
