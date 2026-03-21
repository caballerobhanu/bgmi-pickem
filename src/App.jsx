import { useState, useEffect, useRef } from "react";
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

const ADMIN_PASS   = import.meta.env.VITE_ADMIN_PASS;
const ADMIN_SECRET = import.meta.env.VITE_ADMIN_SECRET;
const ADMIN_PATH   = import.meta.env.VITE_ADMIN_PATH || "bgis-chennai-2026-arth";
const IS_ADMIN     = window.location.pathname.replace(/^\//, "") === ADMIN_PATH;

const META_DOC     = "bgis2026_finals_meta";
const SUBS_COL     = "bgis2026_finals_submissions";
const LB_CACHE_DOC = "bgis2026_finals_lb_cache";
const USERS_COL    = "bgis2026_finals_users";
const DEADLINE     = new Date("2026-03-27T07:30:00Z");
const LS_TOKEN     = "bgis2026f_token";
const LS_DOCID     = "bgis2026f_docid";
const LS_LB        = "bgis2026f_lb_cache";

const LOGO = (name) => `/logos/${name}.png`;

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
const ALL_IGLS = TEAMS.map(t => ({ player:t.igl, team:t.name, teamId:t.id, logo:t.logo }));

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
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Rajdhani:wght@600;700&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { scroll-behavior: smooth; }
  body { background: #f0f4ff; font-family: 'Inter', sans-serif; color: #0f172a; -webkit-font-smoothing: antialiased; overflow-x: hidden; }
  .app { min-height: 100vh; padding-bottom: 80px; }
  .container { max-width: 960px; margin: 0 auto; padding: 0 16px; }

  .hero { background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #1a56db 100%); padding: 32px 16px 28px; text-align: center; position: relative; overflow: hidden; }
  .hero::after { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse at 50% 120%, rgba(26,86,219,0.3), transparent 70%); pointer-events: none; }
  .hero-logo { height: 72px; object-fit: contain; margin-bottom: 12px; position: relative; z-index: 1; }
  .hero-title { font-family: 'Rajdhani', sans-serif; font-size: clamp(28px,6vw,52px); font-weight: 700; color: #fff; letter-spacing: 0.02em; line-height: 1; position: relative; z-index: 1; margin-bottom: 4px; }
  .hero-title span { color: #60a5fa; }
  .hero-sub { font-size: 13px; color: rgba(255,255,255,0.6); position: relative; z-index: 1; margin-bottom: 14px; }
  .hero-badges { display: flex; justify-content: center; gap: 8px; flex-wrap: wrap; position: relative; z-index: 1; align-items: center; }
  .badge { display: inline-flex; align-items: center; gap: 5px; padding: 5px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
  .badge-blue { background: rgba(96,165,250,0.15); border: 1px solid rgba(96,165,250,0.35); color: #93c5fd; }
  .badge-green { background: rgba(34,197,94,0.12); border: 1px solid rgba(34,197,94,0.3); color: #86efac; }
  .badge-red { background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.3); color: #fca5a5; }
  .badge-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
  .badge-dot.pulse { animation: pulse 1.5s infinite; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }

  /* FIX: Tournament link visible on dark hero */
  .tournament-link { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 600; color: #fff; text-decoration: none; background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.25); border-radius: 20px; padding: 5px 12px; transition: all 0.15s; }
  .tournament-link:hover { background: rgba(255,255,255,0.2); color: #fff; }

  .nav { background: #fff; border-bottom: 2px solid #e2e8f0; display: flex; overflow-x: auto; position: sticky; top: 0; z-index: 50; box-shadow: 0 2px 8px rgba(15,23,42,0.06); scrollbar-width: none; }
  .nav::-webkit-scrollbar { display: none; }
  .nav-btn { flex-shrink: 0; padding: 14px 20px; font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 600; color: #64748b; background: none; border: none; border-bottom: 3px solid transparent; margin-bottom: -2px; cursor: pointer; white-space: nowrap; transition: all 0.15s; }
  .nav-btn:hover { color: #0f172a; }
  .nav-btn.active { color: #1a56db; border-bottom-color: #1a56db; }

  .card { background: #fff; border: 1.5px solid #e2e8f0; border-radius: 14px; padding: 20px; margin-bottom: 16px; }
  .card-title { font-family: 'Rajdhani', sans-serif; font-size: 18px; font-weight: 700; color: #0f172a; margin-bottom: 14px; padding-bottom: 10px; border-bottom: 1px solid #f1f5f9; display: flex; align-items: center; gap: 8px; }
  .section-label { font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #94a3b8; margin-bottom: 10px; }

  .auth-card { background: #fff; border: 1.5px solid #e2e8f0; border-radius: 14px; padding: 24px; margin-bottom: 16px; }
  .auth-title { font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 6px; }
  .auth-sub { font-size: 13px; color: #64748b; margin-bottom: 18px; line-height: 1.6; }

  .input { width: 100%; background: #f8faff; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 11px 14px; font-size: 14px; font-family: 'Inter', sans-serif; color: #0f172a; outline: none; transition: border-color 0.15s, box-shadow 0.15s; }
  .input:focus { border-color: #1a56db; box-shadow: 0 0 0 3px rgba(26,86,219,0.08); }
  .input::placeholder { color: #94a3b8; }
  .input.err { border-color: #ef4444; }
  .pin-input { text-align: center; font-size: 28px; font-weight: 800; letter-spacing: 0.25em; font-family: 'Rajdhani', sans-serif; padding: 14px; }

  .btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 600; border-radius: 8px; padding: 9px 16px; cursor: pointer; transition: all 0.15s; border: 1.5px solid; white-space: nowrap; }
  .btn:disabled { opacity: 0.45; cursor: not-allowed; }
  .btn-primary { background: #1a56db; border-color: #1a56db; color: #fff; box-shadow: 0 4px 12px rgba(26,86,219,0.25); }
  .btn-primary:hover:not(:disabled) { background: #1648c0; transform: translateY(-1px); }
  .btn-outline { background: transparent; border-color: #cbd5e1; color: #475569; }
  .btn-outline:hover:not(:disabled) { border-color: #1a56db; color: #1a56db; background: rgba(26,86,219,0.04); }
  .btn-green { background: rgba(22,163,74,0.08); border-color: rgba(22,163,74,0.3); color: #15803d; }
  .btn-green:hover:not(:disabled) { background: rgba(22,163,74,0.14); }
  .btn-red { background: rgba(239,68,68,0.08); border-color: rgba(239,68,68,0.3); color: #dc2626; }
  .btn-red:hover:not(:disabled) { background: rgba(239,68,68,0.14); }
  .btn-purple { background: rgba(139,92,246,0.08); border-color: rgba(139,92,246,0.3); color: #7c3aed; }
  .btn-row { display: flex; gap: 8px; flex-wrap: wrap; }
  .btn-full { width: 100%; font-size: 15px; padding: 13px 20px; }

  .user-bar { display: flex; align-items: center; gap: 10px; background: rgba(22,163,74,0.06); border: 1px solid rgba(22,163,74,0.2); border-radius: 10px; padding: 10px 14px; margin-bottom: 16px; flex-wrap: wrap; }
  .user-bar-name { font-size: 16px; font-weight: 700; flex: 1; }

  /* Team grid */
  .teams-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 8px; margin-bottom: 16px; }
  @media(max-width:420px) { .teams-grid { grid-template-columns: repeat(3,1fr); } }
  .team-card { background: #fff; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 10px 6px 8px; display: flex; flex-direction: column; align-items: center; gap: 5px; cursor: pointer; transition: all 0.15s; font-family: 'Inter', sans-serif; position: relative; min-height: 80px; }
  .team-card:hover:not(:disabled):not(.selected) { border-color: #1a56db; background: rgba(26,86,219,0.04); transform: translateY(-2px); box-shadow: 0 4px 12px rgba(26,86,219,0.1); }
  .team-card.selected { border-color: #1a56db; background: rgba(26,86,219,0.06); }
  .team-card.champion-pick { border-color: #f59e0b; background: rgba(245,158,11,0.07); box-shadow: 0 0 0 2px rgba(245,158,11,0.2); }
  .team-card:disabled { opacity: 0.4; cursor: not-allowed; }

  /* FIX: logo background — show on white card */
  .team-logo { width: 42px; height: 42px; object-fit: contain; border-radius: 6px; background: #0f172a; padding: 3px; }
  .player-logo { width: 30px; height: 30px; object-fit: contain; border-radius: 4px; background: #0f172a; padding: 2px; }

  .team-name { font-size: 10px; font-weight: 600; text-align: center; line-height: 1.2; color: #0f172a; }
  .team-badge { position: absolute; top: 3px; left: 3px; font-size: 10px; font-weight: 700; background: #1a56db; color: #fff; border-radius: 4px; padding: 1px 4px; line-height: 1.4; }
  .team-badge.gold { background: #f59e0b; }

  /* Player grid */
  .players-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(82px, 1fr)); gap: 6px; margin-bottom: 12px; max-height: 300px; overflow-y: auto; padding-right: 2px; }
  .player-card { background: #f8faff; border: 1.5px solid #e2e8f0; border-radius: 8px; padding: 8px 5px; display: flex; flex-direction: column; align-items: center; gap: 3px; cursor: pointer; transition: all 0.15s; font-family: 'Inter', sans-serif; position: relative; }
  .player-card:hover:not(:disabled):not(.selected) { border-color: #1a56db; background: rgba(26,86,219,0.06); }
  .player-card.selected { border-color: #1a56db; background: rgba(26,86,219,0.08); }
  .player-card.first-pick { border-color: #f59e0b; background: rgba(245,158,11,0.08); }
  .player-name { font-size: 10px; font-weight: 600; text-align: center; line-height: 1.2; }
  .player-team-name { font-size: 9px; color: #94a3b8; text-align: center; }

  /* Drag-and-drop Top 5 slots */
  .slots-list { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
  .drag-slot { display: flex; align-items: center; gap: 10px; background: #f8faff; border: 1.5px solid #1a56db; border-radius: 10px; padding: 8px 12px; cursor: grab; user-select: none; transition: all 0.15s; }
  .drag-slot:active { cursor: grabbing; }
  .drag-slot.champion { border-color: #f59e0b; background: rgba(245,158,11,0.06); }
  .drag-slot.dragging { opacity: 0.4; }
  .drag-slot.drag-over { border-color: #1a56db; background: rgba(26,86,219,0.08); transform: scale(1.01); }
  .drag-handle { color: #94a3b8; font-size: 16px; cursor: grab; flex-shrink: 0; }
  .drag-num { font-family: 'Rajdhani', sans-serif; font-size: 18px; font-weight: 700; color: #1a56db; min-width: 22px; text-align: center; }
  .drag-slot.champion .drag-num { color: #f59e0b; }
  .drag-logo { width: 28px; height: 28px; object-fit: contain; border-radius: 4px; background: #0f172a; padding: 2px; flex-shrink: 0; }
  .drag-name { font-size: 13px; font-weight: 600; flex: 1; }
  .drag-actions { display: flex; align-items: center; gap: 6px; margin-left: auto; }
  .champ-btn { font-size: 11px; font-weight: 600; padding: 2px 7px; border-radius: 6px; cursor: pointer; border: 1.5px solid #cbd5e1; background: transparent; color: #64748b; font-family: 'Inter', sans-serif; transition: all 0.15s; white-space: nowrap; }
  .champ-btn.active { background: rgba(245,158,11,0.12); border-color: #f59e0b; color: #92400e; }
  .rm-btn { width: 20px; height: 20px; border-radius: 50%; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.2); color: #dc2626; font-size: 10px; font-weight: 900; display: flex; align-items: center; justify-content: center; cursor: pointer; }
  .rm-btn:hover { background: rgba(239,68,68,0.2); }

  .score-strip { background: #fff; border-bottom: 1px solid #e2e8f0; padding: 8px 16px; display: flex; gap: 16px; overflow-x: auto; font-size: 11px; font-weight: 600; color: #475569; scrollbar-width: none; }
  .score-strip::-webkit-scrollbar { display: none; }
  .score-item { display: flex; align-items: center; gap: 4px; white-space: nowrap; }
  .score-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }

  .steps { display: flex; margin-bottom: 20px; border-radius: 10px; overflow: hidden; border: 1px solid #e2e8f0; }
  .step { flex: 1; padding: 10px 6px; text-align: center; font-size: 11px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: #94a3b8; background: #fff; border-right: 1px solid #e2e8f0; transition: all 0.2s; }
  .step:last-child { border-right: none; }
  .step.active { color: #1a56db; background: rgba(26,86,219,0.05); }
  .step.done { color: #16a34a; background: rgba(22,163,74,0.05); }
  .step-n { display: inline-flex; width: 16px; height: 16px; border-radius: 50%; background: #e2e8f0; align-items: center; justify-content: center; font-size: 9px; margin-right: 3px; vertical-align: middle; }
  .step.active .step-n { background: #1a56db; color: #fff; }
  .step.done .step-n { background: #16a34a; color: #fff; }

  .toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); background: #16a34a; color: #fff; font-weight: 700; font-size: 14px; padding: 12px 22px; border-radius: 10px; z-index: 999; white-space: nowrap; box-shadow: 0 4px 20px rgba(0,0,0,0.15); animation: toast-in 0.25s ease; }
  .toast.err { background: #dc2626; }
  @keyframes toast-in { from{opacity:0;transform:translateX(-50%) translateY(8px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }

  .loading { text-align: center; padding: 48px 20px; color: #94a3b8; }
  .spinner { width: 30px; height: 30px; border: 3px solid #e2e8f0; border-top-color: #1a56db; border-radius: 50%; animation: spin 0.7s linear infinite; margin: 0 auto 12px; }
  @keyframes spin { to{transform:rotate(360deg)} }

  .success-card { text-align: center; padding: 40px 20px; background: #fff; border-radius: 14px; border: 1.5px solid #e2e8f0; margin-bottom: 16px; }
  .success-icon { font-size: 52px; margin-bottom: 12px; }
  .success-title { font-family: 'Rajdhani', sans-serif; font-size: 26px; font-weight: 700; color: #16a34a; margin-bottom: 8px; }

  .locked { background: #fff; border: 1.5px solid #e2e8f0; border-radius: 14px; padding: 40px 20px; text-align: center; margin-bottom: 16px; }
  .locked-icon { font-size: 38px; margin-bottom: 10px; }
  .locked-title { font-family: 'Rajdhani', sans-serif; font-size: 20px; font-weight: 700; color: #0f172a; margin-bottom: 6px; }
  .locked-sub { font-size: 13px; color: #64748b; line-height: 1.6; }

  .banner { border-radius: 10px; padding: 10px 14px; margin-bottom: 14px; font-size: 13px; font-weight: 600; line-height: 1.5; }
  .banner.amber { background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.25); color: #92400e; }
  .banner.blue { background: rgba(26,86,219,0.06); border: 1px solid rgba(26,86,219,0.2); color: #1e40af; }
  .banner.green { background: rgba(22,163,74,0.06); border: 1px solid rgba(22,163,74,0.2); color: #14532d; }

  .sub-card { background: #fff; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 16px 18px; margin-bottom: 12px; }
  .sub-header { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; flex-wrap: wrap; }
  .status-chip { font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.04em; }
  .status-published { background: rgba(22,163,74,0.1); color: #16a34a; }
  .status-pending { background: rgba(245,158,11,0.1); color: #92400e; }
  .status-open { background: rgba(26,86,219,0.08); color: #1e40af; }

  .chips { display: flex; flex-wrap: wrap; gap: 4px; }
  .chip { font-size: 10px; font-weight: 600; padding: 2px 7px; border-radius: 4px; background: #f1f5f9; border: 1px solid #e2e8f0; color: #475569; }
  .chip.correct { background: rgba(22,163,74,0.1); border-color: rgba(22,163,74,0.3); color: #16a34a; }
  .chip.champion { background: rgba(245,158,11,0.1); border-color: rgba(245,158,11,0.3); color: #92400e; }

  .lb-tabs { display: flex; gap: 0; border: 1.5px solid #e2e8f0; border-radius: 10px; overflow: hidden; margin-bottom: 16px; width: fit-content; }
  .lb-tab { padding: 9px 18px; font-size: 13px; font-weight: 600; background: none; border: none; cursor: pointer; font-family: 'Inter', sans-serif; color: #64748b; transition: all 0.15s; border-right: 1px solid #e2e8f0; }
  .lb-tab:last-child { border-right: none; }
  .lb-tab.active { background: #0f172a; color: #fff; }

  .table { width: 100%; border-collapse: separate; border-spacing: 0; background: #fff; border: 1.5px solid #e2e8f0; border-radius: 12px; overflow: hidden; font-size: 13px; }
  .table th { background: #f8faff; color: #94a3b8; font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; padding: 10px 12px; border-bottom: 1.5px solid #e2e8f0; text-align: left; }
  .table td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
  .table tr:last-child td { border-bottom: none; }
  .table tr:hover td { background: rgba(26,86,219,0.02); }
  .rank-cell { font-family: 'Rajdhani', sans-serif; font-size: 22px; font-weight: 700; color: #94a3b8; text-align: center; width: 40px; }
  .score-pill { font-family: 'Rajdhani', sans-serif; font-size: 16px; font-weight: 700; color: #1a56db; }
  .fantasy-score { font-family: 'Rajdhani', sans-serif; font-size: 15px; font-weight: 700; color: #7c3aed; }
  .user-cell { display: flex; align-items: center; gap: 6px; }

  .admin-box { background: #fff; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 16px; }
  .admin-title { font-family: 'Rajdhani', sans-serif; font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid #f1f5f9; }
  .admin-label { font-size: 11px; font-weight: 700; color: #94a3b8; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.05em; }
  .admin-select { background: #f8faff; border: 1.5px solid #e2e8f0; border-radius: 8px; padding: 8px 10px; color: #0f172a; font-size: 13px; font-family: 'Inter', sans-serif; outline: none; width: 100%; }
  .admin-select:focus { border-color: #1a56db; }
  .admin-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px,1fr)); gap: 10px; margin-bottom: 14px; }
  .del-btn { background: none; border: 1px solid #e2e8f0; border-radius: 6px; padding: 3px 8px; font-size: 11px; font-weight: 600; color: #94a3b8; cursor: pointer; transition: all 0.15s; font-family: 'Inter', sans-serif; }
  .del-btn:hover { border-color: #ef4444; color: #dc2626; background: rgba(239,68,68,0.06); }

  .fantasy-input-wrap { display: flex; flex-direction: column; gap: 3px; }
  .fantasy-input { background: #f8faff; border: 1.5px solid #e2e8f0; border-radius: 8px; padding: 7px 10px; font-size: 13px; font-family: 'Inter', sans-serif; color: #0f172a; outline: none; width: 100%; }
  .fantasy-input:focus { border-color: #1a56db; }
  .fantasy-label { font-size: 11px; font-weight: 600; color: #64748b; }
  .info-row { display: flex; gap: 12px; align-items: center; font-size: 12px; color: #64748b; flex-wrap: wrap; }
  .info-row strong { color: #0f172a; }
  .err-text { font-size: 12px; color: #dc2626; font-weight: 600; margin-top: 6px; }

  @media(max-width:600px) {
    .hero { padding: 24px 14px 20px; }
    .hero-logo { height: 56px; }
    .container { padding: 0 12px; }
    .card { padding: 16px; }
    .nav-btn { padding: 12px 14px; font-size: 12px; }
    .drag-name { font-size: 12px; }
  }
`;


// Player Accordion - grouped by team, tap to expand
function PlayerAccordion({ picks, setPicks, max, pts1, pts2 }) {
  const [open, setOpen] = useState(null);

  const pickPlayer = (player) => {
    if (picks.includes(player)) { setPicks(p=>p.filter(x=>x!==player)); return; }
    if (picks.length >= max) return;
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
        Tap a team to expand, then tap a player name to select.
      </div>
      {TEAMS.map(t=>{
        const teamPicks = picks.filter(p=>t.players.includes(p));
        const isOpen = open===t.id;
        return (
          <div key={t.id} style={{border:`1.5px solid ${teamPicks.length>0?"#1a56db":"#e2e8f0"}`,borderRadius:10,marginBottom:7,overflow:"hidden"}}>
            <div onClick={()=>setOpen(o=>o===t.id?null:t.id)}
              style={{display:"flex",alignItems:"center",gap:10,padding:"10px 13px",cursor:"pointer",background:"#fff",userSelect:"none"}}>
              <img src={LOGO(t.logo)} alt="" style={{width:30,height:30,objectFit:"contain",borderRadius:5,background:"#0f172a",padding:2,flexShrink:0}}/>
              <span style={{fontSize:13,fontWeight:600,flex:1}}>{t.name}</span>
              {teamPicks.length>0&&<span style={{fontSize:11,fontWeight:700,color:"#1a56db",background:"rgba(26,86,219,.08)",borderRadius:10,padding:"2px 8px"}}>{teamPicks.length} picked</span>}
              <span style={{fontSize:11,color:"#94a3b8",transition:"transform .2s",transform:isOpen?"rotate(180deg)":"none",flexShrink:0}}>▼</span>
            </div>
            {isOpen&&(
              <div style={{background:"#f8faff",borderTop:"1px solid #e2e8f0",padding:"10px 13px",display:"flex",flexWrap:"wrap",gap:6}}>
                {t.players.map(player=>{
                  const idx=picks.indexOf(player);
                  const isPicked=idx>=0, isFirst=idx===0;
                  const isDisabled=!isPicked&&picks.length>=max;
                  const isIgl=player===t.igl;
                  return (
                    <button key={player} onClick={()=>!isDisabled&&pickPlayer(player)}
                      disabled={isDisabled}
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
  );
}


// ── Drag-and-drop Top 5 list component ───────────────────────────
function DraggableTop5({ top5, setTop5, champion, setChampion }) {
  const dragIdx = useRef(null);
  const [dragOver, setDragOver] = useState(null);

  const onDragStart = (e, idx) => {
    dragIdx.current = idx;
    e.dataTransfer.effectAllowed = "move";
  };
  const onDragOver = (e, idx) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOver(idx);
  };
  const onDrop = (e, idx) => {
    e.preventDefault();
    if (dragIdx.current === null || dragIdx.current === idx) { setDragOver(null); return; }
    const newList = [...top5];
    const [moved] = newList.splice(dragIdx.current, 1);
    newList.splice(idx, 0, moved);
    setTop5(newList);
    dragIdx.current = null;
    setDragOver(null);
  };
  const onDragEnd = () => { dragIdx.current = null; setDragOver(null); };

  // Touch drag support
  const touchStart = useRef(null);
  const onTouchStart = (e, idx) => { touchStart.current = { idx, y: e.touches[0].clientY }; };
  const onTouchEnd = (e, idx) => {
    if (!touchStart.current) return;
    touchStart.current = null;
  };

  return (
    <div className="slots-list">
      {top5.map((teamName, idx) => {
        const t = TEAMS.find(t => t.name === teamName);
        const isChamp = champion === teamName;
        return (
          <div key={teamName}
            className={`drag-slot${isChamp ? " champion" : ""}${dragOver === idx ? " drag-over" : ""}`}
            draggable
            onDragStart={e => onDragStart(e, idx)}
            onDragOver={e => onDragOver(e, idx)}
            onDrop={e => onDrop(e, idx)}
            onDragEnd={onDragEnd}
            onTouchStart={e => onTouchStart(e, idx)}
            onTouchEnd={e => onTouchEnd(e, idx)}
          >
            <span className="drag-handle">⠿</span>
            <span className="drag-num">#{idx + 1}</span>
            <img className="drag-logo" src={IMGS[t?.logo]} alt="" />
            <span className="drag-name">{teamName}</span>
            <div className="drag-actions">
              <button className={`champ-btn${isChamp ? " active" : ""}`}
                onClick={() => setChampion(isChamp ? null : teamName)}>
                {isChamp ? "★ Champ" : "☆ Champ"}
              </button>
              <button className="rm-btn" onClick={() => {
                setTop5(prev => prev.filter(t => t !== teamName));
                if (isChamp) setChampion(null);
              }}>✕</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("picks");
  const [toast, setToast] = useState(null);
  const [meta, setMeta] = useState(null);

  const [identity, setIdentity] = useState(null);
  const [usernameInput, setUsernameInput] = useState("");
  const [pinFlow, setPinFlow] = useState("username");
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [pendingDocId, setPendingDocId] = useState(null);
  const [idLoading, setIdLoading] = useState(false);

  const [top5, setTop5] = useState([]);
  const [champion, setChampion] = useState(null);
  const [finalsMvp, setFinalsMvp] = useState([]);
  const [eventMvp, setEventMvp] = useState([]);
  const [bestIgl, setBestIgl] = useState(null);
  const [mostFinishes, setMostFinishes] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [mySubmission, setMySubmission] = useState(null);

  const [lbTab, setLbTab] = useState("prediction");
  const [lbData, setLbData] = useState(null);
  const [fantasyData, setFantasyData] = useState(null);

  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [adminPassInput, setAdminPassInput] = useState("");
  const [adminAttempts, setAdminAttempts] = useState(0);
  const [adminLockUntil] = useState(() => parseInt(localStorage.getItem("bgis26f_admin_lock") || "0"));
  const [adminSubs, setAdminSubs] = useState([]);
  const [adminFetching, setAdminFetching] = useState(false);
  const [results, setResults] = useState({ top5: [], champion: "", finalsMvp: "", eventMvp: "", bestIgl: "", mostFinishes: "" });
  const [adminFantasy, setAdminFantasy] = useState({ teamPoints: {}, playerKills: {} });
  const [adminFantasySaving, setAdminFantasySaving] = useState(false);
  const [subCount, setSubCount] = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, "pickem", META_DOC));
        if (snap.exists()) {
          const d = snap.data();
          setMeta(d);
          if (d.results) setResults(d.results);
          if (d.fantasy) { setAdminFantasy(d.fantasy); setFantasyData(d.fantasy); }
        } else setMeta({});
      } catch { setMeta({}); }
    };
    load();
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem(LS_TOKEN);
    const savedId = localStorage.getItem(LS_DOCID);
    if (saved && savedId) setIdentity({ username: savedId, token: saved, isReturning: true });
  }, []);

  useEffect(() => {
    if (!identity) { setMySubmission(null); return; }
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, "pickem", META_DOC, SUBS_COL, identity.username));
        if (snap.exists() && !snap.data().deleted) {
          const sub = snap.data();
          setMySubmission(sub);
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

  useEffect(() => {
    if (!meta) return;
    const loadLb = async () => {
      const serverVersion = meta.cacheVersion || 0;
      try {
        const cached = JSON.parse(localStorage.getItem(LS_LB) || "null");
        if (cached && cached.version === serverVersion && cached.submissions?.length) {
          setLbData(cached.submissions); setSubCount(cached.submissions.length); return;
        }
      } catch {}
      try {
        const snap = await getDoc(doc(db, "pickem", LB_CACHE_DOC));
        if (snap.exists()) {
          const d = snap.data();
          setLbData(d.submissions || []); setSubCount(d.count || 0);
          localStorage.setItem(LS_LB, JSON.stringify({ version: serverVersion, submissions: d.submissions || [] }));
        }
      } catch {}
    };
    if (isClosed() || meta?.published) loadLb();
  }, [meta]);

  const handleConfirm = async () => {
    const clean = usernameInput.trim().toLowerCase().replace(/[^a-z0-9_\-.]/g, "");
    if (!clean || clean.length < 3) { showToast("Username must be at least 3 characters", "error"); return; }
    setIdLoading(true); setPinError("");
    try {
      const uSnap = await getDoc(doc(db, USERS_COL, clean));
      setPendingDocId(clean);
      if (uSnap.exists()) {
        const savedId = localStorage.getItem(LS_DOCID);
        const savedToken = localStorage.getItem(LS_TOKEN);
        if (savedId === clean && savedToken === uSnap.data().token) {
          setIdentity({ username: clean, token: savedToken, isReturning: true });
          showToast(`Welcome back, ${clean}!`);
        } else setPinFlow("pin_verify");
      } else setPinFlow("pin_new");
    } catch { showToast("Something went wrong. Try again.", "error"); }
    finally { setIdLoading(false); }
  };

  const handleSetPin = async () => {
    if (!/^\d{6}$/.test(pinInput)) { setPinError("PIN must be exactly 6 digits"); return; }
    const token = await hashPin(pinInput + pendingDocId);
    try {
      await setDoc(doc(db, USERS_COL, pendingDocId), { token, username: pendingDocId, createdAt: new Date().toISOString() });
      localStorage.setItem(LS_TOKEN, token); localStorage.setItem(LS_DOCID, pendingDocId);
      setIdentity({ username: pendingDocId, token, isReturning: false });
      setPinFlow("username"); setPinInput(""); setPinError("");
      showToast(`Welcome, ${pendingDocId}! 🎮`);
    } catch { showToast("Failed to save. Try again.", "error"); }
  };

  const handleVerifyPin = async () => {
    if (!/^\d{6}$/.test(pinInput)) { setPinError("PIN must be exactly 6 digits"); return; }
    const lockKey = `bgis26f_pin_lock_${pendingDocId}`;
    const attKey = `bgis26f_pin_att_${pendingDocId}`;
    const now = Date.now();
    const lockedUntil = parseInt(localStorage.getItem(lockKey) || "0");
    if (now < lockedUntil) { setPinError(`Locked for ${Math.ceil((lockedUntil-now)/60000)} min.`); return; }
    setIdLoading(true); setPinError("");
    try {
      const uSnap = await getDoc(doc(db, USERS_COL, pendingDocId));
      const token = await hashPin(pinInput + pendingDocId);
      if (uSnap.exists() && uSnap.data().token === token) {
        localStorage.removeItem(lockKey); localStorage.removeItem(attKey);
        localStorage.setItem(LS_TOKEN, token); localStorage.setItem(LS_DOCID, pendingDocId);
        setIdentity({ username: pendingDocId, token, isReturning: true });
        setPinFlow("username"); setPinInput(""); setPinError("");
        showToast(`Welcome back, ${pendingDocId}!`);
      } else {
        const att = parseInt(localStorage.getItem(attKey) || "0") + 1;
        localStorage.setItem(attKey, String(att));
        if (att >= 3) { localStorage.setItem(lockKey, String(now+15*60000)); setPinError("Too many attempts. Locked 15 min."); }
        else setPinError(`Wrong PIN. ${3-att} attempt${3-att===1?"":"s"} left.`);
      }
    } catch { setPinError("Something went wrong."); }
    finally { setIdLoading(false); }
  };

  const resetIdentity = () => {
    setIdentity(null); setUsernameInput(""); setPinFlow("username"); setPinInput(""); setPinError("");
    localStorage.removeItem(LS_TOKEN); localStorage.removeItem(LS_DOCID);
  };

  const canSubmit = top5.length === 5 && champion && finalsMvp.length === 3 && eventMvp.length === 3 && bestIgl && mostFinishes;

  const handleSubmit = async () => {
    if (!identity || !canSubmit) return;
    setSubmitting(true);
    try {
      const sub = { username: identity.username, top5, champion, finalsMvp, eventMvp, bestIgl, mostFinishes, timestamp: new Date().toISOString(), createdAt: mySubmission?.createdAt || new Date().toISOString() };
      await setDoc(doc(db, "pickem", META_DOC, SUBS_COL, identity.username), sub);
      setMySubmission(sub); setSubmitted(true);
      showToast("Picks submitted! Good luck! 🎮");
    } catch { showToast("Failed to save. Try again.", "error"); }
    finally { setSubmitting(false); }
  };

  const toggleTop5 = (teamName) => {
    if (isClosed() || !identity) return;
    if (top5.includes(teamName)) {
      setTop5(prev => prev.filter(t => t !== teamName));
      if (champion === teamName) setChampion(null);
    } else {
      if (top5.length >= 5) { showToast("You can only pick 5 teams", "error"); return; }
      setTop5(prev => [...prev, teamName]);
    }
  };

  const toggleMvp = (player, arr, setArr, max) => {
    if (arr.includes(player)) setArr(prev => prev.filter(p => p !== player));
    else { if (arr.length >= max) { showToast(`Max ${max} picks`, "error"); return; } setArr(prev => [...prev, player]); }
  };

  // Admin
  const handleAdminLogin = () => {
    const now = Date.now();
    if (now < adminLockUntil) { showToast(`Locked for ${Math.ceil((adminLockUntil-now)/60000)} min`, "error"); return; }
    if (adminPassInput === ADMIN_PASS) {
      setAdminUnlocked(true); setAdminAttempts(0);
      localStorage.removeItem("bgis26f_admin_lock");
      loadAdminSubs();
    } else {
      const next = adminAttempts + 1; setAdminAttempts(next);
      if (next >= 5) { const lu = now+15*60000; localStorage.setItem("bgis26f_admin_lock", String(lu)); showToast("Locked 15 min", "error"); }
      else showToast(`Wrong. ${5-next} left`, "error");
    }
  };

  const loadAdminSubs = async () => {
    setAdminFetching(true);
    try {
      const snap = await getDocs(collection(db, "pickem", META_DOC, SUBS_COL));
      const subs = snap.docs.map(d => d.data()).filter(d => !d.deleted);
      setAdminSubs(subs); setSubCount(subs.length);
    } catch {}
    setAdminFetching(false);
  };

  const handleSaveResults = async () => {
    try {
      const freshSnap = await getDoc(doc(db, "pickem", META_DOC));
      const fresh = freshSnap.exists() ? freshSnap.data() : {};
      await setDoc(doc(db, "pickem", META_DOC), { adminSecret: ADMIN_SECRET, ...fresh, results }, { merge: true });
      setMeta(prev => ({ ...prev, results }));
      showToast("Results saved!");
    } catch { showToast("Save failed", "error"); }
  };

  const handlePublishToggle = async (publish) => {
    try {
      const freshSnap = await getDoc(doc(db, "pickem", META_DOC));
      const fresh = freshSnap.exists() ? freshSnap.data() : {};
      await setDoc(doc(db, "pickem", META_DOC), { adminSecret: ADMIN_SECRET, ...fresh, published: publish }, { merge: true });
      setMeta(prev => ({ ...prev, published: publish }));
      if (publish) await bakeLeaderboard();
      showToast(publish ? "Scores published!" : "Scores hidden");
    } catch { showToast("Failed", "error"); }
  };

  const bakeLeaderboard = async () => {
    try {
      const snap = await getDocs(collection(db, "pickem", META_DOC, SUBS_COL));
      const submissions = snap.docs.map(d => d.data()).filter(d => !d.deleted);
      await setDoc(doc(db, "pickem", LB_CACHE_DOC), { adminSecret: ADMIN_SECRET, bakedAt: new Date().toISOString(), submissions, count: submissions.length });
      const freshSnap = await getDoc(doc(db, "pickem", META_DOC));
      const fresh = freshSnap.exists() ? freshSnap.data() : {};
      await setDoc(doc(db, "pickem", META_DOC), { adminSecret: ADMIN_SECRET, ...fresh, cacheVersion: (fresh.cacheVersion||0)+1 }, { merge: true });
      localStorage.removeItem(LS_LB);
      showToast(`Baked — ${submissions.length} submissions`);
    } catch(e) { showToast("Bake failed", "error"); }
  };

  const handleSaveFantasy = async () => {
    setAdminFantasySaving(true);
    try {
      const freshSnap = await getDoc(doc(db, "pickem", META_DOC));
      const fresh = freshSnap.exists() ? freshSnap.data() : {};
      await setDoc(doc(db, "pickem", META_DOC), { adminSecret: ADMIN_SECRET, ...fresh, fantasy: adminFantasy }, { merge: true });
      setFantasyData(adminFantasy);
      showToast("Fantasy data saved!");
    } catch { showToast("Save failed", "error"); }
    setAdminFantasySaving(false);
  };

  const handleDeleteSub = async (username) => {
    if (!window.confirm(`Delete ${username}?`)) return;
    try {
      await setDoc(doc(db, "pickem", META_DOC, SUBS_COL, username), { adminSecret: ADMIN_SECRET, deleted: true }, { merge: true });
      setAdminSubs(prev => prev.filter(s => s.username !== username));
      showToast("Deleted");
    } catch { showToast("Delete failed", "error"); }
  };

  const publishedResults = meta?.published ? meta?.results : null;
  const scoredLb = lbData ? [...lbData].map(s => ({
    ...s,
    score: publishedResults ? calcPredictionScore(s, publishedResults) : null,
    fantasyScore: fantasyData ? calcFantasyScore(s, fantasyData) : null,
  })).sort((a, b) => {
    if (lbTab === "fantasy") return (b.fantasyScore||0) - (a.fantasyScore||0);
    if ((b.score||0) !== (a.score||0)) return (b.score||0) - (a.score||0);
    return new Date(a.createdAt||0) - new Date(b.createdAt||0);
  }) : null;

  const closed = isClosed();
  const countdown = timeLeft();
  const step = !identity ? 1 : (top5.length<5||!champion||finalsMvp.length<3||eventMvp.length<3||!bestIgl||!mostFinishes) ? 2 : 3;

  // ── Admin render ──────────────────────────────────────────────
  if (IS_ADMIN) return (
    <>
      <style>{CSS}</style>
      <div className="app">
        <div className="hero">
          <img src={IMGS["BGIS_2026_Logo_White"]} className="hero-logo" alt="BGIS 2026" />
          <div className="hero-title">ADMIN <span>PANEL</span></div>
          <div className="hero-sub">BGIS 2026 Grand Finals Pick'em</div>
        </div>
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "20px 16px" }}>
          {!adminUnlocked ? (
            <div className="admin-box" style={{ maxWidth: 360 }}>
              <div className="admin-title">Admin Access</div>
              <div style={{ marginBottom: 12 }}>
                <div className="admin-label">Password</div>
                <input className="input" type="password" placeholder="Enter admin password"
                  value={adminPassInput} onChange={e => setAdminPassInput(e.target.value)}
                  onKeyDown={e => e.key==="Enter" && handleAdminLogin()} />
              </div>
              <button className="btn btn-primary btn-full" onClick={handleAdminLogin}>Unlock</button>
            </div>
          ) : (
            <>
              <div className="admin-box">
                <div className="admin-title">📊 Stats</div>
                <div className="info-row">
                  <span>Submissions: <strong>{subCount ?? "..."}</strong></span>
                  <span>Published: <strong>{meta?.published ? "Yes ✅" : "No"}</strong></span>
                </div>
                <div className="btn-row" style={{ marginTop: 12 }}>
                  <button className="btn btn-outline" onClick={loadAdminSubs} disabled={adminFetching}>{adminFetching?"Loading...":"🔄 Refresh"}</button>
                  <button className="btn btn-purple" onClick={bakeLeaderboard}>🗜 Bake Cache</button>
                  {!meta?.published
                    ? <button className="btn btn-green" onClick={() => handlePublishToggle(true)}>✅ Publish Scores</button>
                    : <button className="btn btn-red" onClick={() => handlePublishToggle(false)}>🔒 Hide Scores</button>}
                </div>
              </div>

              <div className="admin-box">
                <div className="admin-title">🏆 Results</div>
                <div className="admin-grid">
                  {[0,1,2,3,4].map(i => (
                    <div key={i}>
                      <div className="admin-label">Top 5 — #{i+1}</div>
                      <select className="admin-select" value={results.top5?.[i]||""} onChange={e => { const v=[...(results.top5||["","","","",""])]; v[i]=e.target.value; setResults(p=>({...p,top5:v})); }}>
                        <option value="">— Select —</option>
                        {TEAMS.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                      </select>
                    </div>
                  ))}
                  {[["champion","Champion"],["finalsMvp","Finals MVP"],["eventMvp","Event MVP"]].map(([k,l]) => (
                    <div key={k}>
                      <div className="admin-label">{l}</div>
                      <select className="admin-select" value={results[k]||""} onChange={e => setResults(p=>({...p,[k]:e.target.value}))}>
                        <option value="">— Select —</option>
                        {k==="champion" ? TEAMS.map(t=><option key={t.id} value={t.name}>{t.name}</option>) : ALL_PLAYERS.map(p=><option key={p.player} value={p.player}>{p.player} ({p.team})</option>)}
                      </select>
                    </div>
                  ))}
                  <div>
                    <div className="admin-label">Best IGL</div>
                    <select className="admin-select" value={results.bestIgl||""} onChange={e=>setResults(p=>({...p,bestIgl:e.target.value}))}>
                      <option value="">— Select —</option>
                      {ALL_IGLS.map(p=><option key={p.player} value={p.player}>{p.player} ({p.team})</option>)}
                    </select>
                  </div>
                  <div>
                    <div className="admin-label">Most Kills (team)</div>
                    <select className="admin-select" value={results.mostFinishes||""} onChange={e=>setResults(p=>({...p,mostFinishes:e.target.value}))}>
                      <option value="">— Select —</option>
                      {TEAMS.map(t=><option key={t.id} value={t.name}>{t.name}</option>)}
                    </select>
                  </div>
                </div>
                <button className="btn btn-green" onClick={handleSaveResults}>💾 Save Results</button>
              </div>

              <div className="admin-box">
                <div className="admin-title">⚡ Fantasy Data (Live Updates)</div>
                <p style={{fontSize:12,color:"#64748b",marginBottom:14}}>Update after each match day.</p>
                <div className="admin-label" style={{marginBottom:8}}>Team Points</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:8,marginBottom:16}}>
                  {TEAMS.map(t=>(
                    <div key={t.id} className="fantasy-input-wrap">
                      <label className="fantasy-label">{t.name}</label>
                      <input type="number" className="fantasy-input" placeholder="0"
                        value={adminFantasy.teamPoints?.[t.id]??""} onChange={e=>setAdminFantasy(p=>({...p,teamPoints:{...p.teamPoints,[t.id]:parseInt(e.target.value)||0}}))} />
                    </div>
                  ))}
                </div>
                <div className="admin-label" style={{marginBottom:8}}>Player Kills</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:8,marginBottom:16}}>
                  {ALL_PLAYERS.map(p=>(
                    <div key={p.player} className="fantasy-input-wrap">
                      <label className="fantasy-label">{p.player} <span style={{color:"#94a3b8"}}>({TEAMS.find(t=>t.id===p.teamId)?.name?.split(" ")[0]})</span></label>
                      <input type="number" className="fantasy-input" placeholder="0"
                        value={adminFantasy.playerKills?.[p.player]??""} onChange={e=>setAdminFantasy(p=>({...p,playerKills:{...p.playerKills,[p.player]:parseInt(e.target.value)||0}}))} />
                    </div>
                  ))}
                </div>
                <button className="btn btn-primary" onClick={handleSaveFantasy} disabled={adminFantasySaving}>{adminFantasySaving?"Saving...":"💾 Save Fantasy Data"}</button>
              </div>

              <div className="admin-box">
                <div className="admin-title">📋 Submissions ({adminSubs.length})</div>
                <div style={{overflowX:"auto"}}>
                  <table className="table">
                    <thead><tr><th>#</th><th>Username</th><th>Top 5</th><th>Champion</th><th>Finals MVP (1st)</th><th>Event MVP (1st)</th><th>IGL</th><th>Kills Team</th><th>Submitted</th><th></th></tr></thead>
                    <tbody>
                      {[...adminSubs].sort((a,b)=>new Date(b.timestamp||0)-new Date(a.timestamp||0)).map((s,i)=>(
                        <tr key={s.username}>
                          <td className="rank-cell">{i+1}</td>
                          <td><strong>{s.username}</strong></td>
                          <td style={{fontSize:11}}>{(s.top5||[]).join(", ")}</td>
                          <td style={{fontSize:11}}>{s.champion}</td>
                          <td style={{fontSize:11}}>{s.finalsMvp?.[0]}</td>
                          <td style={{fontSize:11}}>{s.eventMvp?.[0]}</td>
                          <td style={{fontSize:11}}>{s.bestIgl}</td>
                          <td style={{fontSize:11}}>{s.mostFinishes}</td>
                          <td style={{fontSize:11,color:"#64748b"}}>{s.timestamp?fmtTime(s.timestamp):"-"}</td>
                          <td><button className="del-btn" onClick={()=>handleDeleteSub(s.username)}>Delete</button></td>
                        </tr>
                      ))}
                      {!adminSubs.length&&<tr><td colSpan={10} style={{textAlign:"center",color:"#94a3b8",padding:22}}>No submissions.</td></tr>}
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

  // ── Main render ───────────────────────────────────────────────
  return (
    <>
      <style>{CSS}</style>
      <div className="app">
        <div className="hero">
          <img src={IMGS["BGIS_2026_Logo_White"]} className="hero-logo" alt="BGIS 2026"/>
          <div className="hero-title">GRAND FINALS <span>PICK'EM</span></div>
          <div className="hero-sub">Battlegrounds Mobile India Series 2026 · Chennai</div>
          <div className="hero-badges">
            {closed
              ? <span className="badge badge-red"><span className="badge-dot"/>Submissions Closed</span>
              : <span className="badge badge-green"><span className="badge-dot pulse"/>Open · {countdown||"Closing soon"}</span>}
            <span className="badge badge-blue">16 Teams · 215 pts max</span>
            <a href="https://esportsamaze.in/BGMI/Tournaments/Battlegrounds_Mobile_India_Series_2026" target="_blank" rel="noopener noreferrer" className="tournament-link">
              🔗 Tournament Page
            </a>
          </div>
        </div>

        <div className="score-strip">
          <span className="score-item"><span className="score-dot" style={{background:"#1a56db"}}/>Top 5: 10 pts each</span>
          <span className="score-item"><span className="score-dot" style={{background:"#f59e0b"}}/>Champion: 30 pts</span>
          <span className="score-item"><span className="score-dot" style={{background:"#7c3aed"}}/>Finals MVP: 50/20 pts</span>
          <span className="score-item"><span className="score-dot" style={{background:"#16a34a"}}/>Event MVP: 40/20 pts</span>
          <span className="score-item"><span className="score-dot" style={{background:"#ef4444"}}/>Best IGL: 25 pts</span>
          <span className="score-item"><span className="score-dot" style={{background:"#64748b"}}/>Most Kills: 20 pts</span>
        </div>

        <div className="nav">
          {[{id:"picks",label:"🎮 Make Picks"},{id:"my",label:"📋 My Submission"},{id:"lb",label:"🏆 Leaderboard"}].map(t=>(
            <button key={t.id} className={`nav-btn${tab===t.id?" active":""}`} onClick={()=>setTab(t.id)}>{t.label}</button>
          ))}
        </div>

        {/* PICKS TAB */}
        {tab==="picks"&&(
          <div className="container" style={{paddingTop:20}}>
            {!meta?<div className="loading"><div className="spinner"/>Loading...</div>:(
              <>
                {!closed&&(
                  <div className="steps">
                    {[{n:1,l:"Your Name"},{n:2,l:"Make Picks"},{n:3,l:"Submit"}].map(s=>(
                      <div key={s.n} className={`step${step===s.n?" active":step>s.n?" done":""}`}>
                        <span className="step-n">{step>s.n?"✓":s.n}</span>{s.l}
                      </div>
                    ))}
                  </div>
                )}

                {!identity?(
                  <>
                    {pinFlow==="username"&&(
                      <div className="auth-card">
                        <div className="auth-title">Enter your username</div>
                        <div className="auth-sub">Choose any username (letters, numbers, underscores). You'll use a 6-digit PIN from other devices.</div>
                        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                          <input className="input" style={{flex:1,minWidth:160}} placeholder="e.g. bgmi_fan_2026"
                            value={usernameInput} onChange={e=>setUsernameInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleConfirm()}/>
                          <button className="btn btn-primary" onClick={handleConfirm} disabled={idLoading||!usernameInput.trim()}>{idLoading?"Checking...":"Continue →"}</button>
                        </div>
                      </div>
                    )}
                    {pinFlow==="pin_new"&&(
                      <div className="auth-card">
                        <div className="auth-title">Set a 6-digit PIN</div>
                        <div className="auth-sub">Protects your picks. Needed to edit from another device. <strong>Don't share it.</strong></div>
                        <input className={`input pin-input${pinError?" err":""}`} type="number" inputMode="numeric" placeholder="000000"
                          value={pinInput} onChange={e=>{setPinInput(e.target.value.slice(0,6));setPinError("");}} onKeyDown={e=>e.key==="Enter"&&handleSetPin()}/>
                        {pinError&&<div className="err-text">{pinError}</div>}
                        <div className="btn-row" style={{marginTop:12}}>
                          <button className="btn btn-primary" onClick={handleSetPin} disabled={pinInput.length!==6}>Set PIN & Continue →</button>
                          <button className="btn btn-outline" onClick={()=>{setPinFlow("username");setPinInput("");setPinError("");}}>← Back</button>
                        </div>
                      </div>
                    )}
                    {pinFlow==="pin_verify"&&(
                      <div className="auth-card">
                        <div className="auth-title">Enter your PIN</div>
                        <div className="auth-sub"><strong>{pendingDocId}</strong> already exists. Enter your 6-digit PIN.</div>
                        <input className={`input pin-input${pinError?" err":""}`} type="number" inputMode="numeric" placeholder="000000"
                          value={pinInput} onChange={e=>{setPinInput(e.target.value.slice(0,6));setPinError("");}} onKeyDown={e=>e.key==="Enter"&&handleVerifyPin()}/>
                        {pinError&&<div className="err-text">{pinError}</div>}
                        <div className="btn-row" style={{marginTop:12}}>
                          <button className="btn btn-primary" onClick={handleVerifyPin} disabled={idLoading||pinInput.length!==6}>{idLoading?"Verifying...":"Verify PIN →"}</button>
                          <button className="btn btn-outline" onClick={()=>{setPinFlow("username");setPinInput("");setPinError("");}}>← Back</button>
                        </div>
                      </div>
                    )}
                  </>
                ):(
                  <div className="user-bar">
                    <div className="user-bar-name">👤 {identity.username}</div>
                    {identity.isReturning&&<span className="status-chip status-open">Editing</span>}
                    <div style={{flex:1}}/>
                    <button className="btn btn-outline" style={{fontSize:11,padding:"5px 10px"}} onClick={resetIdentity}>Change</button>
                  </div>
                )}

                {identity&&closed&&!mySubmission&&(
                  <div className="locked">
                    <div className="locked-icon">⛔</div>
                    <div className="locked-title">Submissions Closed</div>
                    <div className="locked-sub">Picks closed Mar 27 at 1 PM IST. Check the Leaderboard.</div>
                  </div>
                )}

                {identity&&submitted&&(
                  <div className="success-card">
                    <div className="success-icon">🎮</div>
                    <div className="success-title">Picks Locked In!</div>
                    <div style={{color:"#64748b",fontSize:13,marginBottom:16}}>{identity.username} · Grand Finals</div>
                    <button className="btn btn-outline" onClick={()=>setSubmitted(false)}>Edit Picks</button>
                  </div>
                )}

                {identity&&!closed&&!submitted&&(
                  <>
                    {/* TOP 5 */}
                    <div className="card">
                      <div className="card-title">
                        <span>🏅</span> Pick Top 5 Qualifying Teams
                        <span style={{marginLeft:"auto",fontSize:12,color:"#64748b"}}>{top5.length}/5</span>
                      </div>
                      {top5.length>0&&(
                        <>
                          <div className="section-label">Drag to reorder · tap ☆ to set Champion (30 pts)</div>
                          <DraggableTop5 top5={top5} setTop5={setTop5} champion={champion} setChampion={setChampion}/>
                          {champion&&<div className="banner amber" style={{marginBottom:10}}>⭐ {champion} is your Champion — earns 30 pts if correct!</div>}
                        </>
                      )}
                      <div className="section-label">{top5.length<5?`Select ${5-top5.length} more team${5-top5.length>1?"s":""}`:top5.length===5&&!champion?"Now set your Champion ☆":"All 5 picked!"}</div>
                      <div className="teams-grid">
                        {TEAMS.map(t=>{
                          const sel=top5.includes(t.name);
                          const isChamp=champion===t.name;
                          return(
                            <button key={t.id} className={`team-card${sel?" selected":""}${isChamp?" champion-pick":""}`}
                              onClick={()=>toggleTop5(t.name)} disabled={!sel&&top5.length>=5}>
                              {isChamp&&<div className="team-badge gold">★</div>}
                              {sel&&!isChamp&&<div className="team-badge">✓</div>}
                              <img className="team-logo" src={IMGS[t.logo]} alt=""/>
                              <div className="team-name">{t.name}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* FINALS MVP */}
                    <div className="card">
                      <div className="card-title"><span>🎯</span> Finals MVP <span style={{marginLeft:"auto",fontSize:12,color:"#64748b"}}>{finalsMvp.length}/3</span></div>
                      <div className="banner blue" style={{marginBottom:14}}>Pick 3 players. <strong>1st choice = 50 pts</strong> · 2nd/3rd = 20 pts if correct.</div>
                      {finalsMvp.length>0&&(
                        <div style={{marginBottom:12}}>
                          <div className="chips">
                            {finalsMvp.map((p,i)=>(
                              <span key={p} className={`chip${i===0?" correct":""}`} style={{cursor:"pointer"}} onClick={()=>setFinalsMvp(prev=>prev.filter(x=>x!==p))}>
                                {i===0?"⭐ ":i===1?"2nd: ":"3rd: "}{p} ✕
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="section-label">{finalsMvp.length<3?`Pick ${3-finalsMvp.length} more`:"All 3 picked!"}</div>
                      <div className="players-grid">
                        {ALL_PLAYERS.map(p=>{
                          const sel=finalsMvp.includes(p.player);
                          const idx=finalsMvp.indexOf(p.player);
                          return(
                            <button key={`fmvp-${p.player}-${p.teamId}`} className={`player-card${sel?" selected":""}${idx===0?" first-pick":""}`}
                              onClick={()=>toggleMvp(p.player,finalsMvp,setFinalsMvp,3)} disabled={!sel&&finalsMvp.length>=3}>
                              {idx>=0&&<div style={{position:"absolute",top:3,left:3,fontSize:10,fontWeight:700,color:idx===0?"#f59e0b":"#1a56db"}}>{idx===0?"★":`${idx+1}`}</div>}
                              <img className="player-logo" src={IMGS[p.logo]} alt=""/>
                              <div className="player-name">{p.player}</div>
                              <div className="player-team-name">{p.team.split(" ").pop()}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* EVENT MVP */}
                    <div className="card">
                      <div className="card-title"><span>🌟</span> Event MVP <span style={{marginLeft:"auto",fontSize:12,color:"#64748b"}}>{eventMvp.length}/3</span></div>
                      <div className="banner blue" style={{marginBottom:14}}>Pick 3 players. <strong>1st choice = 40 pts</strong> · 2nd/3rd = 20 pts if correct.</div>
                      {eventMvp.length>0&&(
                        <div style={{marginBottom:12}}>
                          <div className="chips">
                            {eventMvp.map((p,i)=>(
                              <span key={p} className={`chip${i===0?" correct":""}`} style={{cursor:"pointer"}} onClick={()=>setEventMvp(prev=>prev.filter(x=>x!==p))}>
                                {i===0?"⭐ ":i===1?"2nd: ":"3rd: "}{p} ✕
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="section-label">{eventMvp.length<3?`Pick ${3-eventMvp.length} more`:"All 3 picked!"}</div>
                      <div className="players-grid">
                        {ALL_PLAYERS.map(p=>{
                          const sel=eventMvp.includes(p.player);
                          const idx=eventMvp.indexOf(p.player);
                          return(
                            <button key={`emvp-${p.player}-${p.teamId}`} className={`player-card${sel?" selected":""}${idx===0?" first-pick":""}`}
                              onClick={()=>toggleMvp(p.player,eventMvp,setEventMvp,3)} disabled={!sel&&eventMvp.length>=3}>
                              {idx>=0&&<div style={{position:"absolute",top:3,left:3,fontSize:10,fontWeight:700,color:idx===0?"#f59e0b":"#1a56db"}}>{idx===0?"★":`${idx+1}`}</div>}
                              <img className="player-logo" src={IMGS[p.logo]} alt=""/>
                              <div className="player-name">{p.player}</div>
                              <div className="player-team-name">{p.team.split(" ").pop()}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* BEST IGL */}
                    <div className="card">
                      <div className="card-title"><span>🎖️</span> Best IGL — 25 pts</div>
                      <div className="section-label">Pick the best In-Game Leader of the tournament</div>
                      <div className="teams-grid" style={{gridTemplateColumns:"repeat(auto-fill,minmax(88px,1fr))"}}>
                        {ALL_IGLS.map(p=>(
                          <button key={p.player} className={`player-card${bestIgl===p.player?" selected":""}`}
                            onClick={()=>setBestIgl(bestIgl===p.player?null:p.player)}>
                            <img className="player-logo" src={IMGS[p.logo]} alt=""/>
                            <div className="player-name">{p.player}</div>
                            <div className="player-team-name">{p.team.split(" ").pop()}</div>
                          </button>
                        ))}
                      </div>
                      {bestIgl&&<div className="banner green" style={{marginTop:10,marginBottom:0}}>✅ {bestIgl} selected as Best IGL</div>}
                    </div>

                    {/* MOST KILLS */}
                    <div className="card">
                      <div className="card-title"><span>💀</span> Most Kills Team — 20 pts</div>
                      <div className="section-label">Which team will have the most total kills?</div>
                      <div className="teams-grid">
                        {TEAMS.map(t=>(
                          <button key={t.id} className={`team-card${mostFinishes===t.name?" selected":""}`}
                            onClick={()=>setMostFinishes(mostFinishes===t.name?null:t.name)}>
                            <img className="team-logo" src={IMGS[t.logo]} alt=""/>
                            <div className="team-name">{t.name}</div>
                          </button>
                        ))}
                      </div>
                      {mostFinishes&&<div className="banner green" style={{marginTop:10,marginBottom:0}}>✅ {mostFinishes} selected</div>}
                    </div>

                    {/* SUBMIT */}
                    <div style={{maxWidth:480,margin:"0 auto 32px"}}>
                      {!canSubmit&&(
                        <div className="banner amber" style={{marginBottom:12}}>
                          Complete all picks to submit:
                          {top5.length<5&&` · Top 5 (${top5.length}/5)`}
                          {!champion&&" · Champion"}
                          {finalsMvp.length<3&&` · Finals MVP (${finalsMvp.length}/3)`}
                          {eventMvp.length<3&&` · Event MVP (${eventMvp.length}/3)`}
                          {!bestIgl&&" · Best IGL"}
                          {!mostFinishes&&" · Most Kills"}
                        </div>
                      )}
                      <button className="btn btn-primary btn-full" onClick={handleSubmit} disabled={!canSubmit||submitting}>
                        {submitting?"Submitting...":mySubmission?"Update Picks 🔄":"Submit Picks 🎮"}
                      </button>
                      <div style={{textAlign:"center",fontSize:12,color:"#94a3b8",marginTop:8}}>Submitting again overwrites your previous picks.</div>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* MY SUBMISSION TAB */}
        {tab==="my"&&(
          <div className="container" style={{paddingTop:20}}>
            {!identity?(
              <div className="locked">
                <div className="locked-icon">👤</div>
                <div className="locked-title">Sign in first</div>
                <div className="locked-sub">Go to Make Picks, enter your username and PIN.</div>
                <button className="btn btn-primary" style={{marginTop:14}} onClick={()=>setTab("picks")}>Make Picks →</button>
              </div>
            ):!mySubmission?(
              <div className="locked">
                <div className="locked-icon">📋</div>
                <div className="locked-title">No submission yet</div>
                <div className="locked-sub">{closed?"Submissions are now closed.":"Head to Make Picks to submit."}</div>
                {!closed&&<button className="btn btn-primary" style={{marginTop:14}} onClick={()=>setTab("picks")}>Make Picks →</button>}
              </div>
            ):(
              <>
                {publishedResults&&(
                  <div style={{background:"linear-gradient(135deg,#1a56db,#1648c0)",borderRadius:14,padding:"20px",marginBottom:16,color:"#fff",textAlign:"center"}}>
                    <div style={{fontSize:13,opacity:0.8,marginBottom:4}}>Your Prediction Score</div>
                    <div style={{fontFamily:"'Rajdhani',sans-serif",fontSize:52,fontWeight:700,lineHeight:1}}>
                      {calcPredictionScore(mySubmission,publishedResults)} <span style={{fontSize:22,opacity:0.7}}>pts</span>
                    </div>
                    {fantasyData&&<div style={{fontSize:13,marginTop:8,opacity:0.9}}>Fantasy Score: <strong>{calcFantasyScore(mySubmission,fantasyData)} pts</strong></div>}
                  </div>
                )}
                <div className="card">
                  <div className="card-title">📋 Your Submission</div>
                  <div style={{fontSize:11,color:"#94a3b8",marginBottom:14}}>Submitted {fmtTime(mySubmission.timestamp)}</div>
                  <div style={{marginBottom:14}}>
                    <div className="section-label">Top 5 Teams (in your order)</div>
                    <div className="chips">
                      {(mySubmission.top5||[]).map((team,i)=>{
                        const correct=publishedResults?.top5?.includes(team);
                        const isChamp=mySubmission.champion===team;
                        return <span key={team} className={`chip${isChamp?" champion":correct?" correct":""}`}>{isChamp?"★ ":""}{i+1}. {team}</span>;
                      })}
                    </div>
                  </div>
                  <div style={{marginBottom:14}}>
                    <div className="section-label">Finals MVP Picks</div>
                    <div className="chips">
                      {(mySubmission.finalsMvp||[]).map((p,i)=>{
                        const correct=publishedResults?.finalsMvp===p;
                        return <span key={p} className={`chip${correct?" correct":""}`}>{i===0?"⭐ ":`${i+1}. `}{p}</span>;
                      })}
                    </div>
                  </div>
                  <div style={{marginBottom:14}}>
                    <div className="section-label">Event MVP Picks</div>
                    <div className="chips">
                      {(mySubmission.eventMvp||[]).map((p,i)=>{
                        const correct=publishedResults?.eventMvp===p;
                        return <span key={p} className={`chip${correct?" correct":""}`}>{i===0?"⭐ ":`${i+1}. `}{p}</span>;
                      })}
                    </div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                    <div>
                      <div className="section-label">Best IGL</div>
                      <span className={`chip${publishedResults&&mySubmission.bestIgl===publishedResults.bestIgl?" correct":""}`}>{mySubmission.bestIgl}</span>
                    </div>
                    <div>
                      <div className="section-label">Most Kills Team</div>
                      <span className={`chip${publishedResults&&mySubmission.mostFinishes===publishedResults.mostFinishes?" correct":""}`}>{mySubmission.mostFinishes}</span>
                    </div>
                  </div>
                  {!closed&&<div style={{marginTop:16}}><button className="btn btn-outline" onClick={()=>{setSubmitted(false);setTab("picks");}}>✏️ Edit Picks</button></div>}
                </div>
                {publishedResults&&(
                  <div className="card">
                    <div className="card-title">🏆 Official Results</div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                      <div><div className="section-label">Top 5</div><div className="chips">{(publishedResults.top5||[]).map(t=><span key={t} className={`chip${t===publishedResults.champion?" champion":"correct"}`}>{t===publishedResults.champion?"★ ":""}{t}</span>)}</div></div>
                      <div><div className="section-label">Champion</div><span className="chip champion">🏆 {publishedResults.champion}</span></div>
                      <div><div className="section-label">Finals MVP</div><span className="chip correct">{publishedResults.finalsMvp}</span></div>
                      <div><div className="section-label">Event MVP</div><span className="chip correct">{publishedResults.eventMvp}</span></div>
                      <div><div className="section-label">Best IGL</div><span className="chip correct">{publishedResults.bestIgl}</span></div>
                      <div><div className="section-label">Most Kills</div><span className="chip correct">{publishedResults.mostFinishes}</span></div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* LEADERBOARD TAB */}
        {tab==="lb"&&(
          <div className="container" style={{paddingTop:20}}>
            {!closed&&!meta?.published?(
              <div className="locked">
                <div className="locked-icon">🔒</div>
                <div className="locked-title">Leaderboard Hidden</div>
                <div className="locked-sub">All submissions visible after Mar 27 at 1 PM IST.</div>
              </div>
            ):(
              <>
                {fantasyData&&Object.keys(fantasyData.teamPoints||{}).length>0&&(
                  <div className="lb-tabs">
                    <button className={`lb-tab${lbTab==="prediction"?" active":""}`} onClick={()=>setLbTab("prediction")}>Prediction</button>
                    <button className={`lb-tab${lbTab==="fantasy"?" active":""}`} onClick={()=>setLbTab("fantasy")}>⚡ Fantasy</button>
                  </div>
                )}
                {!meta?.published&&<div className="banner amber">⏳ Picks visible — scores appear once results are published.</div>}
                {!scoredLb?(
                  <div className="loading"><div className="spinner"/>Loading...</div>
                ):(
                  <div style={{overflowX:"auto"}}>
                    <table className="table">
                      <thead>
                        <tr>
                          <th>#</th><th>User</th>
                          {meta?.published&&<th style={{textAlign:"right"}}>Score</th>}
                          <th>Top 5</th><th>MVP Picks</th><th>IGL</th>
                        </tr>
                      </thead>
                      <tbody>
                        {scoredLb.map((s,i)=>(
                          <tr key={s.username} style={s.username===identity?.username?{background:"rgba(26,86,219,0.04)"}:{}}>
                            <td className="rank-cell">{i===0?"🥇":i===1?"🥈":i===2?"🥉":i+1}</td>
                            <td>
                              <div className="user-cell">
                                <strong>{s.username}</strong>
                                {s.username===identity?.username&&<span className="status-chip status-open" style={{fontSize:9}}>You</span>}
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
                              <div className="chips">
                                {(s.top5||[]).map(t=>{
                                  const correct=publishedResults?.top5?.includes(t);
                                  const isChamp=s.champion===t;
                                  return <span key={t} className={`chip${isChamp?" champion":correct?" correct":""}`}>{isChamp?"★":""}{t}</span>;
                                })}
                              </div>
                            </td>
                            <td>
                              <div className="chips">
                                {[s.finalsMvp?.[0],s.eventMvp?.[0]].filter(Boolean).map((p,pi)=>(
                                  <span key={`${p}-${pi}`} className="chip">⭐{p}</span>
                                ))}
                              </div>
                            </td>
                            <td style={{fontSize:12}}>{s.bestIgl}</td>
                          </tr>
                        ))}
                        {!scoredLb.length&&<tr><td colSpan={6} style={{textAlign:"center",color:"#94a3b8",padding:28}}>No submissions yet.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                )}
                {meta?.published&&(
                  <div style={{display:"flex",gap:14,flexWrap:"wrap",marginTop:12,fontSize:11,fontWeight:600,color:"#64748b"}}>
                    <span><span style={{display:"inline-block",width:8,height:8,borderRadius:"50%",background:"#16a34a",marginRight:4}}/>Correct pick</span>
                    <span><span style={{display:"inline-block",width:8,height:8,borderRadius:"50%",background:"#f59e0b",marginRight:4}}/>Champion pick</span>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {toast&&<div className={`toast${toast.type==="error"?" err":""}`}>{toast.msg}</div>}
      </div>
    </>
  );
}
