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
    setIdLoading(true); setPinError("");
    try {
      const uSnap = await getDoc(doc(db,USERS_COL,pendingDocId));
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

      // Mobile — use Web Share API if supported
      if (navigator.canShare) {
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], filename, { type: "image/png" });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: "BGIS 2026 Pick'em",
            text: `My ${STAGE_LABELS[stage]} picks — make yours at esportsamaze.in`,
            url: "https://esportsamaze.in/BGMI/Tournaments/Battlegrounds_Mobile_India_Series_2026/Pickem",
          });
          return;
        }
      }
      // Desktop fallback — download
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = filename;
      a.click();
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
                              {sharing===stage ? "⏳ Generating..." : navigator.canShare ? "📤 Share Card" : "⬇️ Download Card"}
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
