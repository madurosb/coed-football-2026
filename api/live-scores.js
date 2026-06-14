// /api/live-scores.js
// Primary: worldcup26.ir (free, no key, has goalscorers + minute)
// Fallback: football-data.org (has score/status but no goalscorers)
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=30');

  try {
    // === PRIMARY: worldcup26.ir (free, no key, goalscorers + minute) ===
    let matches = [];
    try {
      const r = await fetch('https://worldcup26.ir/get/games', {
        headers: { 'Accept': 'application/json', 'User-Agent': 'COED-Football/1.0' },
        signal: AbortSignal.timeout(4000)
      });
      if (r.ok) {
        const data = await r.json();
        const games = data.games || data || [];
        const now = new Date();

        matches = games
          .filter(g => {
            const status = (g.status || g.state || '').toUpperCase();
            const kickoff = g.date ? new Date(g.date) : null;
            const isLiveStatus = ['LIVE','IN_PLAY','IN PLAY','1H','2H','HT','HALFTIME','ET','PEN'].some(s => status.includes(s));
            const isFinished = ['FT','FINISHED','FULL TIME','FULLTIME','AET','AP'].some(s => status.includes(s));
            // Include: live now, or finished in last 3 hours
            if (isLiveStatus) return true;
            if (isFinished && kickoff) {
              const hoursAgo = (now - kickoff) / 3600000;
              return hoursAgo < 3;
            }
            return false;
          })
          .map(g => {
            const status = (g.status || g.state || '').toUpperCase();
            const isLive = ['1H','2H','HT','LIVE','IN_PLAY','IN PLAY','ET','PEN'].some(s => status.includes(s));
            const normalizedStatus = isLive ? 'IN_PLAY' :
              ['HT','HALFTIME'].some(s => status.includes(s)) ? 'PAUSED' : 'FINISHED';

            // Parse goals/scorers
            const goals = [];
            if (g.goals1) g.goals1.forEach(goal => goals.push({ team: 'home', name: goal.name || goal.scorer || '', minute: goal.minute || goal.min || '' }));
            if (g.goals2) g.goals2.forEach(goal => goals.push({ team: 'away', name: goal.name || goal.scorer || '', minute: goal.minute || goal.min || '' }));
            // Also check events array
            if (g.events) {
              g.events.filter(e => (e.type||'').toLowerCase().includes('goal')).forEach(e => {
                goals.push({ team: e.team === (g.home_team?.name || g.team1) ? 'home' : 'away', name: e.player || '', minute: e.minute || '' });
              });
            }

            const homeScore = g.score?.home ?? g.home_score ?? g.score1 ?? null;
            const awayScore = g.score?.away ?? g.away_score ?? g.score2 ?? null;

            return {
              id: String(g._id || g.id || `${g.home_team?.name||g.team1}-${g.away_team?.name||g.team2}`),
              homeTeam: g.home_team?.name || g.team1 || '',
              awayTeam: g.away_team?.name || g.team2 || '',
              homeScore: homeScore !== null ? parseInt(homeScore) : null,
              awayScore: awayScore !== null ? parseInt(awayScore) : null,
              status: normalizedStatus,
              minute: g.minute || g.elapsed || g.time || null,
              goals,
              kickoff: g.date || g.datetime || null,
              source: 'worldcup26'
            };
          });
      }
    } catch(e) {
      console.log('worldcup26.ir failed:', e.message);
    }

    // === FALLBACK: football-data.org ===
    if (matches.length === 0) {
      const API_KEY = process.env.FOOTBALL_DATA_KEY;
      if (API_KEY) {
        const r = await fetch(
          'https://api.football-data.org/v4/competitions/WC/matches?status=IN_PLAY,PAUSED,FINISHED',
          { headers: { 'X-Auth-Token': API_KEY } }
        );
        if (r.ok) {
          const data = await r.json();
          const now = new Date();
          matches = (data.matches || [])
            .filter(m => {
              if (['IN_PLAY','PAUSED'].includes(m.status)) return true;
              if (m.status === 'FINISHED') {
                const k = new Date(m.utcDate);
                return (now - k) / 3600000 < 3;
              }
              return false;
            })
            .map(m => ({
              id: String(m.id),
              homeTeam: m.homeTeam?.name || '',
              awayTeam: m.awayTeam?.name || '',
              homeScore: m.score?.fullTime?.home ?? m.score?.halfTime?.home ?? null,
              awayScore: m.score?.fullTime?.away ?? m.score?.halfTime?.away ?? null,
              status: m.status,
              minute: m.minute || null,
              goals: [],
              kickoff: m.utcDate,
              source: 'football-data'
            }));
        }
      }
    }

    return res.status(200).json({ matches, updated: new Date().toISOString() });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
