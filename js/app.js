import {
  outcome, botMove, humanMoves, findPath, resumeAnswer, requestModel, PROCESSING_MS,
  C4, c4Empty, c4Full, c4WinLine, c4Think, c4Label, c4Explain,
  CODE_QUESTIONS, makeShopData, makeShopTools, runCodeQuestion
} from './engine.mjs';
import { getLang, setLang, tr, locale, onLangChange, applyPage } from './i18n.mjs';

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const scrollToEl = el => el.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
const num = (x, digits = 0) => Number(x).toLocaleString(locale(), { maximumFractionDigits: digits, minimumFractionDigits: digits });
const pct = x => tr(`${x}%`, `${x} %`);

/* ---------- language ---------- */
applyPage();
$('#lang-toggle').addEventListener('click', () => setLang(getLang() === 'de' ? 'en' : 'de'));

/* ---------- light / dark theme: follows the device until the visitor picks one ---------- */
const root = document.documentElement, themeButton = $('#theme-toggle');
const systemDark = matchMedia('(prefers-color-scheme: dark)');
const SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
const MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>';
const theme = () => root.dataset.theme || (systemDark.matches ? 'dark' : 'light');

function renderThemeButton() {
  const dark = theme() === 'dark';
  const label = dark ? tr('Switch to light mode', 'Zum hellen Design wechseln') : tr('Switch to dark mode', 'Zum dunklen Design wechseln');
  themeButton.innerHTML = dark ? SUN : MOON;
  themeButton.setAttribute('aria-label', label);
  themeButton.title = label;
  const paper = getComputedStyle(root).getPropertyValue('--paper').trim();
  $$('meta[name="theme-color"]').forEach(m => m.setAttribute('content', paper));
}
themeButton.addEventListener('click', () => {
  const next = theme() === 'dark' ? 'light' : 'dark';
  root.dataset.theme = next;
  try { localStorage.setItem('theme', next); } catch { /* the choice just won't persist */ }
  renderThemeButton();
});
systemDark.addEventListener('change', renderThemeButton);
onLangChange(renderThemeButton);
renderThemeButton();

/* ---------- featured panel: play its animation once it scrolls into view ---------- */
const featurePanel = $('#feature-panel');
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver(entries => {
    if (entries.some(e => e.isIntersecting)) { featurePanel.classList.add('play'); io.disconnect(); }
  }, { threshold: 0.35 });
  io.observe(featurePanel);
} else {
  featurePanel.classList.add('play');
}

/* ---------- mini Connect Four on its card ---------- */
const MINI = ['', '', '', '', '', '', '', '', '', '', 'g', '', '', '', '', '', 'y', 'g', '', '', '', '', 'g', 'y', 'y', 'y', 'g', ''];
$('#mini-c4').innerHTML = MINI.map(c => `<i class="${c}"></i>`).join('');

/* ---------- lab dialog ---------- */
const dialog = $('#lab-dialog'), content = $('#lab-content');
const LABS = { codemode: codeModeLab, games: gamesLab, path: pathLab, requests: requestLab, ask: askLab };
const PLAYGROUND = ['requests', 'games', 'path', 'ask']; // Code Mode lives with its case study, not the playground
const explored = new Set();
let cleanup = () => {}, lastTrigger = null, currentLab = null;

function openLab(name, trigger = document.activeElement, option) {
  if ($('#command-dialog').open) $('#command-dialog').close();
  cleanup();
  cleanup = () => {};
  lastTrigger = trigger;
  currentLab = { name, option };
  LABS[name](option);
  if (!dialog.open) dialog.showModal();
  dialog.scrollTop = 0;
  document.body.style.overflow = 'hidden';
  markExplored(name);
}

function markExplored(name) {
  if (PLAYGROUND.includes(name)) explored.add(name);
  const card = $(`.card-cta[data-lab="${name}"]`)?.closest('.lab-card');
  if (card) { card.classList.add('is-visited'); $('.mark', card).textContent = '✓'; }
  renderProgress();
}

function renderProgress() {
  const n = explored.size, total = PLAYGROUND.length;
  $$('.progress-dots span').forEach((d, i) => d.classList.toggle('done', i < n));
  const note = n === total ? tr('You tried them all. Thanks for playing!', 'Sie haben alle ausprobiert. Danke fürs Mitspielen!')
    : n === 0 ? tr('Pick one to get started.', 'Wählen Sie eins aus.')
    : tr('Keep experimenting.', 'Weiter geht’s.');
  $('#lab-progress').textContent = `${n} / ${total} ${tr('experiments explored', 'Experimente ausprobiert')} · ${note}`;
}
renderProgress();

$('#close-lab').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', e => {
  if (e.target !== dialog) return;
  const r = dialog.getBoundingClientRect();
  if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close();
});
dialog.addEventListener('close', () => {
  cleanup();
  cleanup = () => {};
  currentLab = null;
  document.body.style.overflow = '';
  lastTrigger?.focus?.();
});
document.addEventListener('click', e => {
  const t = e.target.closest('[data-lab], [data-open]');
  if (t) openLab(t.dataset.lab || t.dataset.open, t, t.dataset.tab);
});

// Switching language redraws whatever is open in the new language.
onLangChange(() => {
  renderProgress();
  if (dialog.open && currentLab) openLab(currentLab.name, lastTrigger, currentLab.option);
  if ($('#command-dialog').open) renderCommands();
});

/* ---------- Code Mode on toy data ---------- */
function codeModeLab() {
  const qLabel = q => tr(q.label, q.label_de);
  content.innerHTML = `
    <h2 id="dialog-title">${tr('Keep the data <em>out.</em>', 'Daten <em>draußen lassen.</em>')}</h2>
    <p class="subtext">${tr('The idea behind my hackathon project, small enough to run here. Pick a question and grow the database: the raw tool output grows with it, the Code Mode answer stays tiny.',
      'Die Idee hinter meinem Hackathon-Projekt, klein genug für den Browser. Wählen Sie eine Frage und vergrößern Sie die Datenbank: Die rohe Tool-Ausgabe wächst mit, die Code-Mode-Antwort bleibt winzig.')}</p>
    <div class="lab-body code-lab">
      <div class="stack">
        <div>
          <span class="control-label" id="cm-q-label">${tr('Question for the agent', 'Frage an den Agenten')}</span>
          <div class="chips" id="cm-q" role="group" aria-labelledby="cm-q-label">
            ${CODE_QUESTIONS.map((q, i) => `<button type="button" data-q="${i}" aria-pressed="${i === 0}">${esc(qLabel(q))}</button>`).join('')}
          </div>
        </div>
        <div>
          <label class="range-label" for="cm-size">${tr('Orders in the database', 'Bestellungen in der Datenbank')} <output id="cm-size-out" for="cm-size">${num(3650)}</output></label>
          <input type="range" id="cm-size" min="500" max="20000" step="50" value="3650">
        </div>
        <div class="explanation">
          <h3>${tr('WHAT YOU’RE COMPARING', 'WAS HIER VERGLICHEN WIRD')}</h3>
          <p>${tr('<strong>Raw tool calls:</strong> the agent fetches every table it needs, and all of it lands in the model’s context, where the model has to dig out the answer.',
            '<strong>Rohe Tool-Aufrufe:</strong> Der Agent holt jede benötigte Tabelle, und alles landet im Kontext des Modells, das die Antwort selbst heraussuchen muss.')}</p>
          <p style="margin-top:10px">${tr('<strong>Code Mode:</strong> the agent writes the script on the right, it runs next to the data, and only its return value goes back to the model.',
            '<strong>Code Mode:</strong> Der Agent schreibt das Skript rechts, es läuft direkt bei den Daten, und nur sein Rückgabewert geht zurück an das Modell.')}</p>
        </div>
        <details class="peek-box"><summary>${tr('Peek at the raw payload', 'Blick in die Rohdaten')}</summary><pre class="peek" id="cm-peek"></pre></details>
      </div>
      <figure class="panel" aria-label="${tr('Script the agent writes, its result, and the size of each approach', 'Skript des Agenten, sein Ergebnis und die Datenmenge beider Ansätze')}">
        <p class="ask" id="cm-ask"></p>
        <pre id="cm-code"></pre>
        <div class="result" id="cm-result" aria-live="polite"></div>
        <div class="compare">
          <div class="row raw"><span>${tr('Raw tool calls', 'Rohe Tool-Aufrufe')}</span><div class="bar"><div class="fill"></div></div><span class="num" id="cm-raw">–</span></div>
          <div class="row cm"><span>Code Mode</span><div class="bar"><div class="fill" id="cm-fill"></div></div><span class="num" id="cm-cm">–</span></div>
          <p class="note" id="cm-note"></p>
        </div>
      </figure>
    </div>
    <p class="insight">${tr('The data is generated in your browser and the script really runs against it. Tokens are estimated at 4 bytes each. It starts at the size of our hackathon benchmark (1.69 MB of raw output); drag the slider to see how each approach scales.',
      'Die Daten werden in Ihrem Browser erzeugt, und das Skript läuft tatsächlich darauf. Tokens sind mit 4 Bytes pro Token geschätzt. Der Start entspricht der Größe unseres Hackathon-Benchmarks (1,69 MB Rohausgabe); mit dem Regler sehen Sie, wie beide Ansätze skalieren.')}</p>`;

  const enc = new TextEncoder(), size = $('#cm-size');
  const bytes = s => enc.encode(s).length;
  const fmt = b => b < 1000 ? `${b} B` : b < 1e6 ? `${num(b / 1000, 1)} KB` : `${num(b / 1e6, 2)} MB`;
  const highlight = src => esc(src)
    .replace(/&quot;[^&]*&quot;/g, m => `<span class="s">${m}</span>`)
    .replace(/\b(const|await|async|return|for|of)\b/g, '<span class="k">$1</span>');
  let current = 0, cache = { n: 0 }, run = 0;

  async function update() {
    const n = +size.value, q = CODE_QUESTIONS[current], mine = ++run;
    $('#cm-size-out').textContent = num(n);
    if (cache.n !== n) cache = { n, data: makeShopData(n), json: {} };
    const json = t => cache.json[t] ??= JSON.stringify(cache.data[t]);
    const result = await runCodeQuestion(q, makeShopTools(cache.data));
    if (mine !== run || !$('#cm-code')) return;
    const rawBytes = q.raw.reduce((s, t) => s + bytes(json(t)), 0);
    const cmBytes = bytes(JSON.stringify(result));
    const tables = new Intl.ListFormat(locale()).format(q.raw);
    $('#cm-ask').innerHTML = tr(`Agent is asked: <b>“${esc(q.label)}”</b>`, `Der Agent wird gefragt: <b>„${esc(q.label_de)}“</b>`);
    $('#cm-code').innerHTML = highlight(q.code);
    $('#cm-result').textContent = JSON.stringify(result, null, 1).replace(/\n\s*/g, ' ');
    $('#cm-raw').textContent = fmt(rawBytes);
    $('#cm-cm').textContent = fmt(cmBytes);
    $('#cm-fill').style.width = `${Math.max(cmBytes / rawBytes * 100, 0.5)}%`;
    // ratio from the rounded token counts shown, so the sentence adds up
    const rawTokens = Math.round(rawBytes / 4), cmTokens = Math.max(1, Math.round(cmBytes / 4)), ratio = rawTokens / cmTokens;
    $('#cm-note').textContent = tr(
      `About ${num(cmTokens)} tokens instead of ${num(rawTokens)}, ${num(ratio)}× less. Raw means the full ${tables} table${q.raw.length > 1 ? 's' : ''}.`,
      `Etwa ${num(cmTokens)} statt ${num(rawTokens)} Tokens, ${num(ratio)}× weniger. „Roh“ heißt: die vollständige${q.raw.length > 1 ? 'n Tabellen' : ' Tabelle'} ${tables}.`);
    $('#cm-peek').textContent = json(q.raw[0]).slice(0, 700) + ' …';
  }

  $('#cm-q').addEventListener('click', e => {
    const b = e.target.closest('[data-q]');
    if (!b) return;
    current = +b.dataset.q;
    $$('#cm-q button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    update();
  });
  size.addEventListener('input', update);
  update();
  cleanup = () => { run++; };
}

/* ---------- Two games, two kinds of bot ---------- */
const GAME_TABS = [
  { id: 'ttt', label: () => tr('Tic-tac-toe · solved', 'Tic-Tac-Toe · gelöst'), render: ticTacToeLab },
  { id: 'c4', label: () => tr('Connect Four · estimated', 'Vier gewinnt · geschätzt'), render: connectFourLab }
];

function gamesLab(initial = 'ttt') {
  content.innerHTML = `
    <h2 id="dialog-title">${tr('Two games, <em>two kinds of bot.</em>', 'Zwei Spiele, <em>zwei Arten von Bot.</em>')}</h2>
    <p class="subtext">${tr('Tic-tac-toe is small enough for the bot to check every possible game, so it never loses. Connect Four has about 4.5 trillion positions, so its bot can only look a few moves ahead and estimate. Switch between them to compare.',
      'Tic-Tac-Toe ist klein genug, dass der Bot jede mögliche Partie prüfen kann, deshalb verliert er nie. Vier gewinnt hat etwa 4,5 Billionen Stellungen, also kann sein Bot nur ein paar Züge vorausschauen und schätzen. Wechseln Sie zwischen beiden und vergleichen Sie.')}</p>
    <div class="game-tabs" role="tablist" aria-label="${tr('Games', 'Spiele')}">
      ${GAME_TABS.map(g => `<button type="button" role="tab" id="tab-${g.id}" aria-controls="panel-${g.id}">${g.label()}</button>`).join('')}
    </div>
    ${GAME_TABS.map(g => `<div class="game-panel" role="tabpanel" id="panel-${g.id}" aria-labelledby="tab-${g.id}" hidden></div>`).join('')}`;

  // both games stay mounted, so switching tabs keeps a game in progress
  const stops = GAME_TABS.map(g => g.render($(`#panel-${g.id}`)));
  const tabs = GAME_TABS.map(g => $(`#tab-${g.id}`));
  const select = id => GAME_TABS.forEach((g, i) => {
    const on = g.id === id;
    tabs[i].setAttribute('aria-selected', String(on));
    tabs[i].tabIndex = on ? 0 : -1;
    $(`#panel-${g.id}`).hidden = !on;
    if (on && currentLab) currentLab.option = id;
  });
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => select(GAME_TABS[i].id));
    tab.addEventListener('keydown', e => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      const next = (i + (e.key === 'ArrowRight' ? 1 : GAME_TABS.length - 1)) % GAME_TABS.length;
      select(GAME_TABS[next].id);
      tabs[next].focus();
    });
  });
  select(GAME_TABS.some(g => g.id === initial) ? initial : 'ttt');
  cleanup = () => stops.forEach(stop => stop());
}

const scoreLine = s => tr(`THIS SESSION · You ${s.you} / Bot ${s.bot} / Draws ${s.draw}`, `DIESE SITZUNG · Sie ${s.you} / Bot ${s.bot} / Unentschieden ${s.draw}`);

/* Connect Four with an inspectable minimax bot */
const c4Score = { you: 0, bot: 0, draw: 0 };
let c4Depth = 3;

function connectFourLab(root) {
  const { COLS, ROWS, HUMAN, BOT } = C4;
  const howTo = tr('Click a column, or Tab to the board, move with the arrow keys and press Enter.', 'Klicken Sie auf eine Spalte, oder wechseln Sie mit Tab zum Brett, wählen Sie mit den Pfeiltasten und drücken Sie Enter.');
  root.innerHTML = `
    <p class="panel-intro">${tr('<strong>Estimated.</strong> Far too many positions to check, so the bot looks 1, 3 or 6 moves ahead and scores the positions where it stops. That means it can be beaten. You’re yellow, the bot is green.',
      '<strong>Geschätzt.</strong> Viel zu viele Stellungen zum Durchrechnen, also schaut der Bot 1, 3 oder 6 Züge voraus und bewertet die Stellungen, bei denen er aufhört. Deshalb ist er schlagbar. Sie spielen Gelb, der Bot Grün.')}</p>
    <div class="lab-body">
      <div>
        <div class="c4" id="c4" role="group" aria-label="${tr('Connect Four board, columns 1 to 7. Use the arrow keys to move between columns.', 'Vier-gewinnt-Brett, Spalten 1 bis 7. Mit den Pfeiltasten wechseln Sie die Spalte.')}"></div>
        <div class="c4-scores" id="c4-scores" aria-hidden="true"></div>
        <p class="key"><span><i style="background:#e8b931"></i>${tr('You', 'Sie')}</span><span><i style="background:#6fb596"></i>Bot</span><span>${tr('Numbers: the bot’s score per column, higher is better for it', 'Zahlen: Bewertung des Bots pro Spalte, höher ist besser für ihn')}</span></p>
      </div>
      <aside>
        <p class="status-line" id="c4-status" role="status" aria-live="polite"></p>
        <div class="explanation"><h3>${tr('INSIDE THE BOT’S HEAD', 'IM KOPF DES BOTS')}</h3><p id="c4-think" aria-live="polite">${howTo}</p></div>
        <div style="margin-top:20px">
          <span class="control-label" id="c4-depth-label">${tr('Bot strength', 'Spielstärke')}</span>
          <div class="chips" id="c4-depth" role="group" aria-labelledby="c4-depth-label">
            <button type="button" data-depth="1">${tr('Easy · 1 move ahead', 'Leicht · 1 Zug voraus')}</button>
            <button type="button" data-depth="3">${tr('Medium · 3', 'Mittel · 3')}</button>
            <button type="button" data-depth="6">${tr('Hard · 6', 'Schwer · 6')}</button>
          </div>
        </div>
        <div class="tools-row">
          <button class="quiet" type="button" id="c4-new">${tr('New game ↻', 'Neues Spiel ↻')}</button>
          <button class="quiet" type="button" id="c4-botfirst">${tr('Bot starts', 'Bot beginnt')}</button>
          <button class="quiet" type="button" id="c4-hint">${tr('Suggest a move', 'Zug vorschlagen')}</button>
          <button class="quiet" type="button" id="c4-undo">${tr('Undo turn ↶', 'Zug zurück ↶')}</button>
        </div>
        <p class="score" id="c4-score" aria-live="polite"></p>
        <details class="peek-box">
          <summary>${tr('How the bot decides', 'So entscheidet der Bot')}</summary>
          <p>${tr('Minimax search with alpha-beta pruning. For each column it plays out every sequence of moves up to its search depth, assuming you always answer with your best reply, then scores the positions where it stops.',
            'Minimax-Suche mit Alpha-Beta-Pruning. Für jede Spalte spielt er alle Zugfolgen bis zu seiner Suchtiefe durch, nimmt dabei an, dass Sie immer optimal antworten, und bewertet die Stellungen, bei denen er aufhört.')}</p>
          <p>${tr('A position earns points for open lines of two or three bot discs and for discs in the centre column, and loses the same for yours. A forced win or loss inside the search depth outranks any score: that’s what “win” and “loss” under the board mean.',
            'Eine Stellung bekommt Punkte für offene Zweier- und Dreierreihen des Bots und für Steine in der mittleren Spalte und verliert genauso viele für Ihre. Ein erzwungener Sieg oder eine erzwungene Niederlage innerhalb der Suchtiefe schlägt jede Punktzahl: Das bedeuten „gew.“ und „verl.“ unter dem Brett.')}</p>
        </details>
      </aside>
    </div>
    <p class="insight">${tr('Hints search 6 moves ahead from your side. Undo takes back your last move and the bot’s reply; undoing a finished game removes it from the score. Scores last while this page is open.',
      'Vorschläge schauen von Ihrer Seite aus 6 Züge voraus. „Zug zurück“ nimmt Ihren letzten Zug und die Antwort des Bots zurück; ein beendetes Spiel wird dabei auch aus der Wertung entfernt. Die Wertung gilt, solange die Seite offen ist.')}</p>`;

  const el = $('#c4', root), scoreEl = $('#c4-scores', root), status = $('#c4-status', root), think = $('#c4-think', root);
  el.innerHTML = Array.from({ length: COLS }, (_, c) => `<button type="button" data-col="${c}">${'<span class="slot"></span>'.repeat(ROWS)}</button>`).join('');
  scoreEl.innerHTML = '<span></span>'.repeat(COLS);
  const cols = [...el.children];
  let board, turn, over, last, scores, best, hint, history, scored, timer = null;

  const copy = b => b.map(col => [...col]);
  const yourMove = () => tr('Your move.', 'Sie sind am Zug.');

  function render(win) {
    const winSet = new Set((win || []).map(([c, r]) => `${c},${r}`));
    cols.forEach((btn, c) => {
      [...btn.children].forEach((slot, r) => {
        const v = board[c][r];
        let cls = 'slot';
        if (v) cls += v === HUMAN ? ' p1' : ' p2';
        if (!winSet.size && last && last[0] === c && last[1] === r) cls += ' last drop';
        if (winSet.has(`${c},${r}`)) cls += ' win';
        if (hint === c && r === board[c].length) cls += ' hint';
        slot.className = cls;
      });
      const left = ROWS - board[c].length;
      btn.setAttribute('aria-disabled', String(over || turn !== HUMAN || left === 0));
      btn.setAttribute('aria-label', tr(
        `Column ${c + 1}, ${left ? `${left} space${left > 1 ? 's' : ''} left` : 'full'}${hint === c ? ', suggested' : ''}`,
        `Spalte ${c + 1}, ${left ? `${left} ${left > 1 ? 'Plätze' : 'Platz'} frei` : 'voll'}${hint === c ? ', vorgeschlagen' : ''}`));
    });
    [...scoreEl.children].forEach((s, c) => { s.textContent = c4Label(scores[c], getLang()); s.className = c === best ? 'best' : ''; });
    $$('#c4-depth button', root).forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.depth === c4Depth)));
    $('#c4-hint', root).disabled = over || turn !== HUMAN;
    $('#c4-undo', root).disabled = !history.length;
    $('#c4-score', root).textContent = scoreLine(c4Score);
  }

  function finish(c, who) {
    const line = c4WinLine(board, c);
    if (line) {
      over = true; scored = who === HUMAN ? 'you' : 'bot'; c4Score[scored]++;
      status.textContent = who === HUMAN ? tr('You win. Four in a row!', 'Sie gewinnen. Vier in einer Reihe!') : tr('The bot wins. Try another line?', 'Der Bot gewinnt. Noch ein Versuch?');
      render(line);
      return true;
    }
    if (c4Full(board)) { over = true; scored = 'draw'; c4Score.draw++; status.textContent = tr('Draw: the board is full.', 'Unentschieden: Das Brett ist voll.'); render(); return true; }
    return false;
  }

  function play(c, who) { board[c].push(who); last = [c, board[c].length - 1]; hint = null; }

  function botMove() {
    const t0 = performance.now(), res = c4Think(board, c4Depth), ms = Math.max(1, Math.round(performance.now() - t0));
    const why = c4Explain(board, res, c4Depth, getLang());
    scores = res.scores; best = res.best;
    play(res.best, BOT);
    think.textContent = `${why} ${tr(`It checked ${num(res.nodes)} positions in ${ms} ms.`, `Er hat ${num(res.nodes)} Stellungen in ${ms} ms geprüft.`)}`;
    if (finish(res.best, BOT)) return;
    turn = HUMAN;
    status.textContent = yourMove();
    render();
  }

  function queueBot() {
    turn = BOT;
    status.textContent = tr('Bot is thinking…', 'Der Bot überlegt …');
    render();
    timer = setTimeout(botMove, reduced() ? 0 : 280);
  }

  function humanMove(c) {
    if (over || turn !== HUMAN || board[c].length >= ROWS) return;
    history.push({ board: copy(board), last, scores, best });
    play(c, HUMAN);
    if (finish(c, HUMAN)) { think.textContent = tr('Start a new game, or undo to try another line.', 'Starten Sie ein neues Spiel oder nehmen Sie den Zug zurück, um eine andere Variante zu probieren.'); return; }
    queueBot();
  }

  function reset(botFirst) {
    clearTimeout(timer);
    board = c4Empty(); over = false; last = null; scores = Array(COLS).fill(null); best = -1; hint = null; history = []; scored = null;
    turn = HUMAN;
    status.textContent = yourMove();
    think.textContent = howTo;
    if (botFirst) queueBot(); else render();
  }

  el.addEventListener('click', e => { const b = e.target.closest('button'); if (b) humanMove(+b.dataset.col); });
  el.addEventListener('keydown', e => {
    const i = cols.indexOf(document.activeElement);
    const j = e.key === 'ArrowLeft' ? i - 1 : e.key === 'ArrowRight' ? i + 1 : -1;
    if (i >= 0 && j >= 0 && j < COLS) { cols[j].focus(); e.preventDefault(); }
  });
  $('#c4-depth', root).addEventListener('click', e => {
    const b = e.target.closest('[data-depth]');
    if (!b) return;
    c4Depth = +b.dataset.depth;
    render();
  });
  $('#c4-new', root).addEventListener('click', () => reset(false));
  $('#c4-botfirst', root).addEventListener('click', () => reset(true));
  $('#c4-hint', root).addEventListener('click', () => {
    const res = c4Think(board, 6, HUMAN), s = res.scores[res.best], col = res.best + 1;
    hint = res.best;
    think.textContent = s >= C4.WIN / 2
      ? tr(`Try column ${col}. It leads to a forced win for you.`, `Versuchen Sie Spalte ${col}. Sie führt zu einem erzwungenen Sieg für Sie.`)
      : s <= -C4.WIN / 2
        ? tr(`Try column ${col}. Every move loses against perfect play, but this one holds out longest.`, `Versuchen Sie Spalte ${col}. Gegen perfektes Spiel verliert jeder Zug, aber dieser hält am längsten.`)
        : tr(`Try column ${col}. It scores best from your side, looking 6 moves ahead.`, `Versuchen Sie Spalte ${col}. Sie schneidet aus Ihrer Sicht am besten ab, 6 Züge vorausgeschaut.`);
    render();
  });
  $('#c4-undo', root).addEventListener('click', () => {
    if (!history.length) return;
    clearTimeout(timer);
    if (scored) { c4Score[scored]--; scored = null; }
    ({ board, last, scores, best } = history.pop());
    over = false; turn = HUMAN; hint = null;
    status.textContent = tr('Turn undone. Try another move.', 'Zug zurückgenommen. Probieren Sie einen anderen.');
    think.textContent = tr('The board is back to before your last move.', 'Das Brett ist wieder wie vor Ihrem letzten Zug.');
    render();
  });
  reset(false);
  return () => clearTimeout(timer);
}

/* Tic-tac-toe with a perfect bot */
const tttScore = { you: 0, bot: 0, draw: 0 };
const OUTCOME_DE = { Win: 'Sieg', Loss: 'Niederlage', Draw: 'Remis' };

function ticTacToeLab(root) {
  root.innerHTML = `
    <p class="panel-intro">${tr('<strong>Solved.</strong> Before every move the bot plays out every way the rest of the game could go, so it can’t lose. The best you can do is a draw. You’re ×, the bot is ○.',
      '<strong>Gelöst.</strong> Vor jedem Zug spielt der Bot jeden möglichen weiteren Spielverlauf durch, deshalb kann er nicht verlieren. Mehr als ein Unentschieden ist nicht drin. Sie spielen ×, der Bot ○.')}</p>
    <div class="lab-body">
      <div>
        <div class="ttt" id="ttt" role="group" aria-label="${tr('Tic-tac-toe board', 'Tic-Tac-Toe-Brett')}"></div>
        <p class="status-line" id="ttt-status" role="status" aria-live="polite"></p>
        <div class="tools-row">
          <button class="quiet" type="button" id="ttt-hint">${tr('Suggest a move', 'Zug vorschlagen')}</button>
          <button class="quiet" type="button" id="ttt-undo">${tr('Undo turn ↶', 'Zug zurück ↶')}</button>
          <button class="quiet" type="button" id="ttt-values" aria-pressed="false"></button>
        </div>
      </div>
      <aside>
        <span class="control-label" id="ttt-mode-label">${tr('Bot strategy', 'Strategie des Bots')}</span>
        <div class="chips" id="ttt-mode" role="group" aria-labelledby="ttt-mode-label">
          <button type="button" data-mode="optimal" aria-pressed="true">${tr('Optimal · minimax', 'Optimal · Minimax')}</button>
          <button type="button" data-mode="casual" aria-pressed="false">${tr('Casual · random', 'Locker · zufällig')}</button>
        </div>
        <div class="tools-row"><button class="quiet" type="button" id="ttt-new">${tr('Start a new game ↻', 'Neues Spiel ↻')}</button></div>
        <p class="score" id="ttt-score" aria-live="polite"></p>
        <div class="explanation"><h3>${tr('INSIDE THE BOT’S HEAD', 'IM KOPF DES BOTS')}</h3><p id="ttt-reason"></p></div>
      </aside>
    </div>
    <p class="insight">${tr('Hints and outcomes assume perfect play from both sides. Against the optimal bot the best you can do is draw. Undo restores the board to before your last move.',
      'Vorschläge und Ergebnisse setzen perfektes Spiel beider Seiten voraus. Gegen den optimalen Bot ist ein Unentschieden das Beste, was Sie erreichen können. „Zug zurück“ stellt das Brett vor Ihrem letzten Zug wieder her.')}</p>`;

  const boardEl = $('#ttt', root), status = $('#ttt-status', root), reason = $('#ttt-reason', root);
  const outcomeLabel = label => tr(label, OUTCOME_DE[label]);
  let board, busy, finished, history, showValues = false, scored, mode = 'optimal', timer = null;
  const buttons = Array.from({ length: 9 }, (_, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.addEventListener('click', () => play(i));
    boardEl.append(b);
    return b;
  });

  function render() {
    const options = showValues && !busy && !finished ? humanMoves(board) : [];
    const win = outcome(board)?.line || [];
    buttons.forEach((b, i) => {
      b.textContent = board[i] === 'X' ? '×' : board[i] === 'O' ? '○' : '';
      b.disabled = busy || finished || !!board[i];
      b.classList.toggle('winning', win.includes(i));
      b.classList.remove('hint');
      const row = Math.floor(i / 3) + 1, col = i % 3 + 1;
      let label = tr(`Row ${row}, column ${col}, ${board[i] === 'X' ? 'yours' : board[i] === 'O' ? 'bot' : 'empty'}`,
        `Reihe ${row}, Spalte ${col}, ${board[i] === 'X' ? 'Ihres' : board[i] === 'O' ? 'Bot' : 'leer'}`);
      const value = options.find(v => v.index === i);
      if (value) {
        const cap = document.createElement('span');
        cap.className = `move-value ${value.label.toLowerCase()}`;
        cap.textContent = outcomeLabel(value.label);
        b.append(cap);
        label += tr(`, leads to a ${value.label.toLowerCase()}`, `, führt zu: ${outcomeLabel(value.label)}`);
      }
      b.setAttribute('aria-label', label);
    });
    const values = $('#ttt-values', root);
    $('#ttt-hint', root).disabled = busy || finished;
    $('#ttt-undo', root).disabled = !history.length;
    values.disabled = busy || finished;
    values.setAttribute('aria-pressed', String(showValues));
    values.textContent = showValues ? tr('Hide outcomes', 'Ergebnisse ausblenden') : tr('Show outcomes', 'Ergebnisse zeigen');
    $$('#ttt-mode button', root).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
    $('#ttt-score', root).textContent = scoreLine(tttScore);
  }

  function end() {
    const result = outcome(board);
    if (!result) return false;
    finished = true;
    scored = result.winner === 'draw' ? 'draw' : result.winner === 'X' ? 'you' : 'bot';
    tttScore[scored]++;
    status.textContent = scored === 'draw' ? tr('A draw. Well played.', 'Unentschieden. Gut gespielt.')
      : scored === 'you' ? tr('You won! Nicely done.', 'Sie haben gewonnen! Stark.')
      : tr('The bot wins. Try another strategy?', 'Der Bot gewinnt. Andere Strategie?');
    render();
    return true;
  }

  function play(i) {
    if (busy || finished || board[i]) return;
    history.push([...board]);
    board[i] = 'X';
    if (end()) return;
    busy = true;
    status.textContent = tr('Bot is considering its move…', 'Der Bot überlegt seinen Zug …');
    render();
    timer = setTimeout(() => {
      const move = botMove(board, mode, Math.random, getLang());
      if (move) {
        board[move.index] = 'O';
        const checked = move.nodes ? ` ${tr(`I checked ${num(move.nodes)} positions, every way the game could still go.`, `Ich habe ${num(move.nodes)} Stellungen geprüft, also jeden möglichen weiteren Verlauf.`)}` : '';
        reason.textContent = `${tr('Square', 'Feld')} ${move.index + 1}: ${move.reason}${checked}`;
      }
      busy = false;
      if (!end()) { status.textContent = tr('Your turn. What will you try?', 'Sie sind dran. Was probieren Sie?'); render(); }
    }, reduced() ? 0 : 220);
  }

  function reset() {
    clearTimeout(timer);
    board = Array(9).fill(''); busy = false; finished = false; history = []; scored = null;
    status.textContent = tr('Your turn. Make the first move.', 'Sie sind dran. Machen Sie den ersten Zug.');
    reason.textContent = tr('Show outcomes to inspect the game tree, or ask for a suggested move.', 'Mit „Ergebnisse zeigen“ sehen Sie den Spielbaum, oder lassen Sie sich einen Zug vorschlagen.');
    render();
  }

  $('#ttt-new', root).addEventListener('click', reset);
  $('#ttt-mode', root).addEventListener('click', e => { const b = e.target.closest('[data-mode]'); if (b) { mode = b.dataset.mode; reset(); } });
  $('#ttt-values', root).addEventListener('click', () => { showValues = !showValues; render(); });
  $('#ttt-hint', root).addEventListener('click', () => {
    const best = humanMoves(board)[0];
    if (!best) return;
    render();
    buttons[best.index].classList.add('hint');
    const row = Math.floor(best.index / 3) + 1, col = best.index % 3 + 1;
    reason.textContent = tr(
      `Try square ${best.index + 1} (row ${row}, column ${col}). Best guaranteed outcome: ${best.label.toLowerCase()}, if both sides play perfectly.`,
      `Versuchen Sie Feld ${best.index + 1} (Reihe ${row}, Spalte ${col}). Bestes garantiertes Ergebnis: ${outcomeLabel(best.label)}, wenn beide Seiten perfekt spielen.`);
  });
  $('#ttt-undo', root).addEventListener('click', () => {
    if (!history.length) return;
    clearTimeout(timer);
    if (scored) { tttScore[scored]--; scored = null; }
    board = history.pop(); busy = false; finished = false;
    status.textContent = tr('Turn undone. Try another move.', 'Zug zurückgenommen. Probieren Sie einen anderen.');
    reason.textContent = tr('The board is back to before your last move. Explore a different branch of the game.', 'Das Brett ist wieder wie vor Ihrem letzten Zug. Probieren Sie einen anderen Zweig des Spiels.');
    render();
  });
  reset();
  return () => clearTimeout(timer);
}

/* ---------- Pathfinding: BFS vs A* ---------- */
function pathLab() {
  content.innerHTML = `
    <h2 id="dialog-title">${tr('Find a way <em>through.</em>', 'Finden Sie den <em>Weg.</em>')}</h2>
    <p class="subtext">${tr('Draw walls, move the start or goal, then run or compare the searches. With a keyboard, use the arrow keys and Space on the grid.',
      'Zeichnen Sie Wände, verschieben Sie Start oder Ziel und starten oder vergleichen Sie dann die Suchen. Mit der Tastatur: Pfeiltasten und Leertaste im Raster.')}</p>
    <div class="toolbar">
      <label><span class="control-label">${tr('Algorithm', 'Algorithmus')}</span><select id="algorithm"><option value="bfs">${tr('Breadth-first search', 'Breitensuche')}</option><option value="astar">${tr('A* · Manhattan distance', 'A* · Manhattan-Distanz')}</option></select></label>
      <label><span class="control-label">Animation</span><select id="speed"><option value="14">${tr('Quick', 'Schnell')}</option><option value="40">${tr('Step by step', 'Schritt für Schritt')}</option><option value="0">${tr('Instant', 'Sofort')}</option></select></label>
      <button class="button primary" type="button" id="run-path">${tr('Find a path →', 'Weg finden →')}</button>
      <button class="quiet" type="button" id="compare-paths">${tr('Compare BFS &amp; A*', 'BFS &amp; A* vergleichen')}</button>
    </div>
    <div class="edit-tools">
      <span>${tr('EDIT', 'BEARBEITEN')}</span>
      <button class="quiet" type="button" data-edit="walls" aria-pressed="true">${tr('Draw walls', 'Wände zeichnen')}</button>
      <button class="quiet" type="button" data-edit="start" aria-pressed="false">${tr('Move start', 'Start verschieben')}</button>
      <button class="quiet" type="button" data-edit="goal" aria-pressed="false">${tr('Move goal', 'Ziel verschieben')}</button>
      <button class="quiet" type="button" id="clear-path">${tr('Clear walls', 'Wände löschen')}</button>
      <button class="quiet" type="button" id="maze">${tr('Example maze', 'Beispiel-Labyrinth')}</button>
    </div>
    <div class="path-grid" id="path-grid" role="group" aria-label="${tr('Editable pathfinding grid', 'Bearbeitbares Raster für die Wegsuche')}"></div>
    <div class="compare-results" id="compare-results" aria-live="polite"></div>
    <div class="legend"><span style="--key:var(--green)">Start</span><span style="--key:var(--accent)">${tr('Goal', 'Ziel')}</span><span style="--key:var(--wall)">${tr('Wall', 'Wand')}</span><span style="--key:var(--explored)">${tr('Explored', 'Erkundet')}</span><span style="--key:var(--accent-soft)">${tr('Shortest path', 'Kürzester Weg')}</span></div>
    <p class="path-status" id="path-status" role="status" aria-live="polite">${tr('Ready. Make a maze, then run a search.', 'Bereit. Bauen Sie ein Labyrinth und starten Sie eine Suche.')}</p>
    <p class="insight">${tr('Breadth-first search expands level by level. A* prioritises the distance travelled so far plus an estimate of the distance left. On this unweighted grid both find a shortest path; A* usually explores fewer cells.',
      'Die Breitensuche arbeitet sich Ebene für Ebene vor. A* bevorzugt Felder nach bisheriger Strecke plus geschätzter Reststrecke. Auf diesem ungewichteten Raster finden beide einen kürzesten Weg; A* erkundet meist weniger Felder.')}</p>`;

  const width = 17, height = 9, grid = $('#path-grid'), status = $('#path-status');
  const bfsName = () => tr('Breadth-first search', 'Breitensuche');
  let start = 4 * width + 1, goal = 4 * width + 15, walls = new Set(), running = false, version = 0;
  let editMode = 'walls', painting = false, paintWall = true, lastPointer = null;

  const cells = Array.from({ length: width * height }, (_, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'path-cell';
    b.addEventListener('click', e => { if (e.detail === 0 || lastPointer !== 'mouse' || editMode !== 'walls') editCell(i); });
    b.addEventListener('pointerdown', e => {
      lastPointer = e.pointerType;
      if (e.pointerType !== 'mouse' || e.button !== 0 || running || editMode !== 'walls' || i === start || i === goal) return;
      painting = true; paintWall = !walls.has(i); paintCell(i);
    });
    b.addEventListener('pointerenter', () => { if (painting && !running && editMode === 'walls') paintCell(i); });
    b.addEventListener('keydown', e => {
      const step = { ArrowRight: 1, ArrowLeft: -1, ArrowUp: -width, ArrowDown: width }[e.key];
      if (step !== undefined) { e.preventDefault(); cells[Math.max(0, Math.min(cells.length - 1, i + step))].focus(); }
    });
    grid.append(b);
    return b;
  });

  function draw() {
    cells.forEach((c, i) => {
      c.className = 'path-cell' + (walls.has(i) ? ' wall' : '') + (i === start ? ' start' : i === goal ? ' goal' : '');
      c.textContent = i === start ? 'S' : i === goal ? tr('G', 'Z') : '';
      c.disabled = running;
      const row = Math.floor(i / width) + 1, col = i % width + 1;
      const kind = i === start ? 'start' : i === goal ? tr('goal', 'Ziel') : walls.has(i) ? tr('wall', 'Wand') : tr('open', 'frei');
      c.setAttribute('aria-label', tr(`Row ${row}, column ${col}: ${kind}`, `Reihe ${row}, Spalte ${col}: ${kind}`));
    });
  }
  function setRunning(value) {
    running = value;
    $$('[data-edit], #compare-paths, #run-path, #clear-path, #maze, #algorithm, #speed').forEach(b => { b.disabled = value; });
    cells.forEach(c => { c.disabled = value; });
  }
  function edited() {
    draw();
    $('#compare-results').replaceChildren();
    status.textContent = tr(`${walls.size} walls. Ready for a new search.`, `${walls.size} ${walls.size === 1 ? 'Wand' : 'Wände'}. Bereit für eine neue Suche.`);
  }
  function paintCell(i) { if (i === start || i === goal) return; paintWall ? walls.add(i) : walls.delete(i); edited(); }
  function editCell(i) {
    if (running) return;
    if (editMode === 'start' && i !== goal) { start = i; walls.delete(i); }
    else if (editMode === 'goal' && i !== start) { goal = i; walls.delete(i); }
    else if (editMode === 'walls' && i !== start && i !== goal) { walls.has(i) ? walls.delete(i) : walls.add(i); }
    edited();
  }
  function example() {
    start = 4 * width + 1; goal = 4 * width + 15; walls = new Set();
    for (let y = 0; y < height; y++) { if (y !== 1) walls.add(y * width + 5); if (y !== 7) walls.add(y * width + 11); }
    $('#compare-results').replaceChildren();
    draw();
    status.textContent = tr('Example maze loaded. Compare both algorithms on the same grid.', 'Beispiel-Labyrinth geladen. Vergleichen Sie beide Algorithmen auf demselben Raster.');
  }

  const endPaint = () => { painting = false; };
  document.addEventListener('pointerup', endPaint);
  document.addEventListener('pointercancel', endPaint);

  $$('[data-edit]').forEach(b => b.addEventListener('click', () => {
    editMode = b.dataset.edit;
    $$('[data-edit]').forEach(t => t.setAttribute('aria-pressed', String(t === b)));
    status.textContent = editMode === 'walls'
      ? tr('Draw or erase walls. Drag with a mouse; tap on touchscreens.', 'Wände zeichnen oder löschen. Mit der Maus ziehen, auf Touchscreens tippen.')
      : tr(`Click any open square to move the ${editMode}.`, `Klicken Sie auf ein freies Feld, um ${editMode === 'start' ? 'den Start' : 'das Ziel'} zu verschieben.`);
  }));
  $('#compare-paths').addEventListener('click', () => {
    const bfs = findPath({ width, height, start, goal, walls }), astar = findPath({ width, height, start, goal, walls, algorithm: 'astar' });
    $('#compare-results').innerHTML = [[bfsName(), bfs], ['A*', astar]].map(([name, r]) =>
      `<div class="compare-result"><strong>${name}</strong>${tr(`${r.visited.length} cells explored`, `${r.visited.length} Felder erkundet`)}<br>${r.path.length
        ? tr(`${r.path.length - 1} steps in the shortest path`, `${r.path.length - 1} Schritte im kürzesten Weg`)
        : tr('No path available', 'Kein Weg möglich')}</div>`).join('');
    status.textContent = bfs.path.length
      ? tr('Same maze, same shortest path length. Compare how many cells each search explored.', 'Gleiches Labyrinth, gleich lange kürzeste Wege. Vergleichen Sie, wie viele Felder jede Suche erkundet hat.')
      : tr('Neither search found a route. Remove a wall or move an endpoint.', 'Keine der beiden Suchen hat einen Weg gefunden. Entfernen Sie eine Wand oder verschieben Sie einen Endpunkt.');
  });
  $('#clear-path').addEventListener('click', () => { walls.clear(); edited(); status.textContent = tr('Walls cleared. Click or drag to draw a new maze.', 'Wände gelöscht. Klicken oder ziehen Sie, um ein neues Labyrinth zu zeichnen.'); });
  $('#maze').addEventListener('click', example);
  $('#algorithm').addEventListener('change', () => { draw(); status.textContent = tr('Algorithm changed. Run the search to see it.', 'Algorithmus geändert. Starten Sie die Suche, um ihn zu sehen.'); });
  $('#run-path').addEventListener('click', async () => {
    draw();
    setRunning(true);
    const mine = ++version, algorithm = $('#algorithm').value, delay = reduced() ? 0 : +$('#speed').value;
    const result = findPath({ width, height, start, goal, walls, algorithm });
    status.textContent = tr('Searching…', 'Suche läuft …');
    for (const i of result.visited) {
      if (mine !== version) return;
      if (i !== start && i !== goal) cells[i].classList.add('visited');
      if (delay) await new Promise(r => setTimeout(r, delay));
    }
    if (mine !== version) return;
    result.path.forEach(i => { if (i !== start && i !== goal) cells[i].classList.add('route'); });
    const name = algorithm === 'astar' ? 'A*' : bfsName();
    status.textContent = result.path.length
      ? tr(`${name} explored ${result.visited.length} cells. Shortest path: ${result.path.length - 1} steps.`, `${name} hat ${result.visited.length} Felder erkundet. Kürzester Weg: ${result.path.length - 1} Schritte.`)
      : tr(`No path found after exploring ${result.visited.length} cells. Remove a wall and try again.`, `Kein Weg gefunden, nachdem ${result.visited.length} Felder erkundet wurden. Entfernen Sie eine Wand und versuchen Sie es erneut.`);
    setRunning(false);
  });
  example();
  cleanup = () => {
    version++;
    painting = false;
    document.removeEventListener('pointerup', endPaint);
    document.removeEventListener('pointercancel', endPaint);
  };
}

/* ---------- Request simulator ---------- */
function requestLab() {
  content.innerHTML = `
    <h2 id="dialog-title">${tr('Where does the <em>waiting happen?</em>', 'Wo entsteht die <em>Wartezeit?</em>')}</h2>
    <p class="subtext">${tr('Change the workload, pick a request strategy, and watch an interface get its data. The same idea sits behind the 40% speed-up from merging APIs at AIO Tests.',
      'Ändern Sie die Datenmenge, wählen Sie eine Request-Strategie und sehen Sie zu, wie eine Oberfläche ihre Daten lädt. Dieselbe Idee steckt hinter den bis zu 40&nbsp;% schnelleren Abläufen durch zusammengeführte APIs bei AIO Tests.')}</p>
    <div class="request-body">
      <div class="request-controls">
        <div><label class="range-label" for="req-count">${tr('Data items', 'Datensätze')} <output id="req-count-out" for="req-count">6</output></label><input id="req-count" type="range" min="1" max="12" value="6"></div>
        <div><label class="range-label" for="req-latency">${tr('Network latency', 'Netzwerklatenz')} <output id="req-latency-out" for="req-latency">120 ms</output></label><input id="req-latency" type="range" min="20" max="300" step="10" value="120"></div>
        <div>
          <span class="control-label" id="req-strategy-label">${tr('Request strategy', 'Request-Strategie')}</span>
          <div class="strategy" id="req-strategy" role="group" aria-labelledby="req-strategy-label">
            <button type="button" data-strategy="sequential">${tr('One at a time', 'Einzeln nacheinander')} <span aria-hidden="true">→</span></button>
            <button type="button" data-strategy="parallel">${tr('Parallel · 3 lanes', 'Parallel · 3 Spuren')} <span aria-hidden="true">⇉</span></button>
            <button type="button" data-strategy="batch">${tr('One batch', 'Ein Batch')} <span aria-hidden="true">⊞</span></button>
          </div>
        </div>
        <button class="button primary" type="button" id="req-run">${tr('Replay requests', 'Requests abspielen')} <span aria-hidden="true">↻</span></button>
      </div>
      <div class="request-chart">
        <div class="request-metrics" aria-live="polite" aria-atomic="true">
          <div><output id="req-time">–</output><span>${tr('MODELLED COMPLETION', 'MODELLIERTE DAUER')}</span></div>
          <div><output class="saving" id="req-saving">–</output><span>${tr('LESS WAITING THAN ONE AT A TIME', 'WENIGER WARTEZEIT ALS EINZELN')}</span></div>
        </div>
        <div class="waterfall" id="waterfall"></div>
        <div class="request-axis"><span>0 ms</span><span id="req-axis-end"></span></div>
        <div class="request-legend"><span>${tr('Network latency', 'Netzwerklatenz')}</span><span>${tr(`Processing · ${PROCESSING_MS} ms per item`, `Verarbeitung · ${PROCESSING_MS} ms pro Datensatz`)}</span></div>
        <p class="request-explanation" id="req-explanation"></p>
      </div>
    </div>
    <p class="insight">${tr(`An illustrative model: equal payloads, fixed latency, ${PROCESSING_MS} ms of processing per item, no caching or bandwidth limits. Parallel mode allows up to three requests at once; batch mode processes items one after another on the server. Not a benchmark of employer systems.`,
      `Ein vereinfachtes Modell: gleich große Datenpakete, feste Latenz, ${PROCESSING_MS} ms Verarbeitung pro Datensatz, kein Caching und keine Bandbreitengrenzen. Im Parallelmodus laufen bis zu drei Requests gleichzeitig; im Batch-Modus verarbeitet der Server die Datensätze nacheinander. Kein Benchmark von Systemen meines Arbeitgebers.`)}</p>`;

  let strategy = 'sequential', frame = 0;
  const EXPLAIN = {
    sequential: () => tr('Each request waits for the one before it, so the network latency is paid once per item, back to back.', 'Jeder Request wartet auf den vorherigen, also fällt die Netzwerklatenz für jeden Datensatz einzeln an, einer nach dem anderen.'),
    parallel: () => tr('Three requests travel at once. Each still pays the latency, but independent work overlaps.', 'Drei Requests laufen gleichzeitig. Jeder zahlt weiterhin die Latenz, aber unabhängige Arbeit überlappt.'),
    batch: () => tr('One round trip carries every item. The server still spends 40 ms per item, but you only wait on the network once.', 'Ein einziger Roundtrip transportiert alle Datensätze. Der Server braucht weiterhin 40 ms pro Datensatz, aber auf das Netzwerk wartet man nur einmal.')
  };
  const NAMES = { sequential: () => tr('One at a time', 'Einzeln nacheinander'), parallel: () => tr('Parallel', 'Parallel'), batch: () => tr('Batch', 'Batch') };
  function render(animate = false) {
    const count = +$('#req-count').value, latency = +$('#req-latency').value, model = requestModel(count, latency, strategy);
    $('#req-count-out').textContent = count;
    $('#req-latency-out').textContent = `${latency} ms`;
    $('#req-time').textContent = `${num(model.total)} ms`;
    $('#req-saving').textContent = pct(Math.round(100 * (1 - model.total / model.baseline)));
    $('#req-axis-end').textContent = `${num(model.baseline)} ms`;
    $$('#req-strategy button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.strategy === strategy)));
    const chart = $('#waterfall');
    chart.classList.remove('is-running');
    chart.innerHTML = model.requests.map((r, i) => `
      <div class="request-row"><span>${strategy === 'batch' ? 'BATCH' : `REQ ${i + 1}`}</span>
        <div class="request-track"><div class="request-bar" style="--left:${100 * r.start / model.baseline}%;--width:${100 * r.duration / model.baseline}%;--network:${100 * latency / r.duration}%;--duration:${r.duration};--start:${r.start}"><span class="network"></span></div></div>
      </div>`).join('');
    const n = model.requests.length;
    chart.setAttribute('aria-label', tr(`${NAMES[strategy]()} strategy: ${n} request${n > 1 ? 's' : ''}, ${model.total} milliseconds in total.`,
      `Strategie ${NAMES[strategy]()}: ${n} ${n > 1 ? 'Requests' : 'Request'}, insgesamt ${model.total} Millisekunden.`));
    $('#req-explanation').textContent = EXPLAIN[strategy]();
    if (animate) { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => chart.classList.add('is-running')); }
  }
  ['#req-count', '#req-latency'].forEach(s => $(s).addEventListener('input', () => render()));
  $('#req-strategy').addEventListener('click', e => { const b = e.target.closest('[data-strategy]'); if (b) { strategy = b.dataset.strategy; render(true); } });
  $('#req-run').addEventListener('click', () => render(true));
  render(true);
  cleanup = () => cancelAnimationFrame(frame);
}

/* ---------- Guided résumé assistant ---------- */
function askLab() {
  const topics = tr(['Work experience', 'AI & agents', 'Skills & tools', 'Education', 'Projects', 'Contact'],
    ['Berufserfahrung', 'KI & Agenten', 'Fähigkeiten & Tools', 'Studium', 'Projekte', 'Kontakt']);
  content.innerHTML = `
    <h2 id="dialog-title">${tr('Meet the <em>engineer.</em>', 'Lernen Sie <em>mich kennen.</em>')}</h2>
    <p class="subtext">${tr('A quick, guided tour of my background. Pick a topic or type a question.', 'Ein kurzer, geführter Überblick über meinen Werdegang. Wählen Sie ein Thema oder stellen Sie eine Frage.')}</p>
    <div class="chat-log" id="chat-log" role="log" aria-label="${tr('Conversation', 'Unterhaltung')}" aria-live="polite"></div>
    <div class="chips chat-options">
      ${topics.map(t => `<button type="button">${esc(t)}</button>`).join('')}
    </div>
    <form class="chat-form" id="chat-form">
      <input type="text" aria-label="${tr('Your question', 'Ihre Frage')}" placeholder="${tr('What would you like to know?', 'Was möchten Sie wissen?')}" maxlength="400" autocomplete="off" required>
      <button class="button primary" type="submit">${tr('Ask', 'Fragen')} <span aria-hidden="true">↑</span></button>
    </form>
    <p class="insight">${tr('A guided assistant: prepared answers matched to topics from my résumé. No language model, no external service. Your questions stay in this page and are cleared when you close it.',
      'Ein geführter Assistent: vorbereitete Antworten zu Themen aus meinem Lebenslauf. Kein Sprachmodell, kein externer Dienst. Ihre Fragen bleiben auf dieser Seite und werden beim Schließen gelöscht.')}</p>`;
  const log = $('#chat-log');
  const add = (text, user = false) => {
    const bubble = document.createElement('div');
    bubble.className = 'bubble' + (user ? ' user' : '');
    bubble.textContent = text;
    log.append(bubble);
    log.scrollTop = log.scrollHeight;
  };
  const ask = q => { if (!q.trim()) return; add(q, true); add(resumeAnswer(q, getLang())); };
  add(tr('Hi! Ask about Siddharth’s experience, AI work, skills, education or projects. Pick a topic below or type a question.',
    'Hallo! Fragen Sie nach Siddharths Erfahrung, KI-Arbeit, Fähigkeiten, Studium oder Projekten. Wählen Sie unten ein Thema oder tippen Sie eine Frage.'));
  $('#chat-form').addEventListener('submit', e => {
    e.preventDefault();
    const input = $('input', e.target);
    ask(input.value.trim());
    input.value = '';
    input.focus();
  });
  $$('.chat-options button').forEach(b => b.addEventListener('click', () => ask(b.textContent)));
}

/* ---------- quick navigation (Cmd/Ctrl + K) ---------- */
// Titles and types in both languages; keywords hold English and German search words.
const COMMANDS = [
  { title: ['Run Code Mode on toy data', 'Code Mode mit Spieldaten ausprobieren'], type: ['Experiment', 'Experiment'], keywords: 'agentic ai mcp sandbox tokens code mode ki agent', lab: 'codemode' },
  { title: ['Play Connect Four', 'Vier gewinnt spielen'], type: ['Experiment', 'Experiment'], keywords: 'game minimax alpha beta bot connect four estimated spiel geschätzt', lab: 'games', tab: 'c4' },
  { title: ['Play tic-tac-toe', 'Tic-Tac-Toe spielen'], type: ['Experiment', 'Experiment'], keywords: 'game minimax tic tac toe bot solved spiel gelöst', lab: 'games', tab: 'ttt' },
  { title: ['Draw a maze', 'Labyrinth zeichnen'], type: ['Experiment', 'Experiment'], keywords: 'pathfinding bfs astar a* algorithms maze wegsuche algorithmen breitensuche', lab: 'path' },
  { title: ['Tune request performance', 'Request-Performance optimieren'], type: ['Experiment', 'Experiment'], keywords: 'backend network api java latency performance netzwerk latenz', lab: 'requests' },
  { title: ['Ask about Siddharth', 'Fragen zu Siddharth'], type: ['Guided assistant', 'Assistent'], keywords: 'chat resume questions background lebenslauf fragen', lab: 'ask' },
  { title: ['Code Mode case study', 'Projekt: Code Mode'], type: ['Recent project', 'Aktuelles Projekt'], keywords: 'hackathon agentic ai mcp anythingmcp black forest ki', target: '#code-mode' },
  { title: ['Work experience', 'Berufserfahrung'], type: ['Section', 'Abschnitt'], keywords: 'frontend vue typescript java career aio tests jira erfahrung arbeit', target: '#work' },
  { title: ['About, education and skills', 'Über mich, Studium und Fähigkeiten'], type: ['Section', 'Abschnitt'], keywords: 'education msc darmstadt background skills stack tools studium fähigkeiten', target: '#about' },
  { title: ['Earlier hardware projects', 'Frühere Hardware-Projekte'], type: ['Projects', 'Projekte'], keywords: 'printer robot ar hardware drucker roboter', target: '#earlier' },
  { title: ['Get in touch', 'Kontakt aufnehmen'], type: ['Contact', 'Kontakt'], keywords: 'email hire werkstudent working student internship kontakt praktikum', target: '#contact' },
  { title: ['Download résumé', 'Lebenslauf herunterladen'], type: ['PDF', 'PDF'], keywords: 'cv resume download lebenslauf', href: 'assets/Resume_Siddharth_Agarwal.pdf' }
];
const command = $('#command-dialog'), search = $('#command-search'), results = $('#command-results');
let commandTrigger = null;
const pick = pair => tr(pair[0], pair[1]);

function renderCommands() {
  const query = search.value.toLowerCase().trim();
  const matches = COMMANDS.filter(c => `${c.title.join(' ')} ${c.type.join(' ')} ${c.keywords}`.toLowerCase().includes(query));
  results.replaceChildren();
  if (!matches.length) {
    const p = document.createElement('p');
    p.textContent = tr('No match. Try “game”, “AI” or “contact”.', 'Kein Treffer. Versuchen Sie „Spiel“, „KI“ oder „Kontakt“.');
    p.className = 'muted';
    results.append(p);
  }
  for (const item of matches) {
    const b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = `<span>${esc(pick(item.title))}</span><small>${esc(pick(item.type).toUpperCase())} ↗</small>`;
    b.addEventListener('click', () => {
      command.close();
      if (item.lab) openLab(item.lab, commandTrigger, item.tab);
      else if (item.target) scrollToEl($(item.target));
      else { const a = document.createElement('a'); a.href = item.href; a.download = ''; a.click(); }
    });
    results.append(b);
  }
}
function openCommands() {
  if (dialog.open) return;
  commandTrigger = document.activeElement;
  search.value = '';
  renderCommands();
  command.showModal();
  search.focus();
}
$('#open-commands').addEventListener('click', openCommands);
$('#close-commands').addEventListener('click', () => command.close());
command.addEventListener('close', () => { if (!dialog.open) commandTrigger?.focus?.(); });
command.addEventListener('click', e => {
  if (e.target !== command) return;
  const r = command.getBoundingClientRect();
  if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) command.close();
});
search.addEventListener('input', renderCommands);
command.addEventListener('keydown', e => {
  const buttons = $$('button', results), i = buttons.indexOf(document.activeElement);
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    if (buttons.length) buttons[(i + (e.key === 'ArrowDown' ? 1 : buttons.length - 1) + buttons.length) % buttons.length].focus();
  } else if (e.key === 'Enter' && document.activeElement === search) {
    e.preventDefault();
    buttons[0]?.click();
  }
});
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    command.open ? command.close() : openCommands();
  }
});
