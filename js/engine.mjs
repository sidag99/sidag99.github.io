// Pure logic for the playground: no DOM access, so everything here is testable in Node.

/* ---------- Tic-tac-toe: exhaustive minimax ---------- */

export const lines = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
const TTT_PREFERENCE = [4, 0, 2, 6, 8, 1, 3, 5, 7]; // centre, then corners, then edges

export function outcome(board) {
  for (const line of lines) {
    if (board[line[0]] && line.every(i => board[i] === board[line[0]])) return { winner: board[line[0]], line };
  }
  return board.every(Boolean) ? { winner: 'draw', line: [] } : null;
}

function minimax(board, turn, depth = 0, stats = { nodes: 0 }) {
  stats.nodes++;
  const end = outcome(board);
  if (end) return end.winner === 'O' ? 10 - depth : end.winner === 'X' ? depth - 10 : 0;
  const values = [];
  for (let i = 0; i < 9; i++) {
    if (board[i]) continue;
    board[i] = turn;
    values.push(minimax(board, turn === 'O' ? 'X' : 'O', depth + 1, stats));
    board[i] = '';
  }
  return turn === 'O' ? Math.max(...values) : Math.min(...values);
}

const TTT_REASONS = {
  en: {
    casual: 'Casual mode picks a random legal move, so it can make mistakes.',
    win: 'I found a winning move and took it.',
    block: 'I blocked your immediate winning threat. Minimax also checked what happens after the block.',
    centre: 'I took the centre. Among equally good moves, my tie-break prefers the centre, then corners.',
    search: 'I searched every possible continuation. This move gives me the best guaranteed outcome, assuming you also play perfectly.'
  },
  de: {
    casual: 'Im lockeren Modus wähle ich einen zufälligen Zug und kann daher Fehler machen.',
    win: 'Ich habe einen Gewinnzug gefunden und ihn gespielt.',
    block: 'Ich habe Ihre direkte Gewinndrohung blockiert. Minimax hat auch geprüft, was nach dem Block passiert.',
    centre: 'Ich habe die Mitte genommen. Bei gleich guten Zügen bevorzuge ich die Mitte, dann die Ecken.',
    search: 'Ich habe jede mögliche Fortsetzung durchsucht. Dieser Zug sichert mir das beste Ergebnis, vorausgesetzt, Sie spielen ebenfalls perfekt.'
  }
};

export function botMove(board, difficulty = 'optimal', random = Math.random, lang = 'en') {
  const R = TTT_REASONS[lang] || TTT_REASONS.en;
  if (outcome(board)) return null;
  const moves = [], stats = { nodes: 0 };
  for (let i = 0; i < 9; i++) {
    if (board[i]) continue;
    const next = [...board];
    next[i] = 'O';
    moves.push({ index: i, score: minimax(next, 'X', 0, stats) });
  }
  if (difficulty === 'casual') {
    return { ...moves[Math.floor(random() * moves.length)], nodes: 0, reason: R.casual };
  }
  moves.sort((a, b) => b.score - a.score || TTT_PREFERENCE.indexOf(a.index) - TTT_PREFERENCE.indexOf(b.index));
  const best = moves[0];
  const next = [...board];
  next[best.index] = 'O';
  const blocks = lines.some(l => l.includes(best.index) && l.filter(i => board[i] === 'X').length === 2);
  const reason = outcome(next)?.winner === 'O' ? R.win
    : blocks ? R.block
    : best.index === 4 && board.every(v => v !== 'O') && board.filter(Boolean).length <= 1 ? R.centre
    : R.search;
  return { ...best, nodes: stats.nodes, reason };
}

// What each open square leads to for the human (X) if both sides play perfectly from there.
export function humanMoves(board) {
  if (outcome(board)) return [];
  return board.flatMap((value, index) => {
    if (value) return [];
    const next = [...board];
    next[index] = 'X';
    const score = -minimax(next, 'O');
    return [{ index, score, label: score > 0 ? 'Win' : score < 0 ? 'Loss' : 'Draw' }];
  }).sort((a, b) => b.score - a.score || a.index - b.index);
}

/* ---------- Connect Four: depth-limited minimax with alpha-beta ---------- */

export const C4 = { COLS: 7, ROWS: 6, HUMAN: 1, BOT: 2, WIN: 1e6 };
const { COLS, ROWS, HUMAN, BOT, WIN } = C4;
const C4_ORDER = [3, 2, 4, 1, 5, 0, 6];          // centre first: better pruning, better tie-breaks
const DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];
const WINDOWS = [];                                 // every line of four cells on the board
for (let c = 0; c < COLS; c++) {
  for (let r = 0; r < ROWS; r++) {
    for (const [dc, dr] of DIRS) {
      const ec = c + 3 * dc, er = r + 3 * dr;
      if (ec >= 0 && ec < COLS && er >= 0 && er < ROWS) WINDOWS.push([0, 1, 2, 3].map(i => [c + i * dc, r + i * dr]));
    }
  }
}

// board[c] is a stack of discs, bottom first
export const c4Empty = () => Array.from({ length: COLS }, () => []);
export const c4Full = b => b.every(col => col.length >= ROWS);

export function c4WinLine(b, c) {
  const r = b[c].length - 1, p = b[c][r];
  for (const [dc, dr] of DIRS) {
    const line = [[c, r]];
    for (const s of [1, -1]) {
      let cc = c + dc * s, rr = r + dr * s;
      while (cc >= 0 && cc < COLS && rr >= 0 && rr < ROWS && b[cc][rr] === p) { line.push([cc, rr]); cc += dc * s; rr += dr * s; }
    }
    if (line.length >= 4) return line;
  }
  return null;
}

// static score from the bot's point of view
export function c4Evaluate(b) {
  let s = 0;
  for (const v of b[3]) s += v === BOT ? 3 : -3;
  for (const w of WINDOWS) {
    let mine = 0, theirs = 0;
    for (const [c, r] of w) { const v = b[c][r]; if (v === BOT) mine++; else if (v === HUMAN) theirs++; }
    if (mine && theirs) continue;
    if (mine === 3) s += 5; else if (mine === 2) s += 2;
    else if (theirs === 3) s -= 5; else if (theirs === 2) s -= 2;
  }
  return s;
}

function negamax(b, d, alpha, beta, player, stats) {
  stats.nodes++;
  if (d === 0) return player === BOT ? c4Evaluate(b) : -c4Evaluate(b);
  let moved = false;
  for (const c of C4_ORDER) {
    if (b[c].length >= ROWS) continue;
    moved = true;
    b[c].push(player);
    const sc = c4WinLine(b, c) ? WIN + d : -negamax(b, d - 1, -beta, -alpha, 3 - player, stats);
    b[c].pop();
    if (sc > alpha) alpha = sc;
    if (alpha >= beta) break;
  }
  return moved ? alpha : 0;
}

// Score every root column for `me` with a full window, so the numbers shown are exact.
export function c4Think(b, depth, me = BOT) {
  const stats = { nodes: 0 }, scores = Array(COLS).fill(null);
  for (let c = 0; c < COLS; c++) {
    if (b[c].length >= ROWS) continue;
    b[c].push(me);
    scores[c] = c4WinLine(b, c) ? WIN + depth : -negamax(b, depth - 1, -Infinity, Infinity, 3 - me, stats);
    b[c].pop();
  }
  let best = -1;
  for (const c of C4_ORDER) if (scores[c] !== null && (best < 0 || scores[c] > scores[best])) best = c;
  return { scores, best, nodes: stats.nodes };
}

export const c4Label = (s, lang = 'en') => s === null ? '–'
  : s >= WIN / 2 ? (lang === 'de' ? 'gew.' : 'win')
  : s <= -WIN / 2 ? (lang === 'de' ? 'verl.' : 'loss')
  : String(s);

// Plain-language reason for the bot's choice; call before the move is played.
export function c4Explain(b, res, depth, lang = 'en') {
  const c = res.best, s = res.scores[c], col = c + 1, de = lang === 'de';
  b[c].push(HUMAN);
  const blocks = !!c4WinLine(b, c);
  b[c].pop();
  if (s === WIN + depth) return de ? `Spalte ${col} gewinnt sofort.` : `Column ${col} wins on the spot.`;
  if (s >= WIN / 2) return de ? `Er hat einen erzwungenen Sieg gefunden, der in Spalte ${col} beginnt.` : `It found a forced win that starts in column ${col}.`;
  if (blocks) return de ? `Er hat Spalte ${col} gespielt, um Ihre Viererreihe zu blockieren.` : `It played column ${col} to block your four in a row.`;
  if (s <= -WIN / 2) return de ? `Bei perfektem Spiel verliert jede Spalte, also hat er Spalte ${col} gewählt, die am längsten hält.` : `Every column loses if you play perfectly, so it chose column ${col}, which holds out longest.`;
  return de ? `Spalte ${col} hat am besten abgeschnitten (${s}), ${depth} ${depth > 1 ? 'Züge' : 'Zug'} vorausgeschaut.`
    : `Column ${col} scored highest (${s}) looking ${depth} move${depth > 1 ? 's' : ''} ahead.`;
}

/* ---------- Pathfinding: BFS and A* on a grid ---------- */

export function findPath({ width, height, start, goal, walls, algorithm = 'bfs' }) {
  const frontier = [start], dist = new Map([[start, 0]]), previous = new Map(), visited = [], closed = new Set();
  const heuristic = n => Math.abs(n % width - goal % width) + Math.abs(Math.floor(n / width) - Math.floor(goal / width));
  while (frontier.length) {
    if (algorithm === 'astar') frontier.sort((a, b) => (dist.get(a) + heuristic(a)) - (dist.get(b) + heuristic(b)) || heuristic(a) - heuristic(b));
    const current = frontier.shift();
    if (closed.has(current)) continue;
    closed.add(current);
    visited.push(current);
    if (current === goal) {
      const path = [goal];
      while (path[0] !== start) path.unshift(previous.get(path[0]));
      return { visited, path };
    }
    const x = current % width, y = Math.floor(current / width);
    const neighbors = [[x + 1, y], [x, y + 1], [x - 1, y], [x, y - 1]]
      .filter(([nx, ny]) => nx >= 0 && nx < width && ny >= 0 && ny < height)
      .map(([nx, ny]) => ny * width + nx);
    for (const n of neighbors) {
      if (walls.has(n) || closed.has(n)) continue;
      const cost = dist.get(current) + 1;
      if (cost < (dist.get(n) ?? Infinity)) {
        dist.set(n, cost);
        previous.set(n, current);
        if (!frontier.includes(n)) frontier.push(n);
      }
    }
  }
  return { visited, path: [] };
}

/* ---------- Request simulator ---------- */

export const PROCESSING_MS = 40;

export function requestModel(count, latency, strategy = 'sequential') {
  const duration = latency + PROCESSING_MS, baseline = count * duration;
  const requests = strategy === 'batch'
    ? [{ start: 0, duration: latency + count * PROCESSING_MS }]
    : Array.from({ length: count }, (_, i) => ({ start: (strategy === 'parallel' ? Math.floor(i / 3) : i) * duration, duration }));
  return { baseline, total: Math.max(...requests.map(r => r.start + r.duration)), requests };
}

/* ---------- Code Mode on toy data ---------- */

export const CODE_QUESTIONS = [
  {
    label: 'What happened to order 12345?',
    label_de: 'Was ist mit Bestellung 12345 passiert?',
    raw: ['orders', 'users', 'shipments'],
    lookup: true, // a plain agent can fetch the three records directly, so compare against those
    code:
`const o = await tools.orders.get({ id: 12345 })
const u = await tools.users.get({ id: o.customer_id })
const s = await tools.shipments.find({ order: o.id })
return { status: s.status, eta: s.eta, customer: u.name }`
  },
  {
    label: 'How many shipments are delayed?',
    label_de: 'Wie viele Sendungen sind verspätet?',
    raw: ['shipments'],
    code:
`const all = await tools.shipments.list()
const late = all.filter(s => s.status === "delayed")
return { delayed: late.length, of: all.length }`
  },
  {
    label: 'Who are our top 3 customers?',
    label_de: 'Wer sind unsere drei besten Kunden?',
    raw: ['orders', 'users'],
    code:
`const orders = await tools.orders.list()
const spend = {}
for (const o of orders) spend[o.customer_id] = (spend[o.customer_id] ?? 0) + o.total_eur
const top = Object.entries(spend).sort((a, b) => b[1] - a[1]).slice(0, 3)
return Promise.all(top.map(async ([id, eur]) =>
  ({ name: (await tools.users.get({ id: +id })).name, eur: Math.round(eur) })))`
  }
];

const FIRST = ['Anna', 'Ben', 'Clara', 'David', 'Elif', 'Felix', 'Greta', 'Hannah', 'Ivan', 'Jonas', 'Lea', 'Mia', 'Noah', 'Omar', 'Paula', 'Sofia', 'Tim', 'Yusuf'];
const LAST = ['Schmidt', 'Weber', 'Fischer', 'Wagner', 'Becker', 'Hoffmann', 'Koch', 'Richter', 'Klein', 'Wolf', 'Neumann', 'Braun'];
const CITIES = ['Darmstadt', 'Freiburg', 'Frankfurt', 'Mannheim', 'Karlsruhe', 'Stuttgart', 'Mainz'];
const CARRIERS = ['DHL', 'DPD', 'Hermes', 'GLS', 'UPS'];
const PRODUCTS = [['KB-201', 'Mechanical keyboard', 89.9], ['MS-110', 'Wireless mouse', 34.5], ['MN-27Q', '27-inch monitor', 279], ['HB-4P', 'USB-C hub', 42], ['HP-300', 'Headset', 64.99], ['CM-HD', 'Webcam', 59], ['LS-AL', 'Laptop stand', 39.9], ['CB-2M', 'USB-C cable', 12.5]];

// small seeded PRNG so the same size always gives the same data
function rng(seed) {
  return () => {
    seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function makeShopData(n) {
  const rand = rng(7);
  const pick = a => a[Math.floor(rand() * a.length)];
  const day = d => new Date(Date.UTC(2026, 8, 1) + d * 864e5).toISOString().slice(0, 10);
  const users = [];
  for (let i = 0; i < Math.max(50, Math.round(n / 5)); i++) {
    const f = pick(FIRST), l = pick(LAST);
    users.push({ id: 1000 + i, name: `${f} ${l}`, email: `${f}.${l}.${i}@example.com`.toLowerCase(), city: pick(CITIES), signed_up: day(-Math.floor(rand() * 900)), newsletter: rand() < 0.4 });
  }
  const orders = [], shipments = [];
  const first = 12345 - Math.floor(n / 2);
  for (let i = 0; i < n; i++) {
    const id = first + i, created = Math.floor(rand() * 50);
    const items = Array.from({ length: 1 + Math.floor(rand() * 3) }, () => {
      const [sku, name, unit_eur] = pick(PRODUCTS);
      return { sku, name, qty: 1 + Math.floor(rand() * 3), unit_eur };
    });
    const customer = pick(users);
    orders.push({ id, customer_id: customer.id, created_at: day(created), payment: 'paid', items, total_eur: Math.round(items.reduce((s, x) => s + x.qty * x.unit_eur, 0) * 100) / 100, ship_to: customer.city });
    const r = rand();
    const status = id === 12345 ? 'delayed' : r < 0.62 ? 'delivered' : r < 0.85 ? 'in_transit' : r < 0.93 ? 'delayed' : 'label_created';
    shipments.push({ id: `SHP-${id}`, order_id: id, carrier: pick(CARRIERS), status, eta: id === 12345 ? '2026-10-19' : day(created + 3 + Math.floor(rand() * 6)), events: [{ at: day(created), event: 'label_created' }, { at: day(created + 1), event: 'picked_up' }] });
  }
  return { users, orders, shipments };
}

export function makeShopTools(d) {
  const orderById = new Map(d.orders.map(o => [o.id, o]));
  const userById = new Map(d.users.map(u => [u.id, u]));
  const shipByOrder = new Map(d.shipments.map(s => [s.order_id, s]));
  return {
    orders: { get: async ({ id }) => orderById.get(id), list: async () => d.orders },
    users: { get: async ({ id }) => userById.get(id), list: async () => d.users },
    shipments: { find: async ({ order }) => shipByOrder.get(order), list: async () => d.shipments }
  };
}

// What plain tool calls would put into the model's context for a question.
// Lookups fetch whole records; questions that need every row fetch whole tables.
export function rawPayload(q, data) {
  if (!q.lookup) return q.raw.map(t => JSON.stringify(data[t]));
  const order = data.orders.find(o => o.id === 12345);
  const user = data.users.find(u => u.id === order.customer_id);
  const shipment = data.shipments.find(x => x.order_id === order.id);
  return [order, user, shipment].map(r => JSON.stringify(r));
}

// Runs one of the fixed scripts above (never visitor input) against the toy tools.
export function runCodeQuestion(q, tools) {
  return new Function('tools', `return (async () => {\n${q.code}\n})()`)(tools);
}

/* ---------- Guided résumé assistant (prepared answers, no language model) ---------- */

// Each topic matches English and German questions; the answer follows the page language.
const answers = [
  {
    keys: /\b(hackathon\w*)\b/i,
    en: 'Siddharth enjoys hackathons: an unfamiliar problem, a new team and a few days to solve it. His team won first place for NCR Corporation’s problem statement at Smart India Hackathon 2020 with a hand-gesture-based ATM PIN entry system. At the Black Forest Hackathon 2026 his team built Code Mode, a sandbox that lets AI agents answer questions without pulling whole tables into the prompt, and placed 5th of 14.',
    de: 'Siddharth mag Hackathons: ein unbekanntes Problem, ein neues Team und ein paar Tage Zeit. Beim Smart India Hackathon 2020 gewann sein Team den ersten Platz für die Aufgabe von NCR Corporation, mit einer PIN-Eingabe für Geldautomaten per Handgesten. Beim Black Forest Hackathon 2026 baute sein Team Code Mode, eine Sandbox, mit der KI-Agenten Fragen beantworten, ohne ganze Tabellen in den Prompt zu laden, und belegte Platz 5 von 14.'
  },
  {
    keys: /\b(agent\w*|agentic|mcp|code mode|sandbox|black forest)\b/i,
    en: 'At the Black Forest Hackathon (Oct 2026) Siddharth’s team of five built Code Mode for AnythingMCP, an open-source MCP gateway. Instead of pulling whole tables into the model’s context, the agent writes a short script that runs in an isolated V8 sandbox next to the data, and only the answer goes back. On one query that was 41 bytes instead of 1.69 MB. They placed 5th of 14. Siddharth broke down the challenge, steered the build (much of it written with AI coding agents) and debugged it to a working demo.',
    de: 'Beim Black Forest Hackathon (Okt 2026) hat Siddharths Fünferteam Code Mode für AnythingMCP gebaut, ein Open-Source-MCP-Gateway. Statt ganze Tabellen in den Kontext des Modells zu laden, schreibt der Agent ein kurzes Skript, das in einer isolierten V8-Sandbox direkt bei den Daten läuft; nur die Antwort geht zurück. Bei einer Abfrage waren das 41 Bytes statt 1,69 MB. Das Team wurde Fünfter von 14. Siddharth hat die Aufgabe analysiert, die Umsetzung gesteuert (vieles davon mit KI-Coding-Agenten geschrieben) und sie bis zur funktionierenden Demo debuggt.'
  },
  {
    keys: /\b(contact|email|e-mail|hire|hiring|job|role|werkstudent\w*|working student|intern\w*|opportunit\w*|available|reach|kontakt\w*|praktik\w*|verfügbar|erreich\w*|bewerb\w*|einstellen|anstellung|stellenangebot\w*)\b/i,
    en: 'He’s looking for a Werkstudent (working student) role or internship in software engineering or AI, and is open to the right full-time role. Email: siddharth.agarwal@stud.tu-darmstadt.de · LinkedIn: linkedin.com/in/sidag99. As a Werkstudent he can work up to 20 hours a week during the semester and full-time in semester breaks. For a start date, please ask him directly.',
    de: 'Er sucht eine Werkstudentenstelle oder ein Praktikum in Softwareentwicklung oder KI und ist offen für die passende Vollzeitstelle. E-Mail: siddharth.agarwal@stud.tu-darmstadt.de · LinkedIn: linkedin.com/in/sidag99. Als Werkstudent kann er im Semester bis zu 20 Stunden pro Woche arbeiten und in den Semesterferien in Vollzeit. Für einen Starttermin fragen Sie ihn bitte direkt.'
  },
  {
    keys: /\b(ai|openai|azure|generative|llm|prompt\w*|applied|ki|künstlich\w*|generativ\w*|angewandt\w*)\b/i,
    en: 'At Navarambh Software, Siddharth took generative AI features on OpenAI and Azure AI from prompt design to production; they helped win new customers. He now works on applied and agentic AI alongside an MSc in Computer Science (Data Science) at TU Darmstadt. Ask about “Code Mode” for his agent sandbox project.',
    de: 'Bei Navarambh Software hat Siddharth generative KI-Funktionen auf OpenAI und Azure AI vom Prompt-Design bis in die Produktion gebracht; sie haben geholfen, neue Kunden zu gewinnen. Heute beschäftigt er sich neben seinem Master in Informatik (Data Science) an der TU Darmstadt mit angewandter und agentischer KI. Fragen Sie nach „Code Mode“ für sein Sandbox-Projekt für Agenten.'
  },
  {
    keys: /\b(skill|skills|stack|tool|tools|language|languages|java|vue|typescript|react|backend|frontend|fähigkeit\w*|kenntnis\w*|technologie\w*|sprachen?|programmier\w*|werkzeug\w*)\b/i,
    en: 'His core stack is Vue.js, TypeScript, JavaScript and Java, with SQL and Querydsl on the backend. His résumé also lists C++, React, HTML/CSS, Atlassian APIs, OpenAI and Azure AI. He speaks English (C1) and is learning German (B1).',
    de: 'Sein Kern-Stack sind Vue.js, TypeScript, JavaScript und Java, im Backend dazu SQL und Querydsl. In seinem Lebenslauf stehen außerdem C++, React, HTML/CSS, Atlassian-APIs, OpenAI und Azure AI. Er spricht Englisch (C1) und lernt Deutsch (B1).'
  },
  {
    keys: /\b(educat\w*|study|studies|student|university|degree|master\w*|msc|bachelor|studi\w*|universit\w*|hochschule|abschluss|ausbildung)\b/i,
    en: 'Siddharth is doing an MSc in Computer Science with a Data Science focus at Technische Universität Darmstadt (2025 to present). Before that he earned a BE in Computer Engineering at Thapar Institute of Engineering & Technology (2017–2021).',
    de: 'Siddharth macht seinen Master in Informatik mit Schwerpunkt Data Science an der Technischen Universität Darmstadt (seit 2025). Davor hat er einen B.E. in Computer Engineering am Thapar Institute of Engineering & Technology abgeschlossen (2017–2021).'
  },
  {
    keys: /\b(project\w*|robot|hardware|printer|ar|experiment\w*|game\w*|projekt\w*|roboter|drucker|spiel\w*)\b/i,
    en: 'Recent: Code Mode, an agent sandbox for AnythingMCP (Black Forest Hackathon 2026). Earlier: an IoT-connected 3D printer with Raspberry Pi and OctoPi (2021), an autonomous delivery bot with Arduino, ESP8266 and Firebase (2020), and AR Architect, an Android AR app built with Unity and Vuforia (2019). The games on this page were built for the portfolio with help from AI coding assistants.',
    de: 'Aktuell: Code Mode, eine Agenten-Sandbox für AnythingMCP (Black Forest Hackathon 2026). Früher: ein vernetzter 3D-Drucker mit Raspberry Pi und OctoPi (2021), ein autonomer Lieferroboter mit Arduino, ESP8266 und Firebase (2020) und AR Architect, eine Android-AR-App mit Unity und Vuforia (2019). Die Spiele auf dieser Seite sind mit Hilfe von KI-Coding-Tools für das Portfolio entstanden.'
  },
  {
    keys: /\b(award|achievement|win|winner|sih|smart india|auszeichnung\w*|preis\w*|gewonnen|sieg\w*|erfolg\w*)\b/i,
    en: 'Siddharth’s team won first place for problem statement NH447 (NCR Corporation) at Smart India Hackathon 2020 with a hand-gesture-based ATM PIN entry system.',
    de: 'Siddharths Team hat beim Smart India Hackathon 2020 den ersten Platz für die Aufgabe NH447 (NCR Corporation) gewonnen, mit einer PIN-Eingabe für Geldautomaten, die per Handgesten gesteuert wird.'
  },
  {
    keys: /\b(experience|work|build|built|career|navarambh|aio|jira|about|who|siddharth|test\w*|sdet|erfahrung\w*|beruf\w*|arbeit\w*|karriere|werdegang)\b/i,
    en: 'Siddharth worked at Navarambh Software as SDE I and then SDE II from July 2021 to October 2025, working on AIO Tests (aiotests.com), a test management app inside Jira where QA teams write test cases, run test cycles and track defects. He led the Vue 3 / TypeScript migration, built 50+ reusable components and Java services, sped up key workflows by up to 40%, and shipped AI and Jira integrations. Before that he was an SDET intern at Frugal Testing (Jan–Jun 2021).',
    de: 'Siddharth war von Juli 2021 bis Oktober 2025 bei Navarambh Software, erst als SDE I, dann als SDE II, und hat an AIO Tests gearbeitet (aiotests.com), einer Testmanagement-App in Jira, in der QA-Teams Testfälle schreiben, Testzyklen durchführen und Fehler verfolgen. Er hat die Migration auf Vue 3 / TypeScript geleitet, über 50 wiederverwendbare Komponenten und Java-Services gebaut, wichtige Abläufe um bis zu 40 % beschleunigt sowie KI- und Jira-Integrationen ausgeliefert. Davor war er SDET-Praktikant bei Frugal Testing (Jan–Jun 2021).'
  }
];

const GREETING = {
  en: 'Hello! I’m a guided résumé assistant. Ask about Siddharth’s experience, AI work, skills, education, projects, or how to reach him.',
  de: 'Hallo! Ich bin ein geführter Lebenslauf-Assistent. Fragen Sie nach Siddharths Erfahrung, KI-Arbeit, Fähigkeiten, Studium, Projekten oder wie Sie ihn erreichen.'
};
const UNKNOWN = {
  en: 'I don’t have a verified answer to that in Siddharth’s résumé. Try experience, AI work, skills, education, projects, or contact. For anything else, please ask him directly.',
  de: 'Dazu habe ich keine verlässliche Antwort aus Siddharths Lebenslauf. Fragen Sie nach Erfahrung, KI-Arbeit, Fähigkeiten, Studium, Projekten oder Kontakt. Alles andere fragen Sie ihn am besten direkt.'
};

export function resumeAnswer(question, lang = 'en') {
  const l = lang === 'de' ? 'de' : 'en';
  if (/^\s*(hello|hi|hey|hallo|moin|servus|guten (tag|morgen|abend))\b/i.test(question)) return GREETING[l];
  return answers.find(a => a.keys.test(question))?.[l] ?? UNKNOWN[l];
}
