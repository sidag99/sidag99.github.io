import {
  outcome, botMove, humanMoves, findPath, resumeAnswer, requestModel, PROCESSING_MS,
  C4, c4Empty, c4Full, c4WinLine, c4Think, c4Label, c4Explain,
  CODE_QUESTIONS, makeShopData, makeShopTools, runCodeQuestion
} from './engine.mjs';

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const scrollToEl = el => el.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
const num = x => Math.round(x).toLocaleString('en');

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
const LABS = { codemode: codeModeLab, c4: connectFourLab, ttt: ticTacToeLab, path: pathLab, requests: requestLab, ask: askLab };
const PLAYGROUND = ['c4', 'ttt', 'path', 'requests', 'ask']; // Code Mode lives with its case study, not the playground
const explored = new Set();
let cleanup = () => {}, lastTrigger = null;

function openLab(name, trigger = document.activeElement) {
  if ($('#command-dialog').open) $('#command-dialog').close();
  cleanup();
  cleanup = () => {};
  lastTrigger = trigger;
  LABS[name]();
  if (!dialog.open) dialog.showModal();
  dialog.scrollTop = 0;
  document.body.style.overflow = 'hidden';
  markExplored(name);
}

function markExplored(name) {
  if (!PLAYGROUND.includes(name)) return;
  explored.add(name);
  const card = $(`.card-cta[data-lab="${name}"]`)?.closest('.lab-card');
  if (card) { card.classList.add('is-visited'); $('.mark', card).textContent = '✓'; }
  $$('.progress-dots span').forEach((d, i) => d.classList.toggle('done', i < explored.size));
  const total = PLAYGROUND.length;
  $('#lab-progress').textContent = `${explored.size} / ${total} experiments explored · ${explored.size === total ? 'You tried them all. Thanks for playing!' : 'Keep experimenting.'}`;
}

$('#close-lab').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', e => {
  if (e.target !== dialog) return;
  const r = dialog.getBoundingClientRect();
  if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close();
});
dialog.addEventListener('close', () => {
  cleanup();
  cleanup = () => {};
  document.body.style.overflow = '';
  lastTrigger?.focus?.();
});
document.addEventListener('click', e => {
  const t = e.target.closest('[data-lab], [data-open]');
  if (t) openLab(t.dataset.lab || t.dataset.open, t);
});

/* ---------- 01 Code Mode on toy data ---------- */
function codeModeLab() {
  content.innerHTML = `
    <h2 id="dialog-title">Keep the data <em>out.</em></h2>
    <p class="subtext">The idea behind my hackathon project, small enough to run here. Pick a question and grow the database: the raw tool output grows with it, the Code Mode answer stays tiny.</p>
    <div class="lab-body code-lab">
      <div class="stack">
        <div>
          <span class="control-label" id="cm-q-label">Question for the agent</span>
          <div class="chips" id="cm-q" role="group" aria-labelledby="cm-q-label">
            ${CODE_QUESTIONS.map((q, i) => `<button type="button" data-q="${i}" aria-pressed="${i === 0}">${esc(q.label)}</button>`).join('')}
          </div>
        </div>
        <div>
          <label class="range-label" for="cm-size">Orders in the database <output id="cm-size-out" for="cm-size">5,000</output></label>
          <input type="range" id="cm-size" min="500" max="20000" step="500" value="5000">
        </div>
        <div class="explanation">
          <h3>WHAT YOU’RE COMPARING</h3>
          <p><strong>Raw tool calls:</strong> the agent fetches every table it needs, and all of it lands in the model’s context, where the model has to dig out the answer.</p>
          <p style="margin-top:10px"><strong>Code Mode:</strong> the agent writes the script on the right, it runs next to the data, and only its return value goes back to the model.</p>
        </div>
        <details class="peek-box"><summary>Peek at the raw payload</summary><pre class="peek" id="cm-peek"></pre></details>
      </div>
      <figure class="panel" aria-label="Script the agent writes, its result, and the size of each approach">
        <p class="ask" id="cm-ask"></p>
        <pre id="cm-code"></pre>
        <div class="result" id="cm-result" aria-live="polite"></div>
        <div class="compare">
          <div class="row raw"><span>Raw tool calls</span><div class="bar"><div class="fill"></div></div><span class="num" id="cm-raw">–</span></div>
          <div class="row cm"><span>Code Mode</span><div class="bar"><div class="fill" id="cm-fill"></div></div><span class="num" id="cm-cm">–</span></div>
          <p class="note" id="cm-note"></p>
        </div>
      </figure>
    </div>
    <p class="insight">The data is generated in your browser and the script really runs against it. Tokens are estimated at 4 bytes each. The 1.69 MB → 41 B figure in the project write-up is from our hackathon benchmark.</p>`;

  const enc = new TextEncoder(), size = $('#cm-size');
  const bytes = s => enc.encode(s).length;
  const fmt = b => b < 1000 ? `${b} B` : b < 1e6 ? `${(b / 1000).toFixed(1)} KB` : `${(b / 1e6).toFixed(2)} MB`;
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
    $('#cm-ask').innerHTML = `Agent is asked: <b>“${esc(q.label)}”</b>`;
    $('#cm-code').innerHTML = highlight(q.code);
    $('#cm-result').textContent = JSON.stringify(result, null, 1).replace(/\n\s*/g, ' ');
    $('#cm-raw').textContent = fmt(rawBytes);
    $('#cm-cm').textContent = fmt(cmBytes);
    $('#cm-fill').style.width = `${Math.max(cmBytes / rawBytes * 100, 0.5)}%`;
    $('#cm-note').textContent = `About ${num(cmBytes / 4)} tokens instead of ${num(rawBytes / 4)}, ${num(rawBytes / cmBytes)}× less. Raw means the full ${new Intl.ListFormat('en').format(q.raw)} table${q.raw.length > 1 ? 's' : ''}.`;
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

/* ---------- 02 Connect Four with an inspectable minimax bot ---------- */
const c4Score = { you: 0, bot: 0, draw: 0 };
let c4Depth = 3;

function connectFourLab() {
  const { COLS, ROWS, HUMAN, BOT } = C4;
  content.innerHTML = `
    <h2 id="dialog-title">Four in a <em>row.</em></h2>
    <p class="subtext">You’re yellow, the bot is green. After each move it shows how it scored every column, so you can see why it played where it did.</p>
    <div class="lab-body">
      <div>
        <div class="c4" id="c4" role="group" aria-label="Connect Four board, columns 1 to 7. Use the arrow keys to move between columns."></div>
        <div class="c4-scores" id="c4-scores" aria-hidden="true"></div>
        <p class="key"><span><i style="background:#e8b931"></i>You</span><span><i style="background:#6fb596"></i>Bot</span><span>Numbers: the bot’s score per column, higher is better for it</span></p>
      </div>
      <aside>
        <p class="status-line" id="c4-status" role="status" aria-live="polite">Your move.</p>
        <div class="explanation"><h3>INSIDE THE BOT’S HEAD</h3><p id="c4-think" aria-live="polite">Click a column, or Tab to the board, move with the arrow keys and press Enter.</p></div>
        <div style="margin-top:20px">
          <span class="control-label" id="c4-depth-label">Bot strength</span>
          <div class="chips" id="c4-depth" role="group" aria-labelledby="c4-depth-label">
            <button type="button" data-depth="1">Easy · 1 move ahead</button>
            <button type="button" data-depth="3">Medium · 3</button>
            <button type="button" data-depth="6">Hard · 6</button>
          </div>
        </div>
        <div class="tools-row">
          <button class="quiet" type="button" id="c4-new">New game ↻</button>
          <button class="quiet" type="button" id="c4-botfirst">Bot starts</button>
          <button class="quiet" type="button" id="c4-hint">Suggest a move</button>
          <button class="quiet" type="button" id="c4-undo">Undo turn ↶</button>
        </div>
        <p class="score" id="c4-score" aria-live="polite"></p>
        <details class="peek-box">
          <summary>How the bot decides</summary>
          <p>Minimax search with alpha-beta pruning. For each column it plays out every sequence of moves up to its search depth, assuming you always answer with your best reply, then scores the positions where it stops.</p>
          <p>A position earns points for open lines of two or three bot discs and for discs in the centre column, and loses the same for yours. A forced win or loss inside the search depth outranks any score: that’s what “win” and “loss” under the board mean.</p>
        </details>
      </aside>
    </div>
    <p class="insight">Hints search 6 moves ahead from your side. Undo takes back your last move and the bot’s reply; undoing a finished game removes it from the score. Scores last while this page is open.</p>`;

  const el = $('#c4'), scoreEl = $('#c4-scores'), status = $('#c4-status'), think = $('#c4-think');
  el.innerHTML = Array.from({ length: COLS }, (_, c) => `<button type="button" data-col="${c}">${'<span class="slot"></span>'.repeat(ROWS)}</button>`).join('');
  scoreEl.innerHTML = '<span></span>'.repeat(COLS);
  const cols = [...el.children];
  let board, turn, over, last, scores, best, hint, history, scored, timer = null;

  const copy = b => b.map(col => [...col]);

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
      btn.setAttribute('aria-label', `Column ${c + 1}, ${left ? `${left} space${left > 1 ? 's' : ''} left` : 'full'}${hint === c ? ', suggested' : ''}`);
    });
    [...scoreEl.children].forEach((s, c) => { s.textContent = c4Label(scores[c]); s.className = c === best ? 'best' : ''; });
    $$('#c4-depth button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.depth === c4Depth)));
    $('#c4-hint').disabled = over || turn !== HUMAN;
    $('#c4-undo').disabled = !history.length;
    $('#c4-score').textContent = `THIS SESSION · You ${c4Score.you} / Bot ${c4Score.bot} / Draws ${c4Score.draw}`;
  }

  function finish(c, who) {
    const line = c4WinLine(board, c);
    if (line) {
      over = true; scored = who === HUMAN ? 'you' : 'bot'; c4Score[scored]++;
      status.textContent = who === HUMAN ? 'You win. Four in a row!' : 'The bot wins. Try another line?';
      render(line);
      return true;
    }
    if (c4Full(board)) { over = true; scored = 'draw'; c4Score.draw++; status.textContent = 'Draw: the board is full.'; render(); return true; }
    return false;
  }

  function play(c, who) { board[c].push(who); last = [c, board[c].length - 1]; hint = null; }

  function botMove() {
    const t0 = performance.now(), res = c4Think(board, c4Depth), ms = Math.max(1, Math.round(performance.now() - t0));
    const why = c4Explain(board, res, c4Depth);
    scores = res.scores; best = res.best;
    play(res.best, BOT);
    think.textContent = `${why} It checked ${num(res.nodes)} positions in ${ms} ms.`;
    if (finish(res.best, BOT)) return;
    turn = HUMAN;
    status.textContent = 'Your move.';
    render();
  }

  function queueBot() {
    turn = BOT;
    status.textContent = 'Bot is thinking…';
    render();
    timer = setTimeout(botMove, reduced() ? 0 : 280);
  }

  function humanMove(c) {
    if (over || turn !== HUMAN || board[c].length >= ROWS) return;
    history.push({ board: copy(board), last, scores, best });
    play(c, HUMAN);
    if (finish(c, HUMAN)) { think.textContent = 'Start a new game, or undo to try another line.'; return; }
    queueBot();
  }

  function reset(botFirst) {
    clearTimeout(timer);
    board = c4Empty(); over = false; last = null; scores = Array(COLS).fill(null); best = -1; hint = null; history = []; scored = null;
    turn = HUMAN;
    status.textContent = 'Your move.';
    think.textContent = 'Click a column, or Tab to the board, move with the arrow keys and press Enter.';
    if (botFirst) queueBot(); else render();
  }

  el.addEventListener('click', e => { const b = e.target.closest('button'); if (b) humanMove(+b.dataset.col); });
  el.addEventListener('keydown', e => {
    const i = cols.indexOf(document.activeElement);
    const j = e.key === 'ArrowLeft' ? i - 1 : e.key === 'ArrowRight' ? i + 1 : -1;
    if (i >= 0 && j >= 0 && j < COLS) { cols[j].focus(); e.preventDefault(); }
  });
  $('#c4-depth').addEventListener('click', e => {
    const b = e.target.closest('[data-depth]');
    if (!b) return;
    c4Depth = +b.dataset.depth;
    render();
  });
  $('#c4-new').addEventListener('click', () => reset(false));
  $('#c4-botfirst').addEventListener('click', () => reset(true));
  $('#c4-hint').addEventListener('click', () => {
    const res = c4Think(board, 6, HUMAN), s = res.scores[res.best];
    hint = res.best;
    think.textContent = `Try column ${res.best + 1}. ${s >= C4.WIN / 2 ? 'It leads to a forced win for you.' : s <= -C4.WIN / 2 ? 'Every move loses against perfect play, but this one holds out longest.' : 'It scores best from your side, looking 6 moves ahead.'}`;
    render();
  });
  $('#c4-undo').addEventListener('click', () => {
    if (!history.length) return;
    clearTimeout(timer);
    if (scored) { c4Score[scored]--; scored = null; }
    ({ board, last, scores, best } = history.pop());
    over = false; turn = HUMAN; hint = null;
    status.textContent = 'Turn undone. Try another move.';
    think.textContent = 'The board is back to before your last move.';
    render();
  });
  reset(false);
  cleanup = () => clearTimeout(timer);
}

/* ---------- 03 Tic-tac-toe with a perfect bot ---------- */
const tttScore = { you: 0, bot: 0, draw: 0 };

function ticTacToeLab() {
  content.innerHTML = `
    <h2 id="dialog-title">Your move, <em>human.</em></h2>
    <p class="subtext">You’re ×, the bot is ○. Play, undo a turn, or reveal what every move leads to.</p>
    <div class="lab-body">
      <div>
        <div class="ttt" id="ttt" role="group" aria-label="Tic-tac-toe board"></div>
        <p class="status-line" id="ttt-status" role="status" aria-live="polite">Your turn. Make the first move.</p>
        <div class="tools-row">
          <button class="quiet" type="button" id="ttt-hint">Suggest a move</button>
          <button class="quiet" type="button" id="ttt-undo">Undo turn ↶</button>
          <button class="quiet" type="button" id="ttt-values" aria-pressed="false">Show outcomes</button>
        </div>
      </div>
      <aside>
        <span class="control-label" id="ttt-mode-label">Bot strategy</span>
        <div class="chips" id="ttt-mode" role="group" aria-labelledby="ttt-mode-label">
          <button type="button" data-mode="optimal" aria-pressed="true">Optimal · minimax</button>
          <button type="button" data-mode="casual" aria-pressed="false">Casual · random</button>
        </div>
        <div class="tools-row"><button class="quiet" type="button" id="ttt-new">Start a new game ↻</button></div>
        <p class="score" id="ttt-score" aria-live="polite"></p>
        <div class="explanation"><h3>INSIDE THE BOT’S HEAD</h3><p id="ttt-reason">Minimax searches every future move. Show outcomes to see whether each square leads to a win, draw or loss when both sides play perfectly.</p></div>
      </aside>
    </div>
    <p class="insight">Hints and outcomes assume perfect play from both sides. Against the optimal bot the best you can do is draw. Undo restores the board to before your last move.</p>`;

  const boardEl = $('#ttt'), status = $('#ttt-status'), reason = $('#ttt-reason');
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
      let label = `Row ${Math.floor(i / 3) + 1}, column ${i % 3 + 1}, ${board[i] === 'X' ? 'yours' : board[i] === 'O' ? 'bot' : 'empty'}`;
      const value = options.find(v => v.index === i);
      if (value) {
        const cap = document.createElement('span');
        cap.className = `move-value ${value.label.toLowerCase()}`;
        cap.textContent = value.label;
        b.append(cap);
        label += `, leads to a ${value.label.toLowerCase()}`;
      }
      b.setAttribute('aria-label', label);
    });
    $('#ttt-hint').disabled = busy || finished;
    $('#ttt-undo').disabled = !history.length;
    $('#ttt-values').disabled = busy || finished;
    $('#ttt-values').setAttribute('aria-pressed', String(showValues));
    $('#ttt-values').textContent = showValues ? 'Hide outcomes' : 'Show outcomes';
    $$('#ttt-mode button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
    $('#ttt-score').textContent = `THIS SESSION · You ${tttScore.you} / Bot ${tttScore.bot} / Draws ${tttScore.draw}`;
  }

  function end() {
    const result = outcome(board);
    if (!result) return false;
    finished = true;
    scored = result.winner === 'draw' ? 'draw' : result.winner === 'X' ? 'you' : 'bot';
    tttScore[scored]++;
    status.textContent = scored === 'draw' ? 'A draw. Well played.' : scored === 'you' ? 'You won! Nicely done.' : 'The bot wins. Try another strategy?';
    render();
    return true;
  }

  function play(i) {
    if (busy || finished || board[i]) return;
    history.push([...board]);
    board[i] = 'X';
    if (end()) return;
    busy = true;
    status.textContent = 'Bot is considering its move…';
    render();
    timer = setTimeout(() => {
      const move = botMove(board, mode);
      if (move) { board[move.index] = 'O'; reason.textContent = `Square ${move.index + 1}: ${move.reason}`; }
      busy = false;
      if (!end()) { status.textContent = 'Your turn. What will you try?'; render(); }
    }, reduced() ? 0 : 220);
  }

  function reset() {
    clearTimeout(timer);
    board = Array(9).fill(''); busy = false; finished = false; history = []; scored = null;
    status.textContent = 'Your turn. Make the first move.';
    reason.textContent = 'Show outcomes to inspect the game tree, or ask for a suggested move.';
    render();
  }

  $('#ttt-new').addEventListener('click', reset);
  $('#ttt-mode').addEventListener('click', e => { const b = e.target.closest('[data-mode]'); if (b) { mode = b.dataset.mode; reset(); } });
  $('#ttt-values').addEventListener('click', () => { showValues = !showValues; render(); });
  $('#ttt-hint').addEventListener('click', () => {
    const best = humanMoves(board)[0];
    if (!best) return;
    render();
    buttons[best.index].classList.add('hint');
    reason.textContent = `Try square ${best.index + 1} (row ${Math.floor(best.index / 3) + 1}, column ${best.index % 3 + 1}). Best guaranteed outcome: ${best.label.toLowerCase()}, if both sides play perfectly.`;
  });
  $('#ttt-undo').addEventListener('click', () => {
    if (!history.length) return;
    clearTimeout(timer);
    if (scored) { tttScore[scored]--; scored = null; }
    board = history.pop(); busy = false; finished = false;
    status.textContent = 'Turn undone. Try another move.';
    reason.textContent = 'The board is back to before your last move. Explore a different branch of the game.';
    render();
  });
  reset();
  cleanup = () => clearTimeout(timer);
}

/* ---------- 04 Pathfinding: BFS vs A* ---------- */
function pathLab() {
  content.innerHTML = `
    <h2 id="dialog-title">Find a way <em>through.</em></h2>
    <p class="subtext">Draw walls, move the start or goal, then run or compare the searches. With a keyboard, use the arrow keys and Space on the grid.</p>
    <div class="toolbar">
      <label><span class="control-label">Algorithm</span><select id="algorithm"><option value="bfs">Breadth-first search</option><option value="astar">A* · Manhattan distance</option></select></label>
      <label><span class="control-label">Animation</span><select id="speed"><option value="14">Quick</option><option value="40">Step by step</option><option value="0">Instant</option></select></label>
      <button class="button primary" type="button" id="run-path">Find a path →</button>
      <button class="quiet" type="button" id="compare-paths">Compare BFS &amp; A*</button>
    </div>
    <div class="edit-tools">
      <span>EDIT</span>
      <button class="quiet" type="button" data-edit="walls" aria-pressed="true">Draw walls</button>
      <button class="quiet" type="button" data-edit="start" aria-pressed="false">Move start</button>
      <button class="quiet" type="button" data-edit="goal" aria-pressed="false">Move goal</button>
      <button class="quiet" type="button" id="clear-path">Clear walls</button>
      <button class="quiet" type="button" id="maze">Example maze</button>
    </div>
    <div class="path-grid" id="path-grid" role="group" aria-label="Editable pathfinding grid"></div>
    <div class="compare-results" id="compare-results" aria-live="polite"></div>
    <div class="legend"><span style="--key:var(--green)">Start</span><span style="--key:var(--accent)">Goal</span><span style="--key:var(--wall)">Wall</span><span style="--key:var(--explored)">Explored</span><span style="--key:var(--accent-soft)">Shortest path</span></div>
    <p class="path-status" id="path-status" role="status" aria-live="polite">Ready. Make a maze, then run a search.</p>
    <p class="insight">Breadth-first search expands level by level. A* prioritises the distance travelled so far plus an estimate of the distance left. On this unweighted grid both find a shortest path; A* usually explores fewer cells.</p>`;

  const width = 17, height = 9, grid = $('#path-grid'), status = $('#path-status');
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
      c.textContent = i === start ? 'S' : i === goal ? 'G' : '';
      c.disabled = running;
      c.setAttribute('aria-label', `Row ${Math.floor(i / width) + 1}, column ${i % width + 1}: ${i === start ? 'start' : i === goal ? 'goal' : walls.has(i) ? 'wall' : 'open'}`);
    });
  }
  function setRunning(value) {
    running = value;
    $$('[data-edit], #compare-paths, #run-path, #clear-path, #maze, #algorithm, #speed').forEach(b => { b.disabled = value; });
    cells.forEach(c => { c.disabled = value; });
  }
  function edited() { draw(); $('#compare-results').replaceChildren(); status.textContent = `${walls.size} walls. Ready for a new search.`; }
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
    status.textContent = 'Example maze loaded. Compare both algorithms on the same grid.';
  }

  const endPaint = () => { painting = false; };
  document.addEventListener('pointerup', endPaint);
  document.addEventListener('pointercancel', endPaint);

  $$('[data-edit]').forEach(b => b.addEventListener('click', () => {
    editMode = b.dataset.edit;
    $$('[data-edit]').forEach(t => t.setAttribute('aria-pressed', String(t === b)));
    status.textContent = editMode === 'walls' ? 'Draw or erase walls. Drag with a mouse; tap on touchscreens.' : `Click any open square to move the ${editMode}.`;
  }));
  $('#compare-paths').addEventListener('click', () => {
    const bfs = findPath({ width, height, start, goal, walls }), astar = findPath({ width, height, start, goal, walls, algorithm: 'astar' });
    $('#compare-results').innerHTML = [['Breadth-first search', bfs], ['A*', astar]].map(([name, r]) =>
      `<div class="compare-result"><strong>${name}</strong>${r.visited.length} cells explored<br>${r.path.length ? `${r.path.length - 1} steps in the shortest path` : 'No path available'}</div>`).join('');
    status.textContent = bfs.path.length ? 'Same maze, same shortest path length. Compare how many cells each search explored.' : 'Neither search found a route. Remove a wall or move an endpoint.';
  });
  $('#clear-path').addEventListener('click', () => { walls.clear(); edited(); status.textContent = 'Walls cleared. Click or drag to draw a new maze.'; });
  $('#maze').addEventListener('click', example);
  $('#algorithm').addEventListener('change', () => { draw(); status.textContent = 'Algorithm changed. Run the search to see it.'; });
  $('#run-path').addEventListener('click', async () => {
    draw();
    setRunning(true);
    const mine = ++version, algorithm = $('#algorithm').value, delay = reduced() ? 0 : +$('#speed').value;
    const result = findPath({ width, height, start, goal, walls, algorithm });
    status.textContent = 'Searching…';
    for (const i of result.visited) {
      if (mine !== version) return;
      if (i !== start && i !== goal) cells[i].classList.add('visited');
      if (delay) await new Promise(r => setTimeout(r, delay));
    }
    if (mine !== version) return;
    result.path.forEach(i => { if (i !== start && i !== goal) cells[i].classList.add('route'); });
    status.textContent = result.path.length
      ? `${algorithm === 'astar' ? 'A*' : 'Breadth-first search'} explored ${result.visited.length} cells. Shortest path: ${result.path.length - 1} steps.`
      : `No path found after exploring ${result.visited.length} cells. Remove a wall and try again.`;
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

/* ---------- 05 Request simulator ---------- */
function requestLab() {
  content.innerHTML = `
    <h2 id="dialog-title">Where does the <em>waiting happen?</em></h2>
    <p class="subtext">Change the workload, pick a request strategy, and watch an interface get its data. The same idea sits behind the 40% speed-up from merging APIs at AIO Tests.</p>
    <div class="request-body">
      <div class="request-controls">
        <div><label class="range-label" for="req-count">Data items <output id="req-count-out" for="req-count">6</output></label><input id="req-count" type="range" min="1" max="12" value="6"></div>
        <div><label class="range-label" for="req-latency">Network latency <output id="req-latency-out" for="req-latency">120 ms</output></label><input id="req-latency" type="range" min="20" max="300" step="10" value="120"></div>
        <div>
          <span class="control-label" id="req-strategy-label">Request strategy</span>
          <div class="strategy" id="req-strategy" role="group" aria-labelledby="req-strategy-label">
            <button type="button" data-strategy="sequential">One at a time <span aria-hidden="true">→</span></button>
            <button type="button" data-strategy="parallel">Parallel · 3 lanes <span aria-hidden="true">⇉</span></button>
            <button type="button" data-strategy="batch">One batch <span aria-hidden="true">⊞</span></button>
          </div>
        </div>
        <button class="button primary" type="button" id="req-run">Replay requests <span aria-hidden="true">↻</span></button>
      </div>
      <div class="request-chart">
        <div class="request-metrics" aria-live="polite" aria-atomic="true">
          <div><output id="req-time">–</output><span>MODELLED COMPLETION</span></div>
          <div><output class="saving" id="req-saving">–</output><span>LESS WAITING THAN ONE AT A TIME</span></div>
        </div>
        <div class="waterfall" id="waterfall"></div>
        <div class="request-axis"><span>0 ms</span><span id="req-axis-end"></span></div>
        <div class="request-legend"><span>Network latency</span><span>Processing · ${PROCESSING_MS} ms per item</span></div>
        <p class="request-explanation" id="req-explanation"></p>
      </div>
    </div>
    <p class="insight">An illustrative model: equal payloads, fixed latency, ${PROCESSING_MS} ms of processing per item, no caching or bandwidth limits. Parallel mode allows up to three requests at once; batch mode processes items one after another on the server. Not a benchmark of employer systems.</p>`;

  let strategy = 'sequential', frame = 0;
  const EXPLAIN = {
    sequential: 'Each request waits for the one before it, so the network latency is paid once per item, back to back.',
    parallel: 'Three requests travel at once. Each still pays the latency, but independent work overlaps.',
    batch: 'One round trip carries every item. The server still spends 40 ms per item, but you only wait on the network once.'
  };
  function render(animate = false) {
    const count = +$('#req-count').value, latency = +$('#req-latency').value, model = requestModel(count, latency, strategy);
    $('#req-count-out').textContent = count;
    $('#req-latency-out').textContent = `${latency} ms`;
    $('#req-time').textContent = `${num(model.total)} ms`;
    $('#req-saving').textContent = `${Math.round(100 * (1 - model.total / model.baseline))}%`;
    $('#req-axis-end').textContent = `${num(model.baseline)} ms`;
    $$('#req-strategy button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.strategy === strategy)));
    const chart = $('#waterfall');
    chart.classList.remove('is-running');
    chart.innerHTML = model.requests.map((r, i) => `
      <div class="request-row"><span>${strategy === 'batch' ? 'BATCH' : `REQ ${i + 1}`}</span>
        <div class="request-track"><div class="request-bar" style="--left:${100 * r.start / model.baseline}%;--width:${100 * r.duration / model.baseline}%;--network:${100 * latency / r.duration}%;--duration:${r.duration};--start:${r.start}"><span class="network"></span></div></div>
      </div>`).join('');
    chart.setAttribute('aria-label', `${strategy} strategy: ${model.requests.length} request${model.requests.length > 1 ? 's' : ''}, ${model.total} milliseconds in total.`);
    $('#req-explanation').textContent = EXPLAIN[strategy];
    if (animate) { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => chart.classList.add('is-running')); }
  }
  ['#req-count', '#req-latency'].forEach(s => $(s).addEventListener('input', () => render()));
  $('#req-strategy').addEventListener('click', e => { const b = e.target.closest('[data-strategy]'); if (b) { strategy = b.dataset.strategy; render(true); } });
  $('#req-run').addEventListener('click', () => render(true));
  render(true);
  cleanup = () => cancelAnimationFrame(frame);
}

/* ---------- 06 Guided résumé assistant ---------- */
function askLab() {
  content.innerHTML = `
    <h2 id="dialog-title">Meet the <em>engineer.</em></h2>
    <p class="subtext">A quick, guided tour of my background. Pick a topic or type a question.</p>
    <div class="chat-log" id="chat-log" role="log" aria-label="Conversation" aria-live="polite"></div>
    <div class="chips chat-options">
      ${['Work experience', 'AI & agents', 'Skills & tools', 'Education', 'Projects', 'Contact'].map(t => `<button type="button">${t}</button>`).join('')}
    </div>
    <form class="chat-form" id="chat-form">
      <input type="text" aria-label="Your question" placeholder="What would you like to know?" maxlength="400" autocomplete="off" required>
      <button class="button primary" type="submit">Ask <span aria-hidden="true">↑</span></button>
    </form>
    <p class="insight">A guided assistant: prepared answers matched to topics from my résumé. No language model, no external service. Your questions stay in this page and are cleared when you close it.</p>`;
  const log = $('#chat-log');
  const add = (text, user = false) => {
    const bubble = document.createElement('div');
    bubble.className = 'bubble' + (user ? ' user' : '');
    bubble.textContent = text;
    log.append(bubble);
    log.scrollTop = log.scrollHeight;
  };
  const ask = q => { if (!q.trim()) return; add(q, true); add(resumeAnswer(q)); };
  add('Hi! Ask about Siddharth’s experience, AI work, skills, education or projects. Pick a topic below or type a question.');
  $('#chat-form').addEventListener('submit', e => {
    e.preventDefault();
    const input = $('input', e.target);
    ask(input.value.trim());
    input.value = '';
    input.focus();
  });
  $$('.chat-options button').forEach(b => b.addEventListener('click', () => ask(b.textContent)));
}

/* ---------- skill explorer ---------- */
const SKILLS = [
  { name: 'Frontend', tools: 'Vue.js · TypeScript · Quasar', title: 'A foundation that scales.', text: 'Led the Vue 2 → Vue 3 and TypeScript migration at AIO Tests, reworking 100+ components, and built 50+ reusable UI components used across the product.', actions: [{ label: 'Read about the migration', row: 0 }] },
  { name: 'Backend', tools: 'Java · SQL · Querydsl', title: 'Less waiting. More doing.', text: 'Built Java services for large PDF exports, imports and migrations. Merged APIs and rewrote heavy Querydsl queries for up to 40% faster workflows.', actions: [{ label: 'Try the request simulator', lab: 'requests' }, { label: 'Read more', row: 1 }] },
  { name: 'Applied & agentic AI', tools: 'Azure OpenAI · MCP · Sandboxing', title: 'AI inside the workflow.', text: 'Shipped generative AI features on Azure OpenAI from prompt design to production. At the Black Forest Hackathon, built Code Mode: agents write a script that runs next to the data, so only the answer reaches the model.', actions: [{ label: 'Run Code Mode on toy data', lab: 'codemode' }, { label: 'Read the case study', href: '#code-mode' }] },
  { name: 'Algorithms', tools: 'Minimax · Alpha-beta · BFS · A*', title: 'Try the idea. Inspect the logic.', text: 'Two game bots and a pathfinding lab, built for this portfolio with help from AI coding assistants. Each one shows its reasoning, so you can check it.', actions: [{ label: 'Play Connect Four', lab: 'c4' }, { label: 'Draw a maze', lab: 'path' }] },
  { name: 'Testing', tools: 'Java · Selenium · JMeter', title: 'Confidence under load.', text: 'As an SDET intern at Frugal Testing, load-tested auction and banking sites at 1,000+ concurrent users, wrote end-to-end Selenium suites, and mentored the next group of interns.', actions: [{ label: 'Read about the internship', row: 3 }] },
  { name: 'Hardware', tools: 'Raspberry Pi · Arduino · ESP8266', title: 'Code, out in the world.', text: 'Built a networked 3D printer with Raspberry Pi and OctoPi, an autonomous delivery robot with Arduino, ESP8266 and Firebase, and an AR app with Unity.', actions: [{ label: 'See the earlier experiments', href: '#earlier' }] }
];
const tabs = SKILLS.map((skill, i) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.id = `skill-tab-${i}`;
  b.textContent = skill.name;
  b.setAttribute('role', 'tab');
  b.setAttribute('aria-controls', 'skill-evidence');
  b.addEventListener('click', () => selectSkill(i));
  b.addEventListener('keydown', e => {
    const n = SKILLS.length;
    const next = { ArrowRight: (i + 1) % n, ArrowLeft: (i + n - 1) % n, Home: 0, End: n - 1 }[e.key];
    if (next !== undefined) { e.preventDefault(); selectSkill(next); tabs[next].focus(); }
  });
  $('.skill-tabs').append(b);
  return b;
});
function selectSkill(index) {
  const skill = SKILLS[index], panel = $('#skill-evidence');
  tabs.forEach((b, i) => { b.setAttribute('aria-selected', String(i === index)); b.tabIndex = i === index ? 0 : -1; });
  panel.setAttribute('aria-labelledby', tabs[index].id);
  panel.innerHTML = `<span class="caption">${esc(skill.tools)}</span><h4>${esc(skill.title)}</h4><p>${esc(skill.text)}</p>
    <p style="display:flex;flex-wrap:wrap;gap:8px 22px;margin:0">${skill.actions.map(a => a.lab
      ? `<button type="button" class="as-link" data-open="${a.lab}">${esc(a.label)} ↗</button>`
      : a.href ? `<a href="${a.href}">${esc(a.label)} ↘</a>`
      : `<button type="button" class="as-link" data-row="${a.row}">${esc(a.label)} ↘</button>`).join('')}</p>`;
}
$('#skill-evidence').addEventListener('click', e => {
  const b = e.target.closest('[data-row]');
  if (!b) return;
  const row = $$('.rows details')[+b.dataset.row];
  row.open = true;
  scrollToEl(row);
  $('summary', row).focus({ preventScroll: true });
});
selectSkill(0);

/* ---------- quick navigation (Cmd/Ctrl + K) ---------- */
const COMMANDS = [
  { title: 'Run Code Mode on toy data', type: 'Experiment', keywords: 'agentic ai mcp sandbox tokens code mode', lab: 'codemode' },
  { title: 'Play Connect Four', type: 'Experiment', keywords: 'game minimax alpha beta bot connect four', lab: 'c4' },
  { title: 'Play tic-tac-toe', type: 'Experiment', keywords: 'game minimax tic tac toe bot', lab: 'ttt' },
  { title: 'Draw a maze', type: 'Experiment', keywords: 'pathfinding bfs astar a* algorithms maze', lab: 'path' },
  { title: 'Tune request performance', type: 'Experiment', keywords: 'backend network api java latency performance', lab: 'requests' },
  { title: 'Ask about Siddharth', type: 'Guided assistant', keywords: 'chat resume questions background', lab: 'ask' },
  { title: 'Code Mode case study', type: 'Recent project', keywords: 'hackathon agentic ai mcp anythingmcp black forest', target: '#code-mode' },
  { title: 'Work experience', type: 'Section', keywords: 'frontend vue typescript java career aio tests jira', target: '#work' },
  { title: 'Skills and evidence', type: 'Section', keywords: 'skills stack tools', target: '.explorer' },
  { title: 'About and education', type: 'Section', keywords: 'education msc darmstadt background', target: '#about' },
  { title: 'Earlier hardware projects', type: 'Projects', keywords: 'printer robot ar hardware', target: '#earlier' },
  { title: 'Get in touch', type: 'Contact', keywords: 'email hire werkstudent working student internship', target: '#contact' },
  { title: 'Download résumé', type: 'PDF', keywords: 'cv resume download', href: 'assets/Resume_Siddharth_Agarwal.pdf' }
];
const command = $('#command-dialog'), search = $('#command-search'), results = $('#command-results');
let commandTrigger = null;

function renderCommands() {
  const query = search.value.toLowerCase().trim();
  const matches = COMMANDS.filter(c => `${c.title} ${c.type} ${c.keywords}`.toLowerCase().includes(query));
  results.replaceChildren();
  if (!matches.length) {
    const p = document.createElement('p');
    p.textContent = 'No match. Try “game”, “AI” or “contact”.';
    p.className = 'muted';
    results.append(p);
  }
  for (const item of matches) {
    const b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = `<span>${esc(item.title)}</span><small>${esc(item.type.toUpperCase())} ↗</small>`;
    b.addEventListener('click', () => {
      command.close();
      if (item.lab) openLab(item.lab, commandTrigger);
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
