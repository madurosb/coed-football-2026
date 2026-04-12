import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const FOOTBALL_DATA_KEY = process.env.FOOTBALL_DATA_KEY;
const BASE_URL = 'https://api.football-data.org/v4';
const WC_CODE = 'WC';

const headers = {
  'X-Auth-Token': FOOTBALL_DATA_KEY
};

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

function getFlag(countryCode) {
  if (!countryCode) return '🏳';
  const flags = {
    'US':'🇺🇸','MEX':'🇲🇽','CAN':'🇨🇦','BRA':'🇧🇷','ARG':'🇦🇷','FRA':'🇫🇷',
    'GER':'🇩🇪','ESP':'🇪🇸','POR':'🇵🇹','ENG':'🏴󠁧󠁢󠁥󠁮󠁧󠁿','ITA':'🇮🇹','NED':'🇳🇱',
    'BEL':'🇧🇪','CRO':'🇭🇷','SRB':'🇷🇸','JPN':'🇯🇵','KOR':'🇰🇷','AUS':'🇦🇺',
    'MAR':'🇲🇦','SEN':'🇸🇳','NGA':'🇳🇬','GHA':'🇬🇭','CIV':'🇨🇮','CMR':'🇨🇲',
    'EGY':'🇪🇬','KSA':'🇸🇦','IRN':'🇮🇷','QAT':'🇶🇦','URU':'🇺🇾','COL':'🇨🇴',
    'PER':'🇵🇪','ECU':'🇪🇨','POL':'🇵🇱','SUI':'🇨🇭','DEN':'🇩🇰','SWE':'🇸🇪',
    'NOR':'🇳🇴','CZE':'🇨🇿','AUT':'🇦🇹','TUR':'🇹🇷','UKR':'🇺🇦','HUN':'🇭🇺',
    'ROU':'🇷🇴','SVK':'🇸🇰','ALB':'🇦🇱','SVN':'🇸🇮','GEO':'🇬🇪','VEN':'🇻🇪',
    'PAN':'🇵🇦','TUN':'🇹🇳','DZA':'🇩🇿','KEN':'🇰🇪','MLI':'🇲🇱','ZMB':'🇿🇲',
    'GTM':'🇬🇹','HND':'🇭🇳','SLV':'🇸🇻','CRC':'🇨🇷','DOM':'🇩🇴','TTO':'🇹🇹',
    'BOL':'🇧🇴','CHL':'🇨🇱','PRY':'🇵🇾','NZL':'🇳🇿','CHN':'🇨🇳','THA':'🇹🇭',
    'IDN':'🇮🇩','UZB':'🇺🇿','IRQ':'🇮🇶','JOR':'🇯🇴'
  };
  return flags[countryCode.toUpperCase()] || '🏳';
}

async function syncMatches(db) {
  const data = await fetchAPI(`/competitions/${WC_CODE}/matches`);
  const matches = data.matches || [];

  for (const match of matches) {
    const kickoff = new Date(match.utcDate);
    const israelTime = new Intl.DateTimeFormat('he-IL', {
      timeZone: 'Asia/Jerusalem', day:'2-digit', month:'2-digit',
      year:'numeric', hour:'2-digit', minute:'2-digit'
    }).format(kickoff);

    const home = match.homeTeam || {};
    const away = match.awayTeam || {};
    const score = match.score || {};
    const ft = score.fullTime || {};

    await db.collection('matches').doc(String(match.id)).set({
      footballDataId: match.id,
      homeTeam: home.name || home.shortName || '',
      awayTeam: away.name || away.shortName || '',
      homeFlag: getFlag(home.tla || ''),
      awayFlag: getFlag(away.tla || ''),
      kickoff,
      kickoffIsrael: israelTime,
      group: match.group || match.stage || 'World Cup 2026',
      status: match.status || 'SCHEDULED',
      homeScore: ft.home ?? null,
      awayScore: ft.away ?? null,
      homePlayers: [],
      awayPlayers: [],
      lastSynced: new Date()
    }, { merge: true });
  }
  return matches.length;
}

async function syncLiveResults(db) {
  let liveMatches = [];
  try {
    const data = await fetchAPI(`/competitions/${WC_CODE}/matches?status=IN_PLAY,PAUSED,FINISHED`);
    liveMatches = data.matches || [];
  } catch(e) {
    return 0;
  }

  for (const match of liveMatches) {
    const matchId = String(match.id);
    const score = match.score || {};
    const ft = score.fullTime || {};
    const homeScore = ft.home ?? null;
    const awayScore = ft.away ?? null;
    const status = match.status;

    await db.collection('matches').doc(matchId).set({
      status, homeScore, awayScore, lastSynced: new Date()
    }, { merge: true });

    if (status === 'FINISHED') {
      const resultRef = db.collection('results').doc(matchId);
      const existing = await resultRef.get();
      if (!existing.exists || !existing.data()?.pointsCalculated) {
        // football-data.org doesn't have goalscorer in free tier
        // We get scorer from goals array if available
        let firstScorer = null;
        try {
          const detail = await fetchAPI(`/matches/${match.id}`);
          const goals = (detail.goals || [])
            .filter(g => g.type !== 'OWN_GOAL')
            .sort((a, b) => (a.minute || 0) - (b.minute || 0));
          if (goals.length > 0) {
            firstScorer = goals[0].scorer?.name || null;
          }
        } catch(e) {
          console.log('Could not get scorer for', matchId);
        }

        await calculatePoints(db, matchId, homeScore, awayScore, firstScorer);
        await resultRef.set({
          homeScore, awayScore, firstScorer,
          pointsCalculated: true,
          calculatedAt: new Date()
        }, { merge: true });
      }
    }
  }
  return liveMatches.length;
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
    const detail = await fetchAPI(`/matches/${matchId}`);
    const goals = (detail.goals || [])
      .filter(g => g.type !== 'OWN_GOAL')
      .map(g => g.scorer?.name)
      .filter(Boolean);
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
  } catch(e) {
    console.log('Could not sync tournament goals for', matchId);
  }
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
