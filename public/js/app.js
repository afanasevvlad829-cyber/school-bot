(function(){
  const tg = window.Telegram?.WebApp;
  const C = window.APP_CONFIG;

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

  // mode ui
  const modeExplain = document.getElementById("modeExplain");
  const modeMemeBtn = document.getElementById("modeMeme");
  const modeToxicBtn = document.getElementById("modeToxic");
  const modeEvilBtn = document.getElementById("modeEvil");

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

  const statsBtn = document.getElementById("statsBtn");
  const statsModal = document.getElementById("statsModal");
  const statsCloseBg = document.getElementById("statsCloseBg");
  const statsCloseBtn = document.getElementById("statsCloseBtn");
  const statsRefreshBtn = document.getElementById("statsRefreshBtn");
  const statsBackBtn = document.getElementById("statsBackBtn");
  const statsTitle = document.getElementById("statsTitle");
  const statsMeta = document.getElementById("statsMeta");
  const statsBody = document.getElementById("statsBody");

  function logErr(msg){
    if (!errBox) return;
    errBox.textContent += (errBox.textContent ? "\n" : "") + msg;
  }
  window.onerror = (m, src, line, col) => logErr(`JS error: ${m} @${line}:${col}`);
  window.onunhandledrejection = (e) => logErr("Promise error: " + (e.reason?.message || e.reason || "unknown"));

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

  function uid(){
    return (crypto?.randomUUID?.() || ("s_" + Math.random().toString(16).slice(2) + Date.now()));
  }

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
      mode: "meme", // meme|toxic|evil
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

  /**
   * ✅ FIXED FOR YOUR CURRENT GAS doPost:
   * GAS expects JSON body: { payload: {...} }
   * so we send exactly that + Content-Type text/plain (stable for GAS).
   */
  async function sendSessionRow(reason){
    try{
      const tgUser = getTgUser();

      // GAS читает payload.*
      const payload = {
        ...stats,
        ...tgUser,
        reason: reason || "unknown"
      };

      const res = await fetch(C.STATS_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ payload }),
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

  function withUtm(baseUrl, content){
    const u = new URL(baseUrl);
    const utm = C.UTM || {};
    u.searchParams.set("utm_source", utm.utm_source || "tg_miniapp");
    u.searchParams.set("utm_medium", utm.utm_medium || "schoolchat_test");
    u.searchParams.set("utm_campaign", utm.utm_campaign || "cta");
    u.searchParams.set("utm_content", content || "unknown");
    u.searchParams.set("bot", C.BOT_USERNAME);
    if (stats?.result) u.searchParams.set("type", stats.result);
    u.searchParams.set("sid", sessionId);
    return u.toString();
  }

  // ===== MODE =====
  let mode = "meme"; // meme|toxic|evil
  function setMode(next){
    mode = next;
    stats.mode = mode;

    const all = [modeMemeBtn, modeToxicBtn, modeEvilBtn];
    all.forEach(b => b.classList.remove("isActive"));
    all.forEach(b => b.setAttribute("aria-selected","false"));

    if (mode === "meme") {
      modeMemeBtn.classList.add("isActive");
      modeMemeBtn.setAttribute("aria-selected","true");
      modeExplain.textContent = "Мемно — узнаваемо и смешно. Можно кидать всем.";
    } else if (mode === "toxic") {
      modeToxicBtn.classList.add("isActive");
      modeToxicBtn.setAttribute("aria-selected","true");
      modeExplain.textContent = "Токсично — язвительно и колко. Без мата, но с правдой.";
    } else {
      modeEvilBtn.classList.add("isActive");
      modeEvilBtn.setAttribute("aria-selected","true");
      modeExplain.textContent = "Злобно — максимально жёстко. Если ты в ресурсе и тебе можно 😈";
    }
  }
  modeMemeBtn.onclick = () => setMode("meme");
  modeToxicBtn.onclick = () => setMode("toxic");
  modeEvilBtn.onclick = () => setMode("evil");
  setMode("meme");

  // ===== state =====
  let usedAccuracy = false;
  let idx = 0;
  let score = {};
  let questions = [];
  let baseLen = 0;

  function show(screen){
    Object.values(screens).forEach(s => s.style.display = "none");
    screens[screen].style.display = "block";
  }

  function addScore(map){
    map = map || {};
    for (const [k,v] of Object.entries(map)) {
      score[k] = (score[k] || 0) + (Number(v) || 0);
    }
  }

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

  function renderTypeDescriptionHTML(typeObj){
    const d = (mode === "meme") ? typeObj.soft : (mode === "toxic" ? typeObj.toxic : typeObj.evil);
    const bullets = (d.bullets || []).map(x => `<li style="margin:6px 0">${x}</li>`).join("");
    const refs = (typeObj.refs || []).map(r => `<li style="margin:6px 0">${r}</li>`).join("");

    return `
      <div class="avatarRow">
        ${renderAvatar(typeObj.id)}
        <div>
          <div style="font-size:16px; line-height:1.25; font-weight:900">${d.title}</div>
          <div class="typeTag">${typeObj.meme}</div>
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

      <div class="divider"></div>
      <div class="muted small" style="font-weight:800; opacity:.9">Примеры из кино/мультов:</div>
      <ul style="margin:8px 0 0; padding-left:18px; font-size:14px; line-height:1.4">
        ${refs}
      </ul>
    `;
  }

  function pluralClick(n){
    if (n === 1) return "клик";
    if (n >= 2 && n <= 4) return "клика";
    return "кликов";
  }

  function renderQuestion(){
    try {
      const q = questions[idx];
      const total = questions.length;

      if (!q) { renderResult(); return; }

      progressPill.textContent = `Вопрос ${idx+1}/${total}`;

      const left = Math.max(0, total - (idx + 1));
      microPill.textContent = left === 0
        ? `диагноз готов 😈`
        : `ещё ${left} ${pluralClick(left)} до диагноза`;

      qText.textContent = q.q || "(пустой вопрос)";
      answersEl.innerHTML = "";

      const answers = Array.isArray(q.a) ? q.a : [];
      answers.forEach((opt, optIndex) => {
        const b = document.createElement("button");
        b.className = "btn";
        b.textContent = opt?.t || `(вариант ${optIndex+1})`;

        b.onclick = () => {
          try {
            stats.answers.push({ q_index: idx, option: opt?.t || "", ts: Date.now() });
            addScore(opt?.s || {});
            idx++;

            if (!usedAccuracy && idx === baseLen) {
              show("accuracy");
              return;
            }

            if (idx < total) renderQuestion();
            else renderResult();
          } catch (e) {
            logErr("CLICK ERROR: " + (e?.message || String(e)));
          }
        };

        answersEl.appendChild(b);
      });
    } catch (e) {
      logErr("renderQuestion ERROR: " + (e?.message || String(e)));
    }
  }

  function pickBaseQuestions(){
    if (mode === "meme") return window.QUESTIONS.MEME_BASE;
    if (mode === "toxic") return window.QUESTIONS.TOXIC_BASE;
    return window.QUESTIONS.EVIL_BASE;
  }
  function pickAccuracyQuestions(){
    if (mode === "meme") return window.QUESTIONS.MEME_ACCURACY;
    if (mode === "toxic") return window.QUESTIONS.TOXIC_ACCURACY;
    return window.QUESTIONS.EVIL_ACCURACY;
  }

  function renderResult(){
    try{
      const { t1, t2 } = top2Types();
      const best = window.TYPES.find(x=>x.id===t1[0]) || window.TYPES[0];
      const second = window.TYPES.find(x=>x.id===t2[0]) || null;
      const delta = (t1[1] - (t2?.[1] ?? 0));

      stats.result = best.id;
      stats.finish_ts = new Date().toISOString();

      rTitle.textContent = `Ты — ${best.name}`;
      const modeLabel = (mode==="meme" ? "Мемно" : (mode==="toxic" ? "Токсично" : "Злобно"));
      rSubtitle.textContent = `${modeLabel} • ${best.meme}` + (usedAccuracy ? " • точность включена" : "");

      const html = renderTypeDescriptionHTML(best);

      const secondBlock = (delta <= 1 && second) ? `
        <div class="divider"></div>
        <div class="muted small">Ты на грани с:</div>
        <div class="avatarRow" style="margin-top:8px">
          ${renderAvatar(second.id)}
          <div>
            <div style="font-size:14px; font-weight:900">${second.name}</div>
            <div class="typeTag">${second.meme}</div>
          </div>
        </div>
      ` : "";

      rBody.innerHTML = html + secondBlock + `
        <div class="divider"></div>
        <div class="muted small">📸 Скринь и кидай в чат. Это легально.</div>
      `;

      show("result");
      sendSessionRow("finish");
    } catch(e){
      logErr("renderResult ERROR: " + (e?.message || String(e)));
    }
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

  startBtn.onclick = () => {
    resetStats();
    stats.open_ts = stats.open_ts || new Date().toISOString();
    stats.start_ts = new Date().toISOString();

    score = {};
    idx = 0;
    usedAccuracy = false;
    stats.accuracy = false;

    const base = pickBaseQuestions();
    baseLen = base.length;
    questions = [...base];

    show("quiz");
    renderQuestion();
  };

  accuracyBtn.onclick = () => {
    usedAccuracy = true;
    stats.accuracy = true;

    const base = pickBaseQuestions();
    const acc = pickAccuracyQuestions();
    baseLen = base.length;
    questions = [...base, ...acc];

    show("quiz");
    renderQuestion();
  };

  skipAccuracyBtn.onclick = () => {
    usedAccuracy = false;
    stats.accuracy = false;
    renderResult();
  };

  shareBtn.onclick = () => { stats.share_count += 1; doCopy(false); sendSessionRow("share"); };
  memeBtn.onclick  = () => { stats.meme_copy_count += 1; doCopy(true); sendSessionRow("meme_copy"); };
  restartBtn.onclick = () => { stats.restart_count += 1; show("start"); sendSessionRow("restart"); };

  codimsBtn.onclick = () => {
    stats.cta_codims += 1;
    const url = withUtm(C.CODIMS_URL, "cta_codims");
    if (tg?.openLink) tg.openLink(url); else window.location.href = url;
    sendSessionRow("cta_codims");
  };

  ctaBtn.onclick = () => {
    stats.cta_aidacamp += 1;
    const url = withUtm(C.AIDACAMP_URL, "cta_aidacamp");
    if (tg?.openLink) tg.openLink(url); else window.location.href = url;
    sendSessionRow("cta_aidacamp");
  };

  // ===== Global stats (как было) =====
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
  function fillStatsTo100Smart(realTotal, realCounts){
    const ids = window.TYPES.map(t=>t.id);
    const K = ids.length;

    const total = Math.max(0, Number(realTotal||0));
    const counts = {};
    ids.forEach(id => counts[id] = Number(realCounts?.[id] || 0));

    if (total >= 100) return { total, counts, demo:false, added:0 };

    const need = 100 - total;
    const alpha = 1.5;
    const denom = total + alpha * K;
    const p = ids.map(id => (counts[id] + alpha) / denom);

    const seedStr = `${todayKey()}|${total}|${C.BOT_USERNAME}`;
    const rng = mulberry32(hashStrToSeed(seedStr));

    for (let n=0;n<need;n++){
      const r = rng();
      let cum = 0;
      for (let i=0;i<ids.length;i++){
        cum += p[i];
        if (r <= cum) { counts[ids[i]] += 1; break; }
      }
    }
    return { total: 100, counts, demo:true, added: need };
  }

  let lastStatsView = null;

  function renderGlobalStatsList(view){
    lastStatsView = view;

    statsTitle.textContent = "📊 Общая статистика";
    statsMeta.textContent = "";
    statsBackBtn.style.display = "none";

    const myType = stats.result;

    const rows = window.TYPES.map(t => {
      const n = Number(view.counts?.[t.id] || 0);
      const pct = view.total ? Math.round((n/view.total)*100) : 0;
      return { t, n, pct };
    }).sort((a,b)=> b.n - a.n);

    statsBody.innerHTML = rows.map(({t,pct}) => {
      const you = (myType && t.id === myType);
      return `
        <div class="statLine ${you ? "youHere" : ""}" data-type="${t.id}">
          <div class="statLeft">
            <div class="avatar" style="width:44px;height:44px;flex:0 0 44px">${window.TYPE_SVG[t.id] || ""}</div>
            <div style="min-width:0">
              <div class="statName">${t.emoji} ${t.name} ${you ? `<span class="tagYou">Ты здесь</span>` : ""}</div>
            </div>
          </div>
          <div style="text-align:right">
            <div class="statPct">${pct}%</div>
            <div class="statCount">от общего</div>
          </div>
        </div>
      `;
    }).join("");

    [...statsBody.querySelectorAll(".statLine")].forEach(el => {
      el.addEventListener("click", () => {
        const id = el.getAttribute("data-type");
        openTypeFromStats(id);
      });
    });
  }

  function openTypeFromStats(typeId){
    const t = window.TYPES.find(x=>x.id===typeId);
    if (!t) return;

    statsTitle.textContent = `${t.emoji} ${t.name}`;
    statsMeta.textContent = "";
    statsBackBtn.style.display = "inline-block";

    // описание по текущему режиму
    statsBody.innerHTML = `
      <div class="card" style="margin:0; background:#10121a">
        ${renderTypeDescriptionHTML(t)}
      </div>
    `;
  }

  async function showGlobalStats(){
    openStatsModal();
    statsTitle.textContent = "📊 Общая статистика";
    statsMeta.textContent = "";
    statsBody.innerHTML = `<div class="muted">Загружаю…</div>`;

    try{
      const json = await fetchGlobalStats();
      if (!json || !json.ok) throw new Error("bad stats response");

      const view = fillStatsTo100Smart(json.total || 0, json.counts || {});
      renderGlobalStatsList(view);
    }catch(e){
      const view = fillStatsTo100Smart(0, {});
      renderGlobalStatsList(view);
    }
  }

  statsBtn.onclick = () => showGlobalStats();
  statsCloseBg.onclick = () => closeStatsModal();
  statsCloseBtn.onclick = () => closeStatsModal();
  statsRefreshBtn.onclick = () => showGlobalStats();
  statsBackBtn.onclick = () => {
    if (lastStatsView) renderGlobalStatsList(lastStatsView);
    else showGlobalStats();
  };

  const u = getTgUser();
  userHint.textContent = u.username
    ? `Ты в Telegram как: ${u.first_name || ""} ${u.last_name || ""} (${u.username})`.trim()
    : `Ты в Telegram как: ${u.first_name || ""} ${u.last_name || ""}`.trim();

  webappHint.textContent = (tg ? `WebApp detected: ✅ (${tg.platform || "unknown"})` : `WebApp detected: ❌`);

  trackOpenWhenReady();
})();
