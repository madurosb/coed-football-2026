// /api/sync.js  
// Syncs live match status + scores from football-data.org → Firestore
// Called by: Vercel Cron (every minute) OR manually with x-sync-secret header
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const FOOTBALL_DATA_KEY = process.env.FOOTBALL_DATA_KEY;
const BASE_URL = 'https://api.football-data.org/v4';
const WC_CODE = 'WC';
const headers = { 'X-Auth-Token': FOOTBALL_DATA_KEY };

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

function getFlag(tla) {
  if (!tla) return '';
  const flags = {
    'US':'🇺🇸','MX':'🇲🇽','CA':'🇨🇦','BR':'🇧🇷','AR':'🇦🇷','FR':'🇫🇷',
    'DE':'🇩🇪','ES':'🇪🇸','PT':'🇵🇹','NL':'🇳🇱','BE':'🇧🇪','HR':'🇭🇷',
    'JP':'🇯🇵','KR':'🇰🇷','AU':'🇦🇺','MA':'🇲🇦','SN':'🇸🇳','NG':'🇳🇬',
    'GH':'🇬🇭','CI':'🇨🇮','EG':'🇪🇬','SA':'🇸🇦','IR':'🇮🇷','QA':'🇶🇦',
    'UY':'🇺🇾','CO':'🇨🇴','EC':'🇪🇨','CH':'🇨🇭','NO':'🇳🇴','CZ':'🇨🇿',
    'AT':'🇦🇹','TR':'🇹🇷','UA':'🇺🇦','SE':'🇸🇪','BA':'🇧🇦','CV':'🇨🇻',
    'CW':'🇨🇼','HT':'🇭🇹','PA':'🇵🇦','IQ':'🇮🇶','CD':'🇨🇩','NZ':'🇳🇿',
    'UZ':'🇺🇿','JO':'🇯🇴','DZ':'🇩🇿','ZA':'🇿🇦','TN':'🇹🇳','PY':'🇵🇾',
    'VE':'🇻🇪','BO':'🇧🇴','PE':'🇵🇪','CL':'🇨🇱','GT':'🇬🇹','HN':'🇭🇳',
  };
  return flags[tla.toUpperCase()] || '';
}

async function syncLiveResults(db) {
  let liveMatches = [];
  try {
    const data = await fetchAPI(`/competitions/${WC_CODE}/matches?status=IN_PLAY,PAUSED,FINISHED`);
    liveMatches = (data.matches || []).filter(m => ['IN_PLAY','PAUSED','FINISHED'].includes(m.status));
  } catch(e) { return 0; }

  for (const match of liveMatches) {
    const matchId = String(match.id);
    const score = match.score || {};
    const ft = score.fullTime || {};
    const ht = score.halfTime || {};
    const homeScore = ft.home ?? ht.home ?? null;
    const awayScore = ft.away ?? ht.away ?? null;
    const status = match.status;

    await db.collection('matches').doc(matchId).set({
      status, homeScore, awayScore, lastSynced: new Date()
    }, { merge: true });

    if (status === 'FINISHED') {
      const resultRef = db.collection('results').doc(matchId);
      const existing = await resultRef.get();
      if (!existing.exists || !existing.data()?.pointsCalculated) {
        let firstScorer = null;
        try {
          const detail = await fetchAPI(`/matches/${matchId}`);
          const goals = detail.goals || [];
          if (goals.length > 0) firstScorer = goals[0].scorer?.name || null;
        } catch(e) {}
        if (firstScorer) {
          await resultRef.set({ firstScorer, autoDetected: true }, { merge: true });
        }
      }
    }
  }
  return liveMatches.length;
}

async function syncMatches(db) {
  const data = await fetchAPI(`/competitions/${WC_CODE}/matches`);
  const matches = data.matches || [];
  let synced = 0;
  for (const match of matches) {
    const matchId = String(match.id);
    const score = match.score || {};
    const ft = score.fullTime || {};
    await db.collection('matches').doc(matchId).set({
      status: match.status || 'SCHEDULED',
      homeScore: ft.home ?? null,
      awayScore: ft.away ?? null,
      lastSynced: new Date()
    }, { merge: true });
    synced++;
  }
  return synced;
}

export default async function handler(req, res) {
  // Accept: manual call with x-sync-secret, OR Vercel Cron (sends Authorization: Bearer CRON_SECRET)
  const manualSecret = req.headers['x-sync-secret'];
  const cronAuth = req.headers['authorization'];
  const isVercelCron = cronAuth === `Bearer ${process.env.CRON_SECRET}` || 
                       req.headers['x-vercel-cron'] === '1';
  const isManual = manualSecret === process.env.SYNC_SECRET;

  if (!isVercelCron && !isManual) {
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
    return res.status(200).json(result);
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
