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
  const statsBackBtn = document.getElementById("statsBackBtn");
  const statsTitle = document.getElementById("statsTitle");
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

  // ===== 1-row stats buffer =====
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
    }
