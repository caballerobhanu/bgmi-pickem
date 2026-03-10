import { useState, useEffect, useCallback } from "react";
import { initializeApp } from "firebase/app";
import {
  getFirestore, collection, doc,
  setDoc, deleteDoc, getDoc, onSnapshot, getDocs
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
  semis:    new Date("2026-03-12T07:30:00Z"), // 1:00 PM IST
  survival: new Date("2026-03-16T07:00:00Z"), // 12:30 PM IST
  finals:   new Date("2099-01-01T00:00:00Z"), // set by admin later
};

// ── Constants ─────────────────────────────────────────────────────
const WIKI_BASE  = "https://esportsamaze.in";
const FILE_BASE  = `${WIKI_BASE}/index.php?title=Special:Redirect/file/`;
const ADMIN_PASS = "bgmi2026admin";
const LS_TOKEN   = "bgis2026_token";
const LS_DOCID   = "bgis2026_docid";

// ── Stage display config ──────────────────────────────────────────
const STAGE_LABELS = {
  semis:    "Semifinals",
  survival: "Survival Stage",
  finals:   "Grand Finals",
};
const STAGE_ORDER = ["semis", "survival", "finals"];

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
    if (results.includes(t)) { pts += 5; if (results[i]===t) pts += 5; }
  });
  return pts;
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
    const unsub = onSnapshot(doc(db, "pickem", META_DOC), snap => {
      if (!snap.exists()) return;
      const d = snap.data();
      setMeta(d);
      setActiveStage(d.activeStage || "semis");
      // Sync admin edits defaults
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
    });
    return unsub;
  }, []);

  // ── Firestore: my picks across all stages ─────────────────────
  useEffect(() => {
    if (!identity) { setMyPicks({}); return; }
    const unsubs = STAGE_ORDER.map(stage => {
      const col = STAGE_COLS[stage];
      const ref = doc(db, "pickem", META_DOC, col, identity.docId);
      return onSnapshot(ref, snap => {
        setMyPicks(prev => ({ ...prev, [stage]: snap.exists() ? snap.data() : null }));
      });
    });
    return () => unsubs.forEach(u => u());
  }, [identity]);

  // ── Firestore: sub counts (always) ───────────────────────────
  useEffect(() => {
    const unsubs = STAGE_ORDER.map(stage => {
      const ref = collection(db, "pickem", META_DOC, STAGE_COLS[stage]);
      return onSnapshot(ref, snap => {
        setSubCounts(prev => ({ ...prev, [stage]: snap.size }));
      });
    });
    return () => unsubs.forEach(u => u());
  }, []);

  // ── Firestore: all submissions post-deadline or admin ─────────
  useEffect(() => {
    if (!meta) return;
    const unsubs = STAGE_ORDER.map(stage => {
      const sd = meta.stages?.[stage];
      if (!sd) return () => {};
      const deadline = DEADLINES[stage];
      const isPast   = new Date() > deadline;
      if (!isPast && !adminUnlocked) return () => {};
      const ref = collection(db, "pickem", META_DOC, STAGE_COLS[stage]);
      return onSnapshot(ref, snap => {
        setAllSubs(prev => ({ ...prev, [stage]: snap.docs.map(d => d.data()) }));
      });
    });
    return () => unsubs.forEach(u => u && u());
  }, [meta, adminUnlocked]);

  // ── Admin: fetch all subs for admin view ─────────────────────
  useEffect(() => {
    if (!adminUnlocked) return;
    const ref = collection(db, "pickem", META_DOC, STAGE_COLS[adminStage]);
    const unsub = onSnapshot(ref, snap => setAdminSubs(snap.docs.map(d => d.data())));
    return unsub;
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
      const uRef   = doc(db, "pickem", USERS_COL, docId);
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
      showToast("Something went wrong. Try again.","error");
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
    await setDoc(doc(db,"pickem",USERS_COL,pendingDocId), { token, platform, username:clean, createdAt:new Date().toISOString() });
    localStorage.setItem(LS_TOKEN, token);
    localStorage.setItem(LS_DOCID, pendingDocId);
    setIdentity({ username:clean, platform, docId:pendingDocId, token, isReturning:false });
    setPinFlow("username"); setPinInput(""); setPinError("");
  };

  // ── Verify PIN (returning, different browser) ─────────────────
  const handleVerifyPin = async () => {
    if (!/^\d{6}$/.test(pinInput)) { setPinError("PIN must be exactly 6 digits"); return; }
    setIdLoading(true); setPinError("");
    try {
      const uSnap = await getDoc(doc(db,"pickem",USERS_COL,pendingDocId));
      const token = await hashPin(pinInput);
      if (uSnap.exists() && uSnap.data().token===token) {
        const clean = usernameInput.trim().replace(/^@/,"").toLowerCase();
        localStorage.setItem(LS_TOKEN, token);
        localStorage.setItem(LS_DOCID, pendingDocId);
        const subSnap = await getDoc(doc(db,"pickem",META_DOC,STAGE_COLS[activeStage],pendingDocId));
        setIdentity({ username:clean, platform, docId:pendingDocId, token, isReturning:true });
        if (subSnap.exists()) setPicks(subSnap.data().picks||[]);
        showToast(`Welcome back @${clean}!`);
        setPinFlow("username"); setPinInput(""); setPinError("");
      } else {
        setPinError("Incorrect PIN. Try again.");
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
  const handleAdminLogin = () => {
    if (adminPassInput===ADMIN_PASS) setAdminUnlocked(true);
    else showToast("Wrong password","error");
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

  const handleSaveResults = async () => {
    const filled = (ae.results||[]).filter(Boolean);
    if (filled.length<(ae.qualifyCount||8)) { showToast(`Fill all ${ae.qualifyCount||8} positions`,"error"); return; }
    try {
      await setDoc(doc(db,"pickem",META_DOC), {
        stages: { ...(meta?.stages||{}), [adminStage]: { ...(meta?.stages?.[adminStage]||{}), results:ae.results } }
      }, { merge:true });
      showToast("Results saved");
    } catch(e) { showToast("Save failed","error"); }
  };

  const handlePublishToggle = async (publish) => {
    try {
      await setDoc(doc(db,"pickem",META_DOC), {
        stages: { ...(meta?.stages||{}), [adminStage]: { ...(meta?.stages?.[adminStage]||{}), published:publish } }
      }, { merge:true });
      showToast(publish ? "Scores published!" : "Scores hidden");
    } catch(e) { showToast("Failed","error"); }
  };

  const handleStartStage = async (stage) => {
    const label = STAGE_LABELS[stage];
    if (!window.confirm(`Start ${label}? Current stage picks will be locked.`)) return;
    try {
      await setDoc(doc(db,"pickem",META_DOC), {
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
      await deleteDoc(doc(db,"pickem",META_DOC,STAGE_COLS[adminStage],docId));
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
      ? [...subs].map(s=>({...s,score:scoreSubmission(s.picks,results)})).sort((a,b)=>b.score-a.score)
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
    })).sort((a,b)=>b.total-a.total);
  };

  // Available lb tabs — only stages with past deadline
  const lbTabs = STAGE_ORDER.filter(s => isDeadlinePast(s));
  const showCombined = lbTabs.filter(s => isPublished(s)).length > 1;

  // ── Step logic ────────────────────────────────────────────────
  const step = !identity ? 1 : picks.length < qualifyCount ? 2 : 3;

  // ── Render ────────────────────────────────────────────────────
  const stageLabel     = STAGE_LABELS[activeStage];
  const deadlineStr    = activeStage==="semis" ? "Mar 12 · 1:00 PM IST" : activeStage==="survival" ? "Mar 16 · 12:30 PM IST" : "TBD";

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
          <span><span className="pk-score-dot" style={{background:G.green}}/>Correct position = 10 pts</span>
          <span><span className="pk-score-dot" style={{background:G.blue}}/>Correct team, wrong position = 5 pts</span>
          <span style={{color:G.muted}}>Max {qualifyCount*10} pts per stage</span>
        </div>

        {/* ── Nav ── */}
        <div className="pk-nav">
          {[
            {id:"picks",       label:"Make Picks"},
            {id:"submissions", label:"My Submissions"},
            {id:"leaderboard", label:"Leaderboard"},
            {id:"admin",       label:"Admin"},
          ].map(t=>(
            <button key={t.id} className={`pk-nav-btn${tab===t.id?" active":""}`} onClick={()=>setTab(t.id)}>
              {t.label}
            </button>
          ))}
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
            ) : isClosed ? (
              <div className="pk-loading" style={{color:G.red,fontWeight:600,fontSize:15}}>
                ⛔ {stageLabel} submissions closed.
              </div>
            ) : (
              <>
                {/* Steps */}
                <div className="pk-steps">
                  {[{n:1,l:"Username"},{n:2,l:`Pick ${qualifyCount} Teams`},{n:3,l:"Submit"}].map(s=>(
                    <div key={s.n} className={`pk-step${step===s.n?" active":step>s.n?" done":""}`}>
                      <span className="pk-step-n">{step>s.n?"✓":s.n}</span>{s.l}
                    </div>
                  ))}
                </div>

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
                {identity && (
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
                <div className="pk-locked-sub">Go to Make Picks, enter your username and PIN to view your submissions.</div>
              </div>
            ) : (
              <>
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

                  return (
                    <div key={stage} className="pk-sub-card">
                      <div className="pk-sub-card-header">
                        <div className="pk-sub-stage-label">{STAGE_LABELS[stage]}</div>
                        {score!==null && <div className="pk-sub-score">{score} pts</div>}
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
                          {isActive&&!isClosed&&(
                            <button className="pk-btn pk-btn-acc" style={{marginTop:10,fontSize:12,padding:"6px 12px"}}
                              onClick={()=>{setPicks(sub.picks||[]);setTab("picks");}}>
                              Edit Picks
                            </button>
                          )}
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
                <div className="pk-locked-sub">All picks will be visible once the Semifinals deadline passes on Mar 12 at 1:00 PM IST.</div>
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
