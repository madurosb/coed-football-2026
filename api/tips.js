export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_KEY) return res.status(500).json({ error: 'Missing API key' });

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {export default async function handler(req, res) {
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
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'web-search-2025-03-05'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        system: `You are a World Cup 2026 expert analyst. Search the web for the latest FIFA World Cup 2026 news, injury updates, squad news, form guides and predictions. Return ONLY a valid JSON object with no markdown, no backticks, no explanation. Use this exact structure:
{
  "updated": "Day Month Year",
  "injuryWatch": [
    {"player": "Name", "team": "Country", "status": "Doubt/Out/Recovered", "detail": "under 15 words about injury status"}
  ],
  "topScorers": [
    {"player": "Name", "team": "Country", "reason": "under 15 words why to pick them as first scorer"}
  ],
  "tournamentPlayerPicks": [
    {"player": "Name", "team": "Country", "reason": "under 15 words why good tournament player pick"}
  ],
  "drawTeams": [
    {"team": "Country", "stat": "under 12 words about draw tendency"}
  ],
  "highScoringTeams": [
    {"team": "Country", "stat": "under 12 words about goal scoring"}
  ],
  "round1Tips": [
    {"match": "Team A vs Team B", "tip": "under 20 words prediction with reasoning"}
  ],
  "funFact": "one interesting World Cup 2026 fact under 25 words"
}
Include 5 items in injuryWatch, 5 in topScorers, 5 in tournamentPlayerPicks, 4 in drawTeams, 4 in highScoringTeams, 5 in round1Tips. Base everything on real current data from web search.`,
        messages: [{
          role: 'user',
          content: 'Search for: 1) Latest FIFA World Cup 2026 injury news and squad updates, 2) Top goalscorer predictions, 3) Best tournament player picks, 4) Teams known for draws, 5) High scoring teams, 6) Round 1 group stage match predictions. Return the JSON with all sections filled with real current data.'
        }]
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    const text = data.content.filter(b => b.type === 'text').map(b => b.text).join('');
    const clean = text.replace(/```json|```/g, '').trim();
    const tips = JSON.parse(clean);
    res.status(200).json(tips);

  } catch (e) {
    console.error('Tips error:', e);
    res.status(500).json({ error: e.message });
  }
}
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'web-search-2025-03-05'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        system: `You are a World Cup 2026 expert analyst. Search the web for the latest FIFA World Cup 2026 information. Return ONLY a valid JSON object with no markdown, no backticks, no explanation. Use this exact structure:
{
  "updated": "Month Year",
  "topScorers": [
    {"player": "Name", "team": "Country", "reason": "under 15 words why"}
  ],
  "tournamentPlayerPicks": [
    {"player": "Name", "team": "Country", "reason": "under 15 words why"}
  ],
  "drawTeams": [
    {"team": "Country", "stat": "under 12 words about draw tendency"}
  ],
  "highScoringTeams": [
    {"team": "Country", "stat": "under 12 words about goal scoring"}
  ],
  "round1Tips": [
    {"match": "Team A vs Team B", "tip": "under 20 words prediction"}
  ],
  "funFact": "one interesting World Cup 2026 fact under 25 words"
}
Include exactly 5 items in topScorers, 5 in tournamentPlayerPicks, 4 in drawTeams, 4 in highScoringTeams, 5 in round1Tips. Base on real current data.`,
        messages: [{
          role: 'user',
          content: 'Search for FIFA World Cup 2026 group stage schedule, top goalscorer predictions, best tournament player picks, teams known for draws, high scoring teams, and round 1 match predictions. Return the JSON.'
        }]
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    const text = data.content.filter(b => b.type === 'text').map(b => b.text).join('');
    const clean = text.replace(/```json|```/g, '').trim();
    const tips = JSON.parse(clean);
    res.status(200).json(tips);

  } catch (e) {
    console.error('Tips error:', e);
    res.status(500).json({ error: e.message });
  }
}
