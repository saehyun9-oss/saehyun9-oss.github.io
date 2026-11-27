/* =========================================================
   core.js — 모든 장면이 함께 쓰는 도구들
   ========================================================= */

/* ---------- 무대 크기 맞추기 (1456 × 816, 비율 유지) ---------- */
const STAGE_W = 1456;
const STAGE_H = 816;
const stage = document.getElementById("stage");

function fitStage() {
  const w = document.documentElement.clientWidth;
  const h = document.documentElement.clientHeight;
  const scale = Math.min(w / STAGE_W, h / STAGE_H);
  stage.style.transform = `translate(-50%, -50%) scale(${scale})`;
}
window.addEventListener("resize", fitStage);
fitStage();

document.getElementById("fullscreen-btn").addEventListener("click", () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen?.();
});

/* ---------- 작은 도우미 ---------- */
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const pad2 = (n) => String(n).padStart(2, "0");
const $ = (sel, root = document) => root.querySelector(sel);

// HTML 문자열로 요소 하나 만들기
function html(str) {
  const t = document.createElement("template");
  t.innerHTML = str.trim();
  return t.content.firstElementChild;
}

// 그림 미리 불러오기 (장면이 시작될 때 깜빡이지 않게)
function preload(srcs) {
  return Promise.all(
    srcs.map((src) => new Promise((res) => {
      const im = new Image();
      im.onload = im.onerror = res;
      im.src = src;
    }))
  );
}

// 요소를 나타나게/사라지게 (CSS .fade 클래스 사용)
async function show(el, ms = 800) {
  el.style.transition = `opacity ${ms}ms ease`;
  el.style.opacity = 0;
  await wait(30);
  el.style.opacity = 1;
  await wait(ms);
}
async function hide(el, ms = 800) {
  el.style.transition = `opacity ${ms}ms ease`;
  el.style.opacity = 0;
  await wait(ms);
}

/* ---------- "클릭해서 계속" 기다리기 ----------
   무대 아무 곳이나 클릭하거나, 스페이스·엔터·→ 키를 누르면 다음으로 가요. */
const nextHint = document.getElementById("next-hint");
let clickWaiters = [];

function waitClick(hintDelay = 700) {
  return new Promise((resolve) => {
    const t = setTimeout(() => nextHint.classList.add("show"), hintDelay);
    clickWaiters.push(() => { clearTimeout(t); resolve(); });
  });
}
function releaseClick() {
  if (!clickWaiters.length) return;
  nextHint.classList.remove("show");
  const list = clickWaiters;
  clickWaiters = [];
  list.forEach((fn) => fn());
}
stage.addEventListener("click", (e) => {
  if (e.target.closest("button, a, .clickable")) return;   // 버튼 클릭은 따로 처리
  releaseClick();
});
window.addEventListener("keydown", (e) => {
  if ([" ", "Enter", "ArrowRight"].includes(e.key)) { e.preventDefault(); releaseClick(); }
});

/* ---------- 장면 전환 ---------- */
const fader = document.getElementById("fader");
const curtain = document.getElementById("curtain");

async function fadeToBlack(ms = 900) {
  fader.style.transition = `opacity ${ms}ms ease`;
  fader.style.opacity = 1;
  await wait(ms);
}
async function fadeFromBlack(ms = 900) {
  fader.style.transition = `opacity ${ms}ms ease`;
  fader.style.opacity = 0;
  await wait(ms);
}
async function curtainClose() {
  curtain.classList.add("closed");
  await wait(1000);
}
async function curtainOpen() {
  curtain.classList.remove("closed");
  await wait(1000);
}

let sceneRun = 0;               // 장면이 바뀌면 숫자가 올라가요 (오래된 동작을 멈추는 데 써요)
const isCurrent = (run) => run === sceneRun;

function goToScene(n) {
  sceneRun++;
  clickWaiters = [];
  nextHint.classList.remove("show");
  document.querySelectorAll(".scene").forEach((s) => {
    s.classList.remove("active");
    if (s.id !== "scene2") s.innerHTML = "";        // Scene2(카드)만 그대로 남겨 둬요
  });
  const el = document.getElementById("scene" + n);
  el.classList.add("active");
  SCENES[n](el, sceneRun);
}

/* ---------- 걷는 캐릭터 ----------
   new Walker(부모요소, "prof" | "rival" | "s1"~"s20", { height, footY, x })
   - height: 화면에 보일 키(px), footY: 발끝 y, x: 그림 왼쪽 x
   - walkTo(x): 그 x까지 걸어가요. 프레임이 바뀔 때마다 ppf만큼 이동(키에 맞춰 줄임)
   - 원본과 반대 방향으로 걸으면 자동으로 좌우반전 */
class Walker {
  constructor(parent, key, { height, footY, x, ms, z = 5 }) {
    this.cfg = WALK[key];
    this.height = height;
    this.width = (this.cfg.frameW * height) / this.cfg.frameH;
    this.step = (this.cfg.ppf * height) / this.cfg.frameH;
    this.ms = (ms || this.cfg.ms) / (key === "prof" || key === "rival" ? 2 : 1.25);
    this.x = x;
    // 그림 한 장(sprite sheet)에서 지금 프레임만 보이게 잘라 보여 줘요
    this.el = document.createElement("div");
    this.el.className = "walker";
    Object.assign(this.el.style, {
      height: height + "px", width: this.width + "px",
      top: footY - height + "px", left: x + "px", zIndex: z,
      backgroundImage: `url(${this.cfg.sheet})`,
      backgroundSize: `${this.width * (this.cfg.frames + 1)}px ${height}px`,
    });
    this.frame(this.cfg.frames);            // 마지막 칸 = 멈춘 모습(stand)
    parent.appendChild(this.el);
    this.facing = this.cfg.dir;
  }
  static sources(key) { return [WALK[key].sheet]; }
  frame(i) { this.el.style.backgroundPosition = `${-i * this.width}px 0`; }
  face(dir) {
    this.facing = dir;
    this.el.style.transform = dir === this.cfg.dir ? "" : "scaleX(-1)";
  }
  walkTo(targetX) {
    return new Promise((resolve) => {
      const dir = targetX > this.x ? "right" : "left";
      const sign = dir === "right" ? 1 : -1;
      this.face(dir);
      let f = -1;
      const tick = () => {
        if (!this.el.isConnected) return resolve();
        f = (f + 1) % this.cfg.frames;                 // 1 → N → 1 → …
        this.frame(f);
        this.x += this.step * sign;
        if ((sign > 0 && this.x >= targetX) || (sign < 0 && this.x <= targetX)) {
          this.x = targetX;
          this.el.style.left = this.x + "px";
          this.frame(this.cfg.frames);               // 도착하면 stand
          return resolve();
        }
        this.el.style.left = this.x + "px";
        setTimeout(tick, this.ms);
      };
      tick();
    });
  }
  remove() { this.el.remove(); }
}

/* ---------- 말풍선 ----------
   말풍선 기록(log) 안에 새 말풍선을 붙이고, 이전 말풍선은 부드럽게 위로 밀어 올려요. */
function addBubble(log, { side, name, text }) {
  const before = new Map([...log.children].map((c) => [c, c.getBoundingClientRect().top]));
  const b = html(`<div class="bubble ${side}"><span class="who">${name}</span><p></p></div>`);
  b.querySelector("p").textContent = text;
  log.appendChild(b);
  // FLIP: 원래 있던 말풍선들이 위로 미끄러지게
  const scale = stage.getBoundingClientRect().height / STAGE_H;
  before.forEach((oldTop, c) => {
    const dy = (oldTop - c.getBoundingClientRect().top) / scale;
    c.animate([{ transform: `translateY(${dy}px)` }, { transform: "translateY(0)" }],
      { duration: 450, easing: "cubic-bezier(.2,.7,.3,1)" });
  });
  b.animate([{ opacity: 0, transform: "translateY(24px) scale(.96)" }, { opacity: 1, transform: "none" }],
    { duration: 450, easing: "cubic-bezier(.2,.7,.3,1)" });
  return b;
}

// 글자가 한 글자씩 써지는 효과
async function typeText(el, text, perChar = 45) {
  el.textContent = "";
  for (const ch of text) {
    el.textContent += ch;
    await wait(perChar);
  }
}

/* ---------- 게임 상태 ---------- */
const state = {
  interviewed: [],     // 면담을 마친 학생 번호 (순서대로)
  current: null,       // 지금 면담 중인 학생
  justFinished: null,  // 방금 면담을 마치고 돌아온 학생
};
const student = (n) => CARDS_DATA.students.find((s) => s.number === n);

/* ---------- 면담 종료 조건 (README 2장, 확정) ----------
   4유형(고활용·검증결핍·중저활용·검증우세) 모두 + 유료 2명 이상 + 무료 2명 이상 + 미사용 1명 이상 */
const CONDITIONS = [
  { id: "고활용",   test: (s) => s.type === "고활용" },
  { id: "검증결핍", test: (s) => s.type === "검증결핍" },
  { id: "중저활용", test: (s) => s.type === "중저활용" },
  { id: "검증우세", test: (s) => s.type === "검증우세" },
  { id: "유료",     test: (s) => s.pay === "유료", need: 2 },
  { id: "무료",     test: (s) => s.pay === "무료", need: 2 },
  { id: "미사용",   test: (s) => s.type.startsWith("미사용") },
];
function missingConditions() {
  const met = state.interviewed.map(student);
  return CONDITIONS.filter((c) => met.filter(c.test).length < (c.need || 1));
}
const conditionsMet = () => missingConditions().length === 0;
