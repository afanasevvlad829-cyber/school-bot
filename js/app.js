(function(){
  const tg = window.Telegram?.WebApp;
  const C = window.APP_CONFIG;

  // ===== UI refs =====
  const screens = {
    start: document.getElementById("screen-start"),
    quiz: document.getElementById("screen-quiz"),
    accuracy: document.getElementById("screen-accuracy"),
    result: document.getElementById("screen-result"),
  };

  const qText = document.getElementById("qText");
  const answersEl = document.getElementById("answers");
  const progressPill = document.getElementById("progressPill");
  const microPill = document.getElementById("microPill");
  const userHint = document.getElementById("userHint");
  const webappHint = document.getElementById("webappHint");
  const errBox = document.getElementById("errBox");

  const toxicSwitch = document.getElementById("toxicSwitch");
  const toxicLabel = document.getElementById("toxicLabel");
  const toxicExplain = document.getElementById("toxicExplain");

  const startBtn = document.getElementById("startBtn");
  const accuracyBtn = document.getElementById("accuracyBtn");
  const skipAccuracyBtn = document.getElementById("skipAccuracyBtn");

  const rTitle = document.getElementById("rTitle");
  const rSubtitle = document.getElementById("rSubtitle");
  const rBody = document.getElementById("rBody");

  const shareBtn = document.getElementById("shareBtn");
  const memeBtn = document.getElementById("memeBtn");
  const restartBtn = document.getElementById("restartBtn");
  const ctaBtn = document.getElementById("ctaBtn");
  const codimsBtn = document.getElementById("codimsBtn");

  // stats modal refs
  const statsBtn = document.getElementById("statsBtn");
  const statsModal = document.getElementById("statsModal");
  const statsCloseBg = document.getElementById("statsCloseBg");
  const statsCloseBtn = document.getElementById("statsCloseBtn");
  const statsRefreshBtn = document.getElementById("statsRefreshBtn");
  const statsMeta = document.getElementById("statsMeta");
  const statsBody = document.getElementById("statsBody");

  // ===== errors =====
  function logErr(msg){
    if (!errBox) return;
    errBox.textContent += (errBox.textContent ? "\n" : "") + msg;
  }
  window.onerror = (m) => logErr("JS error: " + m);
  window.onunhandledrejection = (e) => logErr("Promise error: " + (e.reason?.message || e.reason || "unknown"));

  // ===== telegram init =====
  try {
    if (tg) {
      tg.expand();
      tg.ready();
      tg.setHeaderColor?.("#0b0c10");
      tg.setBackgroundColor?.("#0b0c10");
    }
  } catch {}

  function hasTgUser(){
    const u = tg?.initDataUnsafe?.user;
    return !!(u && u.id);
  }

  function getTgUser(){
    const u = tg?.initDataUnsafe?.user || {};
    return {
      user_id: u.id || null,
      username: u.username ? `@${u.username}` : null,
      first_name: u.first_name || null,
      last_name: u.last_name || null,
      platform: tg?.platform || "unknown",
      chat_type: tg?.initDataUnsafe?.chat_type || null,
    };
  }

  // ===== session id =====
  function uid(){
    return (crypto?.randomUUID?.() || ("s_" + Math.random().toString(16).slice(2) + Date.now()));
  }

  // ===== 1-row stats buffer (send once) =====
  let sessionId = uid();
  let stats = null;

  function resetStats(){
    sessionId = uid();
    stats = {
      session_id: sessionId,
      bot: C.BOT_USERNAME,
      open_ts: null,
      start_ts: null,
      finish_ts: null,
      toxic: false,
      accuracy: false,
      result: null,
      answers: [],
      share_count: 0,
      meme_copy_count: 0,
      cta_aidacamp: 0,
      cta_codims: 0,
      restart_count: 0,
      notes: {}
    };
  }

  resetStats();

  async function sendSessionRow(reason){
    try{
      const payload = {
        ...stats,
        ...getTgUser(),
        reason: reason || "unknown"
      };

      const res = await fetch(C.STATS_URL, {
        method: "POST",
        body: JSON.stringify({ mode: "session", payload }),
        keepalive: true
      });

      if (!res.ok) {
        const t = await res.text().catch(()=>"(no body)");
        logErr(`stats send failed: ${res.status}\n${t.slice(0,180)}`);
      }
    } catch(e){
      logErr("stats send error: " + (e?.message || String(e)));
    }
  }

  window.addEventListener("pagehide", () => {
    if (stats?.start_ts && !stats.finish_ts) {
      stats.notes.abandoned = true;
      sendSessionRow("pagehide");
    }
  });

  function trackOpenWhenReady(){
    const startedAt = Date.now();
    const tick = () => {
      if (hasTgUser()) {
        stats.open_ts = new Date().toISOString();
        stats.notes.waited_ms = Date.now() - startedAt;
        return;
      }
      if (Date.now() - startedAt > 2000) {
        stats.open_ts = new Date().toISOString();
        stats.notes.no_user_after_2s = true;
        stats.notes.initData_len = tg?.initData ? tg.initData.length : 0;
        return;
      }
      setTimeout(tick, 150);
    };
    tick();
  }

  // ===== UTM builder =====
  function withUtm(baseUrl, content){
    const u = new URL(baseUrl);
    const utm = C.UTM;
    u.searchParams.set("utm_source", utm.utm_source);
    u.searchParams.set("utm_medium", utm.utm_medium);
    u.searchParams.set("utm_campaign", utm.utm_campaign);
    u.searchParams.set("utm_content", content);
    u.searchParams.set("bot", C.BOT_USERNAME);
    if (stats?.result) u.searchParams.set("type", stats.result);
    u.searchParams.set("sid", sessionId);
    return u.toString();
  }

  // ===== state =====
  let toxicMode = false;
  let usedAccuracy = false;

  let idx = 0;
  let score = {};
  let questions = [];

  function show(screen){
    Object.values(screens).forEach(s => s.style.display = "none");
    screens[screen].style.display = "block";
  }

  function addScore(map){
    for (const [k,v] of Object.entries(map)) score[k] = (score[k]||0) + v;
  }

  // ===== toxic toggle (no extra rows) =====
  function setToxic(on){
    toxicMode = !!on;
    stats.toxic = toxicMode;

    if (toxicMode) {
      toxicSwitch.classList.add("on");
      toxicSwitch.setAttribute("aria-checked","true");
      toxicLabel.textContent = "Режим токсик: ON";
      toxicExplain.textContent = "ON — язвительно и “как в чате”. OFF — мягко и по-доброму.";
    } else {
      toxicSwitch.classList.remove("on");
      toxicSwitch.setAttribute("aria-checked","false");
      toxicLabel.textContent = "Режим токсик: OFF";
      toxicExplain.textContent = "OFF — мягко и по-доброму. ON — язвительно и “как в реальном чате”.";
    }
  }

  toxicSwitch.addEventListener("click", () => setToxic(!toxicMode));
  setToxic(false);

  // ===== scoring =====
  function top2Types(){
    const entries = window.TYPES.map(t => [t.id, score[t.id] || 0]);
    entries.sort((a,b)=>b[1]-a[1]);
    return { t1: entries[0], t2: entries[1] };
  }

  function buildResultText(best, second, delta, short=false){
    const add = (delta <= 1 && second) ? ` (и чуть-чуть ${second.name})` : "";
    if (short) return `Я — ${best.emoji} ${best.name}${add}. ${best.meme} 😈  @${C.BOT_USERNAME}`;

    const deeplink = `https://t.me/${C.BOT_USERNAME}?startapp=${C.startapp}`;
    return `Я прошёл(ла) тест «Какой ты родитель в школьном чате?» 😈
Результат: ${best.name}${add}
${best.meme}

Пройди тоже: ${deeplink}`;
  }

  function renderAvatar(typeId){
    const svg = window.TYPE_SVG?.[typeId] || "";
    return `<div class="avatar">${svg}</div>`;
  }

  function renderQuestion(){
    const q = questions[idx];
    const total = questions.length;

    progressPill.textContent = `Вопрос ${idx+1}/${total}`;
    microPill.textContent = `ещё ${Math.max(0,total-(idx+1))} клика до диагноза`;
    qText.textContent = q.q;

    answersEl.innerHTML = "";
    q.a.forEach(opt => {
      const b = document.createElement("button");
      b.className = "btn";
      b.textContent = opt.t;
      b.onclick = () => {
        stats.answers.push({ q_index: idx, option: opt.t, ts: Date.now() });
        addScore(opt.s);
        idx++;

        if (!usedAccuracy && idx === window.QUESTIONS.BASE.length) {
          show("accuracy");
          return;
        }

        if (idx < total) renderQuestion();
        else renderResult();
      };
      answersEl.appendChild(b);
    });
  }

  function renderResult(){
    const { t1, t2 } = top2Types();
    const best = window.TYPES.find(x=>x.id===t1[0]) || window.TYPES[0];
    const second = window.TYPES.find(x=>x.id===t2[0]) || null;
    const delta = (t1[1] - (t2?.[1] ?? 0));

    stats.result = best.id;
    stats.finish_ts = new Date().toISOString();

    const mode = toxicMode ? "toxic" : "soft";
    const d = best[mode];

    rTitle.textContent = `Ты — ${best.name}`;
    rSubtitle.textContent = (toxicMode ? `Режим токсик: ON • ${best.meme}` : best.meme) + (usedAccuracy ? " • точность включена" : "");

    const bullets = d.bullets.map(x => `<li style="margin:6px 0">${x}</li>`).join("");

    rBody.innerHTML = `
      <div class="avatarRow">
        ${renderAvatar(best.id)}
        <div>
          <div style="font-size:16px; line-height:1.25; font-weight:800">${d.title}</div>
          <div class="typeTag">${best.meme}</div>
        </div>
      </div>

      <div class="divider"></div>

      <ul style="margin:0; padding-left:18px; font-size:15px; line-height:1.45">
        ${bullets}
      </ul>

      <div class="divider"></div>

      <div style="font-size:14px; line-height:1.45">
        <div><b>${d.strengths}</b></div>
        <div style="margin-top:8px"><b>${d.risks}</b></div>
        <div style="margin-top:10px" class="muted">${d.tip}</div>
      </div>

      ${delta <= 1 && second ? `
        <div class="divider"></div>
        <div class="muted small">Ты на грани с:</div>
        <div class="avatarRow" style="margin-top:8px">
          ${renderAvatar(second.id)}
          <div>
            <div style="font-size:14px; font-weight:700">${second.name}</div>
            <div class="typeTag">${second.meme}</div>
          </div>
        </div>
      ` : ``}

      <div class="divider"></div>
      <div class="muted small">📸 Скринь и кидай в чат. Это легально.</div>
    `;

    show("result");
    sendSessionRow("finish");
  }

  async function doCopy(short=false){
    const { t1, t2 } = top2Types();
    const best = window.TYPES.find(x=>x.id===t1[0]) || window.TYPES[0];
    const second = window.TYPES.find(x=>x.id===t2[0]) || null;
    const delta = (t1[1] - (t2?.[1] ?? 0));
    const text = buildResultText(best, second, delta, short);

    try {
      await navigator.clipboard.writeText(text);
      tg?.showPopup?.({
        title:"Скопировано",
        message: short ? "Короткий мем в буфере 😈" : "Текст результата в буфере 😄",
        buttons:[{type:"ok"}]
      });
    } catch {
      tg?.showPopup?.({ title:"Не вышло скопировать", message:"Скопируй вручную.", buttons:[{type:"ok"}] });
    }
  }

  // ===== buttons =====
  startBtn.onclick = () => {
    resetStats();
    stats.open_ts = stats.open_ts || new Date().toISOString();
    stats.start_ts = new Date().toISOString();

    score = {};
    idx = 0;
    usedAccuracy = false;
    stats.accuracy = false;

    questions = [...window.QUESTIONS.BASE];

    show("quiz");
    renderQuestion();
  };

  accuracyBtn.onclick = () => {
    usedAccuracy = true;
    stats.accuracy = true;
    questions = [...window.QUESTIONS.BASE, ...window.QUESTIONS.ACCURACY];
    show("quiz");
    renderQuestion();
  };

  skipAccuracyBtn.onclick = () => {
    usedAccuracy = false;
    stats.accuracy = false;
    renderResult();
  };

  shareBtn.onclick = () => {
    stats.share_count += 1;
    doCopy(false);
    sendSessionRow("share");
  };

  memeBtn.onclick = () => {
    stats.meme_copy_count += 1;
    doCopy(true);
    sendSessionRow("meme_copy");
  };

  restartBtn.onclick = () => {
    stats.restart_count += 1;
    show("start");
    sendSessionRow("restart");
  };

  codimsBtn.onclick = () => {
    stats.cta_codims += 1;
    const url = withUtm(C.CODIMS_URL, "cta_codims");
    if (tg?.openLink) tg.openLink(url);
    else window.location.href = url;
    sendSessionRow("cta_codims");
  };

  ctaBtn.onclick = () => {
    stats.cta_aidacamp += 1;
    const url = withUtm(C.AIDACAMP_URL, "cta_aidacamp");
    if (tg?.openLink) tg.openLink(url);
    else window.location.href = url;
    sendSessionRow("cta_aidacamp");
  };

  // ===== Global stats (smart fill to 100) =====
  function openStatsModal(){ statsModal.style.display = "block"; }
  function closeStatsModal(){ statsModal.style.display = "none"; }

  function hashStrToSeed(str){
    let h = 2166136261;
    for (let i=0;i<str.length;i++){
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  // deterministic rng
  function mulberry32(a){
    return function(){
      let t = a += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function todayKey(){
    const d = new Date();
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const dd = String(d.getDate()).padStart(2,'0');
    return `${d.getFullYear()}-${mm}-${dd}`;
  }

  async function fetchGlobalStats(){
    const url = new URL(C.STATS_URL);
    url.searchParams.set("mode","stats");
    const res = await fetch(url.toString(), { method:"GET" });
    return await res.json();
  }

  // smart: keep real, add synthetic until 100 (stable per day)
  function fillStatsTo100Smart(realTotal, realCounts){
    const ids = window.TYPES.map(t=>t.id);
    const K = ids.length;

    const total = Math.max(0, Number(realTotal||0));
    const counts = {};
    ids.forEach(id => counts[id] = Number(realCounts?.[id] || 0));

    if (total >= 100) return { total, counts, demo:false, added:0 };

    const target = 100;
    const need = target - total;

    // smoothing: alpha ~ 1.5 (можно менять)
    const alpha = 1.5;

    // probabilities
    const denom = total + alpha * K;
    const p = ids.map(id => (counts[id] + alpha) / denom);

    // stable rng per day + sheet total (чтобы при росте немного менялось)
    const seedStr = `${todayKey()}|${total}|${C.BOT_USERNAME}`;
    const rng = mulberry32(hashStrToSeed(seedStr));

    // multinomial sampling: need draws
    for (let n=0;n<need;n++){
      const r = rng();
      let cum = 0;
      for (let i=0;i<ids.length;i++){
        cum += p[i];
        if (r <= cum) { counts[ids[i]] += 1; break; }
      }
    }

    return { total: target, counts, demo:true, added: need };
  }

  function renderGlobalStats(view){
    const ids = window.TYPES.map(t=>t.id);

    const demoBadge = view.demo ? `<span class="badgeDemo">Демо (добавили +${view.added} до 100)</span>` : "";
    statsMeta.innerHTML = `Всего прошли: <b>${view.demo ? (view.total - view.added) : view.total}</b>${demoBadge}`;

    const rows = window.TYPES.map(t => {
      const n = Number(view.counts?.[t.id] || 0);
      const pct = view.total ? Math.round((n/view.total)*100) : 0;
      return { t, n, pct };
    }).sort((a,b)=> b.n - a.n);

    statsBody.innerHTML = rows.map(({t,n,pct}) => `
      <div class="statLine">
        <div class="statLeft">
          <div class="avatar" style="width:44px;height:44px;flex:0 0 44px">${window.TYPE_SVG[t.id] || ""}</div>
          <div style="min-width:0">
            <div class="statName">${t.emoji} ${t.name}</div>
            <div class="statCount">n=${n}</div>
          </div>
        </div>
        <div style="text-align:right">
          <div class="statPct">${pct}%</div>
          <div class="statCount">от общего</div>
        </div>
      </div>
    `).join("");
  }

  async function showGlobalStats(){
    openStatsModal();
    statsMeta.textContent = "Загружаю…";
    statsBody.innerHTML = "";

    try{
      const json = await fetchGlobalStats();
      if (!json || !json.ok) throw new Error("bad stats response");

      const view = fillStatsTo100Smart(json.total || 0, json.counts || {});
      renderGlobalStats(view);
    }catch(e){
      // если API недоступно — показываем “добавление до 100” от нулевых
      const view = fillStatsTo100Smart(0, {});
      statsMeta.innerHTML = `Всего прошли: <b>0</b><span class="badgeDemo">Демо (API недоступно)</span>`;
      renderGlobalStats(view);
    }
  }

  statsBtn.onclick = () => showGlobalStats();
  statsCloseBg.onclick = () => closeStatsModal();
  statsCloseBtn.onclick = () => closeStatsModal();
  statsRefreshBtn.onclick = () => showGlobalStats();

  // ===== init hints =====
  const u = getTgUser();
  userHint.textContent = u.username
    ? `Ты в Telegram как: ${u.first_name || ""} ${u.last_name || ""} (${u.username})`.trim()
    : `Ты в Telegram как: ${u.first_name || ""} ${u.last_name || ""}`.trim();

  webappHint.textContent = (tg ? `WebApp detected: ✅ (${tg.platform || "unknown"})` : `WebApp detected: ❌`);

  trackOpenWhenReady();
})();
