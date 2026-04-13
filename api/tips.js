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
        max_tokens: 4000,
        system: `You are a FIFA World Cup 2026 expert analyst.

TOURNAMENT PLAYER CONTEXT: Users pick ONE player for the entire tournament. Every goal that player scores = +1 point. So tournament player picks must be prolific GOAL SCORERS - strikers who score many goals. Not midfielders or defenders.

THE REAL ROUND 1 FIXTURES ARE:
June 11: Mexico vs South Africa (Group A), South Korea vs Czechia (Group A)
June 12: Canada vs Bosnia-Herzegovina (Group B), USA vs Paraguay (Group D)
June 13: Qatar vs Switzerland (Group B), Brazil vs Morocco (Group C), Haiti vs Scotland (Group C), Australia vs Türkiye (Group D)
June 14: Germany vs Curaçao (Group E), Netherlands vs Japan (Group F), Ivory Coast vs Ecuador (Group E), Sweden vs Tunisia (Group F)
June 15: Spain vs Cabo Verde (Group H), Belgium vs Egypt (Group G), Saudi Arabia vs Uruguay (Group H), Iran vs New Zealand (Group G)
June 16: France vs Senegal (Group I), Iraq vs Norway (Group I), Argentina vs Algeria (Group J), Austria vs Jordan (Group J)
June 17: Portugal vs DR Congo (Group K), England vs Croatia (Group L), Ghana vs Panama (Group L), Uzbekistan vs Colombia (Group K)

Return ONLY valid JSON, no markdown, no backticks:
{
  "updated": "April 2026",
  "injuryWatch": [
    {"player": "Name", "team": "Country", "status": "Doubt/Out/Recovered", "detail": "short detail under 15 words"}
  ],
  "topFirstScorers": [
    {"player": "Name", "team": "Country", "reason": "under 15 words why good first goalscorer pick per match"}
  ],
  "tournamentPlayers": [
    {"player": "Name", "team": "Country", "goals": "e.g. 5-8", "reason": "under 15 words - must be known prolific goal scorer"}
  ],
  "drawTeams": [
    {"team": "Country", "stat": "under 12 words about draw tendency"}
  ],
  "highScoringTeams": [
    {"team": "Country", "stat": "under 12 words about goal scoring"}
  ],
  "round1Tips": [
    {"match": "Team A vs Team B", "group": "Group X", "pick": "1/X/2", "pickLabel": "Home Win/Draw/Away Win", "tip": "under 15 words reasoning"}
  ],
  "funFact": "one interesting World Cup 2026 fact under 25 words"
}

Include 12 players in injuryWatch (split across pages), 6 in topFirstScorers, 8 in tournamentPlayers (MUST include Messi, Mbappe, Haaland, Vinicius Jr, Kane, Ronaldo), 5 in drawTeams, 5 in highScoringTeams, ALL 24 round1 matches listed above.`,
        messages: [{
          role: 'user',
          content: 'Give me World Cup 2026 tips. For injuries include as many known injured/doubtful players as possible. For tournament players only include prolific goal scorers. Use the exact 24 Round 1 fixtures I provided. Return only JSON.'
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
