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
        system: `You are a World Cup 2026 expert analyst with up to date knowledge. Return ONLY a valid JSON object with no markdown, no backticks, no explanation. Use this exact structure:
{
  "updated": "April 2026",
  "injuryWatch": [
    {"player": "Name", "team": "Country", "status": "Doubt/Out/Recovered", "detail": "short injury detail under 15 words"}
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
Include 5 items in injuryWatch, 5 in topScorers, 5 in tournamentPlayerPicks, 4 in drawTeams, 4 in highScoringTeams, 5 in round1Tips.`,
        messages: [{
          role: 'user',
          content: 'Give me FIFA World Cup 2026 tips: injury watch, top goalscorer picks, best tournament player picks, teams known for draws, high scoring teams, and round 1 group stage match predictions. Return only the JSON.'
        }]
      })
    });

    const data = await response.json();
    console.log('Anthropic response:', JSON.stringify(data).substring(0, 200));

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
