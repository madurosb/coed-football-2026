export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_KEY) return res.status(500).json({ error: 'Missing API key' });

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: `You are a World Cup 2026 expert. The FIFA World Cup 2026 group stage starts June 11, 2026. 

IMPORTANT CONTEXT: In our prediction game, users pick a "tournament player" - one player for the whole tournament. Every goal that player scores gives +1 point. So tournament player picks must be HIGH GOAL SCORERS - strikers and attacking players who are likely to score many goals throughout the tournament (not defenders or goalkeepers). Lionel Messi, Kylian Mbappe, Erling Haaland, Vinicius Jr, Harry Kane etc are ideal picks.

The actual FIFA World Cup 2026 Group Stage Round 1 matches are:
- Group A: Mexico vs Ecuador, USA vs Panama  
- Group B: Argentina vs Albania, Morocco vs Iraq
- Group C: Spain vs Brazil (not confirmed but likely group stage clash - use real confirmed matches)
- Use the REAL confirmed group stage fixtures from the FIFA World Cup 2026 draw that happened in December 2024.

Return ONLY a valid JSON object, no markdown, no backticks:
{
  "updated": "April 2026",
  "injuryWatch": [
    {"player": "Name", "team": "Country", "status": "Doubt/Out/Recovered", "detail": "under 15 words"}
  ],
  "topScorers": [
    {"player": "Name", "team": "Country", "reason": "under 15 words why good first goalscorer pick per match"}
  ],
  "tournamentPlayerPicks": [
    {"player": "Name", "team": "Country", "goals": "expected goals range e.g. 4-7", "reason": "under 15 words - focus on goal scoring ability throughout tournament"}
  ],
  "drawTeams": [
    {"team": "Country", "stat": "under 12 words about draw tendency"}
  ],
  "highScoringTeams": [
    {"team": "Country", "stat": "under 12 words about goal scoring"}
  ],
  "round1Tips": [
    {"match": "Team A vs Team B", "group": "Group X", "tip": "under 20 words prediction"}
  ],
  "funFact": "one interesting World Cup 2026 fact under 25 words"
}
Include 5 in injuryWatch, 6 in topScorers, 6 in tournamentPlayerPicks (MUST include Messi, Mbappe, Haaland, Vinicius Jr), 4 in drawTeams, 4 in highScoringTeams, 6 real round1 matches.`,
        messages: [{
          role: 'user',
          content: 'Give me FIFA World Cup 2026 tips using the real confirmed group stage draw. For tournament player picks focus only on players likely to score many goals. Include the real Round 1 fixtures from the actual FIFA World Cup 2026 draw. Return only the JSON.'
        }]
      })
    });

    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error.message });
    const text = data.content.filter(b => b.type === 'text').map(b => b.text).join('');
    const clean = text.replace(/```json|```/g, '').trim();
    const tips = JSON.parse(clean);
    return res.status(200).json(tips);

  } catch (e) {
    console.error('Tips error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}
