import test from 'node:test';
import assert from 'node:assert/strict';
import {
  botMove, outcome, humanMoves, findPath, resumeAnswer, requestModel,
  C4, c4Empty, c4Think, c4WinLine, CODE_QUESTIONS, makeShopData, makeShopTools, runCodeQuestion
} from '../js/engine.mjs';

test('optimal tic-tac-toe bot never loses against any human move sequence', () => {
  let endings = 0;
  function walk(board) {
    const result = outcome(board);
    if (result) { assert.notEqual(result.winner, 'X'); endings++; return; }
    for (let i = 0; i < 9; i++) {
      if (board[i]) continue;
      const next = [...board];
      next[i] = 'X';
      if (outcome(next)) { walk(next); continue; }
      const move = botMove(next);
      assert.equal(next[move.index], '');
      next[move.index] = 'O';
      walk(next);
    }
  }
  walk(Array(9).fill(''));
  assert.ok(endings > 100);
});

test('tic-tac-toe bot takes wins, blocks threats, and does not mutate input', () => {
  const board = ['O', 'O', '', 'X', 'X', '', 'X', '', ''];
  const before = [...board];
  assert.equal(botMove(board).index, 2);
  assert.deepEqual(board, before);
  const block = botMove(['X', 'X', '', '', 'O', '', '', '', '']);
  assert.equal(block.index, 2);
  assert.match(block.reason, /blocked/);
  assert.match(botMove(['X', 'X', '', '', 'O', '', '', '', ''], 'optimal', Math.random, 'de').reason, /blockiert/);
});

test('human hints reveal forced wins and avoid immediate losses', () => {
  const win = ['X', 'X', '', 'O', 'O', '', '', '', ''];
  assert.equal(humanMoves(win)[0].index, 2);
  assert.equal(humanMoves(win)[0].label, 'Win');
  assert.equal(humanMoves(['O', 'O', '', 'X', '', '', '', 'X', ''])[0].index, 2);
  assert.ok(humanMoves(Array(9).fill('')).every(m => m.label === 'Draw'));
});

test('connect four bot takes an immediate win and blocks one', () => {
  const { HUMAN, BOT } = C4;
  const win = c4Empty();
  win[0] = [BOT, BOT, BOT];
  win[1] = [HUMAN, HUMAN, HUMAN];
  assert.equal(c4Think(win, 3).best, 0);

  const block = c4Empty();
  block[6] = [HUMAN, HUMAN, HUMAN];
  block[2] = [BOT];
  block[4] = [BOT];
  for (const depth of [3, 6]) assert.equal(c4Think(block, depth).best, 6);
});

test('connect four search leaves the board unchanged and detects lines', () => {
  const b = c4Empty();
  b[3] = [C4.HUMAN, C4.BOT];
  const before = JSON.stringify(b);
  const res = c4Think(b, 5);
  assert.equal(JSON.stringify(b), before);
  assert.ok(res.nodes > 0);
  const diag = c4Empty();
  diag[0] = [1]; diag[1] = [2, 1]; diag[2] = [2, 2, 1]; diag[3] = [2, 2, 2, 1];
  assert.equal(c4WinLine(diag, 3).length, 4);
});

test('BFS and A* agree on shortest paths with obstacles and unreachable goals', () => {
  for (let seed = 0; seed < 60; seed++) {
    const walls = new Set();
    for (let n = 1; n < 79; n++) if ((n * 37 + seed * 19) % 13 < 4) walls.add(n);
    const config = { width: 10, height: 8, start: 0, goal: 79, walls };
    const bfs = findPath(config), astar = findPath({ ...config, algorithm: 'astar' });
    assert.equal(bfs.path.length, astar.path.length);
    for (const result of [bfs, astar]) {
      for (let i = 1; i < result.path.length; i++) {
        const a = result.path[i - 1], b = result.path[i];
        assert.ok(!walls.has(b));
        assert.equal(Math.abs(a % 10 - b % 10) + Math.abs(Math.floor(a / 10) - Math.floor(b / 10)), 1);
      }
    }
  }
  assert.deepEqual(findPath({ width: 3, height: 3, start: 0, goal: 8, walls: new Set([1, 3]) }).path, []);
});

test('request model obeys lane capacity and completion-time arithmetic', () => {
  for (let count = 1; count <= 12; count++) {
    for (const latency of [20, 120, 300]) {
      const sequential = requestModel(count, latency), parallel = requestModel(count, latency, 'parallel'), batch = requestModel(count, latency, 'batch');
      assert.equal(sequential.total, count * (latency + 40));
      assert.equal(parallel.total, Math.ceil(count / 3) * (latency + 40));
      assert.equal(batch.total, latency + count * 40);
      for (let t = 0; t < parallel.total; t += 10) assert.ok(parallel.requests.filter(r => r.start <= t && r.start + r.duration > t).length <= 3);
    }
  }
});

test('code mode scripts answer from toy data in far fewer bytes than the raw tables', async () => {
  const data = makeShopData(2000), tools = makeShopTools(data);
  const first = await runCodeQuestion(CODE_QUESTIONS[0], tools);
  assert.equal(first.status, 'delayed');
  const second = await runCodeQuestion(CODE_QUESTIONS[1], tools);
  assert.equal(second.of, 2000);
  const third = await runCodeQuestion(CODE_QUESTIONS[2], tools);
  assert.equal(third.length, 3);
  for (const q of CODE_QUESTIONS) {
    const raw = q.raw.reduce((s, t) => s + JSON.stringify(data[t]).length, 0);
    const answer = JSON.stringify(await runCodeQuestion(q, tools)).length;
    assert.ok(raw > answer * 1000);
  }
});

test('assistant stays grounded and treats unknown content as unsupported', () => {
  assert.match(resumeAnswer('AI experience'), /Azure/);
  assert.match(resumeAnswer('Tell me about agentic AI'), /Code Mode/);
  assert.match(resumeAnswer('Does he do hackathons?'), /Smart India.*Black Forest/s);
  assert.match(resumeAnswer('Education'), /Darmstadt/);
  assert.match(resumeAnswer('Is he looking for a Werkstudent role?'), /Werkstudent/);
  assert.match(resumeAnswer('Is he available as a working student?'), /Werkstudent/);
  assert.match(resumeAnswer('What is his salary?'), /don’t have a verified answer/);
  assert.match(resumeAnswer('<script>alert(1)</script>'), /don’t have a verified answer/);
});

test('assistant understands German questions and answers in German', () => {
  assert.match(resumeAnswer('Welche Berufserfahrung hat er?', 'de'), /Navarambh/);
  assert.match(resumeAnswer('Sucht er eine Werkstudentenstelle?', 'de'), /20 Stunden/);
  assert.match(resumeAnswer('Was hat er studiert?', 'de'), /Master in Informatik/);
  assert.match(resumeAnswer('Welche Fähigkeiten hat er?', 'de'), /Kern-Stack/);
  assert.match(resumeAnswer('KI & Agenten', 'de'), /Code Mode/);
  assert.match(resumeAnswer('Hallo', 'de'), /Lebenslauf-Assistent/);
  assert.match(resumeAnswer('Wie hoch ist sein Gehalt?', 'de'), /keine verlässliche Antwort/);
  assert.match(resumeAnswer('Education', 'de'), /Technischen Universität/);
});
