/* =========================================================
   scenes.js — 장면 1~12
   장면마다 함수 하나예요. goToScene(번호)로 이동해요.
   (el = 그 장면의 <section>, run = 장면 번호표. 장면이 바뀌면 오래된 동작은 멈춰요)
   ========================================================= */

const A = "assets/";

/* =========================================================
   Scene1 도입부
   ========================================================= */
async function scene1(el, run) {
  el.style.background = "#000";
  const line = html(`<p class="s1-text">학기가 끝났어. 상담을 시작해야해!</p>`);
  const img = html(`<img class="full" src="${A}text/s1_who.webp" alt="누구를 먼저 면담할까?" style="opacity:0">`);
  el.append(line, img);
  preload([A + "cards/template.webp"]);

  await wait(800);
  await show(line, 1500); await wait(1800); await hide(line, 1500);
  await wait(600);
  await show(img, 1500); await wait(1800); await hide(img, 1500);
  await wait(400);
  if (isCurrent(run)) goToScene(2);
}

/* =========================================================
   Scene2 학생 선택 (성적 카드)
   ========================================================= */
const S2 = {
  built: false,
  scrollEl: document.getElementById("s2-scroll"),
  gridEl: document.getElementById("s2-grid"),
  savedScroll: 0,
  queue: [],
  running: false,
};
// 도장 그림 한 장(stamps.webp)에서 몇 번째 칸인지
const STAMP_ORDER = ["A", "A-", "B+", "B", "B-", "C+", "C"];
const slotOf = (n) => S2.gridEl.querySelector(`.card-slot[data-number="${n}"]`);

function buildCards() {
  CARDS_DATA.students.forEach((s) => {
    const id = pad2(s.number);
    // 슬롯머신 릴: 다른 학생 카드 12장 + 맨 끝에 이 학생
    const others = CARDS_DATA.students.map((x) => x.number).filter((n) => n !== s.number).sort(() => Math.random() - 0.5);
    const reel = others.slice(0, 12).concat([s.number])
      .map((n) => `<img src="${A}cards/photo/${pad2(n)}.webp" alt="">`).join("");
    // 빨간 선이 그려지는 길 (시작점 + 성적 4점)
    const d = s.path_points.map((p, i) => (i ? "L" : "M") + p.x + " " + p.y).join(" ");
    const L = s.path_length_px;
    const stamps = s.stages.map((g) =>
      `<div class="stamp" title="${g.grade}" style="left:${g.stamp_center.x - 52}px;top:${g.stamp_center.y - 52}px;background-position:${-STAMP_ORDER.indexOf(g.grade) * 104}px 0"></div>`).join("");

    const slot = html(`
      <div class="card-slot" data-number="${s.number}">
        <div class="card-flip">
          <div class="face front"><div class="card-inner">
            <img class="base" src="${A}cards/template.webp" alt="">
            <div class="reel-window" style="visibility:hidden"><div class="reel-strip">${reel}</div></div>
            <svg width="1200" height="560" viewBox="0 0 1200 560">
              <defs><mask id="mask${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="1200" height="560">
                <path class="draw-path" d="${d}" fill="none" stroke="#fff" stroke-width="44" stroke-linejoin="round"
                  stroke-dasharray="${L} ${L + 10}" stroke-dashoffset="${L}" style="transition:stroke-dashoffset .5s ease-in-out"/>
              </mask></defs>
              <image href="${A}cards/line/${id}.webp" width="1200" height="560" mask="url(#mask${id})"/>
            </svg>
            ${stamps}
            <div class="card-name">${s.name_ko} · ${s.name_en}</div>
          </div></div>
          <div class="face back"><div class="card-inner">
            <img class="back-paper" src="${A}cards/template.webp" alt="">
            <div class="back-name">${s.name_ko}<br>${s.name_en}</div>
            <div class="back-stamp">면담 완료</div>
          </div></div>
        </div>
        <div class="ask-bubble">이 학생을 면담할까?</div>
      </div>`);
    slot.addEventListener("click", () => onCardClick(slot, s));
    S2.gridEl.appendChild(slot);
  });

  // 카드가 화면에 보이면 그때 슬롯머신을 돌려요
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      S2.queue.push(e.target);
      runQueue();
    });
  }, { root: S2.scrollEl, threshold: 0.45 });
  S2.gridEl.querySelectorAll(".card-slot").forEach((c) => io.observe(c));
  S2.built = true;
}

async function runQueue() {
  if (S2.running) return;
  S2.running = true;
  while (S2.queue.length) { revealCard(S2.queue.shift()); await wait(180); }
  S2.running = false;
}

async function revealCard(slot) {
  const s = student(+slot.dataset.number);
  const win = slot.querySelector(".reel-window");
  const strip = slot.querySelector(".reel-strip");
  const path = slot.querySelector(".draw-path");
  const stamps = slot.querySelectorAll(".stamp");
  // ① 슬롯머신
  win.style.visibility = "visible";
  await wait(30);
  strip.classList.add("spinning");
  strip.style.transform = `translateY(${-(strip.children.length - 1) * 560}px)`;
  await wait(1900);
  // ② 성적 4단계: 선이 그 점까지 → 도장 '쾅'
  for (let i = 0; i < s.stages.length; i++) {
    path.style.strokeDashoffset = L_minus(s, i);
    await wait(520);
    stamps[i].classList.add("hit");
    slot.classList.remove("thud"); void slot.offsetWidth; slot.classList.add("thud");
    await wait(330);
  }
  // ③ 이름
  slot.querySelector(".card-name").classList.add("show");
  await wait(300);
  slot.classList.add("ready");
}
const L_minus = (s, i) => s.path_length_px - s.stages[i].draw_until_px;

async function onCardClick(slot, s) {
  if (!slot.classList.contains("ready") || slot.classList.contains("done")) return;
  if (S2.busy || document.getElementById("modal").classList.contains("show")) return;
  clearKnock();
  state.current = s.number;
  S2.savedScroll = S2.scrollEl.scrollTop;
  await curtainClose();
  goToScene(3);
}

// 카드를 화면 가운데로 부드럽게 옮기기
async function centerCard(slot) {
  const top = slot.offsetTop + slot.offsetHeight / 2 - STAGE_H / 2;
  S2.scrollEl.scrollTo({ top, behavior: "smooth" });
  await wait(950);
}

// 힌트: 아직 못 채운 조건에 맞는 학생이 먼저 찾아와요 (10번째 면담부터)
function clearKnock() {
  S2.gridEl.querySelectorAll(".knock").forEach((c) => {
    c.classList.remove("knock");
    c.querySelector(".ask-bubble").textContent = "이 학생을 면담할까?";
  });
}
async function showKnock(run) {
  const missing = missingConditions();
  const left = CARDS_DATA.students.filter((s) => !state.interviewed.includes(s.number));
  const fits = left.filter((s) => missing.some((c) => c.test(s)));
  if (!fits.length) return;
  const pick = fits.find((s) => s.key_student) || fits[Math.floor(Math.random() * fits.length)];
  const slot = slotOf(pick.number);
  await wait(500);
  await centerCard(slot);
  while (!slot.classList.contains("ready")) { await wait(200); if (!isCurrent(run)) return; }
  slot.classList.add("knock");
  slot.querySelector(".ask-bubble").textContent = "똑똑, 교수님! 저도 면담할 수 있을까요?";
}

// 선택 창
function askModal(title, text, buttons) {
  const modal = document.getElementById("modal");
  modal.innerHTML = `<div class="modal-box"><h2>${title}</h2><p>${text}</p><div class="row"></div></div>`;
  return new Promise((resolve) => {
    buttons.forEach(([label, value, cls]) => {
      const b = html(`<button class="btn ${cls || ""}">${label}</button>`);
      b.onclick = () => { modal.classList.remove("show"); resolve(value); };
      modal.querySelector(".row").appendChild(b);
    });
    modal.classList.add("show");
  });
}

async function scene2(el, run) {
  if (!S2.built) buildCards();
  S2.scrollEl.scrollTop = S2.savedScroll;
  if (state.justFinished === null) return;

  // 면담을 마치고 돌아왔을 때
  const n = state.justFinished;
  state.justFinished = null;
  S2.busy = true;                                 // 뒤집는 동안은 카드를 누를 수 없어요
  await curtainOpen();
  const slot = slotOf(n);
  await wait(200);
  await centerCard(slot);
  slot.classList.add("done");                     // 카드 뒤집기
  await wait(1100);
  S2.busy = false;
  if (!isCurrent(run)) return;

  if (conditionsMet()) {
    const allDone = state.interviewed.length >= 20;
    const answer = await askModal("면담을 종료할까?",
      allDone ? "모든 학생을 면담했어요." : `지금까지 ${state.interviewed.length}명을 면담했어요.`,
      allDone ? [["면담 종료", true, "red"]] : [["아니, 더 할래", false], ["응, 종료하자", true, "red"]]);
    if (answer) { await fadeToBlack(1200); goToScene(4); }
  } else if (state.interviewed.length >= 9) {
    showKnock(run);
  }
}

/* =========================================================
   교수 연구실 (Scene3·4 공통 배경)
   ========================================================= */
function buildOffice(el) {
  el.append(
    html(`<img class="full" src="${A}bg/mint.jpg" alt="">`),
    // 의자 (코드로 그림)
    html(`<svg class="abs" style="left:1270px;top:380px;z-index:1" width="190" height="350" viewBox="0 0 190 350">
      <g fill="none" stroke="#1b1e22" stroke-linecap="round" stroke-linejoin="round">
        <path d="M150 12 C168 10 178 20 176 40 L170 190" stroke-width="20"/>
        <path d="M150 12 C138 14 136 24 138 40 L146 190" stroke-width="10"/>
        <path d="M20 200 L172 196" stroke-width="22"/>
        <path d="M40 206 L30 330 M150 206 L158 330" stroke-width="10"/>
        <path d="M30 330 L30 338 M158 330 L158 338" stroke="#8e98a0" stroke-width="10"/>
      </g>
      <path d="M154 30 L150 170" stroke="#3a4148" stroke-width="3" fill="none"/>
    </svg>`),
    html(`<img class="abs" src="${A}chars/prof/seated.webp" style="left:1185px;top:85px;height:665px;z-index:2" alt="교수">`),
    html(`<img class="abs" src="${A}furniture/desk_side.webp" style="left:952px;top:245px;width:263px;height:551px;z-index:3" alt="">`)
  );
}

/* =========================================================
   Scene3 면담
   ========================================================= */
async function scene3(el, run) {
  const s = student(state.current);
  const key = "s" + s.number;
  await preload([A + "bg/mint.jpg", A + "chars/prof/seated.webp", A + "furniture/desk_side.webp", ...Walker.sources(key)]);
  buildOffice(el);
  const log = html(`<div class="bubble-log"></div>`);
  el.appendChild(log);

  // 학생: 왼쪽에서 걸어 들어와 교수 앞에서 측면으로 멈춰요
  const H = 560;
  const w = (WALK[key].frameW * H) / WALK[key].frameH;
  const walker = new Walker(el, key, { height: H, footY: 795, x: -w - 10, z: 4 });
  await curtainOpen();
  await walker.walkTo(Math.min(700 - w / 2, 935 - w * 0.85));
  await wait(400);

  // 질문과 답 3번
  for (let i = 0; i < 3; i++) {
    addBubble(log, { side: "prof", name: "교수", text: QUESTIONS[i] });
    await waitClick();
    if (!isCurrent(run)) return;
    addBubble(log, { side: "stu", name: s.name_ko, text: ANSWERS[s.number][i] });
    await waitClick();
    if (!isCurrent(run)) return;
  }

  // 끝: 말풍선 사라지고 학생은 왼쪽으로 걸어 나가요 (좌우반전)
  hide(log, 500);
  await walker.walkTo(-w - 20);
  state.interviewed.push(s.number);
  state.justFinished = s.number;
  state.current = null;
  await curtainClose();
  goToScene(2);
}

/* =========================================================
   Scene4 검색해볼 결심 (생각 구름)
   ========================================================= */
async function scene4(el, run) {
  await preload([A + "bg/mint.jpg", A + "chars/prof/seated.webp", A + "furniture/desk_side.webp"]);
  buildOffice(el);

  // 구름: 바깥 먹선 원(조금 큼) 위에 종이색 원을 겹쳐서 테두리만 남겨요
  const cloud = [[450,285,92],[530,200,100],[650,165,112],[775,190,104],[858,262,92],[800,350,98],[660,385,106],[520,365,98],[430,330,60]];
  const ink = cloud.map(([x,y,r]) => `<circle cx="${x}" cy="${y}" r="${r + 5}"/>`).join("");
  const fill = cloud.map(([x,y,r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join("");
  const trail = [[1150,180,11],[1102,158,17],[1040,140,25]]
    .map(([x,y,r]) => `<g class="puff"><circle cx="${x}" cy="${y}" r="${r + 4}" fill="#2b2925"/><circle cx="${x}" cy="${y}" r="${r}" fill="#fbf8f0"/></g>`).join("");
  const svg = html(`<svg class="thought" viewBox="0 0 1456 816">
      ${trail}
      <g class="puff big"><g fill="#2b2925">${ink}</g><g fill="#fbf8f0">${fill}<ellipse cx="650" cy="278" rx="250" ry="140"/></g></g>
    </svg>`);
  const box = html(`<div class="thought-text"><div></div></div>`);
  const text = box.firstElementChild;
  el.append(svg, box);

  await fadeFromBlack(1000);
  await wait(600);
  for (const p of svg.querySelectorAll(".puff")) { p.classList.add("on"); await wait(300); }
  await wait(350);
  await typeText(text, "AI가 정말 그렇게 심각하다고?", 60);
  text.innerHTML += "<br>";
  const second = document.createElement("span");
  text.appendChild(second);
  await typeText(second, "검색해볼까?", 70);
  await waitClick();
  if (!isCurrent(run)) return;
  await fadeToBlack();
  goToScene(5);
}

/* =========================================================
   Scene5 기사 검색 (모니터 안)
   ========================================================= */
async function scene5(el, run) {
  await preload([A + "bg/watercolor.jpg", A + "monitor/monitor.webp"]);
  el.append(
    html(`<img class="full" src="${A}bg/watercolor.jpg" alt="">`),
    html(`<div class="monitor-wrap">
        <div class="screen">
          <div class="win">
            <div class="win-bar"><div class="addr">가상검색 · 웹 검색</div><button class="xbtn" title="닫기">✕</button></div>
            <div class="win-body"></div>
          </div>
        </div>
        <img class="monitor-frame" src="${A}monitor/monitor.webp" alt="">
      </div>`),
    html(`<p class="abs" style="left:0;width:1456px;top:784px;text-align:center;font-size:17px;color:#3f5a4e;opacity:0" id="s5-tip">
      기사 제목을 눌러 읽어 볼 수 있어요 · 다 봤으면 화면의 ✕를 눌러 창을 닫아요</p>`)
  );
  const screen = $(".screen", el);
  const win = $(".win", el);
  const body = $(".win-body", el);
  const xbtn = $(".xbtn", el);
  await fadeFromBlack(800);

  // 15초 동안 아무것도 안 누르면 X가 깜빡여요
  let idle;
  const resetIdle = () => {
    clearTimeout(idle);
    xbtn.classList.remove("blink");
    idle = setTimeout(() => isCurrent(run) && xbtn.classList.add("blink"), 15000);
  };
  screen.addEventListener("pointerdown", resetIdle);

  // ① 검색창에 타이핑
  const searchPage = () => `
    <div class="search-logo">가상<span>검색</span></div>
    <div class="search-box"><span class="q"></span><span class="caret"></span></div>
    <div class="results"></div>`;
  body.innerHTML = searchPage();
  await wait(700);
  await typeText($(".q", body), SEARCH_QUERY, 180);
  await wait(500);

  // ② 검색 결과 3개
  const showResults = (animate) => {
    body.innerHTML = searchPage();
    $(".q", body).textContent = SEARCH_QUERY;
    const box = $(".results", body);
    ARTICLES.forEach((a, i) => {
      const r = html(`<div class="result clickable"><div class="src">가상일보 · 기사 ${i + 1}</div><h3></h3><p></p></div>`);
      $("h3", r).textContent = a.title;
      $("p", r).textContent = a.summary;
      r.onclick = () => openArticle(i);
      box.appendChild(r);
      if (animate) setTimeout(() => r.classList.add("on"), 250 + i * 350);
      else r.classList.add("on");
    });
  };
  // ③ 기사 상세 → 되돌아가기
  const openArticle = (i) => {
    const a = ARTICLES[i];
    const art = html(`<div class="article">
        <span class="back-link clickable">← 되돌아가기</span>
        <h1></h1><h2></h2><div class="by"></div><div class="paras"></div>
        <div class="sources"><b>출처</b></div>
        <p class="fake-note">※ 이 기사는 실제 연구를 바탕으로 만든 가상 기사입니다.</p>
        <span class="back-link clickable">← 되돌아가기</span>
      </div>`);
    $("h1", art).textContent = a.title;
    $("h2", art).textContent = a.subtitle;
    $(".by", art).textContent = a.byline;
    a.body.forEach((p) => {
      if (typeof p === "string") {
        const el = document.createElement("p"); el.textContent = p; $(".paras", art).appendChild(el);
      } else {
        const t = document.createElement("table");
        p.table.forEach((row, ri) => {
          const tr = document.createElement("tr");
          row.forEach((c) => { const td = document.createElement(ri ? "td" : "th"); td.textContent = c; tr.appendChild(td); });
          t.appendChild(tr);
        });
        $(".paras", art).appendChild(t);
      }
    });
    a.sources.forEach(([name, url, note]) => {
      const d = document.createElement("div");
      d.innerHTML = `· <span></span> <a target="_blank" rel="noopener"></a> <span class="note"></span>`;
      d.children[0].textContent = name;
      d.children[1].textContent = url; d.children[1].href = url;
      d.children[2].textContent = note ? `(${note})` : "";
      $(".sources", art).appendChild(d);
    });
    art.querySelectorAll(".back-link").forEach((b) => (b.onclick = () => showResults(false)));
    body.innerHTML = "";
    body.appendChild(art);
    body.scrollTop = 0;
  };
  showResults(true);
  resetIdle();
  await wait(1500);
  show($("#s5-tip", el), 800);

  // ④ X → 메신저
  await new Promise((res) => (xbtn.onclick = res));
  clearTimeout(idle);
  win.classList.add("closing");
  hide($("#s5-tip", el), 300);
  await wait(400);
  win.remove();
  screen.appendChild(html(`<div class="desktop"></div>`));
  await wait(700);
  const msg = html(`<div class="messenger">
      <div class="m-top">메신저</div>
      <div class="m-body"><div class="m-name">학과장님</div><div class="m-msg"><span class="dots"><span></span><span></span><span></span></span></div></div>
    </div>`);
  screen.appendChild(msg);
  await wait(1600);
  $(".m-msg", msg).textContent = "지금 내 연구실로 오게";        // ⑤ 학과장님 메시지
  $(".m-msg", msg).animate([{ transform: "scale(.9)" }, { transform: "none" }], { duration: 250 });
  await wait(900);
  await waitClick();
  if (!isCurrent(run)) return;
  await fadeToBlack();
  goToScene(6);
}

/* =========================================================
   Scene6 학과장실로 이동 / Scene8 연구실로 복귀 (복도)
   ========================================================= */
async function hallwayWalk(el, run, fromX, toX, next) {
  await preload([A + "bg/hallway.jpg", ...Walker.sources("prof")]);
  el.appendChild(html(`<img class="full" src="${A}bg/hallway.jpg" alt="">`));
  const prof = new Walker(el, "prof", { height: 600, footY: 800, x: fromX, ms: 100 });
  await fadeFromBlack(700);
  await prof.walkTo(toX);
  if (!isCurrent(run)) return;
  await fadeToBlack(800);
  goToScene(next);
}
// Scene6: 오른쪽 → 왼쪽 (교수 걷기 원본 방향)
const scene6 = (el, run) => hallwayWalk(el, run, 1456, -290, 7);
// Scene8: 왼쪽 → 오른쪽 (좌우반전)
const scene8 = (el, run) => hallwayWalk(el, run, -290, 1456, 9);

/* =========================================================
   영상 + 말풍선 (Scene7·9 공통)
   ========================================================= */
async function playVideo(el, run, src, speechHTML, speechAt = 900, hideAt = null) {
  const v = html(`<video class="full" src="${src}" muted playsinline preload="auto" style="object-fit:cover"></video>`);
  el.appendChild(v);
  await new Promise((r) => { v.oncanplay = r; v.onerror = r; setTimeout(r, 4000); });
  await fadeFromBlack(700);
  const ended = new Promise((r) => { v.onended = r; setTimeout(r, 7000); });
  v.play().catch(() => {});
  await wait(speechAt);
  const sp = html(speechHTML);
  sp.style.opacity = 0;
  el.appendChild(sp);
  show(sp, 400);
    if (hideAt !== null) {
    const check = () => { if (v.currentTime >= hideAt) { v.removeEventListener("timeupdate", check); hide(sp, 400); } };
    v.addEventListener("timeupdate", check);
  }
  await ended;
  await waitClick(200);
}

/* =========================================================
   Scene7 꾸중 (학과장님)
   ========================================================= */
async function scene7(el, run) {
  el.style.background = "#eef3ee";
  await playVideo(el, run, A + "video/s7.mp4",
    `<div class="speech tail-right" style="left:40px;top:28px;max-width:600px">
       <span class="who">학과장님</span>옆 연구실 교수는 AI 잘 써서 벌써 이번 주 일을 끝냈는데, 자네는 뭔가!
     </div>`, 900, 4.2);
  if (!isCurrent(run)) return;
  await fadeToBlack();
  goToScene(8);
}

/* =========================================================
   Scene9 밤샘 결심
   ========================================================= */
async function scene9(el, run) {
  el.style.background = "#000";
  const imgs = ["s9_1", "s9_2", "s9_3"].map((n) =>
    html(`<img class="full" src="${A}text/${n}.webp" alt="" style="opacity:0;z-index:30">`));
  await preload(imgs.map((i) => i.src));
  el.append(...imgs);
  fader.style.opacity = 0;          // 검은 배경이라 바로 시작

  for (const img of imgs.slice(0, 2)) {
    await show(img, 1200); await wait(1900); await hide(img, 1200); await wait(300);
  }
  if (!isCurrent(run)) return;
  // 분노하는 교수 영상
  fader.style.transition = "none"; fader.style.opacity = 1;
  el.appendChild(html(`<img class="full" src="${A}bg/watercolor.jpg" alt="">`));
  await playVideo(el, run, A + "video/s9.mp4",
    `<div class="speech tail-right" style="left:40px;top:28px;max-width:560px">
       <span class="who">교수</span>AI 못 써도 돼! 밤새서 하면 그 정도는 나도 할 수 있어! 그거 별거 아니야!
     </div>`, 700);
  if (!isCurrent(run)) return;
  await fadeToBlack(800);
  // 마지막 글귀 (검은 화면)
  [...el.children].forEach((c) => { if (!imgs.includes(c)) c.remove(); });
  fader.style.opacity = 0;
  await show(imgs[2], 1200); await wait(2000); await hide(imgs[2], 1200);
  if (!isCurrent(run)) return;
  fader.style.transition = "none"; fader.style.opacity = 1;
  goToScene(10);
}

/* =========================================================
   Scene10 밤샘과 시간 손해 (교실+복도 레이어)
   ========================================================= */
// 시간(0~24) → 하늘 위색, 아래색, 덮개(r,g,b,투명도)  — demo.html과 같은 값
const SKY_KEYS = [
  [0,   [14,20,44],   [38,50,84],    [14,20,48,0.55]],
  [4.5, [18,24,52],   [52,62,98],    [14,20,48,0.52]],
  [6,   [70,84,128],  [240,186,156], [80,60,110,0.24]],
  [7.5, [140,196,222],[240,226,206], [120,90,80,0.08]],
  [9,   [146,204,226],[214,238,236], [0,0,0,0]],
  [12,  [112,186,220],[198,232,240], [0,0,0,0]],
  [16,  [130,190,218],[226,234,220], [130,100,60,0.05]],
  [18,  [92,100,150], [250,160,110], [150,80,40,0.17]],
  [19.3,[40,46,92],   [120,90,120],  [40,30,70,0.38]],
  [21,  [16,22,48],   [42,56,90],    [14,20,48,0.55]],
  [24,  [14,20,44],   [38,50,84],    [14,20,48,0.55]],
];
const WINDOWS = [[468,112,664,318],[1194,112,1390,318]];
const ROOM_R = [912,84,1426,470];

function makeSky(skyCanvas, tintCanvas, sun, moon) {
  const sky = skyCanvas.getContext("2d"), tint = tintCanvas.getContext("2d");
  const mix = (a, b, u) => a.map((v, i) => v + (b[i] - v) * u);
  const rgb = (c) => `rgb(${c.map(Math.round).join(",")})`;
  const at = (h) => {
    for (let i = 0; i < SKY_KEYS.length - 1; i++) {
      const [h0, t0, b0, c0] = SKY_KEYS[i], [h1, t1, b1, c1] = SKY_KEYS[i + 1];
      if (h >= h0 && h <= h1) { let u = (h - h0) / (h1 - h0); u = u * u * (3 - 2 * u); return [mix(t0, t1, u), mix(b0, b1, u), mix(c0, c1, u)]; }
    }
  };
  return (h) => {
    const [top, bot, [r, g, b, a]] = at(h);
    const grd = sky.createLinearGradient(0, 0, 0, 816);
    grd.addColorStop(0, rgb(top)); grd.addColorStop(1, rgb(bot));
    sky.fillStyle = grd; sky.fillRect(0, 0, 1456, 816);
    for (const [x0, y0, x1, y1] of WINDOWS) {
      if (h >= 5.6 && h <= 18.6) {                                      // 해
        const u = (h - 5.6) / 13, cx = x0 - 20 + (x1 - x0 + 40) * u, cy = y1 + 30 - (y1 - y0 + 10) * Math.sin(Math.PI * u);
        sky.drawImage(sun, cx - 46, cy - 46, 92, 92);
      }
      const mh = ((h - 18.5) % 24 + 24) % 24;
      if (mh <= 11.5) {                                                 // 달
        const u = mh / 11.5, cx = x0 - 10 + (x1 - x0 + 20) * u, cy = y1 + 26 - (y1 - y0 + 4) * Math.sin(Math.PI * u);
        sky.globalAlpha = Math.min(1, Math.min(mh, 11.5 - mh) / 1.2);
        sky.drawImage(moon, cx - 26, cy - 26, 52, 52); sky.globalAlpha = 1;
      }
    }
    tint.clearRect(0, 0, 1456, 816);
    tint.fillStyle = `rgba(${r},${g},${b},${a})`; tint.fillRect(0, 0, 1456, 816);
    if (h >= 20 || h < 5) {                                             // 밤: 오른쪽 방만 불 켜짐
      const [x0, y0, x1, y1] = ROOM_R; tint.clearRect(x0, y0, x1 - x0, y1 - y0);
      tint.fillStyle = `rgba(${r},${g},${b},${a * 0.22})`; tint.fillRect(x0, y0, x1 - x0, y1 - y0);
    }
    for (const [x0, y0, x1, y1] of WINDOWS) tint.clearRect(x0, y0, x1 - x0, y1 - y0);   // 하늘은 덮지 않음
  };
}

async function scene10(el, run) {
  // 복도에 올 학생 5명: 면담했던 학생부터
  const five = [...new Set([...state.interviewed, ...CARDS_DATA.students.map((s) => s.number)])].slice(0, 5);
  const P = A + "layers/";
  await preload([P + "back_rooms.webp", P + "hallway_wall.webp", P + "glass.webp", P + "door_L.webp", P + "door_R.webp",
    P + "sun.webp", P + "moon.webp", A + "furniture/desk_left.webp", A + "furniture/desk_right.webp",
    A + "chars/prof/working_back.webp", A + "chars/prof/sleeping.webp", A + "chars/rival/seated_back.webp",
    ...Walker.sources("rival"), ...five.flatMap((n) => Walker.sources("s" + n))]);

  const sky = html(`<canvas class="full" width="1456" height="816" style="z-index:1"></canvas>`);
  const tint = html(`<canvas class="full" width="1456" height="816" style="z-index:9;pointer-events:none"></canvas>`);
  const profWork = html(`<img class="abs working" src="${A}chars/prof/working_back.webp" style="left:925px;top:205px;height:257px;z-index:4" alt="">`);
  const profSleep = html(`<img class="abs" src="${A}chars/prof/sleeping.webp" style="left:905px;top:210px;height:252px;z-index:4;display:none" alt="">`);
  const rivalSeat = html(`<img class="abs" src="${A}chars/rival/seated_back.webp" style="left:188px;top:220px;height:245px;z-index:4;opacity:0" alt="">`);
  const doorL = html(`<img class="abs door" src="${P}door_L.webp" style="left:28px;top:176px;z-index:7" alt="">`);
  const doorR = html(`<img class="abs door" src="${P}door_R.webp" style="left:754px;top:176px;z-index:7" alt="">`);
  const clock = html(`<div class="clock-tag">20:00</div>`);
  el.append(
    sky,
    html(`<img class="full" src="${P}back_rooms.webp" style="z-index:2" alt="">`),
    html(`<img class="abs" src="${A}furniture/desk_left.webp" style="left:188px;top:265px;width:272px;z-index:3" alt="">`),
    html(`<img class="abs" src="${A}furniture/desk_right.webp" style="left:903px;top:247px;width:269px;z-index:3" alt="">`),
    profWork, profSleep, rivalSeat,
    html(`<img class="full" src="${P}hallway_wall.webp" style="z-index:5" alt="">`),
    html(`<img class="full" src="${P}glass.webp" style="z-index:6" alt="">`),
    doorL, doorR, tint, clock
  );
  const sun = new Image(); sun.src = P + "sun.webp";
  const moon = new Image(); moon.src = P + "moon.webp";
  await Promise.all([sun.decode(), moon.decode()]).catch(() => {});
  const draw = makeSky(sky, tint, sun, moon);

  // ① 밤 20:00 → 아침 08:00 (약 15초)
  const H0 = 20, H1 = 32, DUR = 15000;
  draw(H0);
  await fadeFromBlack(1200);
  await new Promise((done) => {
    const t0 = performance.now();
    const frame = (t) => {
      if (!isCurrent(run)) return done();
      const u = Math.min(1, (t - t0) / DUR);
      const h = H0 + (H1 - H0) * u;
      draw(h % 24);
      const hh = Math.floor(h) % 24, mm = Math.floor((h % 1) * 60);
      clock.textContent = `${pad2(hh)}:${pad2(Math.floor(mm / 10) * 10)}`;
      u < 1 ? requestAnimationFrame(frame) : done();
    };
    requestAnimationFrame(frame);
  });
  if (!isCurrent(run)) return;

  // ② 완전한 아침 → 교수 잠들기 + zzz
  await wait(600);
  profWork.style.display = "none";
  profSleep.style.display = "";
  hide(clock, 800);
  (async () => {
    const sizes = [46, 38, 30];
    for (let i = 0; isCurrent(run); i++) {
      const z = html(`<div class="zzz" style="left:${852 + (i % 3) * 16}px;top:${282 - (i % 3) * 30}px;font-size:${sizes[i % 3]}px">Z</div>`);
      el.appendChild(z);
      z.classList.add("go");
      setTimeout(() => z.remove(), 2500);
      await wait(i % 3 === 2 ? 1400 : 500);
    }
  })();
  await wait(2200);

  // ③ 옆 연구실 교수: 오른쪽에서 들어와 왼쪽 방으로
  const rival = new Walker(el, "rival", { height: 296, footY: 800, x: 1460, ms: 55, z: 8 });
  await rival.walkTo(104 - rival.width / 2);
  if (!isCurrent(run)) return;
  doorL.classList.add("open");
  await wait(500);
  await hide(rival.el, 500);
  rival.remove();
  doorL.classList.remove("open");
  await wait(500);
  await show(rivalSeat, 700);
  await wait(1400);

  // ④ 학생 5명이 왼쪽 → 오른쪽 방 문으로
  const centers = [840, 690, 540, 390, 240];
  const walks = five.map((n, i) => {
    const w = new Walker(el, "s" + n, { height: 296, footY: 800, x: -240 - i * 170, z: 8 });
    return w.walkTo(centers[i] - w.width / 2);
  });
  await Promise.all(walks.slice(0, 3));       // 3명이 문 앞에 도착하면
  if (!isCurrent(run)) return;
  doorR.classList.add("open");                  // 문이 열렸다 닫혀요
  await wait(1300);
  doorR.classList.remove("open");
  await Promise.all(walks);
  await wait(1200);

  // ⑤ 화면이 서서히 어두워져요
  await fadeToBlack(2600);
  goToScene(11);
}

/* =========================================================
   Scene11 시간빈곤 설명 (docs/05 화면 1~7, 문장 그대로)
   ========================================================= */
const person = (hi) => `<svg viewBox="0 0 54 72"><circle class="p" ${hi ? "data-hi" : ""} cx="27" cy="16" r="12"/><path class="p" ${hi ? "data-hi" : ""} d="M8 70 C8 44 14 32 27 32 C40 32 46 44 46 70 Z"/></svg>`;
const people = (total, hi) => `<div class="people">${Array.from({ length: total }, (_, i) => person(i < hi)).join("")}</div>`;
const hbar = (label, value, unit, max, hi) =>
  `<div class="hbar"><div class="lab"><span>${label}</span><b>${value}${unit}</b></div>
   <div class="track"><div class="fill ${hi ? "hi" : ""}" data-w="${(value / max) * 100}"></div></div></div>`;
const cite = (t) => `<span class="cite">[${t}]</span>`;

const EXPLAIN = [
  { // 화면 1
    title: "시간빈곤이란",
    text: [
      `<p>하루 24시간은 세 가지로 나뉩니다.</p>`,
      `<p>자고 씻고 먹는 <b>필수시간</b>. 일·집안일·통근 같은 <b>의무시간</b>. 그리고 내가 고를 수 있는 <b>재량시간</b>.</p>`,
      `<p>재량시간이 보통 사람의 60%에도 못 미치거나, 하루 7시간도 자지 못한다면. 우리는 그것을 <b>시간빈곤</b>이라고 부릅니다.</p>${cite("한국노동연구원 패널브리프 제35호, 2026")}`,
    ],
    vis: [
      ``,
      `<div class="chip-row"><div class="chip"><b>필수시간</b>자고 씻고 먹는 시간</div>
        <div class="chip"><b>의무시간</b>일·집안일·통근</div>
        <div class="chip"><b>재량시간</b>내가 고를 수 있는 시간</div></div>`,
      `<div class="chip hi" style="margin-top:22px"><b>시간빈곤</b>재량시간 &lt; 보통 사람의 60%<br>또는 수면 &lt; 하루 7시간</div>`,
    ],
  },
  { // 화면 2
    title: "우리는 이미 덜 자고 있다",
    text: [
      `<p>2024년, 한국인의 평균 수면시간이 1999년 조사를 시작한 뒤 처음으로 줄었습니다.</p>${cite("통계청, 2024년 생활시간조사")}`,
      `<p>2025년 봄, 한국 대학생 4명 중 3명은 시험기간에 7시간을 못 잤습니다.</p>${cite("이후희, 2026 · 대학생 250명")}`,
      `<p style="font-size:32px;font-weight:800">당신은 어젯밤 몇 시간 잤나요?</p>`,
    ],
    vis: [
      `<img src="${A}chars/prof/sleeping.webp" style="height:300px;display:block;margin:0 auto 30px" alt="">`,
      `<div class="chart-title">시험기간에 7시간을 못 잔 대학생</div>${people(4, 3).replace('class="people"', 'class="people" style="gap:28px"')}
       <p style="font-size:20px;margin-top:10px"><b style="color:var(--red)">4명 중 3명</b></p>`,
      ``,
    ],
  },
  { // 화면 3
    title: "AI는 시간을 벌어 준다.<br>모두에게 똑같이는 아니다",
    small: true,
    text: [
      `<p>AI를 일에 쓰는 사람은 1년 사이 51.8%에서 66.5%로 늘었습니다.</p>`,
      `<p>무료 AI를 쓰는 사람은 업무시간을 8.3% 아꼈고, 돈을 내고 쓰는 사람은 11.4%를 아꼈습니다.</p>${cite("한국은행, 2026 · 근로자 조사")}`,
      `<p>AI를 매주 쓰는 사람은 일주일에 5.9시간을 아꼈습니다. 한 달에 한 번 쓰는 사람의 두 배입니다.</p>${cite("Gallup·Walton 재단, 2025 · 미국 교사")}`,
    ],
    vis: [
      `<div class="chart-title">AI를 일에 쓰는 사람</div>${hbar("1년 전", 51.8, "%", 100)}${hbar("지금", 66.5, "%", 100, true)}`,
      `<div class="chart-title" style="margin-top:18px">아낀 업무시간</div>${hbar("무료 AI", 8.3, "%", 12)}${hbar("유료 AI", 11.4, "%", 12, true)}`,
      `<div class="chart-title" style="margin-top:18px">일주일에 아낀 시간</div>${hbar("한 달에 한 번 쓰는 사람", 2.9, "시간", 6.5)}${hbar("매주 쓰는 사람", 5.9, "시간", 6.5, true)}`,
    ],
  },
  { // 화면 4
    title: "아낀 시간은 어디로 갔을까",
    text: [
      `<p>AI로 아낀 시간의 63.1%는 다시 일에 쓰였습니다.</p>${cite("한국은행, 2026")}`,
      `<p>AI 도구를 들인 회사에서, 직원들은 더 빨리 일했고, 더 많은 일을 맡았고, 아무도 시키지 않았는데 더 오래 일했습니다.</p>${cite("Harvard Business Review, 2026 · 미국 기업 8개월 관찰")}`,
      `<p>AI로 생산성이 가장 많이 오른 사람들의 88%는 번아웃을 겪고 있었습니다.</p>${cite("Upwork, 2025")}`,
    ],
    vis: [
      `<div style="display:flex;align-items:center;gap:26px">
        <svg width="230" height="230" viewBox="0 0 230 230"><circle cx="115" cy="115" r="90" fill="none" stroke="#d6d0c3" stroke-width="34"/>
          <circle class="donut" cx="115" cy="115" r="90" fill="none" stroke="#d8322a" stroke-width="34" stroke-linecap="butt"
            stroke-dasharray="565.5" stroke-dashoffset="565.5" data-to="${565.5 * (1 - 0.631)}" transform="rotate(-90 115 115)"
            style="transition:stroke-dashoffset 1.6s cubic-bezier(.2,.7,.3,1)"/>
          <text x="115" y="125" text-anchor="middle" font-size="36" font-weight="800" fill="#2b2925">63.1%</text></svg>
        <p style="font-size:22px;line-height:1.5">아낀 시간 중<br><b style="color:var(--red)">다시 일에 쓰인 시간</b></p></div>`,
      `<img src="${A}chars/prof/working_back.webp" style="height:190px;display:block;margin:18px 0 10px 60px" alt="">`,
      `<div class="chart-title">생산성이 가장 많이 오른 사람 중 번아웃을 겪는 사람</div>${hbar("", 88, "%", 100, true)}`,
    ],
  },
  { // 화면 5
    title: "가장 바쁜 사람은 배울 시간조차 없다",
    text: [
      `<p>AI를 1년 넘게 쓰고 교육도 세 번 이상 받은 사람들에게 물었습니다. 24명 중 11명은 밀린 업무 때문에 AI를 공부할 시간을 낼 수 없다고 답했습니다.</p>`,
      `<p class="quote">"AI를 공부하고 할 이럴 시간이 없어요."</p>${cite("이다겸·이영준, 2026 · 초등교사 면담")}`,
    ],
    vis: [
      `<div class="chart-title">AI를 공부할 시간을 낼 수 없다고 답한 사람</div>
       <div style="width:470px">${people(24, 11)}</div>
       <p style="font-size:22px;margin-top:14px"><b style="color:var(--red)">24명 중 11명</b></p>`,
      ``,
    ],
  },
  { // 화면 6
    title: "닫힌 순환",
    text: [
      `<p>시간이 없다 → 배울 수 없다 → 하던 방식대로 계속 일한다 → 시간은 더 없어진다</p>`,
      `<p>한 연구는 이 순환이 개인의 의지 부족이 아니라, 일하는 환경과 제도가 만든 구조라고 말합니다.</p>${cite("진윤주, 2026 · 외국인 숙련 근로자 연구")}`,
    ],
    vis: [
      `<svg width="560" height="560" viewBox="0 0 560 560" style="overflow:visible">
        <defs><marker id="arrowhead" viewBox="0 0 10 10" refX="2" refY="5" markerUnits="userSpaceOnUse" markerWidth="22" markerHeight="22" orient="auto">
          <path d="M0 0 L10 5 L0 10 Z" fill="#d8322a"/></marker></defs>
        <g class="cycle-arrows" fill="none" stroke="#d8322a" stroke-width="5" stroke-linecap="round" marker-end="url(#arrowhead)">
          <path d="M374 108 A200 200 0 0 1 453 185" pathLength="1"/>
          <path d="M470 347 A200 200 0 0 1 409 438" pathLength="1"/>
          <path d="M186 462 A200 200 0 0 1 107 385" pathLength="1"/>
          <path d="M90 223 A200 200 0 0 1 151 132" pathLength="1"/>
        </g>
        <g font-size="22" font-weight="700" fill="#2b2925" text-anchor="middle">
          ${[[280, 80, "시간이 없다"], [470, 285, "배울 수 없다"], [280, 490, "하던 방식대로 계속 일한다"], [90, 285, "시간은 더 없어진다"]]
            .map(([x, y, t]) => `<g><rect x="${x - 112}" y="${y - 30}" width="224" height="56" rx="22" fill="#fbf8f0" stroke="#2b2925" stroke-width="3"/>
              <text x="${x}" y="${y + 6}" font-size="${t.length > 9 ? 18 : 22}">${t}</text></g>`).join("")}
        </g>
      </svg>`,
      ``,
    ],
  },
];

async function scene11(el, run) {
  await preload([A + "chars/prof/sleeping.webp", A + "chars/prof/working_back.webp"]);
  await fadeFromBlack(800);

  for (let k = 0; k < EXPLAIN.length; k++) {
    const sc = EXPLAIN[k];
    const scr = html(`<div class="ex-screen">
        <div class="ex-text"><h2 ${sc.small ? 'style="font-size:34px"' : ""}>${sc.title}</h2></div>
        <div class="ex-vis"></div>
        <div class="ex-page">${k + 1} / 7</div>
      </div>`);
    const tCol = $(".ex-text", scr), vCol = $(".ex-vis", scr);
    const pairs = sc.text.map((t, i) => {
      const a = html(`<div class="step">${t}</div>`);
      const b = html(`<div class="step">${sc.vis[i] || ""}</div>`);
      if (sc.small) a.querySelector("p").style.fontSize = "23px";
      tCol.appendChild(a); vCol.appendChild(b);
      return [a, b];
    });
    el.appendChild(scr);
    await wait(30);
    scr.classList.add("on");
    await wait(700);

    // 문장을 하나씩 (클릭하면 남은 문장을 한꺼번에)
    let skip = false;
    const skipper = () => (skip = true);
    stage.addEventListener("click", skipper);
    for (const [a, b] of pairs) {
      a.classList.add("on"); b.classList.add("on");
      animateStep(b);
      if (!skip) await wait(2200);
      if (!isCurrent(run)) return;
    }
    stage.removeEventListener("click", skipper);
    await waitClick(300);
    if (!isCurrent(run)) return;
    scr.classList.remove("on");
    await wait(700);
    scr.remove();
  }

  // 화면 7: A엔딩으로 넘어가는 문장 (검은 화면)
  const last = html(`<div class="ex-screen ex-dark"><div class="ex-text">
      <div class="step"><p>당신은 게으르지 않았다. 밤을 새워 일했다.</p></div>
      <div class="step"><p>다만 배울 시간이 없었을 뿐이다. 면담에서 당신이 평가했던 학생들처럼.</p></div>
      <div class="step" style="margin-top:50px"><p style="font-weight:800">시간빈곤은 혼자 더 노력해서 벗어날 수 있는 문제가 아니다.</p></div>
    </div><div class="ex-page">7 / 7</div></div>`);
  el.appendChild(last);
  await wait(30);
  last.classList.add("on");
  await wait(900);
  for (const s of last.querySelectorAll(".step")) { s.classList.add("on"); await wait(2600); }
  await waitClick(300);
  if (!isCurrent(run)) return;
  await fadeToBlack(1500);
  goToScene(12);
}

// 그래프 모션: 막대 늘이기, 사람 칠하기, 도넛 채우기, 화살표 그리기
function animateStep(box) {
  box.querySelectorAll(".fill").forEach((f) => setTimeout(() => (f.style.width = f.dataset.w + "%"), 100));
  [...box.querySelectorAll(".people svg")].forEach((svg, i) =>
    svg.querySelectorAll(".p[data-hi]").forEach((p) => setTimeout(() => p.classList.add("hi"), 300 + i * 90)));
  box.querySelectorAll(".donut").forEach((d) => setTimeout(() => (d.style.strokeDashoffset = d.dataset.to), 100));
  box.querySelectorAll(".cycle-arrows path").forEach((p, i) => {
    p.style.strokeDasharray = 1; p.style.strokeDashoffset = 1;
    p.style.transition = `stroke-dashoffset .7s ease ${0.3 + i * 0.7}s`;
    setTimeout(() => (p.style.strokeDashoffset = 0), 50);
  });
}

/* =========================================================
   Scene12 A엔딩
   ========================================================= */
async function scene12(el, run) {
  await preload([A + "bg/regret.jpg"]);
  el.append(
    html(`<img class="full" src="${A}bg/regret.jpg" alt="몇 년 뒤, 후회하는 교수">`),
    html(`<div class="end-text">
        <p class="when">몇 년 뒤,</p>
        <h1>배울 시간조차<br>없었던 후회</h1>
        <button class="btn" id="restart">처음부터 다시</button>
      </div>`)
  );
  await fadeFromBlack(2000);
  await wait(500);
  const [when, h1, btn] = [".when", "h1", ".btn"].map((s) => $(s, el));
  await show(when, 1000); await wait(900);
  await show(h1, 1400); await wait(1400);
  await show(btn, 800);
  btn.onclick = () => (location.href = location.pathname);
}

/* =========================================================
   시작
   주소 끝에 ?scene=5 처럼 붙이면 그 장면부터 볼 수 있어요 (확인용).
   Scene3은 학생이 필요해서 ?scene=3 이면 1번 학생으로 시작해요.
   ========================================================= */
const SCENES = { 1: scene1, 2: scene2, 3: scene3, 4: scene4, 5: scene5, 6: scene6,
                 7: scene7, 8: scene8, 9: scene9, 10: scene10, 11: scene11, 12: scene12 };

const params = new URLSearchParams(location.search);
const start = Number(params.get("scene")) || 1;
if (start === 3) { state.current = 1; curtain.classList.add("closed"); }
if (start >= 4) { fader.style.opacity = 1; }
goToScene(start);
