import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const TOURNAMENT_ID = 132;
const BASE_URL = 'https://sportapi7.p.rapidapi.com/api/v1';

const headers = {
  'Content-Type': 'application/json',
  'x-rapidapi-host': 'sportapi7.p.rapidapi.com',
  'x-rapidapi-key': RAPIDAPI_KEY
};

function getDb() {
  if (!getApps().length) {
    initializeApp({
      credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
    });
  }
  return getFirestore();
}

async function fetchAPI(path) {
  const res = await fetch(`${BASE_URL}${path}`, { headers });
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  return res.json();
}

function getFlag(alpha2) {
  if (!alpha2) return '🏳';
  const flags = {
    'US':'🇺🇸','MX':'🇲🇽','CA':'🇨🇦','BR':'🇧🇷','AR':'🇦🇷','FR':'🇫🇷',
    'DE':'🇩🇪','ES':'🇪🇸','PT':'🇵🇹','GB':'🏴󠁧󠁢󠁥󠁮󠁧󠁿','IT':'🇮🇹','NL':'🇳🇱',
    'BE':'🇧🇪','HR':'🇭🇷','RS':'🇷🇸','JP':'🇯🇵','KR':'🇰🇷','AU':'🇦🇺',
    'MA':'🇲🇦','SN':'🇸🇳','NG':'🇳🇬','GH':'🇬🇭','CI':'🇨🇮','CM':'🇨🇲',
    'EG':'🇪🇬','SA':'🇸🇦','IR':'🇮🇷','QA':'🇶🇦','UY':'🇺🇾','CO':'🇨🇴',
    'PE':'🇵🇪','EC':'🇪🇨','PL':'🇵🇱','CH':'🇨🇭','DK':'🇩🇰','SE':'🇸🇪',
    'NO':'🇳🇴','CZ':'🇨🇿','AT':'🇦🇹','TR':'🇹🇷','UA':'🇺🇦','HU':'🇭🇺',
    'RO':'🇷🇴','SK':'🇸🇰','AL':'🇦🇱','ME':'🇲🇪','MK':'🇲🇰','BA':'🇧🇦','SI':'🇸🇮'
  };
  return flags[alpha2.toUpperCase()] || '🏳';
}

async function getSeason() {
  try {
    const data = await fetchAPI(`/unique-tournament/${TOURNAMENT_ID}/seasons`);
    return data.seasons?.[0]?.id || 65360;
  } catch {
    return 65360;
  }
}

async function syncMatches(db, seasonId) {
  let allEvents = [];
  try {
    const past = await fetchAPI(`/unique-tournament/${TOURNAMENT_ID}/season/${seasonId}/events/last/0`);
    allEvents = [...allEvents, ...(past.events || [])];
  } catch(e) { console.log('No past events'); }
  try {
    const next = await fetchAPI(`/unique-tournament/${TOURNAMENT_ID}/season/${seasonId}/events/next/0`);
    allEvents = [...allEvents, ...(next.events || [])];
  } catch(e) { console.log('No next events'); }

  for (const event of allEvents) {
    const kickoff = new Date(event.startTimestamp * 1000);
    const israelTime = new Intl.DateTimeFormat('he-IL', {
      timeZone: 'Asia/Jerusalem', day:'2-digit', month:'2-digit',
      year:'numeric', hour:'2-digit', minute:'2-digit'
    }).format(kickoff);

    await db.collection('matches').doc(String(event.id)).set({
      sofascoreId: event.id,
      homeTeam: event.homeTeam?.name || '',
      awayTeam: event.awayTeam?.name || '',
      homeFlag: getFlag(event.homeTeam?.country?.alpha2 || ''),
      awayFlag: getFlag(event.awayTeam?.country?.alpha2 || ''),
      kickoff: kickoff,
      kickoffIsrael: israelTime,
      group: event.roundInfo?.name || 'World Cup 2026',
      status: event.status?.type || 'notstarted',
      homeScore: event.homeScore?.current ?? null,
      awayScore: event.awayScore?.current ?? null,
      lastSynced: new Date()
    }, { merge: true });
  }
  return allEvents.length;
}

async function syncLiveResults(db, seasonId) {
  let liveEvents = [];
  try {
    const data = await fetchAPI(`/unique-tournament/${TOURNAMENT_ID}/season/${seasonId}/events/live`);
    liveEvents = data.events || [];
  } catch(e) { return 0; }

  for (const event of liveEvents) {
    const matchId = String(event.id);
    const homeScore = event.homeScore?.current ?? null;
    const awayScore = event.awayScore?.current ?? null;
    const status = event.status?.type;

    await db.collection('matches').doc(matchId).set({
      status, homeScore, awayScore, lastSynced: new Date()
    }, { merge: true });

    if (status === 'finished') {
      const resultRef = db.collection('results').doc(matchId);
      const existing = await resultRef.get();
      if (!existing.exists || !existing.data()?.pointsCalculated) {
        let firstScorer = null;
        try {
          const incidents = await fetchAPI(`/event/${event.id}/incidents`);
          const goals = (incidents.incidents || [])
            .filter(i => i.incidentType === 'goal' || i.incidentType === 'penalty')
            .sort((a, b) => (a.time || 0) - (b.time || 0));
          if (goals.length > 0) firstScorer = goals[0].player?.name || null;
        } catch(e) { console.log('No incidents for', matchId); }

        await calculatePoints(db, matchId, homeScore, awayScore, firstScorer);
        await resultRef.set({ homeScore, awayScore, firstScorer, pointsCalculated: true, calculatedAt: new Date() }, { merge: true });
      }
    }
  }
  return liveEvents.length;
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
    const incidents = await fetchAPI(`/event/${matchId}/incidents`);
    const goals = (incidents.incidents || []).filter(i => i.incidentType === 'goal').map(i => i.player?.name).filter(Boolean);
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
    const seasonId = await getSeason();
    const action = req.query.action || 'live';
    let result = { action, timestamp: new Date().toISOString() };

    if (action === 'matches') {
      result.synced = await syncMatches(db, seasonId);
    } else if (action === 'live') {
      result.live = await syncLiveResults(db, seasonId);
    } else if (action === 'all') {
      result.matches = await syncMatches(db, seasonId);
      result.live = await syncLiveResults(db, seasonId);
    }

    res.status(200).json({ success: true, ...result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
