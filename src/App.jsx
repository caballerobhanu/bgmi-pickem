import { useState, useEffect, useCallback } from "react";
import { initializeApp } from "firebase/app";
import {
  getFirestore, collection, doc,
  setDoc, getDoc, getDocs
} from "firebase/firestore";

// ── Firebase ──────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};
const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

// ── Firestore paths ───────────────────────────────────────────────
const META_DOC      = "pickem_bgis2026_meta";
const USERS_COL     = "pickem_bgis2026_users";       // PINs — permanent
const SEMIS_COL     = "pickem_bgis2026_submissions"; // existing 16 submissions — untouched
const SURVIVAL_COL  = "pickem_bgis2026_survival";
const FINALS_COL    = "pickem_bgis2026_finals";

const STAGE_COLS = {
  semis:    SEMIS_COL,
  survival: SURVIVAL_COL,
  finals:   FINALS_COL,
};

// ── Stage deadlines (IST = UTC+5:30) ─────────────────────────────
const DEADLINES = {
  semis:    new Date("2026-03-12T09:30:00Z"), // 3:00 PM IST
  survival: new Date("2026-03-16T09:00:00Z"), // 2:30 PM IST
  finals:   new Date("2099-01-01T00:00:00Z"), // set by admin later
};

// ── Constants ─────────────────────────────────────────────────────
const WIKI_BASE  = "https://esportsamaze.in";
const FILE_BASE  = `${WIKI_BASE}/index.php?title=Special:Redirect/file/`;
const ADMIN_PASS   = import.meta.env.VITE_ADMIN_PASS;
const ADMIN_SECRET = import.meta.env.VITE_ADMIN_SECRET;
const ADMIN_MODE   = new URLSearchParams(window.location.search).get("hAgqBKNXzaNEkUgCjv3b") !== null;
const LS_TOKEN   = "bgis2026_token";
const LS_DOCID   = "bgis2026_docid";

// ── Stage display config ──────────────────────────────────────────
const STAGE_LABELS = {
  semis:    "Semifinals",
  survival: "Survival Stage",
  finals:   "Grand Finals",
};
const STAGE_ORDER   = ["semis", "survival", "finals"];
const LB_CACHE_COL  = "leaderboard_cache";
const LS_LB_PREFIX  = "bgis2026_lb_";

// ── Palette ───────────────────────────────────────────────────────
const G = {
  bg:        "#f4f6f9",
  surface:   "#ffffff",
  border:    "#e2e8f0",
  accent:    "#e85d04",
  accentDim: "rgba(232,93,4,.08)",
  accentTxt: "#c44f00",
  blue:      "#2563eb",
  blueDim:   "rgba(37,99,235,.08)",
  green:     "#16a34a",
  greenDim:  "rgba(22,163,74,.08)",
  red:       "#dc2626",
  redDim:    "rgba(220,38,38,.08)",
  amber:     "#f59e0b",
  text:      "#0f172a",
  sub:       "#475569",
  muted:     "#94a3b8",
  hero:      "#0f172a",
};

// ── CSS ───────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800;900&family=Barlow:wght@400;500;600;700&display=swap');
  *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
  body { background:${G.bg}; font-family:'Barlow',sans-serif; color:${G.text}; -webkit-font-smoothing:antialiased; }
  .pk { min-height:100vh; padding-bottom:60px; }

  /* Hero */
  .pk-hero { background:${G.hero}; padding:40px 24px 32px; text-align:center; position:relative; overflow:hidden; }
  .pk-hero::after { content:''; position:absolute; inset:0; background:radial-gradient(ellipse at 50% 100%,rgba(232,93,4,.18),transparent 60%); pointer-events:none; }
  .pk-eyebrow { font-family:'Barlow Condensed',sans-serif; font-size:11px; font-weight:700; letter-spacing:.22em; text-transform:uppercase; color:${G.accent}; margin-bottom:10px; position:relative; z-index:1; }
  .pk-title { font-family:'Barlow Condensed',sans-serif; font-size:clamp(36px,7vw,64px); font-weight:900; line-height:.9; color:#fff; text-transform:uppercase; margin-bottom:10px; position:relative; z-index:1; }
  .pk-title span { color:${G.accent}; }
  .pk-stage-badge { display:inline-flex; align-items:center; gap:8px; background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.15); border-radius:6px; padding:6px 14px; font-size:13px; font-weight:700; color:rgba(255,255,255,.8); position:relative; z-index:1; margin-bottom:12px; }
  .pk-stage-badge .dot { width:7px; height:7px; border-radius:50%; background:${G.green}; animation:pulse 1.5s infinite; }
  .pk-stage-badge .dot.closed { background:${G.muted}; animation:none; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
  .pk-deadline { display:inline-flex; align-items:center; gap:8px; background:rgba(232,93,4,.15); border:1px solid rgba(232,93,4,.35); border-radius:6px; padding:6px 14px; font-size:12px; font-weight:700; color:${G.accent}; position:relative; z-index:1; }
  .pk-deadline.closed { background:rgba(220,38,38,.12); border-color:rgba(220,38,38,.3); color:${G.red}; }

  /* Score bar */
  .pk-score-bar { background:${G.surface}; border-bottom:1px solid ${G.border}; padding:9px 24px; display:flex; align-items:center; justify-content:center; gap:20px; flex-wrap:wrap; font-size:12px; font-weight:600; color:${G.sub}; }
  .pk-score-dot { width:8px; height:8px; border-radius:50%; display:inline-block; margin-right:4px; }

  /* Nav */
  .pk-nav { display:flex; background:${G.surface}; border-bottom:2px solid ${G.border}; overflow-x:auto; position:sticky; top:0; z-index:10; box-shadow:0 1px 3px rgba(0,0,0,.06); }
  .pk-nav-btn { padding:13px 24px; font-family:'Barlow Condensed',sans-serif; font-size:14px; font-weight:700; letter-spacing:.07em; text-transform:uppercase; color:${G.muted}; background:none; border:none; border-bottom:3px solid transparent; margin-bottom:-2px; cursor:pointer; white-space:nowrap; transition:color .15s,border-color .15s; }
  .pk-nav-btn:hover { color:${G.text}; }
  .pk-nav-btn.active { color:${G.accent}; border-bottom-color:${G.accent}; }

  /* Wrap */
  .pk-wrap { max-width:980px; margin:0 auto; padding:24px 16px 0; }

  /* Steps */
  .pk-steps { display:flex; margin-bottom:22px; border-radius:10px; overflow:hidden; border:1px solid ${G.border}; }
  .pk-step { flex:1; padding:11px 8px; text-align:center; font-family:'Barlow Condensed',sans-serif; font-size:11px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:${G.muted}; background:${G.surface}; border-right:1px solid ${G.border}; transition:all .2s; }
  .pk-step:last-child { border-right:none; }
  .pk-step.active { color:${G.accent}; background:${G.accentDim}; }
  .pk-step.done { color:${G.green}; background:${G.greenDim}; }
  .pk-step-n { display:inline-flex; width:18px; height:18px; border-radius:50%; background:${G.border}; align-items:center; justify-content:center; font-size:10px; margin-right:4px; vertical-align:middle; }
  .pk-step.active .pk-step-n { background:${G.accent}; color:#fff; }
  .pk-step.done .pk-step-n { background:${G.green}; color:#fff; }

  /* Username box */
  .pk-ubox { background:${G.surface}; border:1.5px solid ${G.border}; border-radius:12px; padding:26px 22px; margin-bottom:22px; }
  .pk-ubox-title { font-family:'Barlow Condensed',sans-serif; font-size:17px; font-weight:800; text-transform:uppercase; color:${G.text}; margin-bottom:5px; }
  .pk-ubox-sub { font-size:13px; color:${G.sub}; margin-bottom:16px; line-height:1.6; }
  .pk-platform-toggle { display:flex; border:1.5px solid ${G.border}; border-radius:8px; overflow:hidden; width:fit-content; margin-bottom:13px; }
  .pk-plat-btn { padding:7px 18px; font-size:12px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; background:none; border:none; cursor:pointer; font-family:inherit; color:${G.muted}; transition:all .15s; }
  .pk-plat-btn.active { background:${G.text}; color:#fff; }
  .pk-urow { display:flex; gap:8px; flex-wrap:wrap; }

  /* PIN box */
  .pk-pin-box { background:${G.surface}; border:1.5px solid ${G.border}; border-radius:12px; padding:26px 22px; margin-bottom:22px; }
  .pk-pin-title { font-family:'Barlow Condensed',sans-serif; font-size:17px; font-weight:800; text-transform:uppercase; color:${G.text}; margin-bottom:5px; }
  .pk-pin-sub { font-size:13px; color:${G.sub}; margin-bottom:18px; line-height:1.6; }
  .pk-pin-input { background:${G.bg}; border:2px solid ${G.border}; border-radius:10px; padding:14px; font-size:30px; font-family:'Barlow Condensed',sans-serif; font-weight:900; letter-spacing:.3em; color:${G.text}; outline:none; width:100%; text-align:center; transition:border-color .15s; }
  .pk-pin-input:focus { border-color:${G.accent}; }
  .pk-pin-input.err { border-color:${G.red}; }
  .pk-pin-error { font-size:12px; color:${G.red}; font-weight:600; margin-top:7px; }
  .pk-pin-back { background:none; border:none; font-size:12px; color:${G.muted}; cursor:pointer; font-family:inherit; text-decoration:underline; margin-top:10px; display:inline-block; }
  .pk-pin-back:hover { color:${G.text}; }

  /* User bar */
  .pk-ubar { display:flex; align-items:center; gap:10px; background:${G.greenDim}; border:1px solid rgba(22,163,74,.25); border-radius:10px; padding:11px 15px; margin-bottom:22px; flex-wrap:wrap; }
  .pk-ubar-name { font-size:17px; font-weight:900; font-family:'Barlow Condensed',sans-serif; flex:1; }
  .pk-plat-chip { font-size:10px; font-weight:700; padding:2px 7px; border-radius:4px; text-transform:uppercase; letter-spacing:.04em; }
  .pk-plat-chip.instagram { background:rgba(225,48,108,.1); color:#e1306c; }
  .pk-plat-chip.x { background:rgba(0,0,0,.07); color:#000; }
  .pk-edit-chip { font-size:10px; font-weight:700; padding:2px 7px; border-radius:4px; background:${G.accentDim}; border:1px solid rgba(232,93,4,.2); color:${G.accentTxt}; }
  .pk-change-btn { background:none; border:1px solid ${G.border}; border-radius:6px; padding:4px 10px; font-size:11px; font-weight:600; color:${G.muted}; cursor:pointer; font-family:inherit; transition:all .15s; }
  .pk-change-btn:hover { border-color:${G.accent}; color:${G.accentTxt}; }

  /* Slots */
  .pk-lbl { font-family:'Barlow Condensed',sans-serif; font-size:11px; font-weight:700; letter-spacing:.16em; text-transform:uppercase; color:${G.muted}; margin-bottom:10px; }
  .pk-slots { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin-bottom:24px; }
  @media(max-width:580px){ .pk-slots { grid-template-columns:repeat(2,1fr); } }
  .pk-slot { background:${G.surface}; border:1.5px solid ${G.border}; border-radius:10px; padding:10px 11px; display:flex; align-items:center; gap:8px; min-height:54px; position:relative; transition:all .15s; }
  .pk-slot.filled { border-color:${G.accent}; box-shadow:0 0 0 3px ${G.accentDim}; }
  .pk-slot-n { font-family:'Barlow Condensed',sans-serif; font-size:19px; font-weight:900; color:${G.muted}; min-width:20px; text-align:center; }
  .pk-slot.filled .pk-slot-n { color:${G.accent}; }
  .pk-slot-logo { width:28px; height:28px; object-fit:contain; flex-shrink:0; }
  .pk-slot-name { font-size:11px; font-weight:700; line-height:1.2; flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .pk-slot.empty .pk-slot-name { color:${G.muted}; font-weight:400; }
  .pk-slot-rm { position:absolute; top:4px; right:4px; width:16px; height:16px; border-radius:50%; background:${G.redDim}; border:1px solid rgba(220,38,38,.2); color:${G.red}; font-size:8px; font-weight:900; cursor:pointer; display:flex; align-items:center; justify-content:center; opacity:0; transition:opacity .15s; }
  .pk-slot:hover .pk-slot-rm { opacity:1; }

  /* Pool */
  .pk-pool { display:grid; grid-template-columns:repeat(auto-fill,minmax(120px,1fr)); gap:8px; margin-bottom:24px; }
  .pk-team { background:${G.surface}; border:1.5px solid ${G.border}; border-radius:10px; padding:12px 8px 10px; display:flex; flex-direction:column; align-items:center; gap:6px; cursor:pointer; transition:all .15s; font-family:inherit; position:relative; }
  .pk-team:hover:not(:disabled) { border-color:${G.accent}; background:${G.accentDim}; transform:translateY(-2px); box-shadow:0 4px 12px rgba(232,93,4,.12); }
  .pk-team.sel { border-color:${G.blue}; background:${G.blueDim}; opacity:.6; cursor:default; transform:none; }
  .pk-team:disabled:not(.sel) { opacity:.4; cursor:not-allowed; }
  .pk-team-logo { width:38px; height:38px; object-fit:contain; }
  .pk-team-name { font-size:11px; font-weight:700; color:${G.text}; text-align:center; line-height:1.2; }
  .pk-team-order { position:absolute; top:5px; left:5px; font-family:'Barlow Condensed',sans-serif; font-size:13px; font-weight:900; color:${G.accent}; background:${G.accentDim}; border-radius:4px; padding:1px 5px; line-height:1.3; }

  /* Inputs */
  .pk-input { background:${G.surface}; border:1.5px solid ${G.border}; border-radius:8px; padding:11px 13px; font-size:14px; font-family:inherit; color:${G.text}; outline:none; transition:border-color .15s,box-shadow .15s; width:100%; }
  .pk-input:focus { border-color:${G.accent}; box-shadow:0 0 0 3px ${G.accentDim}; }
  .pk-input::placeholder { color:${G.muted}; }
  .pk-submit { background:${G.accent}; color:#fff; font-family:'Barlow Condensed',sans-serif; font-size:16px; font-weight:900; letter-spacing:.08em; text-transform:uppercase; border:none; border-radius:10px; padding:14px 28px; cursor:pointer; transition:all .15s; width:100%; box-shadow:0 4px 14px rgba(232,93,4,.3); }
  .pk-submit:hover:not(:disabled) { background:#d45200; transform:translateY(-1px); }
  .pk-submit:disabled { opacity:.45; cursor:not-allowed; transform:none; box-shadow:none; }
  .pk-hint { font-size:12px; color:${G.muted}; text-align:center; }

  /* Buttons */
  .pk-btn { font-family:'Barlow Condensed',sans-serif; font-size:13px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; border-radius:8px; padding:9px 16px; cursor:pointer; transition:all .15s; border:1.5px solid; }
  .pk-btn-green { background:${G.greenDim}; border-color:rgba(22,163,74,.3); color:${G.green}; }
  .pk-btn-green:hover { background:rgba(22,163,74,.15); }
  .pk-btn-red { background:${G.redDim}; border-color:rgba(220,38,38,.3); color:${G.red}; }
  .pk-btn-red:hover { background:rgba(220,38,38,.15); }
  .pk-btn-acc { background:${G.accentDim}; border-color:rgba(232,93,4,.3); color:${G.accentTxt}; }
  .pk-btn-acc:hover { background:rgba(232,93,4,.15); }
  .pk-btn-blue { background:${G.blueDim}; border-color:rgba(37,99,235,.3); color:${G.blue}; }
  .pk-btn-blue:hover { background:rgba(37,99,235,.15); }
  .pk-btn-row { display:flex; gap:8px; flex-wrap:wrap; }

  /* Toast */
  .pk-toast { position:fixed; bottom:24px; left:50%; transform:translateX(-50%); background:${G.green}; color:#fff; font-weight:700; font-size:14px; padding:12px 24px; border-radius:8px; z-index:999; white-space:nowrap; box-shadow:0 4px 16px rgba(0,0,0,.15); animation:toast-in .25s ease; }
  .pk-toast.err { background:${G.red}; }
  @keyframes toast-in { from{opacity:0;transform:translateX(-50%) translateY(8px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }

  /* Loading */
  .pk-loading { text-align:center; padding:56px 20px; color:${G.muted}; }
  .pk-spinner { width:32px; height:32px; border:3px solid ${G.border}; border-top-color:${G.accent}; border-radius:50%; animation:spin .7s linear infinite; margin:0 auto 14px; }
  @keyframes spin { to{transform:rotate(360deg)} }

  /* Success */
  .pk-success { text-align:center; padding:44px 20px; background:${G.surface}; border-radius:16px; border:1.5px solid ${G.border}; }
  .pk-success-icon { font-size:52px; margin-bottom:14px; }
  .pk-success-title { font-family:'Barlow Condensed',sans-serif; font-size:26px; font-weight:900; text-transform:uppercase; color:${G.green}; margin-bottom:8px; }

  /* Submission card (My Submissions tab) */
  .pk-sub-card { background:${G.surface}; border:1.5px solid ${G.border}; border-radius:12px; padding:18px 20px; margin-bottom:14px; }
  .pk-sub-card-header { display:flex; align-items:center; gap:10px; margin-bottom:12px; flex-wrap:wrap; }
  .pk-sub-stage-label { font-family:'Barlow Condensed',sans-serif; font-size:14px; font-weight:900; text-transform:uppercase; color:${G.text}; flex:1; }
  .pk-sub-score { font-family:'Barlow Condensed',sans-serif; font-size:18px; font-weight:900; color:${G.accentTxt}; }
  .pk-sub-status { font-size:10px; font-weight:700; padding:2px 8px; border-radius:4px; text-transform:uppercase; letter-spacing:.04em; }
  .pk-sub-status.published { background:${G.greenDim}; color:${G.green}; }
  .pk-sub-status.pending { background:rgba(245,158,11,.1); color:#92400e; }
  .pk-sub-status.open { background:${G.accentDim}; color:${G.accentTxt}; }

  /* Chips */
  .pk-chips { display:flex; flex-wrap:wrap; gap:4px; }
  .pk-chip { font-size:10px; font-weight:600; padding:2px 7px; border-radius:4px; background:${G.bg}; border:1px solid ${G.border}; color:${G.sub}; }
  .pk-chip.pos  { background:${G.greenDim}; border-color:rgba(22,163,74,.3); color:${G.green}; }
  .pk-chip.team { background:${G.blueDim}; border-color:rgba(37,99,235,.3); color:${G.blue}; }

  /* Leaderboard */
  .pk-lb-tabs { display:flex; gap:0; border:1.5px solid ${G.border}; border-radius:10px; overflow:hidden; margin-bottom:18px; width:fit-content; }
  .pk-lb-tab { padding:9px 20px; font-family:'Barlow Condensed',sans-serif; font-size:13px; font-weight:700; letter-spacing:.05em; text-transform:uppercase; background:none; border:none; cursor:pointer; font-family:inherit; color:${G.muted}; transition:all .15s; border-right:1px solid ${G.border}; }
  .pk-lb-tab:last-child { border-right:none; }
  .pk-lb-tab.active { background:${G.text}; color:#fff; }

  /* Table */
  .pk-table { width:100%; border-collapse:separate; border-spacing:0; background:${G.surface}; border:1.5px solid ${G.border}; border-radius:12px; overflow:hidden; font-size:13px; }
  .pk-table th { background:${G.bg}; color:${G.muted}; font-size:10px; font-weight:700; letter-spacing:.1em; text-transform:uppercase; padding:10px 14px; border-bottom:1.5px solid ${G.border}; text-align:left; }
  .pk-table td { padding:10px 14px; border-bottom:1px solid ${G.border}; vertical-align:middle; }
  .pk-table tr:last-child td { border-bottom:none; }
  .pk-table tr:hover td { background:${G.accentDim}; }
  .pk-rank { font-family:'Barlow Condensed',sans-serif; font-size:20px; font-weight:900; color:${G.muted}; text-align:center; width:44px; }
  .pk-score-pill { font-family:'Barlow Condensed',sans-serif; font-size:15px; font-weight:900; color:${G.accentTxt}; }
  .pk-ucell { display:flex; align-items:center; gap:7px; }

  /* Locked */
  .pk-locked { background:${G.surface}; border:1.5px solid ${G.border}; border-radius:12px; padding:40px 24px; text-align:center; margin-bottom:16px; }
  .pk-locked-icon { font-size:38px; margin-bottom:10px; }
  .pk-locked-title { font-family:'Barlow Condensed',sans-serif; font-size:20px; font-weight:900; text-transform:uppercase; color:${G.text}; margin-bottom:7px; }
  .pk-locked-sub { font-size:13px; color:${G.sub}; line-height:1.6; }

  /* Banner */
  .pk-banner { border-radius:10px; padding:11px 15px; margin-bottom:16px; font-size:13px; font-weight:600; line-height:1.5; }
  .pk-banner.amber { background:rgba(245,158,11,.08); border:1px solid rgba(245,158,11,.25); color:#92400e; }
  .pk-banner.green { background:${G.greenDim}; border:1px solid rgba(22,163,74,.25); color:#14532d; }

  /* Admin */
  .pk-abox { background:${G.surface}; border:1.5px solid ${G.border}; border-radius:12px; padding:22px; margin-bottom:18px; }
  .pk-atitle { font-family:'Barlow Condensed',sans-serif; font-size:16px; font-weight:800; text-transform:uppercase; color:${G.text}; margin-bottom:14px; padding-bottom:11px; border-bottom:1px solid ${G.border}; }
  .pk-alabel { font-size:11px; font-weight:700; color:${G.muted}; margin-bottom:4px; text-transform:uppercase; letter-spacing:.05em; }
  .pk-aselect { background:${G.bg}; border:1.5px solid ${G.border}; border-radius:8px; padding:8px 10px; color:${G.text}; font-size:13px; font-family:inherit; outline:none; width:100%; }
  .pk-aselect:focus { border-color:${G.accent}; }
  .pk-agrid { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-bottom:16px; }
  @media(max-width:580px){ .pk-agrid { grid-template-columns:repeat(2,1fr); } }
  .pk-del { background:none; border:1px solid ${G.border}; border-radius:6px; padding:4px 8px; font-size:11px; font-weight:700; color:${G.muted}; cursor:pointer; transition:all .15s; font-family:inherit; }
  .pk-del:hover { border-color:${G.red}; color:${G.red}; background:${G.redDim}; }
  .pk-ts-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(110px,1fr)); gap:8px; margin-bottom:14px; }
  .pk-ts-btn { background:${G.bg}; border:1.5px solid ${G.border}; border-radius:8px; padding:9px 7px; display:flex; flex-direction:column; align-items:center; gap:5px; cursor:pointer; font-family:inherit; transition:all .15s; }
  .pk-ts-btn:hover { border-color:${G.accent}; background:${G.accentDim}; }
  .pk-ts-btn.sel { border-color:${G.green}; background:${G.greenDim}; }
  .pk-ts-logo { width:30px; height:30px; object-fit:contain; }
  .pk-ts-name { font-size:10px; font-weight:700; text-align:center; line-height:1.2; color:${G.text}; }
  .pk-count-row { display:flex; align-items:center; gap:10px; margin-bottom:14px; flex-wrap:wrap; }
  .pk-count-lbl { font-size:13px; font-weight:600; color:${G.sub}; }
  .pk-count-in { width:65px; background:${G.bg}; border:1.5px solid ${G.border}; border-radius:8px; padding:7px 9px; font-size:14px; font-family:inherit; color:${G.text}; outline:none; text-align:center; }
  .pk-count-in:focus { border-color:${G.accent}; }

  /* Stage trigger button */
  .pk-stage-trigger { display:flex; align-items:center; justify-content:space-between; background:${G.bg}; border:1.5px solid ${G.border}; border-radius:10px; padding:14px 16px; margin-bottom:10px; flex-wrap:wrap; gap:10px; }
  .pk-stage-trigger-info { font-size:13px; color:${G.sub}; }
  .pk-stage-trigger-info strong { display:block; font-size:15px; color:${G.text}; margin-bottom:2px; }

  /* Share button */
  .pk-share-btn { display:inline-flex; align-items:center; gap:6px; background:#0f172a; border:1.5px solid rgba(255,255,255,.12); border-radius:7px; padding:7px 13px; font-family:'Barlow Condensed',sans-serif; font-size:12px; font-weight:700; letter-spacing:.05em; text-transform:uppercase; color:#fff; cursor:pointer; transition:all .15s; margin-top:10px; }
  .pk-share-btn:hover { background:#1e293b; border-color:rgba(232,93,4,.5); }
  .pk-share-btn:disabled { opacity:.5; cursor:not-allowed; }

  /* Legend */
  .pk-legend { display:flex; gap:14px; flex-wrap:wrap; margin-top:12px; }
  .pk-legend-item { display:flex; align-items:center; gap:5px; font-size:11px; font-weight:600; color:${G.sub}; }
  .pk-legend-dot { width:9px; height:9px; border-radius:50%; display:inline-block; }
`;

// ── Helpers ───────────────────────────────────────────────────────
async function hashPin(pin) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pin));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,"0")).join("");
}
function scoreSubmission(picks, results) {
  if (!results || !results.filter(Boolean).length) return null;
  let pts = 0;
  picks.forEach((t,i) => {
    if (results.includes(t)) { pts += 10; if (results[i]===t) pts += 5; }
  });
  return pts;
}
// Tiebreaker sort — cascade through positions, then earlier submission
function tiebreakerSort(a, b, results) {
  // Level 1 — total points
  if (b.score !== a.score) return b.score - a.score;
  if (results && results.length) {
    // Level 2 — more correct teams (regardless of position)
    const aCorrectCount = (a.picks||[]).filter(p => results.includes(p)).length;
    const bCorrectCount = (b.picks||[]).filter(p => results.includes(p)).length;
    if (bCorrectCount !== aCorrectCount) return bCorrectCount - aCorrectCount;
    // Level 3 — cascade through each position (#1 first)
    for (let i = 0; i < results.length; i++) {
      const correctTeam = results[i];
      if (!correctTeam) continue;
      const aCorrect = a.picks?.[i] === correctTeam ? 1 : 0;
      const bCorrect = b.picks?.[i] === correctTeam ? 1 : 0;
      if (bCorrect !== aCorrect) return bCorrect - aCorrect;
    }
  }
  // Level 4 — earlier submission wins
  return new Date(a.createdAt||0) - new Date(b.createdAt||0);
}

function logoUrl(filename, teamName) {
  const f = (filename && filename!=="") ? filename : (teamName ? teamName+".png" : null);
  if (!f) return "";
  return FILE_BASE + encodeURIComponent(f.replace(/ /g,"_"));
}
function logoFallback(e, teamName) {
  const fb = FILE_BASE + encodeURIComponent((teamName+".png").replace(/ /g,"_"));
  if (e.target.src!==fb) e.target.src=fb; else e.target.style.display="none";
}
function tn(t) { return (t.display_name&&t.display_name!=="") ? t.display_name : t.team; }
function fmtTime(iso) {
  return new Date(iso).toLocaleString("en-IN",{timeZone:"Asia/Kolkata",day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"});
}

// ── Share Card Generator ──────────────────────────────────────────
const TEMPLATE_B64 = "data:image/png;base64,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";

// Slot Y centers measured from the 1080x1920 template
const SLOT_CENTERS = [492, 654, 816, 977, 1139, 1301, 1463, 1625];

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
    setTimeout(() => reject(new Error("timeout")), 4000);
  });
}

async function generateShareCard({ username, platform, stage, picks, score, published }) {
  // Load Archivo SemiBold from Google Fonts into the document
  if (!document.querySelector("#archivo-font")) {
    const link = document.createElement("link");
    link.id = "archivo-font";
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Archivo:wght@600&display=swap";
    document.head.appendChild(link);
    // Wait for font to load
    await new Promise(r => setTimeout(r, 800));
  }
  await document.fonts.ready;

  const W = 1080, H = 1920;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");

  // Draw template background
  const tmpl = await loadImage(TEMPLATE_B64);
  ctx.drawImage(tmpl, 0, 0, W, H);

  // Username — center aligned, pushed up
  ctx.font = "600 30px 'Archivo', Arial, sans-serif";
  ctx.fillStyle = "rgba(60,60,60,0.80)";
  ctx.textAlign = "center";
  ctx.fillText(`@${username}`, W / 2, 380);

  // Team names — 34px, uppercase, pushed right to clear rank box
  ctx.font = "600 34px 'Archivo', Arial, sans-serif";
  ctx.fillStyle = "#141414";
  ctx.textAlign = "left";

  const maxSlots = Math.min(picks.length, SLOT_CENTERS.length);
  for (let i = 0; i < maxSlots; i++) {
    const cy = SLOT_CENTERS[i];
    ctx.fillText(picks[i].toUpperCase(), 310, cy + 12);
  }

  // Score overlay (if published)
  if (published && score !== null) {
    const lastY = SLOT_CENTERS[maxSlots - 1];
    const scoreY = lastY + 90;
    ctx.fillStyle = "rgba(22,163,74,0.12)";
    ctx.beginPath();
    ctx.roundRect(230, scoreY, 420, 68, 12);
    ctx.fill();
    ctx.font = "600 42px 'Archivo', Arial, sans-serif";
    ctx.fillStyle = "#15803d";
    ctx.textAlign = "center";
    ctx.fillText(`${score} pts`, 440, scoreY + 46);
  }

  return canvas.toDataURL("image/png");
}

// ── App ───────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("picks");

  // ── Identity ──────────────────────────────────────────────────
  const [platform, setPlatform]           = useState("instagram");
  const [usernameInput, setUsernameInput] = useState("");
  const [identity, setIdentity]           = useState(null);
  const [idLoading, setIdLoading]         = useState(false);
  const [pinFlow, setPinFlow]             = useState("username"); // username | pin_new | pin_verify
  const [pinInput, setPinInput]           = useState("");
  const [pinError, setPinError]           = useState("");
  const [pendingDocId, setPendingDocId]   = useState(null);

  // ── Stage state ───────────────────────────────────────────────
  // meta doc stores: activeStage, stages: { semis: {status, results, published, activeTeams, qualifyCount, tournamentName}, survival: {...}, finals: {...} }
  const [meta, setMeta]           = useState(null);
  const [activeStage, setActiveStage] = useState("semis");

  // ── Picks ─────────────────────────────────────────────────────
  const [picks, setPicks]           = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(false);
  const [toast, setToast]           = useState(null);

  // ── Submissions ───────────────────────────────────────────────
  const [myPicks, setMyPicks]         = useState({}); // { semis: doc, survival: doc, finals: doc }
  const [allSubs, setAllSubs]         = useState({}); // { semis: [], survival: [], finals: [] } — post deadline only
  const [subCounts, setSubCounts]     = useState({}); // { semis: n, survival: n }

  // ── Leaderboard tab ───────────────────────────────────────────
  const [lbStage, setLbStage]         = useState("semis");

  // ── Admin ─────────────────────────────────────────────────────
  const [adminUnlocked, setAdminUnlocked]   = useState(false);
  const [adminPassInput, setAdminPassInput] = useState("");
  const [adminStage, setAdminStage]         = useState("semis"); // which stage admin is editing
  const [allWikiTeams, setAllWikiTeams]     = useState([]);
  const [wikiLoading, setWikiLoading]       = useState(false);
  const [wikiErr, setWikiErr]               = useState(null);
  // local admin edits per stage
  const [adminEdits, setAdminEdits]         = useState({});
  const [adminSubs, setAdminSubs]           = useState([]); // for admin submissions view

  // ── Restore identity from localStorage ───────────────────────
  useEffect(() => {
    const savedToken = localStorage.getItem(LS_TOKEN);
    const savedDocId = localStorage.getItem(LS_DOCID);
    if (savedToken && savedDocId) {
      const plat  = savedDocId.startsWith("x_") ? "x" : "instagram";
      const uname = savedDocId.replace(/^(instagram|x)_/, "");
      setIdentity({ username: uname, platform: plat, docId: savedDocId, token: savedToken, isReturning: true });
    }
  }, []);

  // ── Firestore: meta ───────────────────────────────────────────
  useEffect(() => {
  const fetchMeta = async () => {
    const snap = await getDoc(doc(db, "pickem", META_DOC));
    if (!snap.exists()) return;
    const d = snap.data();
    setMeta(d);
    setActiveStage(d.activeStage || "semis");
    setAdminEdits(prev => {
      const updated = { ...prev };
      STAGE_ORDER.forEach(s => {
        if (!updated[s]) {
          const sd = d.stages?.[s] || {};
          updated[s] = {
            results:        sd.results        || Array(sd.qualifyCount||8).fill(""),
            published:      sd.published      || false,
            activeTeams:    (sd.activeTeams||[]).map(t=>typeof t==="string"?{team:t,display_name:"",image:"",image_dark:""}:t),
            qualifyCount:   sd.qualifyCount   || 8,
            tournamentName: sd.tournamentName || "",
          };
        }
      });
      return updated;
    });
  };
  fetchMeta();
}, []);

  // ── Firestore: my picks across all stages ─────────────────────
  useEffect(() => {
    if (!identity) { setMyPicks({}); return; }
    const fetchMyPicks = async () => {
      const picks = {};
      for (const stage of STAGE_ORDER) {
        const snap = await getDoc(doc(db, "pickem", META_DOC, STAGE_COLS[stage], identity.docId));
        picks[stage] = (snap.exists() && !snap.data().deleted) ? snap.data() : null;
      }
      setMyPicks(picks);
    };
    fetchMyPicks();
  }, [identity?.docId]);

  // ── Firestore: sub counts — read from baked cache if available
useEffect(() => {
    const fetchCounts = async () => {
      const counts = {};
      for (const stage of STAGE_ORDER) {
        // Try localStorage cache first
        const lsKey = LS_LB_PREFIX + stage;
        try {
          const cached = JSON.parse(localStorage.getItem(lsKey) || "null");
          if (cached?.submissions?.length) {
            counts[stage] = cached.submissions.length;
            continue;
          }
        } catch {}
        // Try baked doc (1 read)
        try {
          const cacheSnap = await getDoc(doc(db, "pickem", META_DOC, LB_CACHE_COL, stage));
          if (cacheSnap.exists()) {
            counts[stage] = cacheSnap.data().count || 0;
            continue;
          }
        } catch {}
        // Last resort — live fetch (only if no baked doc exists yet)
        const snap = await getDocs(collection(db, "pickem", META_DOC, STAGE_COLS[stage]));
        counts[stage] = snap.docs.filter(d => !d.data().deleted).length;
      }
      setSubCounts(counts);
    };
    fetchCounts();
  }, []);

  // ── Firestore: leaderboard — cache-first, version-gated ──────
  useEffect(() => {
    if (!meta) return;
    const fetchSubs = async () => {
      const subs = {};
      for (const stage of STAGE_ORDER) {
        const deadline  = DEADLINES[stage];
        const isPast    = new Date() > deadline;
        if (!isPast && !adminUnlocked) continue;

        // Admin always reads live (needs fresh data for baking)
        if (adminUnlocked) {
          const snap = await getDocs(collection(db, "pickem", META_DOC, STAGE_COLS[stage]));
          subs[stage] = snap.docs.map(d => d.data()).filter(d => !d.deleted);
          continue;
        }

        // Check cache version from meta
        const serverVersion = meta?.stages?.[stage]?.cacheVersion || 0;
        const lsKey         = LS_LB_PREFIX + stage;
        try {
          const cached = JSON.parse(localStorage.getItem(lsKey) || "null");
          if (cached && cached.version === serverVersion && cached.submissions?.length) {
            subs[stage] = cached.submissions; // cache hit — zero Firestore reads
            continue;
          }
        } catch {}

        // Cache miss — fetch the single baked doc (1 read)
        const cacheSnap = await getDoc(doc(db, "pickem", META_DOC, LB_CACHE_COL, stage));
        if (cacheSnap.exists()) {
          const data = cacheSnap.data();
          subs[stage] = data.submissions || [];
          localStorage.setItem(lsKey, JSON.stringify({ version: serverVersion, submissions: subs[stage] }));
        } else {
          // No baked doc yet — fall back to live fetch
          const snap = await getDocs(collection(db, "pickem", META_DOC, STAGE_COLS[stage]));
          subs[stage] = snap.docs.map(d => d.data()).filter(d => !d.deleted);
        }
      }
      setAllSubs(subs);
    };
    fetchSubs();
  }, [meta?.activeStage, meta?.stages, adminUnlocked]);

  // ── Admin: fetch all subs for admin view ─────────────────────
useEffect(() => {
    if (!adminUnlocked) return;
    const fetchAdminSubs = async () => {
      const snap = await getDocs(collection(db, "pickem", META_DOC, STAGE_COLS[adminStage]));
      setAdminSubs(snap.docs.map(d => d.data()).filter(d => !d.deleted));
    };
    fetchAdminSubs();
  }, [adminUnlocked, adminStage]);

  const showToast = (msg, type="success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Identity helpers ──────────────────────────────────────────
  const resetIdentity = () => {
    setIdentity(null); setUsernameInput(""); setPicks([]);
    setPinFlow("username"); setPinInput(""); setPinError("");
    localStorage.removeItem(LS_TOKEN); localStorage.removeItem(LS_DOCID);
  };

  // ── Step 1: Check username ────────────────────────────────────
  const handleConfirm = async () => {
    const clean = usernameInput.trim().replace(/^@/,"").toLowerCase();
    if (!clean || clean.length<2) { showToast("Enter a valid username","error"); return; }
    setIdLoading(true); setPinError("");
    try {
      const docId  = `${platform}_${clean}`;
      // Check users collection (PIN store)
      const uRef   = doc(db, USERS_COL, docId);
      const uSnap  = await getDoc(uRef);

      if (uSnap.exists()) {
        // User exists — check localStorage
        const savedDocId = localStorage.getItem(LS_DOCID);
        const savedToken = localStorage.getItem(LS_TOKEN);
        if (savedDocId===docId && savedToken===uSnap.data().token) {
          // Same browser — auto login
          const stage = activeStage;
          const subSnap = await getDoc(doc(db,"pickem",META_DOC,STAGE_COLS[stage],docId));
          setIdentity({ username:clean, platform, docId, token:savedToken, isReturning:true });
          if (subSnap.exists()) setPicks(subSnap.data().picks||[]);
          showToast(`Welcome back @${clean}!`);
        } else {
          // Different browser — verify PIN
          setPendingDocId(docId);
          setPinFlow("pin_verify");
        }
      } else {
        // New user — set PIN
        setPendingDocId(docId);
        setPinFlow("pin_new");
      }
    } catch(e) {
      console.error("handleConfirm error:", e);
      showToast(e?.message || "Something went wrong. Try again.","error");
    } finally {
      setIdLoading(false);
    }
  };

  // ── Set PIN (new user) ────────────────────────────────────────
  const handleSetPin = async () => {
    if (!/^\d{6}$/.test(pinInput)) { setPinError("PIN must be exactly 6 digits"); return; }
    const clean = usernameInput.trim().replace(/^@/,"").toLowerCase();
    const token = await hashPin(pinInput);
    // Save to users collection
    await setDoc(doc(db,USERS_COL,pendingDocId), { token, platform, username:clean, createdAt:new Date().toISOString() });
    localStorage.setItem(LS_TOKEN, token);
    localStorage.setItem(LS_DOCID, pendingDocId);
    setIdentity({ username:clean, platform, docId:pendingDocId, token, isReturning:false });
    setPinFlow("username"); setPinInput(""); setPinError("");
  };

  // ── Verify PIN (returning, different browser) ─────────────────
  const handleVerifyPin = async () => {
    if (!/^\d{6}$/.test(pinInput)) { setPinError("PIN must be exactly 6 digits"); return; }

    // Brute force check — keyed per username so others aren't affected
    const lockKey     = `pin_locked_until_${pendingDocId}`;
    const attemptsKey = `pin_attempts_${pendingDocId}`;
    const now         = Date.now();
    const lockedUntil = parseInt(localStorage.getItem(lockKey) || "0");
    if (now < lockedUntil) {
      const mins = Math.ceil((lockedUntil - now) / 60000);
      setPinError(`Too many wrong attempts. Try again in ${mins} min.`);
      return;
    }

    setIdLoading(true); setPinError("");
    try {
      const uSnap = await getDoc(doc(db,USERS_COL,pendingDocId));
      const token = await hashPin(pinInput);
      if (uSnap.exists() && uSnap.data().token===token) {
        // Success — clear lockout state
        localStorage.removeItem(lockKey);
        localStorage.removeItem(attemptsKey);
        const clean = usernameInput.trim().replace(/^@/,"").toLowerCase();
        localStorage.setItem(LS_TOKEN, token);
        localStorage.setItem(LS_DOCID, pendingDocId);
        const subSnap = await getDoc(doc(db,"pickem",META_DOC,STAGE_COLS[activeStage],pendingDocId));
        setIdentity({ username:clean, platform, docId:pendingDocId, token, isReturning:true });
        if (subSnap.exists()) setPicks(subSnap.data().picks||[]);
        showToast(`Welcome back @${clean}!`);
        setPinFlow("username"); setPinInput(""); setPinError("");
      } else {
        const attempts = parseInt(localStorage.getItem(attemptsKey) || "0") + 1;
        localStorage.setItem(attemptsKey, String(attempts));
        if (attempts >= 3) {
          const lockUntil = now + 15 * 60 * 1000;
          localStorage.setItem(lockKey, String(lockUntil));
          setPinError("Too many wrong attempts. Locked for 15 minutes.");
        } else {
          setPinError(`Incorrect PIN. ${3 - attempts} attempt${3-attempts===1?"":"s"} left.`);
        }
      }
    } catch(e) {
      setPinError("Something went wrong. Try again.");
    } finally {
      setIdLoading(false);
    }
  };

  // ── Pick logic ────────────────────────────────────────────────
  const stageData    = meta?.stages?.[activeStage] || {};
  const activeTeams  = (stageData.activeTeams||[]).map(t=>typeof t==="string"?{team:t,display_name:"",image:"",image_dark:""}:t);
  const qualifyCount = stageData.qualifyCount || 8;
  const isClosed     = new Date() > DEADLINES[activeStage];

  const handlePickTeam = useCallback((name) => {
    if (isClosed||!identity) return;
    if (picks.includes(name)) return;
    if (picks.length>=qualifyCount) { showToast(`Already picked ${qualifyCount} teams!`,"error"); return; }
    setPicks(prev=>[...prev,name]);
  }, [picks, isClosed, qualifyCount, identity]);

  const handleRemovePick = (idx) => setPicks(prev=>prev.filter((_,i)=>i!==idx));

  // ── Submit ────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!identity) return;
    if (picks.length<qualifyCount) { showToast(`Pick all ${qualifyCount} teams`,"error"); return; }
    setSubmitting(true);
    try {
      await setDoc(doc(db,"pickem",META_DOC,STAGE_COLS[activeStage],identity.docId), {
        docId:     identity.docId,
        username:  identity.username,
        platform:  identity.platform,
        picks,
        timestamp: new Date().toISOString(),
      });
      setSubmitted(true);
      showToast("Picks submitted! Good luck!");
    } catch(e) {
      showToast("Failed to save. Try again.","error");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Admin ─────────────────────────────────────────────────────
  const [adminAttempts, setAdminAttempts]       = useState(0);
  const [adminLockedUntil, setAdminLockedUntil] = useState(
    () => parseInt(localStorage.getItem("admin_locked_until") || "0")
  );

  const handleAdminLogin = () => {
    const now = Date.now();
    if (now < adminLockedUntil) {
      const mins = Math.ceil((adminLockedUntil - now) / 60000);
      showToast(`Too many attempts. Try again in ${mins} min`, "error");
      return;
    }
    if (adminPassInput === ADMIN_PASS) {
      setAdminUnlocked(true);
      setAdminAttempts(0);
      localStorage.removeItem("admin_locked_until");
    } else {
      const next = adminAttempts + 1;
      setAdminAttempts(next);
      if (next >= 5) {
        const lockUntil = now + 15 * 60 * 1000;
        localStorage.setItem("admin_locked_until", String(lockUntil));
        setAdminLockedUntil(lockUntil);
        showToast("Too many attempts. Locked for 15 minutes.", "error");
      } else {
        showToast(`Wrong password. ${5 - next} attempt${5-next===1?"":"s"} left`, "error");
      }
    }
  };

  const ae = adminEdits[adminStage] || {};
  const setAe = (key, val) => setAdminEdits(prev=>({ ...prev, [adminStage]:{ ...prev[adminStage], [key]:val } }));

  const toggleTeam = (teamObj) => {
    const name = tn(teamObj);
    setAe("activeTeams", ae.activeTeams?.some(t=>tn(t)===name)
      ? ae.activeTeams.filter(t=>tn(t)!==name)
      : [...(ae.activeTeams||[]), teamObj]
    );
  };
  const isSelTeam = (name) => (ae.activeTeams||[]).some(t=>tn(t)===name);

  const handleSaveTeams = async () => {
    if (!ae.activeTeams?.length) { showToast("Select at least one team","error"); return; }
    try {
      await setDoc(doc(db,"pickem",META_DOC), {
        adminSecret: ADMIN_SECRET,
        activeStage,
        stages: {
          ...(meta?.stages||{}),
          [adminStage]: {
            ...(meta?.stages?.[adminStage]||{}),
            activeTeams:    ae.activeTeams,
            qualifyCount:   ae.qualifyCount||8,
            tournamentName: ae.tournamentName||"",
          }
        }
      }, { merge:true });
      showToast(`Saved ${ae.activeTeams.length} teams for ${STAGE_LABELS[adminStage]}`);
    } catch(e) { showToast("Save failed","error"); }
  };

  // ── Bake leaderboard cache ────────────────────────────────────
  const bakeLeaderboard = async (stage, withResults = false) => {
    try {
      // Fetch all live submissions
      const snap = await getDocs(collection(db, "pickem", META_DOC, STAGE_COLS[stage]));
      const submissions = snap.docs.map(d => d.data()).filter(d => !d.deleted);

      // Write baked doc — 1 document, all submissions inside
      await setDoc(doc(db, "pickem", META_DOC, LB_CACHE_COL, stage), {
        adminSecret:  ADMIN_SECRET,
        bakedAt:      new Date().toISOString(),
        withResults,
        submissions,
        count:        submissions.length,
      });

      // Always fetch fresh meta before bumping cacheVersion
      const freshSnap = await getDoc(doc(db, "pickem", META_DOC));
      const freshMeta = freshSnap.exists() ? freshSnap.data() : {};
      const currentVersion = freshMeta.stages?.[stage]?.cacheVersion || 0;
      await setDoc(doc(db, "pickem", META_DOC), {
        adminSecret: ADMIN_SECRET,
        stages: { ...(freshMeta.stages||{}), [stage]: { ...(freshMeta.stages?.[stage]||{}), cacheVersion: currentVersion + 1 } }
      }, { merge:true });

      // Invalidate own localStorage too
      localStorage.removeItem(LS_LB_PREFIX + stage);
      showToast(`Leaderboard baked — ${submissions.length} submissions cached`);
    } catch(e) { showToast("Bake failed", "error"); console.error(e); }
  };

  const handleSaveResults = async () => {
    const filled = (ae.results||[]).filter(Boolean);
    if (filled.length<(ae.qualifyCount||8)) { showToast(`Fill all ${ae.qualifyCount||8} positions`,"error"); return; }
    try {
      // Fetch fresh meta to avoid overwriting other fields with stale state
      const freshSnap = await getDoc(doc(db, "pickem", META_DOC));
      const freshMeta = freshSnap.exists() ? freshSnap.data() : {};
      await setDoc(doc(db,"pickem",META_DOC), {
        adminSecret: ADMIN_SECRET,
        stages: { ...(freshMeta.stages||{}), [adminStage]: { ...(freshMeta.stages?.[adminStage]||{}), results:ae.results } }
      }, { merge:true });
      // Sync local meta state
      setMeta(prev => ({ ...prev, stages: { ...(freshMeta.stages||{}), [adminStage]: { ...(freshMeta.stages?.[adminStage]||{}), results:ae.results } } }));
      showToast("Results saved");
    } catch(e) { showToast("Save failed","error"); }
  };

  const handlePublishToggle = async (publish) => {
    try {
      // Always fetch fresh meta before publishing to avoid overwriting latest results
      const freshSnap = await getDoc(doc(db, "pickem", META_DOC));
      const freshMeta = freshSnap.exists() ? freshSnap.data() : {};
      await setDoc(doc(db,"pickem",META_DOC), {
        adminSecret: ADMIN_SECRET,
        stages: { ...(freshMeta.stages||{}), [adminStage]: { ...(freshMeta.stages?.[adminStage]||{}), published:publish } }
      }, { merge:true });
      // Sync local meta state with fresh data
      setMeta({ ...freshMeta, stages: { ...(freshMeta.stages||{}), [adminStage]: { ...(freshMeta.stages?.[adminStage]||{}), published:publish } } });
      showToast(publish ? "Scores published!" : "Scores hidden");
      if (publish) await bakeLeaderboard(adminStage, true);
    } catch(e) { showToast("Failed","error"); }
  };

  const handleStartStage = async (stage) => {
    const label = STAGE_LABELS[stage];
    if (!window.confirm(`Start ${label}? Current stage picks will be locked.`)) return;
    try {
      await setDoc(doc(db,"pickem",META_DOC), {
        adminSecret: ADMIN_SECRET,
        activeStage: stage,
        stages: {
          ...(meta?.stages||{}),
          [stage]: { ...(meta?.stages?.[stage]||{}), status:"open" }
        }
      }, { merge:true });
      showToast(`${label} is now open!`);
    } catch(e) { showToast("Failed","error"); }
  };

  const handleDeleteSub = async (docId) => {
    if (!window.confirm("Delete this submission?")) return;
    try {
      await setDoc(doc(db,"pickem",META_DOC,STAGE_COLS[adminStage],docId), {
        adminSecret: ADMIN_SECRET,
        deleted: true,
      }, { merge:true });
      setAdminSubs(prev => prev.filter(s => s.docId !== docId));
      showToast("Deleted");
    } catch { showToast("Delete failed","error"); }
  };

  const fetchWikiTeams = async (tName) => {
    if (!tName?.trim()) { showToast("Enter tournament name","error"); return; }
    setWikiLoading(true); setWikiErr(null);
    try {
      const url = `${WIKI_BASE}/api.php?action=cargoquery&tables=Tournament_Teams`
        + `&fields=team,display_name,image,image_dark`
        + `&where=${encodeURIComponent(`tournament='${tName.trim()}'`)}`
        + `&limit=100&format=json&origin=*`;
      const data = await (await fetch(url)).json();
      const rows = (data.cargoquery||[]).map(r=>r.title).filter(r=>r.team&&r.team!=="");
      if (!rows.length) throw new Error("No teams found. Check the tournament name.");
      setAllWikiTeams(rows);
      setAe("activeTeams", rows); // pre-select all
    } catch(e) { setWikiErr(e.message); }
    finally { setWikiLoading(false); }
  };

  // ── Leaderboard helpers ───────────────────────────────────────
  const getStageResults = (stage) => meta?.stages?.[stage]?.results || [];
  const isPublished     = (stage) => meta?.stages?.[stage]?.published || false;
  const isDeadlinePast  = (stage) => new Date() > DEADLINES[stage];

  const getLbData = (stage) => {
    const subs    = allSubs[stage] || [];
    const results = getStageResults(stage);
    const pub     = isPublished(stage);
    return pub
      ? [...subs].map(s=>({...s,score:scoreSubmission(s.picks,results)})).sort((a,b)=>tiebreakerSort(a,b,results))
      : [...subs].sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp));
  };

  const getCombinedLb = () => {
    const map = {};
    ["semis","survival"].forEach(stage => {
      const subs    = allSubs[stage]||[];
      const results = getStageResults(stage);
      const pub     = isPublished(stage);
      subs.forEach(s => {
        if (!map[s.docId]) map[s.docId] = { docId:s.docId, username:s.username, platform:s.platform, semis:null, survival:null };
        map[s.docId][stage] = pub ? scoreSubmission(s.picks,results) : null;
      });
    });
    return Object.values(map).map(u=>({
      ...u,
      total: (u.semis||0) + (u.survival||0)
    })).sort((a,b)=>{
      // Level 1 — total points
      if (b.total !== a.total) return b.total - a.total;
      // Level 2 — more correct teams across all published stages
      let aTotalCorrect = 0, bTotalCorrect = 0;
      for (const stage of ["semis","survival"]) {
        const results = getStageResults(stage);
        const pub     = isPublished(stage);
        if (!pub || !results?.length) continue;
        const aSubs = (allSubs[stage]||[]).find(s=>s.docId===a.docId);
        const bSubs = (allSubs[stage]||[]).find(s=>s.docId===b.docId);
        if (aSubs) aTotalCorrect += (aSubs.picks||[]).filter(p => results.includes(p)).length;
        if (bSubs) bTotalCorrect += (bSubs.picks||[]).filter(p => results.includes(p)).length;
      }
      if (bTotalCorrect !== aTotalCorrect) return bTotalCorrect - aTotalCorrect;
      // Level 3 — cascade positions across stages (#1 semis first, then survival)
      for (const stage of ["semis","survival"]) {
        const results = getStageResults(stage);
        const pub     = isPublished(stage);
        if (!pub || !results?.length) continue;
        const aSubs = (allSubs[stage]||[]).find(s=>s.docId===a.docId);
        const bSubs = (allSubs[stage]||[]).find(s=>s.docId===b.docId);
        if (!aSubs || !bSubs) continue;
        for (let i = 0; i < results.length; i++) {
          const correctTeam = results[i];
          if (!correctTeam) continue;
          const aCorrect = aSubs.picks?.[i] === correctTeam ? 1 : 0;
          const bCorrect = bSubs.picks?.[i] === correctTeam ? 1 : 0;
          if (bCorrect !== aCorrect) return bCorrect - aCorrect;
        }
      }
      // Level 4 — earlier semis submission
      const aSub = (allSubs["semis"]||[]).find(s=>s.docId===a.docId);
      const bSub = (allSubs["semis"]||[]).find(s=>s.docId===b.docId);
      return new Date(aSub?.createdAt||0) - new Date(bSub?.createdAt||0);
    });
  };

  // Available lb tabs — only stages with past deadline
  const lbTabs = STAGE_ORDER.filter(s => isDeadlinePast(s));
  const showCombined = lbTabs.filter(s => isPublished(s)).length > 1;

  // ── Share card ────────────────────────────────────────────────
  const [sharing, setSharing] = useState(null); // stage key being exported

  const handleShare = async (stage, sub, score, published) => {
    setSharing(stage);
    try {
      const dataUrl = await generateShareCard({
        username:  identity.username,
        platform:  identity.platform,
        stage:     STAGE_LABELS[stage],
        picks:     sub.picks || [],
        score,
        published,
      });
      const filename = `bgis2026-${stage}-picks-${identity.username}.png`;

      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], filename, { type: "image/png" });
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

      if (isMobile && navigator.share) {
        try {
          // Try sharing with file
          await navigator.share({
            files: [file],
            title: "BGIS 2026 Pick'em",
            text: `My ${STAGE_LABELS[stage]} picks — make yours at esportsamaze.in`,
            url: "https://esportsamaze.in/BGMI/Tournaments/Battlegrounds_Mobile_India_Series_2026/Pickem",
          });
        } catch(shareErr) {
          if (shareErr?.name === "AbortError") return; // user cancelled — do nothing
          // Share failed — fall back to download
          const a = document.createElement("a");
          a.href = dataUrl;
          a.download = filename;
          a.click();
        }
      } else {
        // Desktop — download
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = filename;
        a.click();
      }
    } catch(e) {
      if (e?.name !== "AbortError") showToast("Could not generate image", "error");
    } finally {
      setSharing(null);
    }
  };

  // ── Step logic ────────────────────────────────────────────────
  const step = !identity ? 1 : picks.length < qualifyCount ? 2 : 3;

  // ── Render ────────────────────────────────────────────────────
  const stageLabel     = STAGE_LABELS[activeStage];
  const deadlineStr    = activeStage==="semis" ? "Mar 12 · 3:00 PM IST" : activeStage==="survival" ? "Mar 16 · 2:30 PM IST" : "TBD";

  return (
    <>
      <style>{css}</style>
      <div className="pk">

        {/* ── Hero ── */}
        <div className="pk-hero">
          <div className="pk-eyebrow">BGMI · BGIS 2026</div>
          <div className="pk-title">PICK<span>'</span>EM</div>
          <div className="pk-stage-badge">
            <span className={`dot${isClosed?" closed":""}`}/>
            {stageLabel} {isClosed ? "· Closed" : "· Open"}
          </div>
          <br/>
          <div className={`pk-deadline${isClosed?" closed":""}`}>
            {isClosed ? `⛔ ${stageLabel} Closed` : `⏰ Closes ${deadlineStr}`}
          </div>
        </div>

        {/* ── Score bar ── */}
        <div className="pk-score-bar">
          <span><span className="pk-score-dot" style={{background:G.green}}/>Correct team + position = 15 pts</span>
          <span><span className="pk-score-dot" style={{background:G.blue}}/>Correct team, wrong position = 10 pts</span>
          <span style={{color:G.muted}}>Max {qualifyCount*15} pts per stage</span>
        </div>

        {/* ── Nav ── */}
        <div className="pk-nav">
          {[
            {id:"picks",       label:"Make Picks"},
            {id:"submissions", label:"My Submissions"},
            {id:"leaderboard", label:"Leaderboard"},
          ].map(t=>(
            <button key={t.id} className={`pk-nav-btn${tab===t.id?" active":""}`} onClick={()=>setTab(t.id)}>
              {t.label}
            </button>
          ))}
          {ADMIN_MODE && (
            <button className={`pk-nav-btn${tab==="admin"?" active":""}`} onClick={()=>setTab("admin")}>
              Admin
            </button>
          )}
        </div>

        {/* ════════ PICKS TAB ════════ */}
        {tab==="picks" && (
          <div className="pk-wrap">
            {!meta ? (
              <div className="pk-loading"><div className="pk-spinner"/>Loading...</div>
            ) : activeTeams.length===0 ? (
              <div className="pk-loading"><div className="pk-spinner"/>Waiting for admin to configure {stageLabel} teams...</div>
            ) : submitted ? (
              <div className="pk-success">
                <div className="pk-success-icon">✅</div>
                <div className="pk-success-title">Picks Submitted!</div>
                <div style={{color:G.sub,fontSize:14,marginBottom:18}}>@{identity?.username} · {stageLabel} · {picks.length} teams</div>
                <div className="pk-chips" style={{justifyContent:"center",marginBottom:22}}>
                  {picks.map((p,i)=><span key={i} className="pk-chip">#{i+1} {p}</span>)}
                </div>
                <button className="pk-submit" style={{maxWidth:240}} onClick={()=>{setSubmitted(false);setPicks([]);}}>Edit Picks</button>
              </div>
            ) : (
              <>
                {/* Steps */}
                {!isClosed && (
                  <div className="pk-steps">
                    {[{n:1,l:"Username"},{n:2,l:`Pick ${qualifyCount} Teams`},{n:3,l:"Submit"}].map(s=>(
                      <div key={s.n} className={`pk-step${step===s.n?" active":step>s.n?" done":""}`}>
                        <span className="pk-step-n">{step>s.n?"✓":s.n}</span>{s.l}
                      </div>
                    ))}
                  </div>
                )}

                {/* Username / PIN screens */}
                {!identity ? (
                  <>
                    {pinFlow==="username" && (
                      <div className="pk-ubox">
                        <div className="pk-ubox-title">Enter your username</div>
                        <div className="pk-ubox-sub">Your Instagram or X handle. Appears on the leaderboard after submissions close.</div>
                        <div className="pk-platform-toggle">
                          <button className={`pk-plat-btn${platform==="instagram"?" active":""}`} onClick={()=>setPlatform("instagram")}>Instagram</button>
                          <button className={`pk-plat-btn${platform==="x"?" active":""}`} onClick={()=>setPlatform("x")}>X / Twitter</button>
                        </div>
                        <div className="pk-urow">
                          <input className="pk-input" style={{flex:1,minWidth:180}}
                            placeholder={platform==="instagram"?"@yourusername":"@yourhandle"}
                            value={usernameInput} onChange={e=>setUsernameInput(e.target.value)}
                            onKeyDown={e=>e.key==="Enter"&&handleConfirm()}/>
                          <button className="pk-btn pk-btn-acc" onClick={handleConfirm} disabled={idLoading||!usernameInput.trim()}>
                            {idLoading?"Checking...":"Continue →"}
                          </button>
                        </div>
                      </div>
                    )}
                    {pinFlow==="pin_new" && (
                      <div className="pk-pin-box">
                        <div className="pk-pin-title">Set a 6-digit PIN</div>
                        <div className="pk-pin-sub">
                          Choose a PIN to protect your picks. You'll need it to edit from a different browser or device.<br/>
                          <strong>Keep it safe — don't share it.</strong>
                        </div>
                        <input className={`pk-pin-input${pinError?" err":""}`}
                          type="number" inputMode="numeric"
                          placeholder="000000" value={pinInput}
                          onChange={e=>{setPinInput(e.target.value.slice(0,6));setPinError("");}}
                          onKeyDown={e=>e.key==="Enter"&&handleSetPin()}/>
                        {pinError&&<div className="pk-pin-error">{pinError}</div>}
                        <div style={{display:"flex",gap:10,marginTop:14,flexWrap:"wrap"}}>
                          <button className="pk-btn pk-btn-green" onClick={handleSetPin} disabled={pinInput.length!==6}>Set PIN &amp; Continue →</button>
                          <button className="pk-pin-back" onClick={()=>{setPinFlow("username");setPinInput("");setPinError("");}}>← Back</button>
                        </div>
                      </div>
                    )}
                    {pinFlow==="pin_verify" && (
                      <div className="pk-pin-box">
                        <div className="pk-pin-title">Enter your PIN</div>
                        <div className="pk-pin-sub">
                          @{usernameInput.replace(/^@/,"").toLowerCase()} already has a submission. Enter your 6-digit PIN to edit your picks.
                        </div>
                        <input className={`pk-pin-input${pinError?" err":""}`}
                          type="number" inputMode="numeric"
                          placeholder="000000" value={pinInput}
                          onChange={e=>{setPinInput(e.target.value.slice(0,6));setPinError("");}}
                          onKeyDown={e=>e.key==="Enter"&&handleVerifyPin()}/>
                        {pinError&&<div className="pk-pin-error">{pinError}</div>}
                        <div style={{display:"flex",gap:10,marginTop:14,flexWrap:"wrap"}}>
                          <button className="pk-btn pk-btn-acc" onClick={handleVerifyPin} disabled={idLoading||pinInput.length!==6}>
                            {idLoading?"Verifying...":"Verify PIN →"}
                          </button>
                          <button className="pk-pin-back" onClick={()=>{setPinFlow("username");setPinInput("");setPinError("");}}>← Back</button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="pk-ubar">
                    <div className="pk-ubar-name">@{identity.username}</div>
                    <span className={`pk-plat-chip ${identity.platform}`}>{identity.platform==="x"?"X":"Instagram"}</span>
                    {identity.isReturning&&<span className="pk-edit-chip">Editing</span>}
                    <div style={{flex:1}}/>
                    <button className="pk-change-btn" onClick={resetIdentity}>Change</button>
                  </div>
                )}

                {/* Picks */}
                {identity && isClosed && (
                  <div className="pk-loading" style={{color:G.red,fontWeight:600,fontSize:15,marginTop:24}}>
                    ⛔ {stageLabel} submissions are closed. Check your picks in the My Submissions tab.
                  </div>
                )}
                {identity && !isClosed && (
                  <>
                    <div className="pk-lbl">Your picks — {picks.length}/{qualifyCount}</div>
                    <div className="pk-slots">
                      {Array.from({length:qualifyCount}).map((_,i)=>{
                        const team=picks[i]; const tData=activeTeams.find(t=>tn(t)===team);
                        return (
                          <div key={i} className={`pk-slot${team?" filled":" empty"}`}>
                            <div className="pk-slot-n">{i+1}</div>
                            {team ? (
                              <>
                                <img className="pk-slot-logo" src={logoUrl(tData?.image,tData?.team)} alt="" onError={e=>logoFallback(e,tData?.team||"")}/>
                                <div className="pk-slot-name">{team}</div>
                                <button className="pk-slot-rm" onClick={()=>handleRemovePick(i)}>✕</button>
                              </>
                            ) : <div className="pk-slot-name">Empty</div>}
                          </div>
                        );
                      })}
                    </div>
                    <div className="pk-lbl">{picks.length<qualifyCount?`Click to pick #${picks.length+1}`:"All picked — scroll up to review"}</div>
                    <div className="pk-pool">
                      {activeTeams.map(t=>{
                        const name=tn(t); const sel=picks.includes(name); const idx=picks.indexOf(name);
                        return (
                          <button key={t.team} className={`pk-team${sel?" sel":""}`}
                            onClick={()=>handlePickTeam(name)} disabled={sel||picks.length>=qualifyCount}>
                            {idx>=0&&<div className="pk-team-order">#{idx+1}</div>}
                            <img className="pk-team-logo" src={logoUrl(t.image,t.team)} alt="" onError={e=>logoFallback(e,t.team)}/>
                            <div className="pk-team-name">{name}</div>
                          </button>
                        );
                      })}
                    </div>
                    {picks.length===qualifyCount&&(
                      <div style={{display:"flex",flexDirection:"column",gap:14,maxWidth:420}}>
                        <button className="pk-submit" onClick={handleSubmit} disabled={submitting}>
                          {submitting?"Submitting...":"Submit Picks"}
                        </button>
                        <div className="pk-hint">Submitting again with the same account overwrites your previous picks.</div>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* ════════ MY SUBMISSIONS TAB ════════ */}
        {tab==="submissions" && (
          <div className="pk-wrap">
            {!identity ? (
              <div className="pk-locked">
                <div className="pk-locked-icon">👤</div>
                <div className="pk-locked-title">Sign in to see your picks</div>
                <div className="pk-locked-sub">Go to Make Picks, enter your username and PIN — even if submissions are closed.</div>
                <button className="pk-btn pk-btn-acc" style={{marginTop:16}} onClick={()=>setTab("picks")}>Go to Make Picks →</button>
              </div>
            ) : (
              <>
                {/* ── Overall rank banner ── */}
                {(() => {
                  const bothPub = isPublished("semis") && isPublished("survival");
                  if (!bothPub) return null;
                  const combined   = getCombinedLb();
                  const overallRank = combined.findIndex(u => u.docId === identity.docId) + 1;
                  if (!overallRank) return null;
                  const total = combined.length;
                  const medal = overallRank===1?"🥇":overallRank===2?"🥈":overallRank===3?"🥉":null;
                  return (
                    <div style={{
                      background: overallRank<=3 ? "rgba(245,158,11,.1)" : "rgba(15,23,42,.04)",
                      border: `1.5px solid ${overallRank<=3 ? "rgba(245,158,11,.35)" : "rgba(15,23,42,.12)"}`,
                      borderRadius:12, padding:"16px 20px", marginBottom:16,
                      display:"flex", alignItems:"center", gap:14,
                    }}>
                      <div style={{fontSize:36}}>{medal || "🏆"}</div>
                      <div>
                        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,fontWeight:900,color:G.text}}>
                          Overall Rank #{overallRank} <span style={{fontSize:15,fontWeight:600,color:G.muted}}>/ {total}</span>
                        </div>
                        <div style={{fontSize:13,color:G.sub,marginTop:3}}>
                          Combined Semis + Survival leaderboard
                        </div>
                      </div>
                    </div>
                  );
                })()}
                {STAGE_ORDER.filter(s => {
                  // Show stage card if: it's the active stage, or deadline has passed, or user has a submission
                  return s===activeStage || new Date()>DEADLINES[s] || myPicks[s];
                }).map(stage => {
                  const sub     = myPicks[stage];
                  const results = getStageResults(stage);
                  const pub     = isPublished(stage);
                  const past    = isDeadlinePast(stage);
                  const score   = pub && sub ? scoreSubmission(sub.picks, results) : null;
                  const isActive = stage===activeStage;
                  // Per-stage rank
                  const lbData  = allSubs[stage]?.length ? getLbData(stage) : null;
                  const myRank  = lbData && sub ? lbData.findIndex(s => s.docId === identity.docId) + 1 : null;
                  const total   = lbData?.length || subCounts[stage] || null;

                  return (
                    <div key={stage} className="pk-sub-card">
                      <div className="pk-sub-card-header">
                        <div className="pk-sub-stage-label">{STAGE_LABELS[stage]}</div>
                        {score!==null && <div className="pk-sub-score">{score} pts</div>}
                        {myRank && (
                          <div style={{
                            fontFamily:"'Barlow Condensed',sans-serif",
                            fontSize:13, fontWeight:700,
                            background: myRank<=3 ? "rgba(245,158,11,.12)" : "rgba(37,99,235,.08)",
                            border: `1px solid ${myRank<=3 ? "rgba(245,158,11,.3)" : "rgba(37,99,235,.2)"}`,
                            color: myRank<=3 ? "#92400e" : G.blue,
                            borderRadius:6, padding:"2px 9px",
                          }}>
                            {myRank===1?"🥇":myRank===2?"🥈":myRank===3?"🥉":"#"+myRank}{total ? ` / ${total}` : ""}
                          </div>
                        )}
                        <span className={`pk-sub-status ${pub?"published":past?"pending":"open"}`}>
                          {pub ? "Results Out" : past ? "Awaiting Results" : "Open"}
                        </span>
                      </div>
                      {sub ? (
                        <>
                          <div className="pk-chips">
                            {(sub.picks||[]).map((p,pi)=>{
                              const cp=pub&&results[pi]===p;
                              const ct=pub&&!cp&&results.includes(p);
                              return <span key={pi} className={`pk-chip${cp?" pos":ct?" team":""}`}>#{pi+1} {p}</span>;
                            })}
                          </div>
                          <div style={{fontSize:11,color:G.muted,marginTop:8}}>Submitted {fmtTime(sub.timestamp)}</div>
                          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:10}}>
                            {isActive&&!isClosed&&(
                              <button className="pk-btn pk-btn-acc" style={{fontSize:12,padding:"6px 12px"}}
                                onClick={()=>{setPicks(sub.picks||[]);setTab("picks");}}>
                                Edit Picks
                              </button>
                            )}
                            <button className="pk-share-btn"
                              onClick={()=>handleShare(stage, sub, score, pub)}
                              disabled={sharing===stage}>
                              {sharing===stage ? "⏳ Generating..." : /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ? "📤 Share Card" : "⬇️ Download Card"}
                            </button>
                          </div>
                        </>
                      ) : (
                        <div style={{fontSize:13,color:G.muted}}>
                          {isActive&&!isClosed ? (
                            <button className="pk-btn pk-btn-acc" style={{fontSize:12,padding:"6px 12px"}}
                              onClick={()=>setTab("picks")}>
                              Make your picks →
                            </button>
                          ) : "No submission for this stage."}
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}

        {/* ════════ LEADERBOARD TAB ════════ */}
        {tab==="leaderboard" && (
          <div className="pk-wrap">
            {lbTabs.length===0 ? (
              <div className="pk-locked">
                <div className="pk-locked-icon">🔒</div>
                <div className="pk-locked-title">Submissions are hidden until deadline</div>
                <div className="pk-locked-sub">All picks will be visible once the Semifinals deadline passes on Mar 12 at 3:00 PM IST.</div>
              </div>
            ) : (
              <>
                {/* Stage tabs */}
                <div className="pk-lb-tabs">
                  {lbTabs.map(s=>(
                    <button key={s} className={`pk-lb-tab${lbStage===s?" active":""}`} onClick={()=>setLbStage(s)}>
                      {STAGE_LABELS[s]}
                    </button>
                  ))}
                  {showCombined&&(
                    <button className={`pk-lb-tab${lbStage==="combined"?" active":""}`} onClick={()=>setLbStage("combined")}>
                      Combined
                    </button>
                  )}
                </div>

                {/* Single stage leaderboard */}
                {lbStage!=="combined" && (() => {
                  const data = getLbData(lbStage);
                  const pub  = isPublished(lbStage);
                  return (
                    <>
                      {!pub&&<div className="pk-banner amber">⏳ Picks are visible — scores will appear once admin publishes results.</div>}
                      <table className="pk-table">
                        <thead>
                          <tr>
                            <th style={{width:44}}>#</th>
                            <th>User</th>
                            {pub&&<th style={{textAlign:"right",width:70}}>Score</th>}
                            <th>Picks</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.map((s,i)=>{
                            const results=getStageResults(lbStage);
                            return (
                              <tr key={s.docId}>
                                <td className="pk-rank">{pub&&i===0?"🥇":pub&&i===1?"🥈":pub&&i===2?"🥉":i+1}</td>
                                <td><div className="pk-ucell"><span style={{fontWeight:700}}>@{s.username}</span><span className={`pk-plat-chip ${s.platform||"instagram"}`}>{s.platform==="x"?"X":"Instagram"}</span></div></td>
                                {pub&&<td style={{textAlign:"right"}}><span className="pk-score-pill">{s.score} pts</span></td>}
                                <td>
                                  <div className="pk-chips">
                                    {(s.picks||[]).map((p,pi)=>{
                                      const cp=pub&&results[pi]===p; const ct=pub&&!cp&&results.includes(p);
                                      return <span key={pi} className={`pk-chip${cp?" pos":ct?" team":""}`}>#{pi+1} {p}</span>;
                                    })}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                          {!data.length&&<tr><td colSpan={pub?4:3} style={{textAlign:"center",color:G.muted,padding:28}}>No submissions yet.</td></tr>}
                        </tbody>
                      </table>
                      {pub&&<div className="pk-legend">
                        <div className="pk-legend-item"><span className="pk-legend-dot" style={{background:G.green}}/>Correct position (10 pts)</div>
                        <div className="pk-legend-item"><span className="pk-legend-dot" style={{background:G.blue}}/>Correct team (5 pts)</div>
                      </div>}
                    </>
                  );
                })()}

                {/* Combined leaderboard */}
                {lbStage==="combined" && (() => {
                  const data = getCombinedLb();
                  return (
                    <table className="pk-table">
                      <thead>
                        <tr>
                          <th style={{width:44}}>#</th>
                          <th>User</th>
                          {isPublished("semis")&&<th style={{textAlign:"right"}}>Semis</th>}
                          {isPublished("survival")&&<th style={{textAlign:"right"}}>Survival</th>}
                          <th style={{textAlign:"right"}}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.map((u,i)=>(
                          <tr key={u.docId}>
                            <td className="pk-rank">{i===0?"🥇":i===1?"🥈":i===2?"🥉":i+1}</td>
                            <td><div className="pk-ucell"><span style={{fontWeight:700}}>@{u.username}</span><span className={`pk-plat-chip ${u.platform||"instagram"}`}>{u.platform==="x"?"X":"Instagram"}</span></div></td>
                            {isPublished("semis")&&<td style={{textAlign:"right",color:G.muted,fontSize:13}}>{u.semis??"-"}{u.semis!=null?" pts":""}</td>}
                            {isPublished("survival")&&<td style={{textAlign:"right",color:G.muted,fontSize:13}}>{u.survival??"-"}{u.survival!=null?" pts":""}</td>}
                            <td style={{textAlign:"right"}}><span className="pk-score-pill">{u.total} pts</span></td>
                          </tr>
                        ))}
                        {!data.length&&<tr><td colSpan={5} style={{textAlign:"center",color:G.muted,padding:28}}>No data yet.</td></tr>}
                      </tbody>
                    </table>
                  );
                })()}
              </>
            )}
          </div>
        )}

        {/* ════════ ADMIN TAB ════════ */}
        {tab==="admin" && (
          <div className="pk-wrap">
            {!adminUnlocked ? (
              <div className="pk-abox" style={{maxWidth:360}}>
                <div className="pk-atitle">Admin Access</div>
                <div style={{marginBottom:13}}>
                  <div className="pk-alabel">Password</div>
                  <input className="pk-input" type="password" placeholder="Enter admin password"
                    value={adminPassInput} onChange={e=>setAdminPassInput(e.target.value)}
                    onKeyDown={e=>e.key==="Enter"&&handleAdminLogin()}/>
                </div>
                <button className="pk-submit" onClick={handleAdminLogin}>Unlock</button>
              </div>
            ) : (
              <>
                {/* Stage management */}
                <div className="pk-abox">
                  <div className="pk-atitle">Stage Management</div>
                  {STAGE_ORDER.map(stage => {
                    const isActive  = stage===activeStage;
                    const stageIdx  = STAGE_ORDER.indexOf(stage);
                    const activeIdx = STAGE_ORDER.indexOf(activeStage);
                    const isPast    = stageIdx < activeIdx;
                    const isFuture  = stageIdx > activeIdx;
                    const nextStage = STAGE_ORDER[activeIdx+1];

                    return (
                      <div key={stage} className="pk-stage-trigger">
                        <div className="pk-stage-trigger-info">
                          <strong>{STAGE_LABELS[stage]}</strong>
                          {isActive && <span style={{color:G.green,fontWeight:700}}>● Active</span>}
                          {isPast   && <span style={{color:G.muted}}>Completed · {subCounts[stage]||0} submissions</span>}
                          {isFuture && <span style={{color:G.muted}}>Not started</span>}
                        </div>
                        {isActive && nextStage && (
                          <button className="pk-btn pk-btn-blue" onClick={()=>handleStartStage(nextStage)}>
                            Start {STAGE_LABELS[nextStage]} →
                          </button>
                        )}
                        {isFuture && stage==="finals" && (
                          <span style={{fontSize:12,color:G.muted,fontStyle:"italic"}}>Coming soon</span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Stage selector for editing */}
                <div className="pk-abox">
                  <div className="pk-atitle">Edit Stage</div>
                  <div className="pk-platform-toggle" style={{marginBottom:18}}>
                    {STAGE_ORDER.filter(s=>s!=="finals").map(s=>(
                      <button key={s} className={`pk-plat-btn${adminStage===s?" active":""}`} onClick={()=>setAdminStage(s)}>
                        {STAGE_LABELS[s]}
                      </button>
                    ))}
                  </div>

                  {/* Teams */}
                  <div style={{marginBottom:20}}>
                    <div className="pk-atitle" style={{fontSize:14,marginBottom:12}}>Teams — {STAGE_LABELS[adminStage]}</div>
                    <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
                      <input className="pk-input" style={{flex:1,minWidth:180}}
                        placeholder="Tournament page name"
                        value={ae.tournamentName||""}
                        onChange={e=>setAe("tournamentName",e.target.value)}/>
                      <button className="pk-btn pk-btn-acc" onClick={()=>fetchWikiTeams(ae.tournamentName)} disabled={wikiLoading}>
                        {wikiLoading?"Loading...":"Load Teams"}
                      </button>
                    </div>
                    {wikiErr&&<div style={{color:G.red,fontSize:13,marginBottom:10}}>{wikiErr}</div>}
                    <div className="pk-count-row">
                      <span className="pk-count-lbl">Teams that qualify:</span>
                      <input className="pk-count-in" type="number" min={1} max={20}
                        value={ae.qualifyCount||8} onChange={e=>setAe("qualifyCount",parseInt(e.target.value)||8)}/>
                      <span style={{fontSize:13,color:G.muted}}>{(ae.activeTeams||[]).length} of {allWikiTeams.length} selected</span>
                    </div>
                    {allWikiTeams.length>0&&(
                      <>
                        <div className="pk-lbl" style={{marginBottom:8}}>Click to select / deselect</div>
                        <div className="pk-ts-grid">
                          {allWikiTeams.map(t=>{
                            const name=tn(t); const sel=isSelTeam(name);
                            return (
                              <button key={t.team} className={`pk-ts-btn${sel?" sel":""}`} onClick={()=>toggleTeam(t)}>
                                <img className="pk-ts-logo" src={logoUrl(t.image,t.team)} alt="" onError={e=>logoFallback(e,t.team)}/>
                                <div className="pk-ts-name">{name}</div>
                                {sel&&<span style={{fontSize:12}}>✓</span>}
                              </button>
                            );
                          })}
                        </div>
                        <div className="pk-btn-row">
                          <button className="pk-btn pk-btn-green" onClick={handleSaveTeams}>Save Teams ({(ae.activeTeams||[]).length})</button>
                          <button className="pk-btn pk-btn-acc" onClick={()=>setAe("activeTeams",[...allWikiTeams])}>Select All</button>
                          <button className="pk-btn pk-btn-red" onClick={()=>setAe("activeTeams",[])}>Clear All</button>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Results */}
                  <div style={{borderTop:`1px solid ${G.border}`,paddingTop:18}}>
                    <div className="pk-atitle" style={{fontSize:14,marginBottom:12}}>Results — {STAGE_LABELS[adminStage]}</div>
                    <div style={{fontSize:13,color:G.muted,marginBottom:12}}>{subCounts[adminStage]||0} submissions received</div>
                    <div className="pk-agrid">
                      {Array.from({length:ae.qualifyCount||8}).map((_,i)=>(
                        <div key={i}>
                          <div className="pk-alabel">#{i+1}</div>
                          <select className="pk-aselect"
                            value={(ae.results||[])[i]||""}
                            onChange={e=>{const v=e.target.value;const r=[...(ae.results||Array(ae.qualifyCount||8).fill(""))];r[i]=v;setAe("results",r);}}>
                            <option value="">— Select —</option>
                            {(ae.activeTeams||[]).map(t=>{const name=tn(t);return <option key={t.team} value={name}>{name}</option>;})}
                          </select>
                        </div>
                      ))}
                    </div>
                    <div className="pk-btn-row">
                      <button className="pk-btn pk-btn-green" onClick={handleSaveResults}>Save Results</button>
                      {!ae.published
                        ?<button className="pk-btn pk-btn-acc" onClick={()=>handlePublishToggle(true)}>Publish Scores</button>
                        :<button className="pk-btn pk-btn-red" onClick={()=>handlePublishToggle(false)}>Hide Scores</button>}
                      <button className="pk-btn" style={{background:"#6c47ff",color:"#fff"}}
                        onClick={()=>bakeLeaderboard(adminStage, isPublished(adminStage))}>
                        🗜 Bake Leaderboard
                      </button>
                    </div>
                  </div>
                </div>

                {/* Submissions */}
                <div className="pk-abox">
                  <div className="pk-atitle">Submissions — {STAGE_LABELS[adminStage]} ({subCounts[adminStage]||0})</div>
                  <table className="pk-table">
                    <thead>
                      <tr><th>#</th><th>User</th><th>Submitted</th><th>Picks</th><th></th></tr>
                    </thead>
                    <tbody>
                      {[...adminSubs].sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp)).map((s,i)=>(
                        <tr key={s.docId}>
                          <td className="pk-rank">{i+1}</td>
                          <td><div className="pk-ucell"><span style={{fontWeight:700}}>@{s.username}</span><span className={`pk-plat-chip ${s.platform||"instagram"}`}>{s.platform==="x"?"X":"Instagram"}</span></div></td>
                          <td style={{fontSize:12,color:G.muted}}>{fmtTime(s.timestamp)}</td>
                          <td><div className="pk-chips">{(s.picks||[]).map((p,pi)=><span key={pi} className="pk-chip">#{pi+1} {p}</span>)}</div></td>
                          <td><button className="pk-del" onClick={()=>handleDeleteSub(s.docId)}>Delete</button></td>
                        </tr>
                      ))}
                      {!adminSubs.length&&<tr><td colSpan={5} style={{textAlign:"center",color:G.muted,padding:22}}>No submissions.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {toast&&<div className={`pk-toast${toast.type==="error"?" err":""}`}>{toast.msg}</div>}
      </div>
    </>
  );
}
