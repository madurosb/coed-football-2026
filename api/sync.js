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
    'USA':'🇺🇸','MEX':'🇲🇽','CAN':'🇨🇦','BRA':'🇧🇷','ARG':'🇦🇷','FRA':'🇫🇷',
    'GER':'🇩🇪','ESP':'🇪🇸','POR':'🇵🇹','ENG':'🏴󠁧󠁢󠁥󠁮󠁧󠁿','NED':'🇳🇱','BEL':'🇧🇪',
    'CRO':'🇭🇷','JPN':'🇯🇵','KOR':'🇰🇷','AUS':'🇦🇺','MAR':'🇲🇦','SEN':'🇸🇳',
    'NGA':'🇳🇬','GHA':'🇬🇭','CIV':'🇨🇮','EGY':'🇪🇬','KSA':'🇸🇦','IRN':'🇮🇷',
    'QAT':'🇶🇦','URU':'🇺🇾','COL':'🇨🇴','ECU':'🇪🇨','SUI':'🇨🇭','NOR':'🇳🇴',
    'CZE':'🇨🇿','AUT':'🇦🇹','TUR':'🇹🇷','UKR':'🇺🇦','SCO':'🏴󠁧󠁢󠁳󠁣󠁴󠁿','SWE':'🇸🇪',
    'BIH':'🇧🇦','CPV':'🇨🇻','CUW':'🇨🇼','HTI':'🇭🇹','PAN':'🇵🇦','IRQ':'🇮🇶',
    'COD':'🇨🇩','NZL':'🇳🇿','UZB':'🇺🇿','JOR':'🇯🇴','ALG':'🇩🇿','RSA':'🇿🇦',
    'TUN':'🇹🇳','PAR':'🇵🇾','VEN':'🇻🇪','BOL':'🇧🇴','PER':'🇵🇪','CHI':'🇨🇱',
    'GTM':'🇬🇹','HON':'🇭🇳'
  };
  return flags[tla.toUpperCase()] || '';
}

// Hardcoded squads - outfield players only
const SQUADS = {
  'Algeria': ['Riyad Mahrez','Islam Slimani','Youcef Atal','Sofiane Feghouli','Haris Belkebla','Aissa Mandi','Djamel Benlamri','Ismael Bennacer','Bilal Benkhedim','Ilyes Chetti'],
  'Argentina': ['Lionel Messi','Julian Alvarez','Lautaro Martinez','Rodrigo De Paul','Enzo Fernandez','Alejandro Garnacho','Thiago Almada','Nicolas Gonzalez','Leandro Paredes','Giovani Lo Celso'],
  'Australia': ['Mathew Leckie','Mitchell Duke','Martin Boyle','Aaron Mooy','Craig Goodwin','Garang Kuol','Riley McGree','Keanu Baccus','Denis Genreau','Kye Rowles'],
  'Austria': ['Marcel Sabitzer','Christoph Baumgartner','Michael Gregoritsch','Marko Arnautovic','Konrad Laimer','Patrick Wimmer','Nicolas Seiwald','Romano Schmid','Florian Grillitsch','Philipp Lienhart'],
  'Belgium': ['Romelu Lukaku','Kevin De Bruyne','Jeremy Doku','Lois Openda','Youri Tielemans','Leandro Trossard','Charles De Ketelaere','Arthur Theate','Axel Witsel','Dodi Lukebakio'],
  'Bosnia & Herzegovina': ['Ermedin Demirovic','Edin Dzeko','Dzenis Burnic','Miralem Pjanic','Sasa Kalajdzic','Rade Krunic','Nedim Bajrami','Edin Visca','Amar Dedic','Anel Ahmedhodzic'],
  'Bosnia and Herzegovina': ['Ermedin Demirovic','Edin Dzeko','Dzenis Burnic','Miralem Pjanic','Sasa Kalajdzic','Rade Krunic','Nedim Bajrami','Edin Visca','Amar Dedic','Anel Ahmedhodzic'],
  'Brazil': ['Vinicius Jr.','Endrick','Raphinha','Lucas Paqueta','Gabriel Martinelli','Casemiro','Bruno Guimaraes','Gabriel Jesus','Savinho','Estevao'],
  'Canada': ['Alphonso Davies','Jonathan David','Cyle Larin','Tajon Buchanan','Stephen Eustaquio','Ismael Kone','Alistair Johnston','Moise Bombito','Derek Cornelius','Richie Laryea'],
  'Cape Verde': ['Garry Rodrigues','Ryan Mendes','Kenny Rocha Santos','Dylan Tavares','Roberto Lopes','Jamiro Monteiro','Steven Fortes','Julio Tavares','Carlos Ponck','Stopira'],
  'Chile': ['Alexis Sanchez','Ben Brereton Diaz','Erick Pulgar','Charles Aranguiz','Felipe Mora','Damian Pizarro','Marcelino Nunez','Ivan Morales','Junior Fernandes','Paulo Diaz'],
  'Colombia': ['James Rodriguez','Luis Diaz','Jhon Duran','Cucho Hernandez','Rafael Santos Borre','Jefferson Lerma','Richard Rios','Jhon Arias','Daniel Munoz','Davinson Sanchez'],
  'Croatia': ['Luka Modric','Mateo Kovacic','Andrej Kramaric','Bruno Petkovic','Marcelo Brozovic','Nikola Vlasic','Lovro Majer','Mario Pasalic','Borna Sosa','Ivan Perisic'],
  'Curacao': ['Leandro Bacuna','Cuco Martina','Rangelo Janga','Elson Hooi','Jarchinio Antonia','Gino van Kessel','Jurien Gaari','Darryl Lachman','Juninho Bacuna','Etienne Reijnen'],
  'Czech Republic': ['Patrik Schick','Tomas Soucek','Vladimir Coufal','Stanislav Lobotka','Adam Hlozek','Lukas Provod','Tomas Suslov','Jan Kuchta','Mojmir Chytil','Ondrej Duda'],
  'Czechia': ['Patrik Schick','Tomas Soucek','Vladimir Coufal','Stanislav Lobotka','Adam Hlozek','Lukas Provod','Tomas Suslov','Jan Kuchta','Mojmir Chytil','Ondrej Duda'],
  'DR Congo': ['Silas Wissa','Yoane Wissa','Cedric Bakambu','Chancel Mbemba','Arthur Masuaku','Paul-Jose Mpoku','Neeskens Kebano','Dodi Lukebakio','Theo Bongonda','Samuel Bastien'],
  'Ecuador': ['Enner Valencia','Michael Estrada','Gonzalo Plata','Jeremy Sarmiento','Piero Hincapie','Pervis Estupinan','Moises Caicedo','Jose Cifuentes','Djorkaeff Reasco','Angelo Preciado'],
  'Egypt': ['Mohamed Salah','Omar Marmoush','Mostafa Mohamed','Trezeguet','Mahmoud Hassan','Emam Ashour','Ahmed Sayed Zizou','Amr El Sulaya','Ramy Rabia','Karim El Ahmadi'],
  'England': ['Harry Kane','Jude Bellingham','Bukayo Saka','Phil Foden','Cole Palmer','Marcus Rashford','Declan Rice','Kobbie Mainoo','Ollie Watkins','Trent Alexander-Arnold'],
  'France': ['Kylian Mbappe','Antoine Griezmann','Ousmane Dembele','Marcus Thuram','Randal Kolo Muani','Christopher Nkunku','Eduardo Camavinga','Aurelien Tchouameni','Kingsley Coman','Warren Zaire-Emery'],
  'Germany': ['Florian Wirtz','Jamal Musiala','Kai Havertz','Leroy Sane','Niclas Fullkrug','Joshua Kimmich','Leon Goretzka','Serge Gnabry','Nick Woltemade','Aleksandar Pavlovic'],
  'Ghana': ['Mohammed Kudus','Jordan Ayew','Antoine Semenyo','Thomas Partey','Inaki Williams','Abdul Fatawu','Tariq Lamptey','Osman Bukari','Andre Ayew','Daniel Amartey'],
  'Haiti': ['Duckens Nazon','Frantzdy Pierrot','Steeven Saba','Mechack Jerome','Derrick Etienne','Wilde-Donald Guerrier','Kevin Laventure','Chery Duckens','Jhon Luzincourt','Frantz Gerald Calixte'],
  'Honduras': ['Alberth Elis','Romell Quioto','Anthony Lozano','Luis Palma','Alex Lopez','Bryan Acosta','Kervin Arriaga','Rigoberto Rivas','Deybi Flores','Jorge Alvarez'],
  'Iran': ['Mehdi Taremi','Sardar Azmoun','Alireza Jahanbakhsh','Karim Ansarifard','Vahid Amiri','Ehsan Hajsafi','Saeid Ezatolahi','Ali Gholizadeh','Ahmad Nourollahi','Milad Mohammadi'],
  'Iraq': ['Aymen Hussein','Amjed Attwan','Mohanad Ali','Yaser Kasim','Alaa Abbas','Ibrahim Bayesh','Muhanad Abdulraheem','Bashar Resan','Saad Natiq','Ali Adnan'],
  "Côte d'Ivoire": ['Sebastien Haller','Nicolas Pepe','Franck Kessie','Serge Aurier','Max Gradel','Simon Adingra','Jeremie Boga','Ibrahim Sangare','Seko Fofana','Wilfried Zaha'],
  'Ivory Coast': ['Sebastien Haller','Nicolas Pepe','Franck Kessie','Serge Aurier','Max Gradel','Simon Adingra','Jeremie Boga','Ibrahim Sangare','Seko Fofana','Wilfried Zaha'],
  'Japan': ['Takefusa Kubo','Kaoru Mitoma','Ritsu Doan','Daichi Kamada','Wataru Endo','Ao Tanaka','Takehiro Tomiyasu','Ayase Ueda','Yukinari Sugawara','Hiroki Ito'],
  'Jordan': ['Musa Al-Taamari','Yazan Al-Naimat','Baha Faisal','Ahmad Gharaibeh','Hamza Al-Dardour','Ashraf Nour','Odai Al-Rashid','Mohammad Abu Hasna','Rawan Rawashdeh','Ahmad Al-Saify'],
  'Mexico': ['Santiago Gimenez','Hirving Lozano','Raul Jimenez','Roberto Alvarado','Henry Martin','Orbelin Pineda','Carlos Vela','Uriel Antuna','Edson Alvarez','Cesar Montes'],
  'Morocco': ['Hakim Ziyech','Achraf Hakimi','Youssef En-Nesyri','Sofiane Boufal','Azzedine Ounahi','Nayef Aguerd','Abde Ezzalzouli','Ibrahim Diaz','Selim Amallah','Romain Saiss'],
  'Netherlands': ['Cody Gakpo','Xavi Simons','Frenkie de Jong','Wout Weghorst','Donyell Malen','Tijjani Reijnders','Teun Koopmeiners','Nathan Ake','Denzel Dumfries','Memphis Depay'],
  'New Zealand': ['Chris Wood','Clayton Lewis','Liberato Cacace','Elijah Just','Matthew Garbett','Alex Rufer','Deklan Wynne','Tommy Smith','Bill Tuilagi','Marko Stamenic'],
  'Nigeria': ['Victor Osimhen','Ademola Lookman','Alex Iwobi','Wilfred Ndidi','Samuel Chukwueze','Moses Simon','Taiwo Awoniyi','Frank Onyeka','Emmanuel Dennis','Kelechi Iheanacho'],
  'Norway': ['Erling Haaland','Martin Odegaard','Alexander Isak','Viktor Gyokeres','Antonio Nusa','Sander Berge','Kristian Thorstvedt','Mohamed Elyounoussi','Patrick Berg','Alexander Sorloth'],
  'Panama': ['Cecilio Waterman','Rolando Blackburn','Ismael Diaz','Anibal Godoy','Adalberto Carrasquilla','Jose Fajardo','Abdiel Arroyo','Edgar Barcenas','Alfredo Stephens','Ricardo Avila'],
  'Paraguay': ['Miguel Almiron','Gustavo Gomez','Richard Sanchez','Junior Alonso','Matias Rojas','Omar Alderete','Antonio Sanabria','Julio Enciso','Julio Romero','Carlos Gonzalez'],
  'Peru': ['Paolo Guerrero','Andre Carrillo','Gianluca Lapadula','Edison Flores','Christian Cueva','Luis Advincula','Renato Tapia','Bryan Reyna','Marcos Lopez','Santiago Ormeño'],
  'Portugal': ['Cristiano Ronaldo','Rafael Leao','Bruno Fernandes','Bernardo Silva','Joao Felix','Goncalo Ramos','Pedro Neto','Vitinha','Diogo Jota','Ruben Neves'],
  'Qatar': ['Akram Afif','Almoez Ali','Hassan Al-Haydos','Abdulaziz Hatem','Ismaeel Mohammad','Karim Boudiaf','Pedro Miguel','Boualem Khoukhi','Bassam Al-Rawi','Ahmed Al-Harazi'],
  'Saudi Arabia': ['Salem Al-Dawsari','Firas Al-Buraikan','Sami Al-Najei','Abdullah Otayf','Hattan Bahebri','Moussa Al-Tammari','Nasser Al-Dawsari','Mohamed Kanno','Ali Al-Hassan','Saleh Al-Shehri'],
  'Scotland': ['Scott McTominay','Andrew Robertson','Kieran Tierney','Che Adams','Ryan Christie','John McGinn','Billy Gilmour','Lawrence Shankland','Ryan Jack','Stuart Armstrong'],
  'Senegal': ['Sadio Mane','Ismaila Sarr','Nicolas Jackson','Iliman Ndiaye','Kalidou Koulibaly','Pape Matar Sarr','Lamine Camara','Idrissa Gueye','Cheikhou Kouyate','Bamba Dieng'],
  'South Africa': ['Percy Tau','Bongani Zungu','Themba Zwane','Keagan Dolly','Evidence Makgopa','Sifiso Hlanti','Mothobi Mvala','Yusuf Maart','Lyle Foster','Teboho Mokoena'],
  'South Korea': ['Son Heung-min','Lee Kang-in','Hwang Hee-chan','Kim Min-jae','Hwang In-beom','Lee Jae-sung','Cho Gue-sung','Na Sang-ho','Oh Hyeon-gyu','Kwon Chang-hoon'],
  'Spain': ['Lamine Yamal','Pedri','Rodri','Alvaro Morata','Nico Williams','Dani Olmo','Ferran Torres','Gavi','Mikel Oyarzabal','Fabian Ruiz'],
  'Sweden': ['Viktor Gyokeres','Alexander Isak','Dejan Kulusevski','Emil Forsberg','Isak Hien','Victor Lindelof','Robin Quaison','Albin Ekdal','Pontus Jansson','Mattias Svanberg'],
  'Switzerland': ['Granit Xhaka','Breel Embolo','Dan Ndoye','Denis Zakaria','Fabian Schar','Remo Freuler','Ricardo Rodriguez','Manuel Akanji','Cedric Itten','Nico Elvedi'],
  'Tunisia': ['Wahbi Khazri','Youssef Msakni','Seifeddine Jaziri','Ellyes Skhiri','Naim Sliti','Ferjani Sassi','Dylan Bronn','Montassar Talbi','Mohamed Ben Romdhane','Ghaylane Chaalali'],
  'Türkiye': ['Hakan Calhanoglu','Arda Guler','Kerem Akturkoglu','Orkun Kokcu','Baris Alper Yilmaz','Ferdi Kadioglu','Cengiz Under','Yunus Akgun','Zeki Celik','Ozan Kabak'],
  'Turkey': ['Hakan Calhanoglu','Arda Guler','Kerem Akturkoglu','Orkun Kokcu','Baris Alper Yilmaz','Ferdi Kadioglu','Cengiz Under','Yunus Akgun','Zeki Celik','Ozan Kabak'],
  'Ukraine': ['Artem Dovbyk','Mykhailo Mudryk','Oleksandr Zinchenko','Ruslan Malinovskyi','Viktor Tsygankov','Georgiy Sudakov','Vladyslav Vanat','Andriy Yarmolenko','Roman Yaremchuk','Taras Stepanenko'],
  'Uruguay': ['Darwin Nunez','Federico Valverde','Luis Suarez','Rodrigo Bentancur','Ronald Araujo','Facundo Torres','Matias Vecino','Jose Maria Gimenez','Maxi Gomez','Brian Rodriguez'],
  'USA': ['Christian Pulisic','Gio Reyna','Folarin Balogun','Weston McKennie','Yunus Musah','Tyler Adams','Ricardo Pepi','Sergino Dest','Antonee Robinson','Josh Weah'],
  'United States': ['Christian Pulisic','Gio Reyna','Folarin Balogun','Weston McKennie','Yunus Musah','Tyler Adams','Ricardo Pepi','Sergino Dest','Antonee Robinson','Josh Weah'],
  'Uzbekistan': ['Eldor Shomurodov','Jaloliddin Masharipov','Abbosbek Fayzullaev','Otabek Shukurov','Dostonbek Khamdamov','Khojiakbar Alijonov','Islom Tukhtamurodov','Sanjar Tursunov','Sherzod Nasrullayev','Jasurbek Yakhshiboev'],
  'Venezuela': ['Salomon Rondon','Josef Martinez','Yeferson Soteldo','Darwin Machis','Yangel Herrera','Jhon Chancellor','Tomas Rincon','Adalberto Penaranda','Eric Ramirez','Junior Moreno'],
};

function getSquad(teamName) {
  if (!teamName) return [];
  // Try exact match first
  if (SQUADS[teamName]) return SQUADS[teamName];
  // Try case-insensitive match
  const key = Object.keys(SQUADS).find(k => k.toLowerCase() === teamName.toLowerCase());
  return key ? SQUADS[key] : [];
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

    const homePlayers = getSquad(home.name || home.shortName || '');
    const awayPlayers = getSquad(away.name || away.shortName || '');

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
      homePlayers,
      awayPlayers,
      lastSynced: new Date()
    }, { merge: true });
  }
  return matches.length;
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
        let firstScorer = null;
        try {
          const detail = await fetchAPI(`/matches/${match.id}`);
          const goals = (detail.goals || [])
            .filter(g => g.type !== 'OWN_GOAL')
            .sort((a, b) => (a.minute || 0) - (b.minute || 0));
          if (goals.length > 0) firstScorer = goals[0].scorer?.name || null;
        } catch(e) { console.log('Could not get scorer for', matchId); }

        await calculatePoints(db, matchId, homeScore, awayScore, firstScorer);

        // If this is the Final, award +10 pts to correct tournament winner pickers
        const matchData = (await db.collection('matches').doc(matchId).get()).data();
        const grp = (matchData?.group || '').toUpperCase();
        if (grp.includes('FINAL') && !grp.includes('SEMI') && !grp.includes('QUARTER')) {
          const winner = homeScore > awayScore ? matchData.homeTeam : awayScore > homeScore ? matchData.awayTeam : null;
          if (winner) {
            const usersSnap = await db.collection('users').get();
            for (const userDoc of usersSnap.docs) {
              const u = userDoc.data();
              if (u.tournamentWinner === winner && !u.winnerBonusAwarded) {
                await userDoc.ref.update({
                  points: (u.points || 0) + 15,
                  winnerBonusAwarded: true
                });
              }
            }
          }
        }

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
  // Get match group for stage multiplier
  const matchDoc = await db.collection('matches').doc(matchId).get();
  const matchGroup = (matchDoc.data()?.group || '').toUpperCase();
  const isFinal = matchGroup.includes('FINAL') && !matchGroup.includes('QUARTER') && !matchGroup.includes('SEMI');
  const isSemi = matchGroup.includes('SEMI');
  const isQuarter = matchGroup.includes('QUARTER');
  const isR16 = matchGroup.includes('16') || matchGroup.includes('ROUND_OF_16');
  const multiplier = isFinal ? 1 : isSemi ? 4 : isQuarter ? 3 : isR16 ? 2 : 1;

  const predsSnap = await db.collection('predictions').where('matchId', '==', matchId).get();
  for (const predDoc of predsSnap.docs) {
    const pred = predDoc.data();
    let pts = 0, exact = 0, bonus = 0;
    const actualResult = homeScore > awayScore ? 'home' : homeScore < awayScore ? 'away' : 'draw';
    const predResult = pred.homeScore > pred.awayScore ? 'home' : pred.homeScore < pred.awayScore ? 'away' : 'draw';

    if (isFinal) {
      if (pred.homeScore === homeScore && pred.awayScore === awayScore) { pts = 20; exact = 1; }
      else if (actualResult === predResult) { pts = 10; }
    } else {
      if (actualResult === predResult) pts += 1 * multiplier;
      if (pred.homeScore === homeScore && pred.awayScore === awayScore) { pts += 3 * multiplier; exact = 1; }
    }
    if (firstScorer && pred.firstScorer === firstScorer) { pts += 2 * multiplier; bonus += 1; }

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

  try {
    const detail = await fetchAPI(`/matches/${matchId}`);

    // Goals (x2 pts each, exclude own goals)
    const goals = (detail.goals || [])
      .filter(g => g.type !== 'OWN_GOAL')
      .map(g => g.scorer?.name)
      .filter(Boolean);

    // Assists (+1 pt each)
    const assists = (detail.goals || [])
      .filter(g => g.type !== 'OWN_GOAL' && g.assist?.name)
      .map(g => g.assist.name)
      .filter(Boolean);

    // Red cards (-1 pt each)
    const bookings = detail.bookings || [];
    const redCards = bookings
      .filter(b => b.card === 'RED_CARD' || b.card === 'YELLOW_RED_CARD')
      .map(b => b.player?.name)
      .filter(Boolean);

    if (goals.length > 0 || assists.length > 0 || redCards.length > 0) {
      const usersSnap = await db.collection('users').get();
      for (const userDoc of usersSnap.docs) {
        const user = userDoc.data();
        if (!user.tournamentPlayer) continue;
        const tp = user.tournamentPlayer;
        const goalsScored = goals.filter(g => g === tp).length;
        const assistsMade = assists.filter(a => a === tp).length;
        const reds = redCards.filter(r => r === tp).length;
        const tpPts = (goalsScored * 2) + (assistsMade * 1) - (reds * 1);
        if (tpPts !== 0) {
          await userDoc.ref.update({
            points: (user.points || 0) + tpPts,
            bonusPoints: (user.bonusPoints || 0) + goalsScored + assistsMade
          });
        }
      }
    }
  } catch(e) { console.log('Could not sync tournament player stats for', matchId); }
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
    } else if (action === 'debug') {
      const data = await fetchAPI(`/competitions/${WC_CODE}/matches?limit=3`);
      const m = (data.matches || [])[0];
      result.sample = m ? { home: m.homeTeam, away: m.awayTeam } : null;
    } else if (action === 'matchStats') {
      const matchId = req.query.matchId;
      if (!matchId) return res.status(400).json({ error: 'matchId required' });
      // Get match from Firestore to find API id
      const matchDoc = await db.collection('matches').doc(matchId).get();
      const matchData = matchDoc.data();
      const apiId = matchData?.apiId;
      if (!apiId) return res.status(200).json({ success: true, matchStats: null });
      // Fetch full match from API
      const data = await fetchAPI(`/matches/${apiId}`);
      const m = data.match || data;
      // Goals
      const goals = (m.goals || []).map(g => ({
        minute: g.minute,
        scorer: g.scorer?.name || 'Unknown',
        team: g.team?.name || ''
      }));
      // Stats
      const rawStats = m.statistics || [];
      const statMap = {
        'Shots on Goal': 'Shots on target',
        'Shots off Goal': 'Shots off target',
        'Total Shots': 'Total shots',
        'Ball Possession': 'Possession %',
        'Corner Kicks': 'Corners',
        'Fouls': 'Fouls',
        'Yellow Cards': 'Yellow cards',
        'Red Cards': 'Red cards',
        'Offsides': 'Offsides',
        'Passes Accurate': 'Accurate passes',
      };
      const stats = [];
      const homeStats = rawStats.find(s => s.team?.id === m.homeTeam?.id)?.statistics || [];
      const awayStats = rawStats.find(s => s.team?.id === m.awayTeam?.id)?.statistics || [];
      const wanted = Object.keys(statMap);
      wanted.forEach(key => {
        const hs = homeStats.find(s => s.type === key);
        const as = awayStats.find(s => s.type === key);
        if (hs || as) stats.push({ label: statMap[key], home: hs?.value ?? null, away: as?.value ?? null });
      });
      // Lineups
      const homeLineup = (m.lineups?.[0]?.startXI || []).map(p => `${p.player?.number||''} ${p.player?.name||''}`);
      const awayLineup = (m.lineups?.[1]?.startXI || []).map(p => `${p.player?.number||''} ${p.player?.name||''}`);
      result.matchStats = { goals, stats, homeLineup, awayLineup, minute: m.minute, status: m.status };
    }
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
