// COED&FOOTBALL - SofaScore API Sync
// This runs as a Vercel Serverless Function
// It fetches live World Cup data and syncs it to Firebase

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const TOURNAMENT_ID = 132; // FIFA World Cup
const BASE_URL = 'https://sportapi7.p.rapidapi.com/api/v1';

const headers = {
  'Content-Type': 'application/json',
  'x-rapidapi-host': 'sportapi7.p.rapidapi.com',
  'x-rapidapi-key': RAPIDAPI_KEY
};

// Init Firebase Admin
let db;
function getDb() {
  if (!db) {
    initializeApp({
      credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
    });
    db = getFirestore();
  }
  return db;
}

// Fetch from SofaScore API
async function fetchAPI(path) {
  const res = await fetch(`${BASE_URL}${path}`, { headers });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// Get current season for World Cup
async function getSeason() {
  const data = await fetchAPI(`/unique-tournament/${TOURNAMENT_ID}/seasons`);
  // Return most recent season
  return data.seasons?.[0]?.id || 65360;
}

// Sync all matches to Firestore
async function syncMatches(seasonId) {
  const db = getDb();
  const data = await fetchAPI(`/unique-tournament/${TOURNAMENT_ID}/season/${seasonId}/events/last/0`);
  const upcoming = await fetchAPI(`/unique-tournament/${TOURNAMENT_ID}/season/${seasonId}/events/next/0`);

  const allEvents = [
    ...(data.events || []),
    ...(upcoming.events || [])
  ];

  const batch = db.batch();
  let count = 0;

  for (const event of allEvents) {
    const matchRef = db.collection('matches').doc(String(event.id));
    const kickoffMs = event.startTimestamp * 1000;
    const kickoff = new Date(kickoffMs);

    // Convert to Israel time string
    const israelTime = new Intl.DateTimeFormat('he-IL', {
      timeZone: 'Asia/Jerusalem',
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    }).format(kickoff);

    const matchData = {
      sofascoreId: event.id,
      homeTeam: event.homeTeam?.name || '',
      awayTeam: event.awayTeam?.name || '',
      homeFlag: getFlag(event.homeTeam?.country?.alpha2 || ''),
      awayFlag: getFlag(event.awayTeam?.country?.alpha2 || ''),
      kickoff: kickoff,
      kickoffIsrael: israelTime,
      group: event.roundInfo?.name || event.tournament?.name || 'World Cup 2026',
      status: event.status?.type || 'notstarted',
      homeScore: event.homeScore?.current ?? null,
      awayScore: event.awayScore?.current ?? null,
      homePlayers: [],
      awayPlayers: [],
      lastSynced: new Date()
    };

    batch.set(matchRef, matchData, { merge: true });
    count++;
  }

  await batch.commit();
  return count;
}

// Sync live results - runs more frequently
async function syncResults(seasonId) {
  const db = getDb();
  // Get live events
  const data = await fetchAPI(`/unique-tournament/${TOURNAMENT_ID}/season/${seasonId}/events/live`);
  const events = data.events || [];

  for (const event of events) {
    if (event.status?.type === 'finished' || event.status?.type === 'inprogress') {
      const matchRef = db.collection('matches').doc(String(event.id));

      // Get incident data for first goalscorer
      let firstScorer = null;
      try {
        const incidents = await fetchAPI(`/event/${event.id}/incidents`);
        const goals = (incidents.incidents || [])
          .filter(i => i.incidentType === 'goal' || i.incidentType === 'penalty')
          .sort((a, b) => (a.time || 0) - (b.time || 0));
        if (goals.length > 0) {
          firstScorer = goals[0].player?.name || null;
        }
      } catch(e) {
        console.log('Could not fetch incidents for', event.id);
      }

      const updateData = {
        status: event.status?.type,
        homeScore: event.homeScore?.current ?? null,
        awayScore: event.awayScore?.current ?? null,
        lastSynced: new Date()
      };
      if (firstScorer) updateData.firstScorer = firstScorer;

      await matchRef.set(updateData, { merge: true });

      // If finished, calculate points automatically
      if (event.status?.type === 'finished') {
        await calculatePoints(String(event.id), event.homeScore?.current, event.awayScore?.current, firstScorer);
      }
    }
  }
  return events.length;
}

// Sync squad players for each match
async function syncPlayers(matchId) {
  const db = getDb();
  const data = await fetchAPI(`/event/${matchId}/lineups`);

  const homePlayers = (data.home?.players || []).map(p => p.player?.name).filter(Boolean);
  const awayPlayers = (data.away?.players || []).map(p => p.player?.name).filter(Boolean);

  await db.collection('matches').doc(String(matchId)).set({
    homePlayers,
    awayPlayers,
    lineupsSynced: true
  }, { merge: true });

  return { homePlayers, awayPlayers };
}

// Auto-calculate points when a match finishes
async function calculatePoints(matchId, homeScore, awayScore, firstScorer) {
  const db = getDb();

  // Check if already calculated
  const resultRef = db.collection('results').doc(matchId);
  const existing = await resultRef.get();
  if (existing.exists && existing.data()?.pointsCalculated) return;

  // Get all predictions for this match
  const predsSnap = await db.collection('predictions')
    .where('matchId', '==', matchId).get();

  for (const predDoc of predsSnap.docs) {
    const pred = predDoc.data();
    let pts = 0;
    let exact = 0;
    let bonus = 0;

    // Correct winner/draw
    const actualResult = homeScore > awayScore ? 'home' : homeScore < awayScore ? 'away' : 'draw';
    const predResult = pred.homeScore > pred.awayScore ? 'home' : pred.homeScore < pred.awayScore ? 'away' : 'draw';
    if (actualResult === predResult) pts += 1;

    // Exact score
    if (pred.homeScore === homeScore && pred.awayScore === awayScore) {
      pts += 3; exact = 1;
    }

    // First goalscorer
    if (firstScorer && pred.firstScorer === firstScorer) {
      pts += 2; bonus += 1;
    }

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

  // Also check tournament player goals
  await syncTournamentPlayerGoals(matchId);

  // Mark as calculated
  await resultRef.set({
    homeScore, awayScore, firstScorer,
    pointsCalculated: true,
    calculatedAt: new Date()
  }, { merge: true });
}

// Update tournament player bonus points
async function syncTournamentPlayerGoals(matchId) {
  const db = getDb();
  try {
    const incidents = await fetchAPI(`/event/${matchId}/incidents`);
    const goals = (incidents.incidents || [])
      .filter(i => i.incidentType === 'goal')
      .map(i => i.player?.name)
      .filter(Boolean);

    if (goals.length === 0) return;

    const usersSnap = await db.collection('users').get();
    for (const userDoc of usersSnap.docs) {
      const user = userDoc.data();
      if (!user.tournamentPlayer) continue;
      const goalsScored = goals.filter(g => g === user.tournamentPlayer).length;
      if (goalsScored > 0) {
        await userDoc.ref.update({
          points: (user.points || 0) + goalsScored,
          bonusPoints: (user.bonusPoints || 0) + goalsScored
        });
      }
    }
  } catch(e) {
    console.log('Could not sync tournament player goals');
  }
}

// Country code to flag emoji
function getFlag(alpha2) {
  if (!alpha2) return '🏳';
  const flags = {
    'US': '🇺🇸', 'MX': '🇲🇽', 'CA': '🇨🇦', 'BR': '🇧🇷', 'AR': '🇦🇷',
    'FR': '🇫🇷', 'DE': '🇩🇪', 'ES': '🇪🇸', 'PT': '🇵🇹', 'GB': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    'IT': '🇮🇹', 'NL': '🇳🇱', 'BE': '🇧🇪', 'HR': '🇭🇷', 'RS': '🇷🇸',
    'JP': '🇯🇵', 'KR': '🇰🇷', 'AU': '🇦🇺', 'MA': '🇲🇦', 'SN': '🇸🇳',
    'NG': '🇳🇬', 'GH': '🇬🇭', 'CI': '🇨🇮', 'CM': '🇨🇲', 'EG': '🇪🇬',
    'SA': '🇸🇦', 'IR': '🇮🇷', 'QA': '🇶🇦', 'UY': '🇺🇾', 'CO': '🇨🇴',
    'PE': '🇵🇪', 'EC': '🇪🇨', 'PL': '🇵🇱', 'CH': '🇨🇭', 'DK': '🇩🇰',
    'SE': '🇸🇪', 'NO': '🇳🇴', 'CZ': '🇨🇿', 'AT': '🇦🇹', 'TR': '🇹🇷',
    'UA': '🇺🇦', 'HU': '🇭🇺', 'RO': '🇷🇴', 'SK': '🇸🇰', 'AL': '🇦🇱',
    'ME': '🇲🇪', 'MK': '🇲🇰', 'BA': '🇧🇦', 'SI': '🇸🇮'
  };
  return flags[alpha2.toUpperCase()] || '🏳';
}

// Main handler - Vercel Serverless Function
export default async function handler(req, res) {
  // Security check
  const secret = req.headers['x-sync-secret'];
  if (secret !== process.env.SYNC_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const action = req.query.action || 'all';

  try {
    const seasonId = await getSeason();
    let result = {};

    if (action === 'matches' || action === 'all') {
      const count = await syncMatches(seasonId);
      result.matchesSynced = count;
    }

    if (action === 'results' || action === 'all') {
      const count = await syncResults(seasonId);
      result.resultsSynced = count;
    }

    if (action === 'players' && req.query.matchId) {
      const players = await syncPlayers(req.query.matchId);
      result.players = players;
    }

    res.status(200).json({ success: true, ...result, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error('Sync error:', err);
    res.status(500).json({ error: err.message });
  }
}
