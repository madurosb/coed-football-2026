import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const BALLDONTLIE_KEY = process.env.BALLDONTLIE_KEY;
const BASE_URL = 'https://api.balldontlie.io/fifa/worldcup/v1';
const headers = { 'Authorization': BALLDONTLIE_KEY };

function getDb() {
  if (!getApps().length) {
    initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
  }
  return getFirestore();
}

async function fetchAPI(path) {
  const res = await fetch(`${BASE_URL}${path}`, { headers });
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  return res.json();
}

function getFlag(code) {
  if (!code) return '🏳';
  const flags = {
    'US':'🇺🇸','MX':'🇲🇽','CA':'🇨🇦','BR':'🇧🇷','AR':'🇦🇷','FR':'🇫🇷',
    'DE':'🇩🇪','ES':'🇪🇸','PT':'🇵🇹','EN':'🏴󠁧󠁢󠁥󠁮󠁧󠁿','GB':'🏴󠁧󠁢󠁥󠁮󠁧󠁿','IT':'🇮🇹','NL':'🇳🇱',
    'BE':'🇧🇪','HR':'🇭🇷','RS':'🇷🇸','JP':'🇯🇵','KR':'🇰🇷','AU':'🇦🇺',
    'MA':'🇲🇦','SN':'🇸🇳','NG':'🇳🇬','GH':'🇬🇭','CI':'🇨🇮','CM':'🇨🇲',
    'EG':'🇪🇬','SA':'🇸🇦','IR':'🇮🇷','QA':'🇶🇦','UY':'🇺🇾','CO':'🇨🇴',
    'PE':'🇵🇪','EC':'🇪🇨','PL':'🇵🇱','CH':'🇨🇭','DK':'🇩🇰','SE':'🇸🇪',
    'NO':'🇳🇴','CZ':'🇨🇿','AT':'🇦🇹','TR':'🇹🇷','UA':'🇺🇦','HU':'🇭🇺',
    'RO':'🇷🇴','SK':'🇸🇰','AL':'🇦🇱','SI':'🇸🇮','GE':'🇬🇪','VE':'🇻🇪',
    'PA':'🇵🇦','TN':'🇹🇳','DZ':'🇩🇿','KE':'🇰🇪','ML':'🇲🇱','ZM':'🇿🇲',
    'GT':'🇬🇹','HN':'🇭🇳','SV':'🇸🇻','CR':'🇨🇷','DO':'🇩🇴','TT':'🇹🇹',
    'BO':'🇧🇴','CL':'🇨🇱','PY':'🇵🇾','NZ':'🇳🇿','CN':'🇨🇳','TH':'🇹🇭',
    'ID':'🇮🇩','UZ':'🇺🇿','IQ':'🇮🇶','JO':'🇯🇴'
  };
  return flags[code.toUpperCase()] || '🏳';
}

async function syncMatches(db) {
  const data = await fetchAPI('/games');
  const games = data.data || [];
  for (const game of games) {
    const kickoff = new Date(game.datetime || game.date);
    const israelTime = new Intl.DateTimeFormat('he-IL', {
      timeZone: 'Asia/Jerusalem', day:'2-digit', month:'2-digit',
      year:'numeric', hour:'2-digit', minute:'2-digit'
    }).format(kickoff);
    const home = game.home_team || {};
    const away = game.away_team || {};
    await db.collection('matches').doc(String(game.id)).set({
      balldontlieId: game.id,
      homeTeam: home.name || '',
      awayTeam: away.name || '',
      homeFlag: getFlag(home.abbreviation || ''),
      awayFlag: getFlag(away.abbreviation || ''),
      kickoff, kickoffIsrael: israelTime,
      group: game.group_name || game.round || 'World Cup 2026',
      status: game.status || 'scheduled',
      homeScore: game.home_team_score ?? null,
      awayScore: game.away_team_score ?? null,
      homePlayers: [], awayPlayers: [],
      lastSynced: new Date()
    }, { merge: true });
  }
  return games.length;
}

async function syncLiveResults(db) {
  let liveGames = [];
  try {
    const data = await fetchAPI('/games?status=in_progress');
    liveGames = data.data || [];
  } catch(e) { return 0; }

  for (const game of liveGames) {
    const matchId = String(game.id);
    const homeScore = game.home_team_score ?? null;
    const awayScore = game.away_team_score ?? null;
    const status = game.status;
    await db.collection('matches').doc(matchId).set({ status, homeScore, awayScore, lastSynced: new Date() }, { merge: true });

    const finished = ['finished','ft','full_time','ended'].includes((status||'').toLowerCase());
    if (finished) {
      const resultRef = db.collection('results').doc(matchId);
      const existing = await resultRef.get();
      if (!existing.exists || !existing.data()?.pointsCalculated) {
        let firstScorer = null;
        try {
          const eventsData = await fetchAPI(`/games/${game.id}/events`);
          const goals = (eventsData.data || [])
            .filter(e => e.type === 'goal' || e.type === 'penalty_goal')
            .sort((a, b) => (a.minute || 0) - (b.minute || 0));
          if (goals.length > 0) firstScorer = goals[0].player_name || null;
        } catch(e) { console.log('No events for', matchId); }
        await calculatePoints(db, matchId, homeScore, awayScore, firstScorer);
        await resultRef.set({ homeScore, awayScore, firstScorer, pointsCalculated: true, calculatedAt: new Date() }, { merge: true });
      }
    }
  }
  return liveGames.length;
}

async function calculatePoints(db, matchId, homeScore, awayScore, firstScorer) {
  const predsSnap = await db.collection('predictions').where('matchId', '==', matchId).get();
  for (const predDoc of predsSnap.docs) {
    const pred = predDoc.data();
    let pts = 0, exact = 0, bonus = 0;
    const actualResult = homeScore > awayScore ? 'home' : homeScore < awayScore ? 'away' : 'draw';
    const predResult = pred.homeScore > pred.awayScore ? 'home' : pred.homeScore < pred.awayScore ? 'away' : 'draw';
    if (actualResult === predResult) pts += 1;
    if (pred.homeScore === homeScore && pred.awayScore === awayScore) { pts += 3; exact = 1; }
    if (firstScorer && pred.firstScorer === firstScorer) { pts += 2; bonus += 1; }
    if (pts > 0 || exact > 0 || bonus > 0) {
      const userRef = db.collection('users').doc(pred.userId);
      const userSnap = await userRef.get();
      if (userSnap.exists) {
        await userRef.update({
          points: (userSnap.data().points || 0) + pts,
          exactScores: (userSnap.data().exactScores || 0) + exact,
          bonusPoints: (userSnap.data().bonusPoints || 0) + bonus
        });
      }
    }
  }
  // Tournament player goals
  try {
    const eventsData = await fetchAPI(`/games/${matchId}/events`);
    const goals = (eventsData.data || []).filter(e => e.type === 'goal').map(e => e.player_name).filter(Boolean);
    if (goals.length > 0) {
      const usersSnap = await db.collection('users').get();
      for (const userDoc of usersSnap.docs) {
        const user = userDoc.data();
        if (!user.tournamentPlayer) continue;
        const scored = goals.filter(g => g === user.tournamentPlayer).length;
        if (scored > 0) {
          await userDoc.ref.update({
            points: (user.points || 0) + scored,
            bonusPoints: (user.bonusPoints || 0) + scored
          });
        }
      }
    }
  } catch(e) { console.log('Could not sync tournament goals'); }
}

export default async function handler(req, res) {
  if (req.headers['x-sync-secret'] !== process.env.SYNC_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const db = getDb();
    const action = req.query.action || 'live';
    let result = { action, timestamp: new Date().toISOString() };
    if (action === 'matches') result.synced = await syncMatches(db);
    else if (action === 'live') result.live = await syncLiveResults(db);
    else if (action === 'all') {
      result.matches = await syncMatches(db);
      result.live = await syncLiveResults(db);
    }
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
