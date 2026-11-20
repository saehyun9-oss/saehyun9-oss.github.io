'use strict';
/* AI 시대, 교사의 시간 — script.js
   Sections: 1 settings / 2 helpers / state / 3 Scene2 slot machine & graphs /
             4 curtain / 5 Scene3 interview / 6 scene navigation */

/* ---------------- 1. 설정값 ---------------- */
const IMG_DIR = 'images/';
const STUDENT_COUNT = 20;         // 학생 수
const MIN_INTERVIEWS = 10;        // 이 인원 이상 면담하면 다음 단계 선택지가 나타남
const CELL_H = 210;               // slot cell height (px); matches --cell-h in style.css
const WALK_STOP = '38%';          // Scene3 에서 학생이 멈추는 가로 위치

// students.png is a single sheet of 20 portraits; each cell is cropped with CSS background-position.
// All values are ratios of the whole image (0 ~ 1).
const SHEET = {
  file: 'students.png',
  cols: 4, rows: 5,
  aspect: 768 / 1536,                          // 이미지 가로/세로 비율
  colCenters: [0.13, 0.37, 0.62, 0.87],// 각 열의 가운데 가로 위치
  rowCenters: [0.12, 0.338, 0.537, 0.716, 0.897], // 각 줄의 가운데 세로 위치
  cw: 0.234, ch: 0.164                         // 잘라낼 칸의 가로/세로 크기
};

// Grade-change graph for each student (0 = low, 1 = high)
const GRAPHS = [
  [0.10,0.40,0.30,0.60,0.55,0.90,0.95],
  [0.10,0.30,0.20,0.45,0.40,0.70,0.95],
  [0.10,0.70,0.40,0.80,0.55,0.95,0.80],
  [0.10,0.95,0.60,0.45,0.50,0.35,0.10],
  [0.15,0.60,0.35,0.75,0.50,0.80,0.55],
  [0.50,0.50,0.50,0.50,0.50,0.50,0.50],
  [0.50,0.50,0.50,0.50,0.50,0.50,0.50],
  [0.55,0.95,0.70,0.10,0.45,0.75,0.60],
  [0.10,0.50,0.30,0.85,0.60,0.95,0.75],
  [0.40,0.55,0.35,0.60,0.95,0.30,0.55],
  [0.05,0.35,0.20,0.65,0.50,0.85,0.95],
  [0.95,0.70,0.85,0.50,0.60,0.25,0.15],
  [0.90,0.95,0.10,0.55,0.30,0.50,0.25],
  [0.10,0.30,0.95,0.70,0.80,0.50,0.40],
  [0.10,0.10,0.95,0.40,0.85,0.30,0.10],
  [0.10,0.90,0.60,0.40,0.55,0.35,0.30],
  [0.30,0.60,0.45,0.90,0.40,0.20,0.35],
  [0.20,0.50,0.70,0.40,0.80,0.60,0.90],
  [0.80,0.60,0.75,0.30,0.45,0.20,0.10],
  [0.25,0.45,0.35,0.55,0.50,0.65,0.60]
];

/* ---------------- 2. Helpers ---------------- */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const wait = ms => new Promise(r => setTimeout(r, ms));
const pad = n => String(n).padStart(2, '0');

// Insert an <img> into every [data-file] element; mark it .missing if the file fails to load.
function buildPic(el) {
  const img = new Image();
  img.alt = '';
  img.onerror = () => { el.classList.add('missing'); img.remove(); };
  img.src = IMG_DIR + el.dataset.file;
  el.appendChild(img);
}

// Show only one region of a multi-pose image (e.g. boss.png).
function buildCrop(el) {
  const d = el.dataset;
  const cx = +d.cx, cy = +d.cy, cw = +d.cw, ch = +d.ch, imgAspect = +d.aspect;
  el.style.backgroundImage = `url(${IMG_DIR}${d.crop})`;
  el.style.backgroundSize = `${100 / cw}% ${100 / ch}%`;
  const px = cw >= 1 ? 0 : (cx - cw / 2) / (1 - cw) * 100;
  const py = ch >= 1 ? 0 : (cy - ch / 2) / (1 - ch) * 100;
  el.style.backgroundPosition = `${px}% ${py}%`;
  el.style.aspectRatio = String(cw * imgAspect / ch);
  probe(d.crop).then(ok => { if (!ok) el.classList.add('missing'); });
}

function probe(file) {
  return new Promise(res => {
    const im = new Image();
    im.onload = () => res(true);
    im.onerror = () => res(false);
    im.src = IMG_DIR + file;
  });
}

// Try each file in order and use the first one that loads.
function makeImg(files) {
  const wrap = document.createElement('div');
  wrap.className = 'pic';
  const img = new Image();
  let k = 0;
  img.onerror = () => {
    k++;
    if (k < files.length) img.src = IMG_DIR + files[k];
    else { wrap.classList.add('missing'); img.remove(); }
  };
  img.src = IMG_DIR + files[0];
  wrap.appendChild(img);
  return wrap;
}

// Restart the text animation
function replay(el) {
  el.classList.remove('play');
  void el.offsetWidth;
  el.classList.add('play');
}

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

/* ---------------- State ---------------- */
const state = {
  scene: 1, step: 0,
  done: new Set(),        // interviewed student indexes
  selected: null,         // student currently being interviewed
  slotStarted: false,
  busy: false,            // ignore input during transitions
  canFinish: false,       // Scene3: interview can be ended
  choseYes: false         // Scene5: article was opened
};

const students = Array.from({ length: STUDENT_COUNT }, (_, i) => ({
  id: i, name: '학생 ' + pad(i + 1), graph: GRAPHS[i]
}));

/* ---------------- 3. Scene2: slot-machine entrance + graph motion ---------------- */
function portraitStyle(el, i) {
  const col = i % SHEET.cols, row = Math.floor(i / SHEET.cols);
  const { cw, ch } = SHEET;
  const cx = SHEET.colCenters[col], cy = SHEET.rowCenters[row];
  el.style.backgroundImage = `url(${IMG_DIR}${SHEET.file})`;
  el.style.backgroundSize = `${100 / cw}% ${100 / ch}%`;
  el.style.backgroundPosition = `${(cx - cw / 2) / (1 - cw) * 100}% ${(cy - ch / 2) / (1 - ch) * 100}%`;
}

function faceCell(idx) {
  const c = document.createElement('div');
  c.className = 'cell';
  const n = document.createElement('span');
  n.className = 'num';
  n.textContent = pad(idx + 1);
  n.style.setProperty('--h', idx * 37);
  const f = document.createElement('div');
  f.className = 'face';
  portraitStyle(f, idx);
  c.append(n, f);
  return c;
}

function blankCell() {
  const c = document.createElement('div');
  c.className = 'cell blank';
  return c;
}

function buildGrid() {
  const grid = $('#grid');
  students.forEach((s, i) => {
    const card = document.createElement('div');
    card.className = 'card locked';
    card.dataset.i = i;
    card.innerHTML = `<div class="pair"><div class="win face-win"></div><div class="win graph-win"></div></div><div class="name">${s.name}</div>`;
    card.onclick = () => pickStudent(i);
    grid.appendChild(card);
  });
}

// Spin a strip fast, then ease to a slow stop (slot machine)
function spinStrip(strip, count, duration) {
  strip.style.transition = 'none';
  strip.style.transform = 'translateY(0px)';
  strip.classList.add('spin');                 // blur while spinning
  void strip.offsetHeight;
  // fast start, long slow stop
  strip.style.transition = `transform ${duration}ms cubic-bezier(.12,.8,.16,1)`;
  strip.style.transform = `translateY(${-(count - 1) * CELL_H}px)`;
  setTimeout(() => strip.classList.remove('spin'), duration * 0.5);
  return wait(duration + 50);
}

// Draw the red line into the empty box (stroke-dashoffset animation)
function drawGraph(win, data) {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('class', 'graph');
  const pts = data.map((v, i) => [10 + i * (80 / (data.length - 1)), 88 - v * 76]);
  const path = document.createElementNS(NS, 'path');
  path.setAttribute('d', 'M ' + pts.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L '));
  path.setAttribute('pathLength', '1');
  path.setAttribute('class', 'line');
  svg.appendChild(path);
  win.appendChild(svg);
  path.getBoundingClientRect();                // commit start state
  path.classList.add('draw');                  // start drawing
}

async function playSlot() {
  const ok = await probe(SHEET.file);
  $('#grid').classList.toggle('nosheet', !ok);

  $$('.card').forEach((card, i) => {
    const faceWin = $('.face-win', card);
    const graphWin = $('.graph-win', card);
    const FACE_COUNT = 16, BLANK_COUNT = 12;

    const fs = document.createElement('div');
    fs.className = 'strip';
    for (let k = 0; k < FACE_COUNT; k++) {
      let idx = Math.floor(Math.random() * STUDENT_COUNT);
      if (k === FACE_COUNT - 1) idx = i;       // last cell is this card's student
      fs.appendChild(faceCell(idx));
    }
    faceWin.appendChild(fs);

    const gs = document.createElement('div');
    gs.className = 'strip';
    for (let k = 0; k < BLANK_COUNT; k++) gs.appendChild(blankCell());
    graphWin.appendChild(gs);

    const duration = 2300 + i * 130;           // later cards stop later
    spinStrip(fs, FACE_COUNT, duration);
    spinStrip(gs, BLANK_COUNT, duration).then(() => {
      drawGraph(graphWin, students[i].graph);
      card.classList.remove('locked');         // clickable once stopped
    });
  });
}

function updateCount() {
  $('#count').textContent = `면담 ${state.done.size} / ${STUDENT_COUNT}`;
  $('#finishBtn').classList.toggle('hidden', state.done.size < MIN_INTERVIEWS);
  $$('.card').forEach((c, i) => c.classList.toggle('done', state.done.has(i)));  // interviewed students turn grayscale
}

function pickStudent(i) {
  const card = $$('.card')[i];
  if (state.busy || state.scene !== 2) return;
  if (card.classList.contains('locked') || state.done.has(i)) return;
  startInterview(i);
}

/* ---------------- 4. Curtain (fade in / out) ---------------- */
const curtain = $('#curtain');
function curtainClose() { curtain.classList.add('closed'); return wait(980); }
function curtainOpen()  { curtain.classList.remove('closed'); return wait(980); }

/* ---------------- 5. Scene3: interview ---------------- */
const S3 = {
  crowd: $('#s3-crowd'), room: $('#s3-room'), walker: $('#walker'),
  flip: $('#walker .flipper'), body: $('#walker .body'),
  bubble: $('#bubble'), hint: $('#s3-hint')
};

function sideFiles(i) {
  return ['student_side.png'];
}

function resetWalker(i) {
  const w = S3.walker;
  w.style.transition = 'none';
  w.style.left = '-18%';
  w.classList.remove('walking');
  S3.flip.classList.remove('flip');
  S3.body.innerHTML = '';
  S3.body.appendChild(makeImg(sideFiles(i)));
  void w.offsetWidth;
}

async function walkIn() {
  const w = S3.walker;
  w.classList.add('walking');
  w.style.transition = 'left 3.4s linear';
  w.style.left = WALK_STOP;
  await wait(3500);
  w.classList.remove('walking');
}

async function startInterview(i) {
  state.busy = true;
  state.selected = i;
  S3.crowd.classList.add('show');
  S3.room.classList.remove('show');
  S3.bubble.classList.remove('show');
  S3.hint.classList.remove('show');
  resetWalker(i);
  showScene(3);
  await wait(1500);                 // 1) classroom full shot
  await curtainClose();             // 2) curtain fades in
  S3.crowd.classList.remove('show');
  S3.room.classList.add('show');    // 3) swap to empty classroom
  await wait(250);
  await curtainOpen();              // 4) curtain fades out
  await walkIn();                   // 5) student walks from the left edge to the teacher
  S3.bubble.classList.add('show');  // 6) speech bubble grows (text not yet written)
  await wait(800);
  S3.hint.classList.add('show');
  state.canFinish = true;
  state.busy = false;
  updateNav();
}

async function finishInterview() {
  if (state.busy || !state.canFinish) return;
  state.busy = true;
  state.canFinish = false;
  updateNav();
  S3.hint.classList.remove('show');
  S3.bubble.classList.remove('show');
  await wait(600);
  S3.flip.classList.add('flip');    // student walks back
  S3.walker.classList.add('walking');
  S3.walker.style.transition = 'left 2.8s linear';
  S3.walker.style.left = '-18%';
  await wait(2900);
  await curtainClose();
  state.done.add(state.selected);   // interview done → grayscale in Scene2
  showScene(2);
  await wait(250);
  await curtainOpen();
  state.busy = false;
  if (state.done.size === MIN_INTERVIEWS) toast('10명을 면담했어요! 더 해도 되고, 아래 버튼으로 넘어가도 돼요');
  updateNav();
}

async function cancelInterview() {
  if (state.busy) return;
  state.busy = true;
  state.canFinish = false;
  S3.hint.classList.remove('show');
  await curtainClose();
  showScene(2);
  await wait(250);
  await curtainOpen();
  state.busy = false;
  updateNav();
}

async function toScene4() {
  if (state.busy) return;
  state.busy = true;
  await curtainClose();
  showScene(4, 0);
  await wait(250);
  await curtainOpen();
  state.busy = false;
}

/* ---------------- 6. Scene navigation ---------------- */
function showScene(n, step = 0) {
  state.scene = n;
  state.step = step;
  $$('.scene').forEach(s => s.classList.toggle('active', s.id === 'scene' + n));
  const sc = $('#scene' + n);
  sc.dataset.step = step;
  $$(':scope > .step', sc).forEach(st => st.classList.toggle('active', +st.dataset.step === step));
  onEnter(n, step, sc);
  updateNav();
}

function onEnter(n, step, sc) {
  // replay text animations of the visible step
  $$('.lines', sc).forEach(l => {
    const st = l.closest('.step');
    if (!st || st.classList.contains('active')) replay(l);
  });
  if (n === 2) {
    if (!state.slotStarted) { state.slotStarted = true; playSlot(); }
    updateCount();
  }
  if (n === 6) walk($('#t6'), '-400px', '620px', 4200);
  if (n === 8) walk($('#t8'), '1700px', '300px', 4200);
}

function walk(el, from, to, ms) {
  el.style.transition = 'none';
  el.style.left = from;
  el.classList.add('walking');
  void el.offsetWidth;
  el.style.transition = `left ${ms}ms linear`;
  el.style.left = to;
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('walking'), ms + 100);
}

function next() {
  if (state.busy) return;
  const n = state.scene, s = state.step;
  switch (n) {
    case 1: s === 0 ? showScene(1, 1) : showScene(2); break;
    case 2:
      if (state.done.size >= MIN_INTERVIEWS) toScene4();
      else toast(`면담을 ${MIN_INTERVIEWS}명 이상 해야 다음으로 갈 수 있어요`);
      break;
    case 3: finishInterview(); break;
    case 4: s === 0 ? showScene(4, 1) : showScene(5, 0); break;
    case 5:
      if (s === 0) showScene(5, 1);
      else if (s === 1) toast('YES 또는 NO를 골라주세요');
      else if (s === 2) showScene(5, 3);
      else showScene(6);
      break;
    case 6: showScene(7); break;
    case 7: showScene(8); break;
    case 8: showScene(9); break;
    case 9: showScene(10, 0); break;
    case 10: s < 2 ? showScene(10, s + 1) : showScene(11); break;
    case 11: showScene(12); break;
  }
}

function prev() {
  if (state.busy) return;
  const n = state.scene, s = state.step;
  switch (n) {
    case 1: if (s === 1) showScene(1, 0); break;
    case 2: showScene(1, 1); break;
    case 3: cancelInterview(); break;
    case 4: s === 1 ? showScene(4, 0) : showScene(2); break;
    case 5:
      if (s === 0) showScene(4, 1);
      else if (s === 3) showScene(5, state.choseYes ? 2 : 1);
      else showScene(5, s - 1);
      break;
    case 6: showScene(5, 3); break;
    case 7: showScene(6); break;
    case 8: showScene(7); break;
    case 9: showScene(8); break;
    case 10: s > 0 ? showScene(10, s - 1) : showScene(9); break;
    case 11: showScene(10, 2); break;
    case 12: showScene(11); break;
  }
}

function choose(yes) {
  if (state.busy) return;
  state.choseYes = yes;
  showScene(5, yes ? 2 : 3);       // YES → article detail / NO → work screen
}

function updateNav() {
  const n = state.scene, s = state.step;
  $('#prev').classList.toggle('dim', n === 1 && s === 0);
  let dimNext = false;
  if (n === 2) dimNext = state.done.size < MIN_INTERVIEWS;
  if (n === 3) dimNext = !state.canFinish;
  if (n === 5 && s === 1) dimNext = true;
  if (n === 12) dimNext = true;
  $('#next').classList.toggle('dim', dimNext);
}

function fit() {
  const s = Math.min(innerWidth / 1600, innerHeight / 900);
  $('#stage').style.transform = `scale(${s})`;
}

/* ---------------- Init ---------------- */
function init() {
  document.documentElement.style.setProperty('--cell-h', CELL_H + 'px');
  $$('[data-file]').forEach(buildPic);
  $$('[data-crop]').forEach(buildCrop);
  buildGrid();
  fit();
  addEventListener('resize', fit);
  $('#prev').onclick = prev;
  $('#next').onclick = next;
  $('#finishBtn').onclick = toScene4;
  $('#yesBtn').onclick = () => choose(true);
  $('#noBtn').onclick = () => choose(false);
  $$('.article').forEach(a => a.onclick = () => choose(true));
  $('#restartBtn').onclick = () => location.reload();
  addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') next();
    if (e.key === 'ArrowLeft') prev();
  });
  showScene(1, 0);
}
init();
