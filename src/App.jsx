import { useState, useEffect, useRef, useCallback } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, collection, setDoc, getDoc, getDocs } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

const ADMIN_PASS_HASH = import.meta.env.VITE_ADMIN_PASS_HASH;
const ADMIN_SECRET = import.meta.env.VITE_ADMIN_SECRET;
const ADMIN_HASH = import.meta.env.VITE_ADMIN_HASH;

const META_DOC      = "bgis2026_finals_meta";
const SUBS_COL      = "bgis2026_finals_submissions";
const LB_META_DOC   = "bgis2026_lb_meta";
const LB_PAGE_PREFIX= "bgis2026_lb_page_";
const USERS_COL     = "bgis2026_finals_users";
const DEADLINE      = new Date("2026-03-27T07:30:00Z");

const LS_TOKEN      = "bgis2026f_token";
const LS_DOCID      = "bgis2026f_docid";
const LS_META       = "bgis2026f_meta";
const LS_MY_SUB     = "bgis2026f_my_sub";
const LS_LB_META    = "bgis2026f_lb_meta";
const LS_LB_PAGE    = "bgis2026f_lb_page_";
const META_TTL      = 20 * 60 * 1000; // 20 minutes
const PAGE_SIZE     = 500;

const LOGO = (name) => `/logos/${name}.png`;

// ── Teams ─────────────────────────────────────────────────────────
const TEAMS = [
  { id:"genesis",   name:"Genesis Esports",        logo:"Genesis_Esports",        igl:"Gravity",   players:["Gravity","Viper","Zap","HunterZ","Fury"] },
  { id:"godlike",   name:"Hero Xtreme GodLike",    logo:"Hero_Xtreme_GodLike",    igl:"Manya",     players:["Manya","Admino","Spower","Jonathan","Godz"] },
  { id:"k9",        name:"K9 Esports",             logo:"K9_Esports",             igl:"Omegaaa",   players:["Omegaaa","NinjaBoi","Slug","Knight","Ryzenbotx"] },
  { id:"metaninza", name:"Meta Ninza",              logo:"Meta_Ninza",             igl:"Shadow7",   players:["Shadow7","Fierce","Apollo","WhiteTiger","Javin"] },
  { id:"myth",      name:"Myth Esports",            logo:"Myth_Esports",           igl:"Detrox",    players:["Detrox","Harshil","Lucifer","Daddy","Aryton"] },
  { id:"nebula",    name:"Nebula Esports",          logo:"Nebula_Esports",         igl:"Aadi",      players:["Aadi","Phoenix","KRATOS","KNOWME","Ryu"] },
  { id:"orangutan", name:"iQOO Orangutan",          logo:"iQOO_Orangutan",         igl:"Aaru",      players:["Aaru","AKop","Attanki","WizzGOD"] },
  { id:"reckoning", name:"iQOO Reckoning Esports", logo:"iQOO_Reckoning_Esports", igl:"Roman",     players:["Roman","Levi","Lovish","Godx","SahilOpAf"] },
  { id:"revenant",  name:"iQOO Revenant XSpark",   logo:"iQOO_Revenant_XSpark",   igl:"Punkk",     players:["Punkk","NinjaJOD","Pain","Tracegod","JD"] },
  { id:"lfp",       name:"Learn from Past",         logo:"Learn_from_Past",        igl:"Honey",     players:["Honey","Max","Rushboy","Termi"] },
  { id:"soul",      name:"iQOO SouL",               logo:"iQOO_SouL",              igl:"Nakul",     players:["Nakul","Goblin","LEGIT","Jokerr","Thunder"] },
  { id:"tamilas",   name:"iQOO Team Tamilas",       logo:"iQOO_Team_Tamilas",      igl:"MrIGL",     players:["MrIGL","Reaper","AimGod","FoxOP"] },
  { id:"vasista",   name:"Vasista Esports",          logo:"Vasista_Esports",        igl:"Hector",    players:["Hector","Beast","Saumay","Shayaan","FusionOP"] },
  { id:"vs",        name:"Victores Sumus",           logo:"Victores_Sumus",         igl:"Owais",     players:["Owais","Mafia","Venom","Scarryjod","Sarang"] },
  { id:"welt",      name:"Welt Esports",             logo:"Welt_Esports",           igl:"Gokul",     players:["Gokul","Justy","Proton","Shyam","Maxioso"] },
  { id:"wyld",      name:"Wyld Fangs",               logo:"Wyld_Fangs",             igl:"SenseiOG",  players:["SenseiOG","Kanha","Spraygod","Goten","Sam"] },
];

const SHORT = {
  "Genesis Esports":        "GENS",
  "Hero Xtreme GodLike":   "HX-GODL",
  "K9 Esports":            "K9",
  "Meta Ninza":            "NINZA",
  "Myth Esports":          "MYTH",
  "Nebula Esports":        "NBE",
  "iQOO Orangutan":        "IQ-OG",
  "iQOO Reckoning Esports":"IQ-RGE",
  "iQOO Revenant XSpark":  "IQ-RNTX",
  "Learn from Past":       "LEFP",
  "iQOO SouL":             "IQ-SOUL",
  "iQOO Team Tamilas":     "IQ-TT",
  "Vasista Esports":       "VE",
  "Victores Sumus":        "VS",
  "Welt Esports":          "WELT",
  "Wyld Fangs":            "WF",
};
const sn = (name) => SHORT[name] || name;
const ALL_IGLS = TEAMS.map(t => ({ player:t.igl, team:t.name, teamId:t.id, logo:t.logo }));

// ── Scoring ───────────────────────────────────────────────────────
function calcPredictionScore(picks, results) {
  if (!results || !picks) return null;
  let score = 0;
  const { top5, champion, finalsMvp, eventMvp, bestIgl, mostFinishes } = picks;
  if (results.top5 && top5) top5.forEach(t => { if (results.top5.includes(t)) score += t===champion?30:10; });
  if (results.finalsMvp && finalsMvp) {
    if (finalsMvp[0]===results.finalsMvp) score+=50;
    else if (finalsMvp[1]===results.finalsMvp||finalsMvp[2]===results.finalsMvp) score+=20;
  }
  if (results.eventMvp && eventMvp) {
    if (eventMvp[0]===results.eventMvp) score+=40;
    else if (eventMvp[1]===results.eventMvp||eventMvp[2]===results.eventMvp) score+=20;
  }
  if (results.bestIgl && bestIgl===results.bestIgl) score+=25;
  if (results.mostFinishes && mostFinishes===results.mostFinishes) score+=20;
  return score;
}

function calcFantasyScore(picks, fantasyData) {
  if (!fantasyData||!picks) return null;
  const { top5, champion, finalsMvp } = picks;
  let score = 0;
  if (top5&&fantasyData.teamPoints) {
    top5.forEach(name => {
      const t = TEAMS.find(t=>t.name===name);
      if (t&&fantasyData.teamPoints[t.id]!=null) {
        const pts = fantasyData.teamPoints[t.id];
        score += name===champion ? Math.round(pts*1.5) : pts;
      }
    });
  }
  if (finalsMvp&&fantasyData.playerKills) {
    (Array.isArray(finalsMvp)?finalsMvp:[finalsMvp]).forEach((p,i)=>{
      const k=fantasyData.playerKills[p];
      if (k!=null) score += i===0?Math.round(k*1.5):k;
    });
  }
  return score;
}

// ── Tiebreaker sort ───────────────────────────────────────────────
// 1. Total score
// 2. Champion correct
// 3. Finals MVP (1st > 2nd > 3rd)
// 4. Event MVP (1st > 2nd > 3rd)
// 5. More correct teams in top5
// 6. Top5 rank order (position accuracy)
// 7. Best IGL correct
// 8. Earlier submission
function tiebreakerSort(a, b, results) {
  if (!results) return new Date(a.createdAt||0) - new Date(b.createdAt||0);

  // 1. Total score
  if (b.score !== a.score) return b.score - a.score;

  // 2. Champion correct
  const aChampCorrect = a.champion && results.champion && a.champion===results.champion ? 1 : 0;
  const bChampCorrect = b.champion && results.champion && b.champion===results.champion ? 1 : 0;
  if (bChampCorrect !== aChampCorrect) return bChampCorrect - aChampCorrect;

  // 3. Finals MVP (1st choice=2, 2nd choice=1, 3rd choice=0)
  const mvpRank = (picks, result) => {
    if (!picks||!result) return -1;
    if (picks[0]===result) return 2;
    if (picks[1]===result) return 1;
    if (picks[2]===result) return 0;
    return -1;
  };
  const aFmvp = mvpRank(a.finalsMvp, results.finalsMvp);
  const bFmvp = mvpRank(b.finalsMvp, results.finalsMvp);
  if (bFmvp !== aFmvp) return bFmvp - aFmvp;

  // 4. Event MVP
  const aEmvp = mvpRank(a.eventMvp, results.eventMvp);
  const bEmvp = mvpRank(b.eventMvp, results.eventMvp);
  if (bEmvp !== aEmvp) return bEmvp - aEmvp;

  // 5. More correct teams in top5
  const countCorrect = (top5) => results.top5 ? (top5||[]).filter(t=>results.top5.includes(t)).length : 0;
  const aCorrect = countCorrect(a.top5), bCorrect = countCorrect(b.top5);
  if (bCorrect !== aCorrect) return bCorrect - aCorrect;

  // 6. Top5 rank order — cascade through positions
  if (results.top5) {
    for (let i=0; i<results.top5.length; i++) {
      const correctTeam = results.top5[i];
      if (!correctTeam) continue;
      const aHas = (a.top5||[])[i]===correctTeam ? 1 : 0;
      const bHas = (b.top5||[])[i]===correctTeam ? 1 : 0;
      if (bHas !== aHas) return bHas - aHas;
    }
  }

  // 7. Best IGL correct
  const aIgl = a.bestIgl && results.bestIgl && a.bestIgl===results.bestIgl ? 1 : 0;
  const bIgl = b.bestIgl && results.bestIgl && b.bestIgl===results.bestIgl ? 1 : 0;
  if (bIgl !== aIgl) return bIgl - aIgl;

  // 8. Earlier submission wins
  return new Date(a.createdAt||a.timestamp||0) - new Date(b.createdAt||b.timestamp||0);
}

// ── Meta caching (20 min TTL) ─────────────────────────────────────
function getCachedMeta() {
  try {
    const cached = JSON.parse(localStorage.getItem(LS_META)||"null");
    if (!cached) return null;
    if (Date.now() - cached.fetchedAt > META_TTL) return null;
    return cached.data;
  } catch { return null; }
}
function setCachedMeta(data) {
  try { localStorage.setItem(LS_META, JSON.stringify({ data, fetchedAt: Date.now() })); } catch {}
}
function invalidateMetaCache() {
  try { localStorage.removeItem(LS_META); } catch {}
}

// ── My submission caching ─────────────────────────────────────────
function getCachedSub(username) {
  try {
    const cached = JSON.parse(localStorage.getItem(LS_MY_SUB)||"null");
    if (cached && cached.username === username) return cached;
    return null;
  } catch { return null; }
}
function setCachedSub(sub) {
  try { localStorage.setItem(LS_MY_SUB, JSON.stringify(sub)); } catch {}
}

// ── LB cache helpers ──────────────────────────────────────────────
function getCachedLbMeta(version) {
  try {
    const cached = JSON.parse(localStorage.getItem(LS_LB_META)||"null");
    if (cached && cached.version === version) return cached;
    return null;
  } catch { return null; }
}
function setCachedLbMeta(data) {
  try { localStorage.setItem(LS_LB_META, JSON.stringify(data)); } catch {}
}
function getCachedLbPage(version, page) {
  try {
    const cached = JSON.parse(localStorage.getItem(LS_LB_PAGE+page)||"null");
    if (cached && cached.version === version) return cached.entries;
    return null;
  } catch { return null; }
}
function setCachedLbPage(version, page, entries) {
  try { localStorage.setItem(LS_LB_PAGE+page, JSON.stringify({ version, entries })); } catch {}
}
function invalidateLbCache() {
  try {
    localStorage.removeItem(LS_LB_META);
    for (let i=0; i<100; i++) localStorage.removeItem(LS_LB_PAGE+i);
  } catch {}
}

// ── Helpers ───────────────────────────────────────────────────────
async function hashPin(pin) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pin));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,"0")).join("");
}
function fmtTime(iso) {
  return new Date(iso).toLocaleString("en-IN",{timeZone:"Asia/Kolkata",day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"});
}
function timeLeft() {
  const diff = DEADLINE.getTime()-Date.now();
  if (diff<=0) return null;
  const d=Math.floor(diff/86400000),h=Math.floor((diff%86400000)/3600000),m=Math.floor((diff%3600000)/60000);
  if (d>0) return d+"d "+h+"h left";
  if (h>0) return h+"h "+m+"m left";
  return m+"m left";
}
const isClosed = () => new Date() > DEADLINE;

// ── CSS ───────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Rajdhani:wght@600;700&display=swap');
  *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
  html { scroll-behavior:smooth; }
  body { background:#f0f4ff; font-family:'Inter',sans-serif; color:#0f172a; -webkit-font-smoothing:antialiased; overflow-x:hidden; }
  .app { min-height:100vh; display:flex; flex-direction:column; }
  .wrap { max-width:1200px; margin:0 auto; padding:0 24px; flex:1; }

  .hero { background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1a56db 100%); padding:28px 16px 24px; text-align:center; position:relative; overflow:hidden; }
  .hero::after { content:''; position:absolute; inset:0; background:radial-gradient(ellipse at 50% 120%,rgba(26,86,219,.25),transparent 70%); pointer-events:none; }
  .hero-logo { height:64px; object-fit:contain; margin-bottom:10px; position:relative; z-index:1; }
  .hero-title { font-family:'Rajdhani',sans-serif; font-size:clamp(26px,5.5vw,50px); font-weight:700; color:#fff; line-height:1; position:relative; z-index:1; margin-bottom:4px; }
  .hero-title span { color:#60a5fa; }
  .hero-sub { font-size:12px; color:rgba(255,255,255,.6); position:relative; z-index:1; margin-bottom:12px; }
  .hero-badges { display:flex; justify-content:center; align-items:center; gap:7px; flex-wrap:wrap; position:relative; z-index:1; }
  .badge { display:inline-flex; align-items:center; gap:5px; padding:4px 11px; border-radius:20px; font-size:11px; font-weight:600; }
  .badge-green { background:rgba(34,197,94,.12); border:1px solid rgba(34,197,94,.3); color:#86efac; }
  .badge-red { background:rgba(239,68,68,.12); border:1px solid rgba(239,68,68,.3); color:#fca5a5; }
  .badge-blue { background:rgba(96,165,250,.15); border:1px solid rgba(96,165,250,.35); color:#93c5fd; }
  .badge-dot { width:6px; height:6px; border-radius:50%; background:currentColor; }
  .badge-dot.pulse { animation:pulse 1.5s infinite; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
  .tour-link { display:inline-flex; align-items:center; gap:5px; font-size:11px; font-weight:600; color:#fff; text-decoration:none; background:rgba(255,255,255,.12); border:1px solid rgba(255,255,255,.25); border-radius:20px; padding:4px 11px; transition:all .15s; }
  .tour-link:hover { background:rgba(255,255,255,.2); }

  .content-grow { flex:1; display:flex; flex-direction:column; }
  .score-strip { background:#fff; border-bottom:1px solid #e2e8f0; padding:7px 16px; display:flex; gap:14px; overflow-x:auto; font-size:11px; font-weight:600; color:#475569; scrollbar-width:none; }
  .score-strip::-webkit-scrollbar { display:none; }
  .si { display:flex; align-items:center; gap:4px; white-space:nowrap; }
  .sd { width:7px; height:7px; border-radius:50%; display:inline-block; }

  .nav { background:#fff; border-bottom:2px solid #e2e8f0; display:flex; overflow-x:auto; position:sticky; top:0; z-index:50; box-shadow:0 2px 8px rgba(15,23,42,.06); scrollbar-width:none; }
  .nav::-webkit-scrollbar { display:none; }
  .nb { flex-shrink:0; padding:13px 18px; font-family:'Inter',sans-serif; font-size:13px; font-weight:600; color:#64748b; background:none; border:none; border-bottom:3px solid transparent; margin-bottom:-2px; cursor:pointer; white-space:nowrap; transition:all .15s; }
  .nb:hover { color:#0f172a; }
  .nb.active { color:#1a56db; border-bottom-color:#1a56db; }

  .card { background:#fff; border:1.5px solid #e2e8f0; border-radius:14px; padding:18px; margin-bottom:14px; }
  .card-title { font-family:'Rajdhani',sans-serif; font-size:17px; font-weight:700; color:#0f172a; margin-bottom:12px; padding-bottom:10px; border-bottom:1px solid #f1f5f9; display:flex; align-items:center; gap:8px; }
  .sec-label { font-size:10px; font-weight:700; letter-spacing:.12em; text-transform:uppercase; color:#94a3b8; margin-bottom:9px; }

  .auth-card { background:#fff; border:1.5px solid #e2e8f0; border-radius:14px; padding:22px; margin-bottom:14px; }
  .auth-title { font-size:15px; font-weight:700; color:#0f172a; margin-bottom:5px; }
  .auth-sub { font-size:13px; color:#64748b; margin-bottom:16px; line-height:1.6; }

  .input { width:100%; background:#f8faff; border:1.5px solid #e2e8f0; border-radius:10px; padding:11px 13px; font-size:14px; font-family:'Inter',sans-serif; color:#0f172a; outline:none; transition:border-color .15s,box-shadow .15s; }
  .input:focus { border-color:#1a56db; box-shadow:0 0 0 3px rgba(26,86,219,.08); }
  .input::placeholder { color:#94a3b8; }
  .input.err { border-color:#ef4444; }
  .pin-input { text-align:center; font-size:26px; font-weight:800; letter-spacing:.22em; font-family:'Rajdhani',sans-serif; }

  .btn { display:inline-flex; align-items:center; justify-content:center; gap:6px; font-family:'Inter',sans-serif; font-size:13px; font-weight:600; border-radius:8px; padding:9px 15px; cursor:pointer; transition:all .15s; border:1.5px solid; white-space:nowrap; }
  .btn:disabled { opacity:.45; cursor:not-allowed; }
  .btn-primary { background:#1a56db; border-color:#1a56db; color:#fff; box-shadow:0 4px 12px rgba(26,86,219,.25); }
  .btn-primary:hover:not(:disabled) { background:#1648c0; transform:translateY(-1px); }
  .btn-outline { background:transparent; border-color:#cbd5e1; color:#475569; }
  .btn-outline:hover:not(:disabled) { border-color:#1a56db; color:#1a56db; background:rgba(26,86,219,.04); }
  .btn-green { background:rgba(22,163,74,.08); border-color:rgba(22,163,74,.3); color:#15803d; }
  .btn-green:hover:not(:disabled) { background:rgba(22,163,74,.14); }
  .btn-red { background:rgba(239,68,68,.08); border-color:rgba(239,68,68,.3); color:#dc2626; }
  .btn-purple { background:rgba(139,92,246,.08); border-color:rgba(139,92,246,.3); color:#7c3aed; }
  .btn-row { display:flex; gap:8px; flex-wrap:wrap; }
  .btn-full { width:100%; font-size:15px; padding:13px 20px; }

  .user-bar { display:flex; align-items:center; gap:10px; background:rgba(22,163,74,.06); border:1px solid rgba(22,163,74,.2); border-radius:10px; padding:10px 14px; margin-bottom:14px; flex-wrap:wrap; }
  .user-bar-name { font-size:15px; font-weight:700; flex:1; }

  .steps { display:flex; margin-bottom:18px; border-radius:10px; overflow:hidden; border:1px solid #e2e8f0; }
  .step { flex:1; padding:10px 6px; text-align:center; font-size:10px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; color:#94a3b8; background:#fff; border-right:1px solid #e2e8f0; }
  .step:last-child { border-right:none; }
  .step.active { color:#1a56db; background:rgba(26,86,219,.05); }
  .step.done { color:#16a34a; background:rgba(22,163,74,.05); }
  .sn { display:inline-flex; width:15px; height:15px; border-radius:50%; background:#e2e8f0; align-items:center; justify-content:center; font-size:9px; margin-right:3px; vertical-align:middle; }
  .step.active .sn { background:#1a56db; color:#fff; }
  .step.done .sn { background:#16a34a; color:#fff; }

  .teams-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(96px,1fr)); gap:8px; margin-bottom:14px; }
  @media(max-width:400px) { .teams-grid { grid-template-columns:repeat(3,1fr); } }
  .team-card { background:#fff; border:1.5px solid #e2e8f0; border-radius:10px; padding:10px 6px 8px; display:flex; flex-direction:column; align-items:center; gap:5px; cursor:pointer; transition:all .15s; font-family:'Inter',sans-serif; position:relative; min-height:76px; text-align:center; }
  .team-card:hover:not(:disabled):not(.selected) { border-color:#1a56db; background:rgba(26,86,219,.04); transform:translateY(-2px); box-shadow:0 4px 12px rgba(26,86,219,.1); }
  .team-card.selected { border-color:#1a56db; background:rgba(26,86,219,.06); }
  .team-card.champ-pick { border-color:#f59e0b; background:rgba(245,158,11,.07); box-shadow:0 0 0 2px rgba(245,158,11,.2); }
  .team-card:disabled { opacity:.4; cursor:not-allowed; }
  .team-logo { width:40px; height:40px; object-fit:contain; }
  .team-name { font-size:10px; font-weight:600; color:#0f172a; line-height:1.2; }
  .tbadge { position:absolute; top:3px; left:3px; font-size:10px; font-weight:700; background:#1a56db; color:#fff; border-radius:4px; padding:1px 4px; line-height:1.4; }
  .tbadge.gold { background:#f59e0b; }

  .slots-list { display:flex; flex-direction:column; gap:6px; margin-bottom:12px; }
  .drag-slot { display:flex; align-items:center; gap:9px; background:#f8faff; border:1.5px solid #1a56db; border-radius:10px; padding:8px 11px; cursor:grab; user-select:none; transition:all .15s; }
  .drag-slot:active { cursor:grabbing; }
  .drag-slot.is-champ { border-color:#f59e0b; background:rgba(245,158,11,.06); }
  .drag-slot.drag-over { transform:scale(1.01); box-shadow:0 4px 12px rgba(26,86,219,.15); }
  .drag-handle { color:#cbd5e1; font-size:15px; flex-shrink:0; }
  .drag-num { font-family:'Rajdhani',sans-serif; font-size:17px; font-weight:700; color:#1a56db; min-width:20px; text-align:center; flex-shrink:0; }
  .drag-slot.is-champ .drag-num { color:#f59e0b; }
  .drag-logo { width:26px; height:26px; object-fit:contain; flex-shrink:0; }
  .drag-name { font-size:13px; font-weight:600; flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .drag-actions { display:flex; align-items:center; gap:5px; flex-shrink:0; }
  .champ-btn { font-size:10px; font-weight:600; padding:2px 7px; border-radius:6px; cursor:pointer; border:1.5px solid #cbd5e1; background:transparent; color:#64748b; font-family:'Inter',sans-serif; transition:all .15s; white-space:nowrap; }
  .champ-btn.on { background:rgba(245,158,11,.12); border-color:#f59e0b; color:#92400e; }
  .rm-btn { width:19px; height:19px; border-radius:50%; background:rgba(239,68,68,.1); border:1px solid rgba(239,68,68,.2); color:#dc2626; font-size:9px; display:flex; align-items:center; justify-content:center; cursor:pointer; flex-shrink:0; }

  .banner { border-radius:10px; padding:9px 13px; margin-bottom:12px; font-size:12px; font-weight:600; line-height:1.5; }
  .banner.amber { background:rgba(245,158,11,.08); border:1px solid rgba(245,158,11,.25); color:#92400e; }
  .banner.blue { background:rgba(26,86,219,.06); border:1px solid rgba(26,86,219,.2); color:#1e40af; }
  .banner.green { background:rgba(22,163,74,.06); border:1px solid rgba(22,163,74,.2); color:#14532d; }

  .toast { position:fixed; bottom:24px; left:50%; transform:translateX(-50%); background:#16a34a; color:#fff; font-weight:700; font-size:13px; padding:11px 20px; border-radius:10px; z-index:999; white-space:nowrap; box-shadow:0 4px 20px rgba(0,0,0,.15); animation:tin .25s ease; }
  .toast.err { background:#dc2626; }
  @keyframes tin { from{opacity:0;transform:translateX(-50%) translateY(8px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }

  .loading { text-align:center; padding:48px 20px; color:#94a3b8; }
  .spinner { width:28px; height:28px; border:3px solid #e2e8f0; border-top-color:#1a56db; border-radius:50%; animation:spin .7s linear infinite; margin:0 auto 12px; }
  @keyframes spin { to{transform:rotate(360deg)} }

  .locked { background:#fff; border:1.5px solid #e2e8f0; border-radius:14px; padding:40px 20px; text-align:center; margin-bottom:14px; }
  .locked-icon { font-size:36px; margin-bottom:10px; }
  .locked-title { font-family:'Rajdhani',sans-serif; font-size:19px; font-weight:700; color:#0f172a; margin-bottom:5px; }
  .locked-sub { font-size:13px; color:#64748b; line-height:1.6; }

  .chips { display:flex; flex-wrap:wrap; gap:4px; }
  .chip { font-size:10px; font-weight:600; padding:2px 7px; border-radius:4px; background:#f1f5f9; border:1px solid #e2e8f0; color:#475569; }
  .chip.correct { background:rgba(22,163,74,.1); border-color:rgba(22,163,74,.3); color:#16a34a; }
  .chip.champion { background:rgba(245,158,11,.1); border-color:rgba(245,158,11,.3); color:#92400e; }

  /* Leaderboard search + pagination */
  .lb-search { width:100%; background:#fff; border:1.5px solid #e2e8f0; border-radius:10px; padding:10px 14px 10px 38px; font-size:13px; font-family:'Inter',sans-serif; color:#0f172a; outline:none; transition:border-color .15s; margin-bottom:12px; }
  .lb-search:focus { border-color:#1a56db; box-shadow:0 0 0 3px rgba(26,86,219,.08); }
  .lb-search-wrap { position:relative; margin-bottom:12px; }
  .lb-search-icon { position:absolute; left:12px; top:50%; transform:translateY(-50%); color:#94a3b8; font-size:14px; pointer-events:none; }
  .lb-search { margin-bottom:0; }

  .pagination { display:flex; align-items:center; justify-content:center; gap:8px; margin-top:14px; flex-wrap:wrap; }
  .page-btn { display:inline-flex; align-items:center; justify-content:center; min-width:36px; height:36px; padding:0 10px; border-radius:8px; border:1.5px solid #e2e8f0; background:#fff; font-size:13px; font-weight:600; color:#475569; cursor:pointer; transition:all .15s; font-family:'Inter',sans-serif; }
  .page-btn:hover:not(:disabled) { border-color:#1a56db; color:#1a56db; background:rgba(26,86,219,.04); }
  .page-btn.active { background:#1a56db; border-color:#1a56db; color:#fff; }
  .page-btn:disabled { opacity:.4; cursor:not-allowed; }
  .page-info { font-size:12px; font-weight:600; color:#64748b; padding:0 4px; }

  .lb-tabs { display:flex; border:1.5px solid #e2e8f0; border-radius:10px; overflow:hidden; margin-bottom:14px; width:fit-content; }
  .lb-tab { padding:8px 16px; font-size:12px; font-weight:600; background:none; border:none; cursor:pointer; font-family:'Inter',sans-serif; color:#64748b; transition:all .15s; border-right:1px solid #e2e8f0; }
  .lb-tab:last-child { border-right:none; }
  .lb-tab.active { background:#0f172a; color:#fff; }

  .tbl { width:100%; border-collapse:separate; border-spacing:0; background:#fff; border:1.5px solid #e2e8f0; border-radius:12px; overflow:hidden; font-size:12px; }
  .tbl th { background:#f8faff; color:#94a3b8; font-size:9px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; padding:9px 11px; border-bottom:1.5px solid #e2e8f0; text-align:left; }
  .tbl td { padding:9px 11px; border-bottom:1px solid #f1f5f9; vertical-align:middle; }
  .tbl tr:last-child td { border-bottom:none; }
  .tbl tr:hover td { background:rgba(26,86,219,.02); }
  .rank-c { font-family:'Rajdhani',sans-serif; font-size:20px; font-weight:700; color:#94a3b8; text-align:center; width:38px; }
  .score-pill { font-family:'Rajdhani',sans-serif; font-size:15px; font-weight:700; color:#1a56db; }
  .fantasy-score { font-family:'Rajdhani',sans-serif; font-size:14px; font-weight:700; color:#7c3aed; }

  .admin-box { background:#fff; border:1.5px solid #e2e8f0; border-radius:12px; padding:18px; margin-bottom:14px; }
  .admin-title { font-family:'Rajdhani',sans-serif; font-size:15px; font-weight:700; color:#0f172a; margin-bottom:11px; padding-bottom:9px; border-bottom:1px solid #f1f5f9; }
  .alabel { font-size:10px; font-weight:700; color:#94a3b8; margin-bottom:4px; text-transform:uppercase; letter-spacing:.05em; }
  .aselect { background:#f8faff; border:1.5px solid #e2e8f0; border-radius:8px; padding:7px 9px; color:#0f172a; font-size:12px; font-family:'Inter',sans-serif; outline:none; width:100%; }
  .aselect:focus { border-color:#1a56db; }
  .agrid { display:grid; grid-template-columns:repeat(auto-fill,minmax(140px,1fr)); gap:9px; margin-bottom:12px; }
  .del-btn { background:none; border:1px solid #e2e8f0; border-radius:6px; padding:3px 8px; font-size:10px; font-weight:600; color:#94a3b8; cursor:pointer; font-family:'Inter',sans-serif; }
  .del-btn:hover { border-color:#ef4444; color:#dc2626; background:rgba(239,68,68,.06); }
  .fi-wrap { display:flex; flex-direction:column; gap:3px; }
  .fi { background:#f8faff; border:1.5px solid #e2e8f0; border-radius:7px; padding:6px 9px; font-size:12px; font-family:'Inter',sans-serif; color:#0f172a; outline:none; width:100%; }
  .fi:focus { border-color:#1a56db; }
  .fi-label { font-size:10px; font-weight:600; color:#64748b; }
  .info-row { display:flex; gap:12px; align-items:center; font-size:12px; color:#64748b; flex-wrap:wrap; }
  .info-row strong { color:#0f172a; }
  .err-text { font-size:11px; color:#dc2626; font-weight:600; margin-top:5px; }


  /* PC two-column layout */
  .pc-two-col { display:grid; grid-template-columns:1fr 1fr; gap:16px; align-items:start; }
  @media(max-width:700px) { .pc-two-col { grid-template-columns:1fr; } }

  /* Top 5 picks column */
  .picks-col { display:flex; flex-direction:column; gap:6px; }

  /* Teams grid 4 columns on PC for top5 selection */
  .teams-grid-pc { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; }
  @media(max-width:700px) { .teams-grid-pc { grid-template-columns:repeat(3,1fr); } }

  /* Accordion two columns on PC */
  .acc-grid { display:grid; grid-template-columns:1fr 1fr; gap:7px; }
  @media(max-width:700px) { .acc-grid { grid-template-columns:1fr; } }


  /* Top social bar */
  .topbar { background:#0f172a; padding:6px 16px; display:flex; align-items:center; justify-content:space-between; gap:10px; }
  .topbar-brand { font-size:11px; font-weight:600; color:rgba(255,255,255,.45); }
  .topbar-brand span { color:rgba(255,255,255,.75); }
  .topbar-socials { display:flex; align-items:center; gap:2px; margin-left:auto; }
  .topbar-social { display:inline-flex; align-items:center; justify-content:center; gap:5px; padding:4px 10px; border-radius:6px; font-size:11px; font-weight:600; text-decoration:none; color:rgba(255,255,255,.6); transition:all .15s; white-space:nowrap; }
  .topbar-social:hover { color:#fff; background:rgba(255,255,255,.1); }
  @media(max-width:480px) { .topbar-brand { display:none; } .topbar-social span { display:none; } .topbar-social { padding:5px 7px; } }

  /* Footer */
  .footer { background:#0f172a; padding:28px 16px 24px; margin-top:auto; }
  .footer-logo { height:38px; object-fit:contain; opacity:.9; display:block; margin:0 auto 18px; }
  .footer-links { display:flex; justify-content:center; gap:16px; flex-wrap:wrap; margin-bottom:14px; }
  .footer-link { font-size:11px; font-weight:600; color:rgba(255,255,255,.5); text-decoration:none; transition:color .15s; }
  .footer-link:hover { color:rgba(255,255,255,.9); }
  .footer-divider { border:none; border-top:1px solid rgba(255,255,255,.08); margin:14px 0; }
  .footer-promo { text-align:center; font-size:12px; color:rgba(255,255,255,.45); line-height:1.6; }
  .footer-promo a { color:#60a5fa; text-decoration:none; font-weight:600; }
  .footer-promo a:hover { color:#93c5fd; }
  .footer-made { text-align:center; font-size:10px; color:rgba(255,255,255,.25); margin-top:12px; }


  @media(max-width:600px) {
    .hero { padding:20px 14px 18px; }
    .hero-logo { height:52px; }
    .wrap { padding:0 12px; }
    .card { padding:14px; }
    .nb { padding:11px 13px; font-size:12px; }
    .drag-name { font-size:12px; }
    .tbl { font-size:11px; }
    .tbl th { font-size:8px; padding:7px 8px; }
    .tbl td { padding:7px 8px; }
    .pagination { gap:5px; }
    .page-btn { min-width:32px; height:32px; font-size:12px; }
  }
`;


// ── Share Card Generator (template-based) ────────────────────────
async function generateShareCard(picks, publishedResults, fantasyData, identity) {
  const canvas = document.createElement("canvas");
  const W = 1080, H = 1920;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");

  try {
    const f1 = new FontFace("Archivo", "url(https://fonts.gstatic.com/s/archivo/v19/k3kPo8UDI-1M0wlSV9XAw6lQkqWY8Q.woff2)", {weight:"600"});
    const f2 = new FontFace("Archivo", "url(https://fonts.gstatic.com/s/archivo/v19/k3kPo8UDI-1M0wlSdV9XAw6lQkqWY8Q.woff2)", {weight:"500"});
    await Promise.all([f1.load(), f2.load()]);
    document.fonts.add(f1); document.fonts.add(f2);
  } catch {}

  const F = "Archivo, Inter, sans-serif";

  const loadImg = (src) => new Promise((res) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = src;
  });

  const rr = (x,y,w,h,r,fill,stroke,sw=1.5) => {
    ctx.beginPath();
    ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y);
    ctx.quadraticCurveTo(x+w,y,x+w,y+r);
    ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
    ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r);
    ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y);
    ctx.closePath();
    if (fill) { ctx.fillStyle=fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle=stroke; ctx.lineWidth=sw; ctx.stroke(); }
  };

  // Draw template
  const tmpl = await loadImg("/logos/story.png");
  if (tmpl) ctx.drawImage(tmpl, 0, 0, W, H);
  else { ctx.fillStyle="#f5f5f5"; ctx.fillRect(0,0,W,H); }

  // ── USERNAME inside pill box ──
  // Pill: x=454-619, top border y=292, center y=330
  const uname = (identity?.username || "player").toUpperCase();
  ctx.save();
  ctx.font = `600 28px ${F}`;
  ctx.fillStyle = "#1a1a1a";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(uname, 536, 330);
  ctx.restore();

  // ── LAYOUT: content zone y=380 to y=1760, total=1380px ──
  // row_h=170 × 5 = 850, box_h=120 × 2rows = 240
  // fixed overhead = 36+10+30+16+12 = 104 → total = 1194 → leftover 186 → distribute as padding
  const PAD = 60;
  const INNER_W = W - PAD*2; // 960px
  const ROW_H = 170;
  const BOX_H = 120;
  const CONTENT_TOP = 380;
  const CONTENT_BOT = 1755;
  const TOTAL_AVAIL = CONTENT_BOT - CONTENT_TOP; // 1375
  const FIXED = 36 + 10 + (5*ROW_H) + 30 + 16 + (2*BOX_H) + 12;
  const LEFTOVER = TOTAL_AVAIL - FIXED; // leftover to distribute
  const TOP_PAD = Math.floor(LEFTOVER * 0.15); // small top breathing room

  let y = CONTENT_TOP + TOP_PAD;

  // TOP 5 PICKS label
  ctx.save();
  ctx.font = `600 24px ${F}`;
  ctx.fillStyle = "rgba(0,0,0,0.30)";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.letterSpacing = "3px";
  ctx.fillText("TOP 5 PICKS", PAD, y);
  ctx.letterSpacing = "0px";
  ctx.fillStyle = "#1a56db";
  ctx.fillRect(PAD, y+5, 44, 2.5);
  ctx.restore();
  y += 36 + 10;

  // ── 5 team rows — no gaps, shared borders ──
  const top5 = picks.top5 || [];
  const champ = picks.champion;

  for (let i=0; i<top5.length; i++) {
    const team = TEAMS.find(t=>t.name===top5[i]);
    const isChamp = top5[i]===champ;
    const ry = y + i*ROW_H;
    const midY = ry + ROW_H/2;
    const isFirst = i===0, isLast = i===top5.length-1;

    // Row background
    const tl = isFirst?12:0, tr = isFirst?12:0, br = isLast?12:0, bl = isLast?12:0;
    ctx.beginPath();
    ctx.moveTo(PAD+tl, ry);
    ctx.lineTo(PAD+INNER_W-tr, ry); ctx.quadraticCurveTo(PAD+INNER_W, ry, PAD+INNER_W, ry+tr);
    ctx.lineTo(PAD+INNER_W, ry+ROW_H-br); ctx.quadraticCurveTo(PAD+INNER_W, ry+ROW_H, PAD+INNER_W-br, ry+ROW_H);
    ctx.lineTo(PAD+bl, ry+ROW_H); ctx.quadraticCurveTo(PAD, ry+ROW_H, PAD, ry+ROW_H-bl);
    ctx.lineTo(PAD, ry+tl); ctx.quadraticCurveTo(PAD, ry, PAD+tl, ry);
    ctx.closePath();
    ctx.fillStyle = isChamp ? "rgba(245,158,11,0.10)" : "rgba(0,0,0,0.04)";
    ctx.fill();
    ctx.strokeStyle = isChamp ? "rgba(245,158,11,0.50)" : "rgba(0,0,0,0.10)";
    ctx.lineWidth = isChamp ? 2 : 1;
    ctx.stroke();

    // Separator line between rows
    if (!isLast) {
      ctx.fillStyle = isChamp ? "rgba(245,158,11,0.2)" : "rgba(0,0,0,0.07)";
      ctx.fillRect(PAD+1, ry+ROW_H-1, INNER_W-2, 1);
    }

    // Rank
    ctx.save();
    ctx.font = `600 28px ${F}`;
    ctx.fillStyle = isChamp ? "#d97706" : "rgba(0,0,0,0.22)";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("#"+(i+1), PAD+22, midY);
    ctx.restore();

    // Logo
    const lsz = 66;
    const lx = PAD+88, ly = midY-lsz/2;
    if (team) {
      const li = await loadImg(LOGO(team.logo));
      if (li) {
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(lx, ly, lsz, lsz, 8);
        ctx.clip();
        ctx.drawImage(li, lx, ly, lsz, lsz);
        ctx.restore();
      }
    }

    // Team name
    ctx.save();
    ctx.font = `600 30px ${F}`;
    ctx.fillStyle = isChamp ? "#92400e" : "#0f172a";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const PILL_W = 164;
    const maxNameW = INNER_W - 88 - lsz - 16 - (isChamp ? PILL_W+28 : 24);
    let tname = team?.name || top5[i];
    while (ctx.measureText(tname).width > maxNameW && tname.length>4) tname=tname.slice(0,-1);
    if (tname!==(team?.name||top5[i])) tname+="…";
    ctx.fillText(tname, lx+lsz+16, midY);
    ctx.restore();

    // Champion pill
    if (isChamp) {
      ctx.save();
      const px = PAD+INNER_W-PILL_W-20;
      const ph = 38;
      const py = midY-ph/2;
      rr(px, py, PILL_W, ph, ph/2, "rgba(245,158,11,0.15)", "rgba(245,158,11,0.60)", 1.5);
      ctx.font = `700 20px ${F}`;
      ctx.fillStyle = "#b45309";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("★  CHAMPION", px+PILL_W/2, midY);
      ctx.restore();
    }
  }

  y += top5.length*ROW_H + 30;

  // Divider
  ctx.fillStyle = "rgba(0,0,0,0.08)";
  ctx.fillRect(PAD, y, INNER_W, 1.5);
  y += 16;

  // ── 4 info boxes ──
  const colW = (INNER_W-14)/2;

  const drawBox = async (label, value, colX, bY, findFn) => {
    const team = findFn ? findFn(value) : null;
    rr(colX, bY, colW, BOX_H, 12, "rgba(0,0,0,0.04)", "rgba(0,0,0,0.09)", 1.5);
    const midY = bY + BOX_H/2;

    // Label
    ctx.save();
    ctx.font = `500 17px ${F}`;
    ctx.fillStyle = "rgba(0,0,0,0.36)";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.letterSpacing = "2px";
    ctx.fillText(label.toUpperCase(), colX+14, bY+24);
    ctx.letterSpacing = "0px";
    ctx.restore();

    // Logo + value — vertically centered in box
    const lsz = 48;
    const lx = colX+14;
    const ly = midY - lsz/2 + 6;
    if (team) {
      const li = await loadImg(LOGO(team.logo));
      if (li) {
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(lx, ly, lsz, lsz, 6);
        ctx.clip();
        ctx.drawImage(li, lx, ly, lsz, lsz);
        ctx.restore();
      }
    }
    ctx.save();
    ctx.font = `700 28px ${F}`;
    ctx.fillStyle = "#0f172a";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    let val = value || "-";
    const maxW = colW - (team?lsz+14:0) - 30;
    while (ctx.measureText(val).width > maxW && val.length>3) val=val.slice(0,-1);
    if (val!==(value||"-") && val.length<(value||"-").length) val+="…";
    ctx.fillText(val, team?lx+lsz+10:lx, ly+lsz/2);
    ctx.restore();
  };

  const fp = (n) => TEAMS.find(t=>t.players?.includes(n));
  const ft = (n) => TEAMS.find(t=>t.name===n);
  const fi = (n) => TEAMS.find(t=>t.igl===n);

  await drawBox("Finals MVP",  picks.finalsMvp?.[0], PAD,         y, fp);
  await drawBox("Event MVP",   picks.eventMvp?.[0],  PAD+colW+14, y, fp);
  y += BOX_H+12;
  await drawBox("Best IGL",    picks.bestIgl,         PAD,         y, fi);
  await drawBox("Most Kills",  picks.mostFinishes,    PAD+colW+14, y, ft);
  y += BOX_H+20;

  // Score (only when published)
  const hasScore = publishedResults && picks.score != null;
  const hasFantasy = fantasyData && picks.fantasyScore != null;
  if (hasScore || hasFantasy) {
    ctx.fillStyle = "rgba(0,0,0,0.07)";
    ctx.fillRect(PAD, y, INNER_W, 1.5);
    y += 16;
    const sh = 88;
    if (hasScore && hasFantasy) {
      rr(PAD, y, colW, sh, 12, "rgba(26,86,219,0.07)", "rgba(26,86,219,0.3)", 1.5);
      ctx.save(); ctx.font=`500 16px ${F}`; ctx.fillStyle="rgba(26,86,219,0.7)"; ctx.textAlign="center"; ctx.letterSpacing="2px"; ctx.fillText("PREDICTION", PAD+colW/2, y+26); ctx.letterSpacing="0px"; ctx.restore();
      ctx.save(); ctx.font=`700 36px ${F}`; ctx.fillStyle="#1a56db"; ctx.textAlign="center"; ctx.fillText(picks.score+" pts", PAD+colW/2, y+66); ctx.restore();
      rr(PAD+colW+14, y, colW, sh, 12, "rgba(124,58,237,0.07)", "rgba(124,58,237,0.3)", 1.5);
      ctx.save(); ctx.font=`500 16px ${F}`; ctx.fillStyle="rgba(124,58,237,0.7)"; ctx.textAlign="center"; ctx.letterSpacing="2px"; ctx.fillText("FANTASY", PAD+colW+14+colW/2, y+26); ctx.letterSpacing="0px"; ctx.restore();
      ctx.save(); ctx.font=`700 36px ${F}`; ctx.fillStyle="#7c3aed"; ctx.textAlign="center"; ctx.fillText(picks.fantasyScore+" pts", PAD+colW+14+colW/2, y+66); ctx.restore();
    } else if (hasScore) {
      rr(PAD, y, INNER_W, sh, 12, "rgba(26,86,219,0.07)", "rgba(26,86,219,0.3)", 1.5);
      ctx.save(); ctx.font=`500 16px ${F}`; ctx.fillStyle="rgba(26,86,219,0.7)"; ctx.textAlign="center"; ctx.letterSpacing="2px"; ctx.fillText("PREDICTION SCORE", W/2, y+26); ctx.letterSpacing="0px"; ctx.restore();
      ctx.save(); ctx.font=`700 42px ${F}`; ctx.fillStyle="#1a56db"; ctx.textAlign="center"; ctx.fillText(picks.score+" pts", W/2, y+70); ctx.restore();
    }
    if (picks.rank) {
      y += sh+10;
      ctx.save(); ctx.font=`600 22px ${F}`; ctx.fillStyle="rgba(0,0,0,0.35)"; ctx.textAlign="center"; ctx.fillText("Rank #"+picks.rank+" on Leaderboard", W/2, y); ctx.restore();
    }
  }

  return canvas;
}

function ShareButtons({ picks, publishedResults, fantasyData, identity }) {
  const [generating, setGenerating] = useState(false);
  const [cardUrl, setCardUrl] = useState(null);

  const generate = async () => {
    setGenerating(true);
    try {
      const canvas = await generateShareCard(picks, publishedResults, fantasyData, identity);
      const url = canvas.toDataURL("image/png");
      setCardUrl(url);
    } catch(e) { console.error(e); }
    setGenerating(false);
  };

  const download = () => {
    if (!cardUrl) return;
    const a = document.createElement("a");
    a.href = cardUrl;
    a.download = `bgis2026_picks_${identity?.username||"player"}.png`;
    a.click();
  };

  const shareTwitter = () => {
    const text = `My BGIS 2026 Grand Finals picks are in! 🎮\n\nChampion: ${picks.champion}\nFinals MVP: ${picks.finalsMvp?.[0]}\n\nCan you beat me? 👇`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent("https://pickem.esportsamaze.in")}`;
    window.open(url, "_blank");
  };

  const shareInstagram = () => {
    download();
    setTimeout(() => {
      alert("Image downloaded! Open Instagram and share it to your story.");
    }, 500);
  };

  return (
    <div style={{marginTop:16}}>
      {!cardUrl ? (
        <button className="btn btn-primary" onClick={generate} disabled={generating} style={{width:"100%"}}>
          {generating ? "Generating card..." : "🎨 Generate Share Card"}
        </button>
      ) : (
        <>
          <img src={cardUrl} alt="Share card preview" style={{width:"100%",borderRadius:12,marginBottom:12,border:"1.5px solid #e2e8f0"}}/>
          <div className="btn-row">
            <button className="btn btn-outline" style={{flex:1}} onClick={download}>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Download
            </button>
            <button className="btn btn-outline" style={{flex:1,color:"#1d9bf0",borderColor:"#1d9bf0"}} onClick={shareTwitter}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.259 5.631 5.905-5.631zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              Post on X
            </button>
            <button className="btn btn-outline" style={{flex:1,color:"#e1306c",borderColor:"#e1306c"}} onClick={shareInstagram}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
              Instagram Story
            </button>
            <button className="btn btn-outline" style={{fontSize:11}} onClick={()=>setCardUrl(null)}>Regenerate</button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Draggable Top 5 ───────────────────────────────────────────────
function DraggableTop5({ top5, setTop5, champion, setChampion }) {
  const dragIdx = useRef(null);
  const [dragOver, setDragOver] = useState(null);
  const onDragStart = (e,i) => { dragIdx.current=i; e.dataTransfer.effectAllowed="move"; };
  const onDragOver  = (e,i) => { e.preventDefault(); setDragOver(i); };
  const onDrop = (e,i) => {
    e.preventDefault();
    if (dragIdx.current===null||dragIdx.current===i) { setDragOver(null); return; }
    const next=[...top5]; const [moved]=next.splice(dragIdx.current,1); next.splice(i,0,moved);
    setTop5(next); dragIdx.current=null; setDragOver(null);
  };
  const onDragEnd = () => { dragIdx.current=null; setDragOver(null); };
  return (
    <div className="slots-list">
      {top5.map((name,i) => {
        const t=TEAMS.find(t=>t.name===name); const isChamp=champion===name;
        return (
          <div key={name} className={`drag-slot${isChamp?" is-champ":""}${dragOver===i?" drag-over":""}`}
            draggable onDragStart={e=>onDragStart(e,i)} onDragOver={e=>onDragOver(e,i)}
            onDrop={e=>onDrop(e,i)} onDragEnd={onDragEnd}>
            <span className="drag-handle">⠿</span>
            <span className="drag-num">#{i+1}</span>
            <img className="drag-logo" src={LOGO(t?.logo)} alt=""/>
            <span className="drag-name">{name}</span>
            <div className="drag-actions">
              <button className={`champ-btn${isChamp?" on":""}`} onClick={()=>setChampion(isChamp?null:name)}>
                {isChamp?"★ Champ":"☆ Champ"}
              </button>
              <button className="rm-btn" onClick={()=>{ setTop5(p=>p.filter(t=>t!==name)); if(isChamp) setChampion(null); }}>✕</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Player Accordion ──────────────────────────────────────────────
function PlayerAccordion({ picks, setPicks, max, pts1, pts2 }) {
  const [open, setOpen] = useState(null);
  const pickPlayer = (player) => {
    if (picks.includes(player)) { setPicks(p=>p.filter(x=>x!==player)); return; }
    if (picks.length>=max) return;
    setPicks(p=>[...p,player]);
  };
  return (
    <div>
      {picks.length>0&&(
        <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:10}}>
          {picks.map((p,i)=>(
            <span key={p} style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:11,fontWeight:600,padding:"3px 8px",borderRadius:6,background:i===0?"rgba(245,158,11,.1)":"rgba(26,86,219,.08)",border:`1px solid ${i===0?"rgba(245,158,11,.3)":"rgba(26,86,219,.2)"}`,color:i===0?"#92400e":"#1e40af"}}>
              {i===0?"⭐":i+1+"."} {p}
              <button onClick={()=>setPicks(prev=>prev.filter(x=>x!==p))} style={{border:"none",background:"none",color:"currentColor",cursor:"pointer",fontSize:10,opacity:.7,padding:0}}>✕</button>
            </span>
          ))}
        </div>
      )}
      <div className="banner blue" style={{marginBottom:10}}>
        Pick 3 players. <strong>1st choice = {pts1} pts</strong> · 2nd/3rd = {pts2} pts if correct.<br/>
        Tap a team to expand, then tap a player to select.
      </div>
      <div className="acc-grid">
      {TEAMS.map(t=>{
        const teamPicks=picks.filter(p=>t.players.includes(p)); const isOpen=open===t.id;
        return (
          <div key={t.id} style={{border:`1.5px solid ${teamPicks.length>0?"#1a56db":"#e2e8f0"}`,borderRadius:10,marginBottom:7,overflow:"hidden"}}>
            <div onClick={()=>setOpen(o=>o===t.id?null:t.id)}
              style={{display:"flex",alignItems:"center",gap:10,padding:"10px 13px",cursor:"pointer",background:"#fff",userSelect:"none"}}>
              <img src={LOGO(t.logo)} alt="" style={{width:30,height:30,objectFit:"contain",flexShrink:0}}/>
              <span style={{fontSize:13,fontWeight:600,flex:1}}>{t.name}</span>
              {teamPicks.length>0&&<span style={{fontSize:11,fontWeight:700,color:"#1a56db",background:"rgba(26,86,219,.08)",borderRadius:10,padding:"2px 8px"}}>{teamPicks.length} picked</span>}
              <span style={{fontSize:11,color:"#94a3b8",transition:"transform .2s",transform:isOpen?"rotate(180deg)":"none",flexShrink:0}}>▼</span>
            </div>
            {isOpen&&(
              <div style={{background:"#f8faff",borderTop:"1px solid #e2e8f0",padding:"10px 13px",display:"flex",flexWrap:"wrap",gap:6}}>
                {t.players.map(player=>{
                  const idx=picks.indexOf(player); const isPicked=idx>=0; const isFirst=idx===0;
                  const isDisabled=!isPicked&&picks.length>=max; const isIgl=player===t.igl;
                  return (
                    <button key={player} onClick={()=>!isDisabled&&pickPlayer(player)} disabled={isDisabled}
                      style={{display:"inline-flex",alignItems:"center",gap:5,padding:"7px 11px",borderRadius:8,border:`1.5px solid ${isFirst?"#f59e0b":isPicked?"#1a56db":"#e2e8f0"}`,background:isFirst?"rgba(245,158,11,.08)":isPicked?"rgba(26,86,219,.08)":"#fff",cursor:isDisabled?"not-allowed":"pointer",fontSize:12,fontWeight:600,color:isFirst?"#92400e":isPicked?"#1e40af":"#0f172a",opacity:isDisabled?.4:1,transition:"all .15s"}}>
                      {isPicked&&<span style={{fontSize:10,fontWeight:800,color:isFirst?"#f59e0b":"#1a56db"}}>{isFirst?"★":idx+1+"."}</span>}
                      {player}
                      {isIgl&&<span style={{fontSize:9,fontWeight:700,background:"rgba(22,163,74,.1)",color:"#15803d",borderRadius:4,padding:"1px 4px"}}>IGL</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────
export default function App() {
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    const check = async () => {
      if (!ADMIN_HASH) return;
      const path = window.location.pathname.replace(/^\//, "");
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(path));
      const hash = Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,"0")).join("");
      setIsAdmin(hash === ADMIN_HASH);
    };
    check();
  }, []);
  const [tab, setTab] = useState("picks");
  const [toast, setToast] = useState(null);
  const [meta, setMeta] = useState(null);

  // Auth
  const [identity, setIdentity] = useState(null);
  const [usernameInput, setUsernameInput] = useState("");
  const [pinFlow, setPinFlow] = useState("username");
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [pendingDocId, setPendingDocId] = useState(null);
  const [idLoading, setIdLoading] = useState(false);

  // Picks
  const [top5, setTop5] = useState([]);
  const [champion, setChampion] = useState(null);
  const [finalsMvp, setFinalsMvp] = useState([]);
  const [eventMvp, setEventMvp] = useState([]);
  const [bestIgl, setBestIgl] = useState(null);
  const [mostFinishes, setMostFinishes] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [mySubmission, setMySubmission] = useState(null);

  // Leaderboard
  const [lbTab, setLbTab] = useState("prediction");
  const [lbMetaInfo, setLbMetaInfo] = useState(null); // {totalPages, count, cacheVersion}
  const [lbPages, setLbPages] = useState({}); // {0: [...], 1: [...]}
  const [lbPage, setLbPage] = useState(0);
  const [lbSearch, setLbSearch] = useState("");
  const [lbLoading, setLbLoading] = useState(false);
  const [fantasyData, setFantasyData] = useState(null);

  // Admin
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [adminPassInput, setAdminPassInput] = useState("");
  const [adminAttempts, setAdminAttempts] = useState(0);
  const [adminLockUntil] = useState(()=>parseInt(localStorage.getItem("bgis26f_admin_lock")||"0"));
  const [adminSubs, setAdminSubs] = useState([]);
  const [adminFetching, setAdminFetching] = useState(false);
  const [results, setResults] = useState({top5:[],champion:"",finalsMvp:"",eventMvp:"",bestIgl:"",mostFinishes:""});
  const [adminFantasy, setAdminFantasy] = useState({teamPoints:{},playerKills:{}});
  const [adminFantasySaving, setAdminFantasySaving] = useState(false);
  const [subCount, setSubCount] = useState(null);

  const showToast = (msg, type="success") => { setToast({msg,type}); setTimeout(()=>setToast(null),3200); };

  // ── Load meta (20 min TTL cache) ──
  useEffect(() => {
    const load = async () => {
      const cached = getCachedMeta();
      if (cached) {
        setMeta(cached);
        if (cached.results) setResults(cached.results);
        if (cached.fantasy) { setAdminFantasy(cached.fantasy); setFantasyData(cached.fantasy); }
        return;
      }
      try {
        const snap = await getDoc(doc(db,"pickem",META_DOC));
        const d = snap.exists() ? snap.data() : {};
        setMeta(d);
        setCachedMeta(d);
        if (d.results) setResults(d.results);
        if (d.fantasy) { setAdminFantasy(d.fantasy); setFantasyData(d.fantasy); }
      } catch { setMeta({}); }
    };
    load();
  }, []);

  // ── Restore identity ──
  useEffect(() => {
    const t=localStorage.getItem(LS_TOKEN), id=localStorage.getItem(LS_DOCID);
    if (t&&id) setIdentity({username:id,token:t,isReturning:true});
  }, []);

  // ── Load my submission (localStorage first) ──
  useEffect(() => {
    if (!identity) { setMySubmission(null); return; }
    const cached = getCachedSub(identity.username);
    if (cached) {
      setMySubmission(cached);
      if (cached.top5) setTop5(cached.top5);
      if (cached.champion) setChampion(cached.champion);
      if (cached.finalsMvp) setFinalsMvp(cached.finalsMvp);
      if (cached.eventMvp) setEventMvp(cached.eventMvp);
      if (cached.bestIgl) setBestIgl(cached.bestIgl);
      if (cached.mostFinishes) setMostFinishes(cached.mostFinishes);
      return;
    }
    // Not in cache — fetch once
    const load = async () => {
      try {
        const snap = await getDoc(doc(db,"pickem",META_DOC,SUBS_COL,identity.username));
        if (snap.exists()&&!snap.data().deleted) {
          const sub = snap.data();
          setMySubmission(sub); setCachedSub(sub);
          if (sub.top5) setTop5(sub.top5);
          if (sub.champion) setChampion(sub.champion);
          if (sub.finalsMvp) setFinalsMvp(sub.finalsMvp);
          if (sub.eventMvp) setEventMvp(sub.eventMvp);
          if (sub.bestIgl) setBestIgl(sub.bestIgl);
          if (sub.mostFinishes) setMostFinishes(sub.mostFinishes);
        }
      } catch {}
    };
    load();
  }, [identity?.username]);

  // ── Load leaderboard meta ──
  const loadLbMeta = useCallback(async () => {
    if (!meta) return;
    const version = meta.cacheVersion||0;
    const cached = getCachedLbMeta(version);
    if (cached) { setLbMetaInfo(cached); return; }
    try {
      const snap = await getDoc(doc(db,"pickem",LB_META_DOC));
      if (snap.exists()) {
        const d = snap.data();
        setLbMetaInfo(d);
        setCachedLbMeta({...d, version});
        setSubCount(d.count||0);
      }
    } catch {}
  }, [meta]);

  useEffect(() => {
    if ((isClosed()||meta?.published) && meta) loadLbMeta();
  }, [meta, loadLbMeta]);

  // ── Load a leaderboard page ──
  const loadLbPage = useCallback(async (page) => {
    if (!meta||!lbMetaInfo) return;
    const version = meta.cacheVersion||0;
    const cached = getCachedLbPage(version, page);
    if (cached) { setLbPages(p=>({...p,[page]:cached})); return; }
    setLbLoading(true);
    try {
      const snap = await getDoc(doc(db,"pickem",LB_PAGE_PREFIX+page));
      if (snap.exists()) {
        const entries = snap.data().entries||[];
        setLbPages(p=>({...p,[page]:entries}));
        setCachedLbPage(version, page, entries);
      }
    } catch {}
    setLbLoading(false);
  }, [meta, lbMetaInfo]);

  useEffect(() => {
    if (lbMetaInfo && !(lbPage in lbPages)) loadLbPage(lbPage);
  }, [lbPage, lbMetaInfo, lbPages, loadLbPage]);

  // ── Auth ──
  const handleConfirm = async () => {
    const clean = usernameInput.trim().toLowerCase().replace(/[^a-z0-9_\-.]/g,"");
    if (!clean||clean.length<3) { showToast("Username must be at least 3 characters","error"); return; }
    setIdLoading(true); setPinError("");
    try {
      const snap = await getDoc(doc(db,USERS_COL,clean));
      setPendingDocId(clean);
      if (snap.exists()) {
        const si=localStorage.getItem(LS_DOCID), st=localStorage.getItem(LS_TOKEN);
        if (si===clean&&st===snap.data().token) { setIdentity({username:clean,token:st,isReturning:true}); showToast("Welcome back, "+clean+"!"); }
        else setPinFlow("pin_verify");
      } else setPinFlow("pin_new");
    } catch { showToast("Something went wrong.","error"); }
    finally { setIdLoading(false); }
  };

  const handleSetPin = async () => {
    if (!/^\d{6}$/.test(pinInput)) { setPinError("Must be exactly 6 digits"); return; }
    const token = await hashPin(pinInput+pendingDocId);
    try {
      await setDoc(doc(db,USERS_COL,pendingDocId),{token,username:pendingDocId,createdAt:new Date().toISOString()});
      localStorage.setItem(LS_TOKEN,token); localStorage.setItem(LS_DOCID,pendingDocId);
      setIdentity({username:pendingDocId,token,isReturning:false});
      setPinFlow("username"); setPinInput(""); setPinError("");
      showToast("Welcome, "+pendingDocId+"! 🎮");
    } catch { showToast("Failed to save.","error"); }
  };

  const handleVerifyPin = async () => {
    if (!/^\d{6}$/.test(pinInput)) { setPinError("Must be exactly 6 digits"); return; }
    const lk="bgis26f_pin_lock_"+pendingDocId, ak="bgis26f_pin_att_"+pendingDocId;
    const now=Date.now(), lu=parseInt(localStorage.getItem(lk)||"0");
    if (now<lu) { setPinError("Locked for "+Math.ceil((lu-now)/60000)+" min."); return; }
    setIdLoading(true); setPinError("");
    try {
      const snap = await getDoc(doc(db,USERS_COL,pendingDocId));
      const token = await hashPin(pinInput+pendingDocId);
      if (snap.exists()&&snap.data().token===token) {
        localStorage.removeItem(lk); localStorage.removeItem(ak);
        localStorage.setItem(LS_TOKEN,token); localStorage.setItem(LS_DOCID,pendingDocId);
        setIdentity({username:pendingDocId,token,isReturning:true});
        setPinFlow("username"); setPinInput(""); setPinError("");
        showToast("Welcome back, "+pendingDocId+"!");
      } else {
        const att=parseInt(localStorage.getItem(ak)||"0")+1; localStorage.setItem(ak,String(att));
        if (att>=3) { localStorage.setItem(lk,String(now+15*60000)); setPinError("Too many attempts. Locked 15 min."); }
        else setPinError("Wrong PIN. "+(3-att)+" attempt"+(3-att===1?"":"s")+" left.");
      }
    } catch { setPinError("Something went wrong."); }
    finally { setIdLoading(false); }
  };

  const resetIdentity = () => {
    setIdentity(null); setUsernameInput(""); setPinFlow("username"); setPinInput(""); setPinError("");
    localStorage.removeItem(LS_TOKEN); localStorage.removeItem(LS_DOCID);
  };

  // ── Submit picks ──
  const canSubmit = top5.length===5&&champion&&finalsMvp.length===3&&eventMvp.length===3&&bestIgl&&mostFinishes;

  const handleSubmit = async () => {
    if (!identity||!canSubmit) return;
    setSubmitting(true);
    try {
      const sub = {username:identity.username,top5,champion,finalsMvp,eventMvp,bestIgl,mostFinishes,timestamp:new Date().toISOString(),createdAt:mySubmission?.createdAt||new Date().toISOString()};
      await setDoc(doc(db,"pickem",META_DOC,SUBS_COL,identity.username),sub);
      setMySubmission(sub); setCachedSub(sub); setSubmitted(true);
      showToast("Picks submitted! Good luck! 🎮");
    } catch { showToast("Failed to save.","error"); }
    finally { setSubmitting(false); }
  };

  const toggleTop5 = (name) => {
    if (isClosed()||!identity) return;
    if (top5.includes(name)) { setTop5(p=>p.filter(t=>t!==name)); if(champion===name) setChampion(null); }
    else { if(top5.length>=5){showToast("Max 5 teams","error");return;} setTop5(p=>[...p,name]); }
  };

  // ── Admin ──
  const handleAdminLogin = async () => {
    const now=Date.now();
    if (now<adminLockUntil){showToast("Locked "+Math.ceil((adminLockUntil-now)/60000)+" min","error");return;}
    const inputHash = await hashPin(adminPassInput);
    if (inputHash===ADMIN_PASS_HASH){setAdminUnlocked(true);setAdminAttempts(0);localStorage.removeItem("bgis26f_admin_lock");loadAdminSubs();}
    else{const n=adminAttempts+1;setAdminAttempts(n);if(n>=5){const lu=now+15*60000;localStorage.setItem("bgis26f_admin_lock",String(lu));showToast("Locked 15 min","error");}else showToast("Wrong. "+(5-n)+" left","error");}
  };

  const loadAdminSubs = async () => {
    setAdminFetching(true);
    try { const snap=await getDocs(collection(db,"pickem",META_DOC,SUBS_COL)); setAdminSubs(snap.docs.map(d=>d.data()).filter(d=>!d.deleted)); setSubCount(snap.docs.filter(d=>!d.data().deleted).length); } catch {}
    setAdminFetching(false);
  };

  const handleSaveResults = async () => {
    try {
      const fs=await getDoc(doc(db,"pickem",META_DOC)); const f=fs.exists()?fs.data():{};
      await setDoc(doc(db,"pickem",META_DOC),{adminSecret:ADMIN_SECRET,...f,results},{merge:true});
      setMeta(p=>({...p,results})); invalidateMetaCache(); showToast("Results saved!");
    } catch { showToast("Save failed","error"); }
  };

  const handlePublishToggle = async (publish) => {
    try {
      const fs=await getDoc(doc(db,"pickem",META_DOC)); const f=fs.exists()?fs.data():{};
      await setDoc(doc(db,"pickem",META_DOC),{adminSecret:ADMIN_SECRET,...f,published:publish},{merge:true});
      setMeta(p=>({...p,published:publish})); invalidateMetaCache();
      if (publish) await bakeLeaderboard();
      showToast(publish?"Scores published!":"Scores hidden");
    } catch { showToast("Failed","error"); }
  };

  const bakeLeaderboard = async () => {
    try {
      // Fetch all submissions
      const snap = await getDocs(collection(db,"pickem",META_DOC,SUBS_COL));
      const allSubs = snap.docs.map(d=>d.data()).filter(d=>!d.deleted);

      // Fetch fresh meta for results
      const metaSnap = await getDoc(doc(db,"pickem",META_DOC));
      const metaData = metaSnap.exists()?metaSnap.data():{};
      const currentResults = metaData.results||null;
      const currentFantasy = metaData.fantasy||null;

      // Score and sort using tiebreaker
      const scored = allSubs.map(s=>({
        ...s,
        score: currentResults ? calcPredictionScore(s,currentResults) : 0,
        fantasyScore: currentFantasy ? calcFantasyScore(s,currentFantasy) : 0,
      })).sort((a,b)=>tiebreakerSort(a,b,currentResults));

      // Paginate into 500-entry docs
      const pages = [];
      for (let i=0; i<scored.length; i+=PAGE_SIZE) pages.push(scored.slice(i,i+PAGE_SIZE));
      const totalPages = pages.length||1;

      // Write page docs in parallel
      await Promise.all(pages.map((entries,i)=>
        setDoc(doc(db,"pickem",LB_PAGE_PREFIX+i),{adminSecret:ADMIN_SECRET,page:i,entries,bakedAt:new Date().toISOString()})
      ));

      // Bump cacheVersion and write lb meta
      const newVersion = (metaData.cacheVersion||0)+1;
      await setDoc(doc(db,"pickem",LB_META_DOC),{adminSecret:ADMIN_SECRET,totalPages,count:allSubs.length,cacheVersion:newVersion,bakedAt:new Date().toISOString()});
      await setDoc(doc(db,"pickem",META_DOC),{adminSecret:ADMIN_SECRET,...metaData,cacheVersion:newVersion},{merge:true});

      // Invalidate all local caches
      invalidateLbCache(); invalidateMetaCache();

      showToast("Baked "+allSubs.length+" entries into "+totalPages+" pages");
    } catch(e) { showToast("Bake failed","error"); console.error(e); }
  };

  const handleSaveFantasy = async () => {
    setAdminFantasySaving(true);
    try {
      const fs=await getDoc(doc(db,"pickem",META_DOC)); const f=fs.exists()?fs.data():{};
      await setDoc(doc(db,"pickem",META_DOC),{adminSecret:ADMIN_SECRET,...f,fantasy:adminFantasy},{merge:true});
      setFantasyData(adminFantasy); invalidateMetaCache();
      showToast("Fantasy saved!");
    } catch { showToast("Save failed","error"); }
    setAdminFantasySaving(false);
  };

  const handleDeleteSub = async (username) => {
    if (!window.confirm("Delete "+username+"?")) return;
    try { await setDoc(doc(db,"pickem",META_DOC,SUBS_COL,username),{adminSecret:ADMIN_SECRET,deleted:true},{merge:true}); setAdminSubs(p=>p.filter(s=>s.username!==username)); showToast("Deleted"); } catch { showToast("Failed","error"); }
  };

  // ── Leaderboard display data ──
  const publishedResults = meta?.published ? meta?.results : null;
  const currentPageEntries = lbPages[lbPage] || [];

  // Search: if searching, scan all cached pages
  const searchResults = useCallback(() => {
    if (!lbSearch.trim()) return null;
    const q = lbSearch.trim().toLowerCase();
    const allCached = Object.values(lbPages).flat();
    return allCached.filter(s=>(s.username||"").toLowerCase().includes(q));
  }, [lbSearch, lbPages]);

  const displayEntries = lbSearch.trim() ? (searchResults()||[]) : currentPageEntries;
  const totalPages = lbMetaInfo?.totalPages||1;

  // Rank offset for current page (for display)
  const rankOffset = lbSearch.trim() ? 0 : lbPage * PAGE_SIZE;

  const closed = isClosed();
  const countdown = timeLeft();
  const step = !identity?1:(top5.length<5||!champion||finalsMvp.length<3||eventMvp.length<3||!bestIgl||!mostFinishes)?2:3;

  // ── Admin render ──
  if (isAdmin) return (
    <>
      <style>{CSS}</style>
      <div className="app">
        {/* Top bar */}
        <div className="topbar">
          <div className="topbar-brand">BGIS 2026 Pick'em by <span><a href="https://esportsamaze.in" target="_blank" rel="noopener noreferrer" style={{color:"inherit",textDecoration:"none"}}>EsportsAmaze</a></span></div>
          <div className="topbar-socials">
            <a href="https://instagram.com/esportsamaze" target="_blank" rel="noopener noreferrer" className="topbar-social" title="Instagram">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
              <span>Instagram</span>
            </a>
            <a href="https://x.com/esportsamaze" target="_blank" rel="noopener noreferrer" className="topbar-social" title="X / Twitter">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.259 5.631 5.905-5.631zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              <span>X</span>
            </a>
            <a href="https://youtube.com/@esportsamaze" target="_blank" rel="noopener noreferrer" className="topbar-social" title="YouTube">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="17" height="17"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
              <span>YouTube</span>
            </a>
          </div>
        </div>

        <div className="hero">
          <img src={LOGO("BGIS_2026_Logo_White")} className="hero-logo" alt="BGIS 2026"/>
          <div className="hero-title">ADMIN <span>PANEL</span></div>
          <div className="hero-sub">BGIS 2026 Grand Finals Pick'em</div>
        </div>
        <div style={{maxWidth:900,margin:"0 auto",padding:"18px 16px"}}>
          {!adminUnlocked?(
            <div className="admin-box" style={{maxWidth:340}}>
              <div className="admin-title">Admin Access</div>
              <div style={{marginBottom:10}}>
                <div className="alabel">Password</div>
                <input className="input" type="password" placeholder="Enter password" value={adminPassInput} onChange={e=>setAdminPassInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleAdminLogin()}/>
              </div>
              <button className="btn btn-primary btn-full" onClick={handleAdminLogin}>Unlock</button>
            </div>
          ):(
            <>
              <div className="admin-box">
                <div className="admin-title">📊 Stats</div>
                <div className="info-row">
                  <span>Submissions: <strong>{subCount??"-"}</strong></span>
                  <span>Published: <strong>{meta?.published?"Yes ✅":"No"}</strong></span>
                  <span>LB Pages: <strong>{lbMetaInfo?.totalPages??"-"}</strong></span>
                </div>
                <div className="btn-row" style={{marginTop:10}}>
                  <button className="btn btn-outline" onClick={loadAdminSubs} disabled={adminFetching}>{adminFetching?"Loading...":"🔄 Refresh Subs"}</button>
                  <button className="btn btn-purple" onClick={bakeLeaderboard}>🗜 Bake Leaderboard</button>
                  {!meta?.published
                    ?<button className="btn btn-green" onClick={()=>handlePublishToggle(true)}>✅ Publish Scores</button>
                    :<button className="btn btn-red" onClick={()=>handlePublishToggle(false)}>🔒 Hide Scores</button>}
                </div>
                <div style={{fontSize:11,color:"#94a3b8",marginTop:8}}>
                  Bake sorts all entries with tiebreaker, paginates into {PAGE_SIZE}/page docs. Run after updating results or fantasy data.
                </div>
              </div>

              <div className="admin-box">
                <div className="admin-title">🏆 Set Results</div>
                <div className="agrid">
                  {[0,1,2,3,4].map(i=>(
                    <div key={i}>
                      <div className="alabel">Top 5 — #{i+1}</div>
                      <select className="aselect" value={results.top5?.[i]||""} onChange={e=>{const v=[...(results.top5||["","","","",""])];v[i]=e.target.value;setResults(p=>({...p,top5:v}));}}>
                        <option value="">— Select —</option>{TEAMS.map(t=><option key={t.id} value={t.name}>{t.name}</option>)}
                      </select>
                    </div>
                  ))}
                  <div>
                    <div className="alabel">Champion</div>
                    <select className="aselect" value={results.champion||""} onChange={e=>setResults(p=>({...p,champion:e.target.value}))}>
                      <option value="">— Select —</option>{TEAMS.map(t=><option key={t.id} value={t.name}>{t.name}</option>)}
                    </select>
                  </div>
                  {[["finalsMvp","Finals MVP"],["eventMvp","Event MVP"]].map(([k,l])=>(
                    <div key={k}>
                      <div className="alabel">{l}</div>
                      <select className="aselect" value={results[k]||""} onChange={e=>setResults(p=>({...p,[k]:e.target.value}))}>
                        <option value="">— Select —</option>
                        {TEAMS.flatMap(t=>t.players.map(p=><option key={k+p} value={p}>{p} ({t.name})</option>))}
                      </select>
                    </div>
                  ))}
                  <div>
                    <div className="alabel">Best IGL</div>
                    <select className="aselect" value={results.bestIgl||""} onChange={e=>setResults(p=>({...p,bestIgl:e.target.value}))}>
                      <option value="">— Select —</option>{ALL_IGLS.map(p=><option key={p.player} value={p.player}>{p.player} ({p.team})</option>)}
                    </select>
                  </div>
                  <div>
                    <div className="alabel">Most Kills (team)</div>
                    <select className="aselect" value={results.mostFinishes||""} onChange={e=>setResults(p=>({...p,mostFinishes:e.target.value}))}>
                      <option value="">— Select —</option>{TEAMS.map(t=><option key={t.id} value={t.name}>{t.name}</option>)}
                    </select>
                  </div>
                </div>
                <button className="btn btn-green" onClick={handleSaveResults}>💾 Save Results</button>
              </div>

              <div className="admin-box">
                <div className="admin-title">⚡ Fantasy Data</div>
                <p style={{fontSize:11,color:"#64748b",marginBottom:12}}>Update after each match day. Team pts ×1.5 for champion. Player kills ×1.5 for MVP 1st choice. After saving, run Bake Leaderboard.</p>
                <div className="alabel" style={{marginBottom:7}}>Team Points</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(175px,1fr))",gap:7,marginBottom:14}}>
                  {TEAMS.map(t=>(
                    <div key={t.id} className="fi-wrap">
                      <label className="fi-label">{t.name}</label>
                      <input type="number" className="fi" placeholder="0" value={adminFantasy.teamPoints?.[t.id]??""} onChange={e=>setAdminFantasy(p=>({...p,teamPoints:{...p.teamPoints,[t.id]:parseInt(e.target.value)||0}}))}/>
                    </div>
                  ))}
                </div>
                <div className="alabel" style={{marginBottom:7}}>Player Kills</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(145px,1fr))",gap:7,marginBottom:14}}>
                  {TEAMS.flatMap(t=>t.players.map(p=>(
                    <div key={p} className="fi-wrap">
                      <label className="fi-label">{p} <span style={{color:"#94a3b8"}}>({t.name.split(" ")[0]})</span></label>
                      <input type="number" className="fi" placeholder="0" value={adminFantasy.playerKills?.[p]??""} onChange={e=>setAdminFantasy(prev=>({...prev,playerKills:{...prev.playerKills,[p]:parseInt(e.target.value)||0}}))}/>
                    </div>
                  )))}
                </div>
                <button className="btn btn-primary" onClick={handleSaveFantasy} disabled={adminFantasySaving}>{adminFantasySaving?"Saving...":"💾 Save Fantasy Data"}</button>
              </div>

              <div className="admin-box">
                <div className="admin-title">📋 Submissions ({adminSubs.length})</div>
                <div style={{overflowX:"auto"}}>
                  <table className="tbl">
                    <thead><tr><th>#</th><th>User</th><th>Top 5</th><th>Champion</th><th>F.MVP</th><th>E.MVP</th><th>IGL</th><th>Kills</th><th>Time</th><th></th></tr></thead>
                    <tbody>
                      {[...adminSubs].sort((a,b)=>new Date(b.timestamp||0)-new Date(a.timestamp||0)).map((s,i)=>(
                        <tr key={s.username}>
                          <td className="rank-c">{i+1}</td>
                          <td><strong>{s.username}</strong></td>
                          <td style={{maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{(s.top5||[]).join(", ")}</td>
                          <td>{s.champion}</td><td>{s.finalsMvp?.[0]}</td><td>{s.eventMvp?.[0]}</td>
                          <td>{s.bestIgl}</td><td>{s.mostFinishes}</td>
                          <td style={{color:"#94a3b8"}}>{s.timestamp?fmtTime(s.timestamp):"-"}</td>
                          <td><button className="del-btn" onClick={()=>handleDeleteSub(s.username)}>Delete</button></td>
                        </tr>
                      ))}
                      {!adminSubs.length&&<tr><td colSpan={10} style={{textAlign:"center",color:"#94a3b8",padding:20}}>No submissions.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
        {toast&&<div className={`toast${toast.type==="error"?" err":""}`}>{toast.msg}</div>}
      </div>
    </>
  );

  // ── Main render ──
  return (
    <>
      <style>{CSS}</style>
      <div className="app">

        {/* Top bar */}
        <div className="topbar">
          <div className="topbar-brand">BGIS 2026 Pick'em by <span><a href="https://esportsamaze.in" target="_blank" rel="noopener noreferrer" style={{color:"inherit",textDecoration:"none"}}>EsportsAmaze</a></span></div>
          <div className="topbar-socials">
            <a href="https://instagram.com/esportsamaze" target="_blank" rel="noopener noreferrer" className="topbar-social" title="Instagram">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
              <span>Instagram</span>
            </a>
            <a href="https://x.com/esportsamaze" target="_blank" rel="noopener noreferrer" className="topbar-social" title="X / Twitter">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.259 5.631 5.905-5.631zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              <span>X</span>
            </a>
            <a href="https://youtube.com/@esportsamaze" target="_blank" rel="noopener noreferrer" className="topbar-social" title="YouTube">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="17" height="17"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
              <span>YouTube</span>
            </a>
          </div>
        </div>

        <div className="hero">
          <img src={LOGO("BGIS_2026_Logo_White")} className="hero-logo" alt="BGIS 2026"/>
          <div className="hero-title">GRAND FINALS <span>PICK'EM</span></div>
          <div className="hero-sub">Battlegrounds Mobile India Series 2026 · Chennai</div>
          <div className="hero-badges">
            {closed
              ?<span className="badge badge-red"><span className="badge-dot"/>Submissions Closed</span>
              :<span className="badge badge-green"><span className="badge-dot pulse"/>Open · {countdown||"Closing soon"}</span>}
            <span className="badge badge-blue">16 Teams · 215 pts max</span>
            <a href="https://esportsamaze.in/BGMI/Tournaments/Battlegrounds_Mobile_India_Series_2026" target="_blank" rel="noopener noreferrer" className="tour-link">🔗 Tournament Page</a>
          </div>

        </div>

        <div className="score-strip">
          <span className="si"><span className="sd" style={{background:"#1a56db"}}/>Top 5: 10 pts</span>
          <span className="si"><span className="sd" style={{background:"#f59e0b"}}/>Champion: 30 pts</span>
          <span className="si"><span className="sd" style={{background:"#7c3aed"}}/>Finals MVP: 50/20</span>
          <span className="si"><span className="sd" style={{background:"#16a34a"}}/>Event MVP: 40/20</span>
          <span className="si"><span className="sd" style={{background:"#ef4444"}}/>Best IGL: 25</span>
          <span className="si"><span className="sd" style={{background:"#64748b"}}/>Most Kills: 20</span>
        </div>

        <div className="nav">
          {[{id:"picks",l:"🎮 Make Picks"},{id:"my",l:"📋 My Submission"},{id:"lb",l:"🏆 Leaderboard"}].map(t=>(
            <button key={t.id} className={`nb${tab===t.id?" active":""}`} onClick={()=>setTab(t.id)}>{t.l}</button>
          ))}
        </div>

        {/* PICKS TAB */}
        {tab==="picks"&&(
          <div className="wrap" style={{paddingTop:18,flex:1}}>
            {!meta?<div className="loading"><div className="spinner"/>Loading...</div>:(
              <>
                {!closed&&(
                  <div className="steps">
                    {[{n:1,l:"Your Name"},{n:2,l:"Make Picks"},{n:3,l:"Submit"}].map(s=>(
                      <div key={s.n} className={`step${step===s.n?" active":step>s.n?" done":""}`}>
                        <span className="sn">{step>s.n?"✓":s.n}</span>{s.l}
                      </div>
                    ))}
                  </div>
                )}
                {!identity?(
                  <>
                    {pinFlow==="username"&&(
                      <div className="auth-card">
                        <div className="auth-title">Enter your username</div>
                        <div className="auth-sub">Pick any username (letters, numbers, underscores). You'll use a 6-digit PIN from other devices.</div>
                        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                          <input className="input" style={{flex:1,minWidth:150}} placeholder="e.g. bgmi_fan_2026" value={usernameInput} onChange={e=>setUsernameInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleConfirm()}/>
                          <button className="btn btn-primary" onClick={handleConfirm} disabled={idLoading||!usernameInput.trim()}>{idLoading?"Checking...":"Continue →"}</button>
                        </div>
                      </div>
                    )}
                    {pinFlow==="pin_new"&&(
                      <div className="auth-card">
                        <div className="auth-title">Set a 6-digit PIN</div>
                        <div className="auth-sub">Protects your picks. Needed to edit from another device. <strong>Don't share it.</strong></div>
                        <input className={`input pin-input${pinError?" err":""}`} type="number" inputMode="numeric" placeholder="000000" value={pinInput} onChange={e=>{setPinInput(e.target.value.slice(0,6));setPinError("");}} onKeyDown={e=>e.key==="Enter"&&handleSetPin()}/>
                        {pinError&&<div className="err-text">{pinError}</div>}
                        <div className="btn-row" style={{marginTop:11}}>
                          <button className="btn btn-primary" onClick={handleSetPin} disabled={pinInput.length!==6}>Set PIN →</button>
                          <button className="btn btn-outline" onClick={()=>{setPinFlow("username");setPinInput("");setPinError("");}}>← Back</button>
                        </div>
                      </div>
                    )}
                    {pinFlow==="pin_verify"&&(
                      <div className="auth-card">
                        <div className="auth-title">Enter your PIN</div>
                        <div className="auth-sub"><strong>{pendingDocId}</strong> already exists. Enter your 6-digit PIN.</div>
                        <input className={`input pin-input${pinError?" err":""}`} type="number" inputMode="numeric" placeholder="000000" value={pinInput} onChange={e=>{setPinInput(e.target.value.slice(0,6));setPinError("");}} onKeyDown={e=>e.key==="Enter"&&handleVerifyPin()}/>
                        {pinError&&<div className="err-text">{pinError}</div>}
                        <div className="btn-row" style={{marginTop:11}}>
                          <button className="btn btn-primary" onClick={handleVerifyPin} disabled={idLoading||pinInput.length!==6}>{idLoading?"Verifying...":"Verify →"}</button>
                          <button className="btn btn-outline" onClick={()=>{setPinFlow("username");setPinInput("");setPinError("");}}>← Back</button>
                        </div>
                      </div>
                    )}
                  </>
                ):(
                  <div className="user-bar">
                    <div className="user-bar-name">👤 {identity.username}</div>
                    {identity.isReturning&&<span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:20,background:"rgba(26,86,219,.08)",color:"#1e40af"}}>Editing</span>}
                    <div style={{flex:1}}/>
                    <button className="btn btn-outline" style={{fontSize:11,padding:"5px 10px"}} onClick={resetIdentity}>Change</button>
                  </div>
                )}

                {identity&&closed&&!mySubmission&&(
                  <div className="locked"><div className="locked-icon">⛔</div><div className="locked-title">Submissions Closed</div><div className="locked-sub">Picks closed Mar 27 at 1 PM IST.</div></div>
                )}
                {identity&&submitted&&(
                  <div style={{background:"#fff",borderRadius:14,border:"1.5px solid #e2e8f0",marginBottom:14,padding:"28px 20px"}}>
                    <div style={{textAlign:"center",marginBottom:20}}>
                      <div style={{fontSize:48,marginBottom:10}}>🎮</div>
                      <div style={{fontFamily:"'Rajdhani',sans-serif",fontSize:24,fontWeight:700,color:"#16a34a",marginBottom:8}}>Picks Locked In!</div>
                      <div style={{color:"#64748b",fontSize:13,marginBottom:14}}>{identity.username} · BGIS 2026 Grand Finals</div>
                      <button className="btn btn-outline" onClick={()=>setSubmitted(false)}>Edit Picks</button>
                    </div>
                    {(() => {
                      const allEntries = Object.values(lbPages).flat();
                      const myEntry = allEntries.find(s=>s.username===identity?.username);
                      const rank = myEntry ? allEntries.indexOf(myEntry)+1 : null;
                      const picksWithScore = {...(mySubmission||{top5,champion,finalsMvp,eventMvp,bestIgl,mostFinishes}), score: myEntry?.score??null, fantasyScore: myEntry?.fantasyScore??null, rank};
                      return <ShareButtons picks={picksWithScore} publishedResults={publishedResults} fantasyData={fantasyData} identity={identity}/>;
                    })()}
                  </div>
                )}

                {identity&&!closed&&!submitted&&(
                  <>
                    {/* TOP 5 */}
                    <div className="card">
                      <div className="card-title">🏅 Pick Top 5 Teams <span style={{marginLeft:"auto",fontSize:12,color:"#64748b"}}>{top5.length}/5</span></div>
                      <div className="pc-two-col">
                        {/* Left col: picked slots */}
                        <div>
                          {top5.length>0&&(
                            <>
                              <div className="sec-label">Drag to reorder · tap ☆ Champion (30 pts)</div>
                              <DraggableTop5 top5={top5} setTop5={setTop5} champion={champion} setChampion={setChampion}/>
                              {champion&&<div className="banner amber" style={{marginBottom:10}}>⭐ {champion} is your Champion pick!</div>}
                            </>
                          )}
                          {top5.length<5&&(
                            <div style={{padding:"20px 0",color:"#94a3b8",fontSize:13,textAlign:"center"}}>
                              {top5.length===0?"Pick 5 teams from the grid →":"Pick "+(5-top5.length)+" more from the grid →"}
                            </div>
                          )}
                          {top5.length===5&&!champion&&(
                            <div style={{padding:"10px 0",color:"#92400e",fontSize:13,fontWeight:600}}>
                              Now tap ☆ Champ on one of your picks
                            </div>
                          )}
                        </div>
                        {/* Right col: 4x4 team grid */}
                        <div>
                          <div className="sec-label">{top5.length<5?"Select teams":"All 5 picked!"}</div>
                          <div className="teams-grid-pc">
                            {TEAMS.map(t=>{
                              const sel=top5.includes(t.name),isChamp=champion===t.name;
                              return(
                                <button key={t.id} className={`team-card${sel?" selected":""}${isChamp?" champ-pick":""}`} onClick={()=>toggleTop5(t.name)} disabled={!sel&&top5.length>=5}>
                                  {isChamp&&<div className="tbadge gold">★</div>}
                                  {sel&&!isChamp&&<div className="tbadge">✓</div>}
                                  <img className="team-logo" src={LOGO(t.logo)} alt=""/>
                                  <div className="team-name">{t.name}</div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* FINALS MVP */}
                    <div className="card">
                      <div className="card-title">🎯 Finals MVP <span style={{marginLeft:"auto",fontSize:12,color:"#64748b"}}>{finalsMvp.length}/3</span></div>
                      <PlayerAccordion picks={finalsMvp} setPicks={setFinalsMvp} max={3} pts1={50} pts2={20}/>
                    </div>

                    {/* EVENT MVP */}
                    <div className="card">
                      <div className="card-title">🌟 Event MVP <span style={{marginLeft:"auto",fontSize:12,color:"#64748b"}}>{eventMvp.length}/3</span></div>
                      <PlayerAccordion picks={eventMvp} setPicks={setEventMvp} max={3} pts1={40} pts2={20}/>
                    </div>

                    {/* BEST IGL */}
                    <div className="card">
                      <div className="card-title">🎖️ Best IGL — 25 pts</div>
                      <div className="sec-label">Pick the best In-Game Leader of the tournament</div>
                      <div className="teams-grid" style={{gridTemplateColumns:"repeat(auto-fill,minmax(88px,1fr))"}}>
                        {ALL_IGLS.map(p=>(
                          <button key={p.player} className={`team-card${bestIgl===p.player?" selected":""}`} onClick={()=>setBestIgl(bestIgl===p.player?null:p.player)}>
                            <img className="team-logo" src={LOGO(p.logo)} alt=""/>
                            <div className="team-name" style={{fontSize:11,fontWeight:700}}>{p.player}</div>
                            <div className="team-name" style={{fontSize:9,color:"#94a3b8"}}>{p.team.split(" ").pop()}</div>
                          </button>
                        ))}
                      </div>
                      {bestIgl&&<div className="banner green" style={{marginTop:10,marginBottom:0}}>✅ {bestIgl} selected</div>}
                    </div>

                    {/* MOST KILLS */}
                    <div className="card">
                      <div className="card-title">💀 Most Kills Team — 20 pts</div>
                      <div className="sec-label">Which team will have the most total kills?</div>
                      <div className="teams-grid">
                        {TEAMS.map(t=>(
                          <button key={t.id} className={`team-card${mostFinishes===t.name?" selected":""}`} onClick={()=>setMostFinishes(mostFinishes===t.name?null:t.name)}>
                            <img className="team-logo" src={LOGO(t.logo)} alt=""/>
                            <div className="team-name">{t.name}</div>
                          </button>
                        ))}
                      </div>
                      {mostFinishes&&<div className="banner green" style={{marginTop:10,marginBottom:0}}>✅ {mostFinishes} selected</div>}
                    </div>

                    {/* SUBMIT */}
                    <div style={{maxWidth:480,margin:"0 auto 32px"}}>
                      {!canSubmit&&(
                        <div className="banner amber" style={{marginBottom:11}}>
                          Still needed:
                          {top5.length<5&&" Top 5 ("+top5.length+"/5)"}
                          {!champion&&" · Champion"}
                          {finalsMvp.length<3&&" · Finals MVP ("+finalsMvp.length+"/3)"}
                          {eventMvp.length<3&&" · Event MVP ("+eventMvp.length+"/3)"}
                          {!bestIgl&&" · Best IGL"}
                          {!mostFinishes&&" · Most Kills"}
                        </div>
                      )}
                      <button className="btn btn-primary btn-full" onClick={handleSubmit} disabled={!canSubmit||submitting}>
                        {submitting?"Submitting...":mySubmission?"Update Picks 🔄":"Submit Picks 🎮"}
                      </button>
                      <div style={{textAlign:"center",fontSize:11,color:"#94a3b8",marginTop:7}}>Submitting again overwrites your previous picks.</div>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* MY SUBMISSION TAB */}
        {tab==="my"&&(
          <div className="wrap" style={{paddingTop:18,flex:1}}>
            {!identity?(
              <div className="locked"><div className="locked-icon">👤</div><div className="locked-title">Sign in first</div><div className="locked-sub">Go to Make Picks, enter your username and PIN.</div><button className="btn btn-primary" style={{marginTop:13}} onClick={()=>setTab("picks")}>Make Picks →</button></div>
            ):!mySubmission?(
              <div className="locked"><div className="locked-icon">📋</div><div className="locked-title">No submission yet</div><div className="locked-sub">{closed?"Submissions closed.":"Head to Make Picks."}</div>{!closed&&<button className="btn btn-primary" style={{marginTop:13}} onClick={()=>setTab("picks")}>Make Picks →</button>}</div>
            ):(
              <>
                {publishedResults&&(
                  <div style={{background:"linear-gradient(135deg,#1a56db,#1648c0)",borderRadius:14,padding:"18px",marginBottom:14,color:"#fff",textAlign:"center"}}>
                    <div style={{fontSize:12,opacity:.8,marginBottom:3}}>Your Prediction Score</div>
                    <div style={{fontFamily:"'Rajdhani',sans-serif",fontSize:48,fontWeight:700,lineHeight:1}}>
                      {calcPredictionScore(mySubmission,publishedResults)} <span style={{fontSize:20,opacity:.7}}>pts</span>
                    </div>
                    {fantasyData&&<div style={{fontSize:12,marginTop:7,opacity:.9}}>Fantasy Score: <strong>{calcFantasyScore(mySubmission,fantasyData)} pts</strong></div>}
                  </div>
                )}
                <div className="card">
                  <div className="card-title">📋 Your Submission</div>
                  <div style={{fontSize:11,color:"#94a3b8",marginBottom:12}}>Submitted {fmtTime(mySubmission.timestamp)}</div>
                  <div style={{marginBottom:12}}><div className="sec-label">Top 5 (in your order)</div>
                    <div className="chips">{(mySubmission.top5||[]).map((t,i)=>{const c=publishedResults?.top5?.includes(t),ch=mySubmission.champion===t;return<span key={t} className={`chip${ch?" champion":c?" correct":""}`}>{ch?"★ ":""}{i+1}. {t}</span>;})}</div>
                  </div>
                  <div style={{marginBottom:12}}><div className="sec-label">Finals MVP Picks</div>
                    <div className="chips">{(mySubmission.finalsMvp||[]).map((p,i)=><span key={p} className={`chip${publishedResults?.finalsMvp===p?" correct":""}`}>{i===0?"⭐ ":i+1+". "}{p}</span>)}</div>
                  </div>
                  <div style={{marginBottom:12}}><div className="sec-label">Event MVP Picks</div>
                    <div className="chips">{(mySubmission.eventMvp||[]).map((p,i)=><span key={p} className={`chip${publishedResults?.eventMvp===p?" correct":""}`}>{i===0?"⭐ ":i+1+". "}{p}</span>)}</div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:11}}>
                    <div><div className="sec-label">Best IGL</div><span className={`chip${publishedResults&&mySubmission.bestIgl===publishedResults.bestIgl?" correct":""}`}>{mySubmission.bestIgl}</span></div>
                    <div><div className="sec-label">Most Kills</div><span className={`chip${publishedResults&&mySubmission.mostFinishes===publishedResults.mostFinishes?" correct":""}`}>{mySubmission.mostFinishes}</span></div>
                  </div>
                  {!closed&&<div style={{marginTop:14}}><button className="btn btn-outline" onClick={()=>{setSubmitted(false);setTab("picks");}}>✏️ Edit Picks</button></div>}
                  {(() => {
                    const allEntries = Object.values(lbPages).flat();
                    const myEntry = allEntries.find(s=>s.username===identity?.username);
                    const rank = myEntry ? allEntries.indexOf(myEntry)+1 : null;
                    const picksWithScore = {...mySubmission, score: myEntry?.score??null, fantasyScore: myEntry?.fantasyScore??null, rank};
                    return <ShareButtons picks={picksWithScore} publishedResults={publishedResults} fantasyData={fantasyData} identity={identity}/>;
                  })()}
                </div>
                {publishedResults&&(
                  <div className="card">
                    <div className="card-title">🏆 Official Results</div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:11}}>
                      <div><div className="sec-label">Top 5</div><div className="chips">{(publishedResults.top5||[]).map(t=><span key={t} className={`chip${t===publishedResults.champion?" champion":"correct"}`}>{t===publishedResults.champion?"★ ":""}{t}</span>)}</div></div>
                      <div><div className="sec-label">Champion</div><span className="chip champion">🏆 {publishedResults.champion}</span></div>
                      <div><div className="sec-label">Finals MVP</div><span className="chip correct">{publishedResults.finalsMvp}</span></div>
                      <div><div className="sec-label">Event MVP</div><span className="chip correct">{publishedResults.eventMvp}</span></div>
                      <div><div className="sec-label">Best IGL</div><span className="chip correct">{publishedResults.bestIgl}</span></div>
                      <div><div className="sec-label">Most Kills</div><span className="chip correct">{publishedResults.mostFinishes}</span></div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* LEADERBOARD TAB */}
        {tab==="lb"&&(
          <div className="wrap" style={{paddingTop:18,flex:1}}>
            {!closed&&!meta?.published?(
              <div className="locked"><div className="locked-icon">🔒</div><div className="locked-title">Leaderboard Hidden</div><div className="locked-sub">Visible after Mar 27 at 1 PM IST.</div></div>
            ):(
              <>
                {fantasyData&&Object.keys(fantasyData.teamPoints||{}).length>0&&(
                  <div className="lb-tabs">
                    <button className={`lb-tab${lbTab==="prediction"?" active":""}`} onClick={()=>setLbTab("prediction")}>Prediction</button>
                    <button className={`lb-tab${lbTab==="fantasy"?" active":""}`} onClick={()=>setLbTab("fantasy")}>⚡ Fantasy</button>
                  </div>
                )}

                {!meta?.published&&<div className="banner amber">⏳ Picks visible — scores appear once results are published.</div>}

                {/* Search */}
                <div className="lb-search-wrap">
                  <span className="lb-search-icon">🔍</span>
                  <input className="lb-search input" placeholder={"Search username across all "+((lbMetaInfo?.count||0)>0?lbMetaInfo.count+" ":"")+"entries..."} value={lbSearch} onChange={e=>{setLbSearch(e.target.value);}}/>
                </div>

                {lbMetaInfo&&!lbSearch&&(
                  <div style={{fontSize:11,color:"#94a3b8",marginBottom:10}}>
                    {lbMetaInfo.count} total entries · Page {lbPage+1} of {totalPages} · 
                    {lbSearch?"":` showing ${lbPage*PAGE_SIZE+1}–${Math.min((lbPage+1)*PAGE_SIZE,lbMetaInfo.count)}`}
                  </div>
                )}

                {lbSearch&&<div style={{fontSize:11,color:"#94a3b8",marginBottom:10}}>{displayEntries.length} result{displayEntries.length!==1?"s":""} found{Object.keys(lbPages).length<totalPages?" (searching loaded pages only)":""}</div>}

                {lbLoading&&!displayEntries.length?(
                  <div className="loading"><div className="spinner"/>Loading page {lbPage+1}...</div>
                ):(
                  <div style={{overflowX:"auto"}}>
                    <table className="tbl">
                      <thead>
                        <tr>
                          <th style={{width:38}}>#</th>
                          <th>User</th>
                          {meta?.published&&<th style={{textAlign:"right",width:70}}>Score</th>}
                          <th style={{width:90}}>Champion</th>
                          <th>Other 4</th>
                          <th style={{width:80}}>F.MVP</th>
                          <th style={{width:80}}>E.MVP</th>
                          <th style={{width:90}}>Kills Team</th>
                          <th style={{width:70}}>IGL</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayEntries.map((s,i)=>{
                          // Global rank = page offset + local index (or from sorted position for search)
                          const globalRank = lbSearch ? (i+1) : (rankOffset+i+1);
                          return (
                            <tr key={s.username} style={s.username===identity?.username?{background:"rgba(26,86,219,.04)"}:{}}>
                              <td className="rank-c">{globalRank===1?"🥇":globalRank===2?"🥈":globalRank===3?"🥉":globalRank}</td>
                              <td>
                                <div style={{display:"flex",alignItems:"center",gap:5}}>
                                  <strong>{s.username}</strong>
                                  {s.username===identity?.username&&<span style={{fontSize:9,fontWeight:700,padding:"1px 6px",borderRadius:10,background:"rgba(26,86,219,.08)",color:"#1e40af"}}>You</span>}
                                </div>
                              </td>
                              {meta?.published&&(
                                <td style={{textAlign:"right"}}>
                                  {lbTab==="fantasy"
                                    ?<span className="fantasy-score">{s.fantasyScore??"-"}</span>
                                    :<span className="score-pill">{s.score??"-"} pts</span>}
                                </td>
                              )}
                              <td>
                                {s.champion&&(
                                  <span className={`chip${publishedResults?.top5?.includes(s.champion)?" champion":""}`}>
                                    ★ {sn(s.champion)}
                                  </span>
                                )}
                              </td>
                              <td>
                                <div className="chips">
                                  {(s.top5||[]).filter(t=>t!==s.champion).map(t=>{
                                    const c=publishedResults?.top5?.includes(t);
                                    return <span key={t} className={`chip${c?" correct":""}`}>{sn(t)}</span>;
                                  })}
                                </div>
                              </td>
                              <td>
                                <div className="chips">
                                  {(s.finalsMvp||[]).map((p,i)=>(
                                    <span key={p} className={`chip${publishedResults?.finalsMvp===p?" correct":""}`}>
                                      {i===0?"⭐ ":""}{p}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td>
                                <div className="chips">
                                  {(s.eventMvp||[]).map((p,i)=>(
                                    <span key={p} className={`chip${publishedResults?.eventMvp===p?" correct":""}`}>
                                      {i===0?"⭐ ":""}{p}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td>
                                <span className={`chip${publishedResults?.mostFinishes&&s.mostFinishes===publishedResults.mostFinishes?" correct":""}`}>
                                  {s.mostFinishes?sn(s.mostFinishes):"-"}
                                </span>
                              </td>
                              <td style={{fontSize:11}}>{s.bestIgl}</td>
                            </tr>
                          );
                        })}
                        {!displayEntries.length&&!lbLoading&&(
                          <tr><td colSpan={9} style={{textAlign:"center",color:"#94a3b8",padding:26}}>
                            {lbSearch?"No results found.":lbMetaInfo?"No entries on this page.":"No submissions yet."}
                          </td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Pagination — hide when searching */}
                {!lbSearch&&lbMetaInfo&&totalPages>1&&(
                  <div className="pagination">
                    <button className="page-btn" onClick={()=>setLbPage(0)} disabled={lbPage===0}>«</button>
                    <button className="page-btn" onClick={()=>setLbPage(p=>Math.max(0,p-1))} disabled={lbPage===0}>‹ Prev</button>
                    {/* Show page numbers around current */}
                    {Array.from({length:totalPages},(_, i)=>i).filter(i=>Math.abs(i-lbPage)<=2||i===0||i===totalPages-1).reduce((acc,i,idx,arr)=>{
                      if (idx>0&&arr[idx-1]!==i-1) acc.push("...");
                      acc.push(i); return acc;
                    },[]).map((item,i)=>
                      item==="..."
                        ?<span key={"ellipsis"+i} className="page-info">…</span>
                        :<button key={item} className={`page-btn${lbPage===item?" active":""}`} onClick={()=>setLbPage(item)}>{item+1}</button>
                    )}
                    <button className="page-btn" onClick={()=>setLbPage(p=>Math.min(totalPages-1,p+1))} disabled={lbPage===totalPages-1}>Next ›</button>
                    <button className="page-btn" onClick={()=>setLbPage(totalPages-1)} disabled={lbPage===totalPages-1}>»</button>
                  </div>
                )}

                {meta?.published&&(
                  <div style={{display:"flex",gap:12,flexWrap:"wrap",marginTop:10,fontSize:10,fontWeight:600,color:"#64748b"}}>
                    <span><span style={{display:"inline-block",width:7,height:7,borderRadius:"50%",background:"#16a34a",marginRight:3}}/>Correct pick</span>
                    <span><span style={{display:"inline-block",width:7,height:7,borderRadius:"50%",background:"#f59e0b",marginRight:3}}/>Champion pick</span>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {toast&&<div className={`toast${toast.type==="error"?" err":""}`}>{toast.msg}</div>}

        {/* Footer */}
        <div className="footer">
          <a href="https://esportsamaze.in" target="_blank" rel="noopener noreferrer">
            <img src="/logos/esportsamaze_singleline.png" className="footer-logo" alt="EsportsAmaze"/>
          </a>

          <div className="footer-links">
            <a href="https://esportsamaze.in" target="_blank" rel="noopener noreferrer" className="footer-link">📖 Wiki (Beta)</a>
            <a href="https://esportsamaze.com" target="_blank" rel="noopener noreferrer" className="footer-link">📰 News & Media</a>
            <a href="https://esportsamaze.in/BGMI/Tournaments/Battlegrounds_Mobile_India_Series_2026" target="_blank" rel="noopener noreferrer" className="footer-link">🏆 BGIS 2026</a>
          </div>
          <hr className="footer-divider"/>
          <div className="footer-promo">
            Interested in brand partnerships or promotions?<br/>
            <a href="mailto:connect@esportsamaze.com">connect@esportsamaze.com</a> · <a href="https://esportsamaze.com" target="_blank" rel="noopener noreferrer">esportsamaze.com</a>
          </div>
          <div className="footer-made">
            Made with ❤️ by EsportsAmaze · BGIS 2026 Grand Finals Pick'em
          </div>
        </div>

      </div>
    </>
  );
}
