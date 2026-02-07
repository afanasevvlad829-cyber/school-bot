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
      answers: [],        // [{q_index, option, ts}]
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

      // ✅ IMPORTANT: no headers to avoid preflight
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

  // If user closes early — try to flush once
  window.addEventListener("pagehide", () => {
    // только если уже стартовал
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
  let toxicInitialized = false;
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

  // ===== toxic toggle (log only on user click) =====
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

    // не шлём “события” отдельно — всё уйдёт одной строкой в конце
    // но отметку сохраним в stats
  }

  toxicSwitch.addEventListener("click", () => {
    if (!toxicInitialized) toxicInitialized = true;
    setToxic(!toxicMode);
  });

  setToxic(false); // init without noise
  toxicInitialized = true;

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
        // save answer to 1-row stats
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

    // ✅ отправляем одну строку по завершению
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
    // reset quiz stats
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
    // не шлём отдельной строкой, но можно “додать” отправкой обновления:
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
    // не сбрасываем sessionId, чтобы видеть ретрай как часть сессии
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

  // ===== init hints =====
  const u = getTgUser();
  userHint.textContent = u.username
    ? `Ты в Telegram как: ${u.first_name || ""} ${u.last_name || ""} (${u.username})`.trim()
    : `Ты в Telegram как: ${u.first_name || ""} ${u.last_name || ""}`.trim();

  webappHint.textContent = (tg ? `WebApp detected: ✅ (${tg.platform || "unknown"})` : `WebApp detected: ❌`);

  // open timestamp
  trackOpenWhenReady();
})();
