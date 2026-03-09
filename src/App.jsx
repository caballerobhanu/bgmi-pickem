import { useState, useEffect, useCallback } from "react";
import { initializeApp } from "firebase/app";
import {
  getFirestore, collection, doc,
  setDoc, deleteDoc, onSnapshot
} from "firebase/firestore";
import {
  getAuth, signInWithPopup, signOut,
  GoogleAuthProvider, onAuthStateChanged
} from "firebase/auth";

// ── Firebase config ───────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};
const firebaseApp = initializeApp(firebaseConfig);
const db          = getFirestore(firebaseApp);
const auth        = getAuth(firebaseApp);
const gProvider   = new GoogleAuthProvider();

// Firestore paths
const SUBMISSIONS_COL = "pickem_bmis2026_submissions";
const META_DOC        = "pickem_bmis2026_meta";

// ── Constants ────────────────────────────────────────────────────
const WIKI_BASE  = "https://esportsamaze.in";
const FILE_BASE  = `${WIKI_BASE}/index.php?title=Special:Redirect/file/`;
const DEADLINE   = new Date("2026-03-12T08:30:00Z"); // 2PM IST
const ADMIN_PASS = "bgmi2026admin";

// ── Colors ───────────────────────────────────────────────────────
const G = {
  bg:        "#f4f6f9",
  surface:   "#ffffff",
  card:      "#ffffff",
  border:    "#e2e8f0",
  borderHi:  "#94a3b8",
  accent:    "#e85d04",
  accentDim: "rgba(232,93,4,.08)",
  accentText:"#c44f00",
  blue:      "#2563eb",
  blueDim:   "rgba(37,99,235,.08)",
  green:     "#16a34a",
  greenDim:  "rgba(22,163,74,.08)",
  red:       "#dc2626",
  redDim:    "rgba(220,38,38,.08)",
  text:      "#0f172a",
  textSub:   "#475569",
  muted:     "#94a3b8",
  hero:      "#0f172a",
};

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800;900&family=Barlow:wght@400;500;600;700&display=swap');
  *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
  body { background:${G.bg}; font-family:'Barlow',sans-serif; color:${G.text}; -webkit-font-smoothing:antialiased; }
  .pk-root { min-height:100vh; background:${G.bg}; padding-bottom:60px; }

  /* Hero */
  .pk-hero {
    background:${G.hero}; padding:44px 24px 36px; text-align:center;
    position:relative; overflow:hidden;
  }
  .pk-hero::after {
    content:''; position:absolute; inset:0;
    background:radial-gradient(ellipse at 50% 100%, rgba(232,93,4,.18) 0%, transparent 60%);
    pointer-events:none;
  }
  .pk-hero-eyebrow {
    font-family:'Barlow Condensed',sans-serif; font-size:11px; font-weight:700;
    letter-spacing:.22em; text-transform:uppercase; color:${G.accent}; margin-bottom:12px;
    position:relative; z-index:1;
  }
  .pk-hero-title {
    font-family:'Barlow Condensed',sans-serif;
    font-size:clamp(40px,8vw,72px); font-weight:900; line-height:.9;
    color:#fff; text-transform:uppercase; margin-bottom:12px;
    position:relative; z-index:1;
  }
  .pk-hero-title span { color:${G.accent}; }
  .pk-hero-sub { font-size:14px; color:rgba(255,255,255,.55); margin-bottom:22px; position:relative; z-index:1; }
  .pk-deadline {
    display:inline-flex; align-items:center; gap:8px;
    background:rgba(232,93,4,.15); border:1px solid rgba(232,93,4,.35);
    border-radius:6px; padding:7px 16px; font-size:13px; font-weight:700; color:${G.accent};
    position:relative; z-index:1;
  }
  .pk-deadline.closed { background:rgba(220,38,38,.12); border-color:rgba(220,38,38,.3); color:${G.red}; }

  /* Auth bar */
  .pk-auth-bar {
    background:${G.surface}; border-bottom:1px solid ${G.border};
    padding:10px 20px; display:flex; align-items:center;
    justify-content:space-between; flex-wrap:wrap; gap:10px;
  }
  .pk-auth-info { display:flex; align-items:center; gap:10px; }
  .pk-auth-avatar {
    width:32px; height:32px; border-radius:50%; object-fit:cover;
    border:2px solid ${G.border};
  }
  .pk-auth-avatar-ph {
    width:32px; height:32px; border-radius:50%;
    background:${G.border}; display:flex; align-items:center;
    justify-content:center; font-size:14px; font-weight:700; color:${G.muted};
  }
  .pk-auth-name { font-size:14px; font-weight:700; color:${G.text}; }
  .pk-auth-badge {
    font-size:10px; font-weight:700; padding:2px 7px; border-radius:4px;
    background:${G.blueDim}; border:1px solid rgba(37,99,235,.2); color:${G.blue};
    text-transform:uppercase; letter-spacing:.05em;
  }
  .pk-auth-badge.manual {
    background:rgba(100,116,139,.08); border-color:rgba(100,116,139,.2); color:${G.muted};
  }
  .pk-google-btn {
    display:flex; align-items:center; gap:8px;
    background:${G.surface}; border:1.5px solid ${G.border};
    border-radius:8px; padding:8px 14px; cursor:pointer;
    font-family:inherit; font-size:13px; font-weight:600; color:${G.text};
    transition:all .15s;
  }
  .pk-google-btn:hover { border-color:${G.blue}; background:${G.blueDim}; }
  .pk-google-icon { width:16px; height:16px; }
  .pk-signout-btn {
    background:none; border:1.5px solid ${G.border}; border-radius:8px;
    padding:6px 12px; font-size:12px; font-weight:600; color:${G.muted};
    cursor:pointer; font-family:inherit; transition:all .15s;
  }
  .pk-signout-btn:hover { border-color:${G.red}; color:${G.red}; }
  .pk-manual-toggle {
    font-size:12px; color:${G.muted}; cursor:pointer; text-decoration:underline;
    background:none; border:none; font-family:inherit;
  }
  .pk-manual-toggle:hover { color:${G.text}; }

  /* Scoring legend */
  .pk-scoring {
    background:${G.surface}; border-bottom:1px solid ${G.border};
    padding:10px 24px; display:flex; align-items:center;
    justify-content:center; gap:20px; flex-wrap:wrap;
    font-size:12px; font-weight:600; color:${G.textSub};
  }
  .pk-scoring-item { display:flex; align-items:center; gap:6px; }
  .pk-scoring-dot { width:8px; height:8px; border-radius:50%; display:inline-block; }

  /* Nav */
  .pk-nav {
    display:flex; background:${G.surface};
    border-bottom:2px solid ${G.border}; overflow-x:auto;
    position:sticky; top:0; z-index:10;
    box-shadow:0 1px 3px rgba(0,0,0,.06);
  }
  .pk-nav-btn {
    padding:14px 28px; font-family:'Barlow Condensed',sans-serif;
    font-size:14px; font-weight:700; letter-spacing:.07em; text-transform:uppercase;
    color:${G.muted}; background:none; border:none;
    border-bottom:3px solid transparent; margin-bottom:-2px;
    cursor:pointer; white-space:nowrap; transition:color .15s, border-color .15s;
  }
  .pk-nav-btn:hover { color:${G.text}; }
  .pk-nav-btn.active { color:${G.accent}; border-bottom-color:${G.accent}; }

  /* Container */
  .pk-container { max-width:980px; margin:0 auto; padding:28px 16px 0; }

  /* Steps */
  .pk-steps { display:flex; margin-bottom:24px; border-radius:10px; overflow:hidden; border:1px solid ${G.border}; }
  .pk-step {
    flex:1; padding:12px 8px; text-align:center;
    font-family:'Barlow Condensed',sans-serif; font-size:12px; font-weight:700;
    letter-spacing:.06em; text-transform:uppercase; color:${G.muted};
    background:${G.surface}; border-right:1px solid ${G.border}; transition:all .2s;
  }
  .pk-step:last-child { border-right:none; }
  .pk-step.active { color:${G.accent}; background:${G.accentDim}; }
  .pk-step.done   { color:${G.green};  background:${G.greenDim}; }
  .pk-step-num {
    display:inline-flex; width:20px; height:20px; border-radius:50%;
    background:${G.border}; align-items:center; justify-content:center;
    font-size:11px; margin-right:5px; vertical-align:middle;
  }
  .pk-step.active .pk-step-num { background:${G.accent}; color:#fff; }
  .pk-step.done   .pk-step-num { background:${G.green};  color:#fff; }

  /* Section label */
  .pk-section-label {
    font-family:'Barlow Condensed',sans-serif; font-size:11px; font-weight:700;
    letter-spacing:.16em; text-transform:uppercase; color:${G.muted}; margin-bottom:12px;
  }

  /* Slots */
  .pk-slots { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin-bottom:28px; }
  @media(max-width:580px){ .pk-slots { grid-template-columns:repeat(2,1fr); } }
  .pk-slot {
    background:${G.surface}; border:1.5px solid ${G.border};
    border-radius:10px; padding:10px 12px;
    display:flex; align-items:center; gap:9px;
    min-height:58px; position:relative; transition:all .15s;
  }
  .pk-slot.filled { border-color:${G.accent}; box-shadow:0 0 0 3px ${G.accentDim}; }
  .pk-slot-num {
    font-family:'Barlow Condensed',sans-serif; font-size:20px; font-weight:900;
    color:${G.muted}; min-width:22px; text-align:center;
  }
  .pk-slot.filled .pk-slot-num { color:${G.accent}; }
  .pk-slot-logo { width:30px; height:30px; object-fit:contain; flex-shrink:0; }
  .pk-slot-logo-ph { width:30px; height:30px; border-radius:6px; background:${G.border}; flex-shrink:0; }
  .pk-slot-name {
    font-size:12px; font-weight:700; line-height:1.2; flex:1; min-width:0;
    overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:${G.text};
  }
  .pk-slot-empty .pk-slot-name { color:${G.muted}; font-weight:400; }
  .pk-slot-remove {
    position:absolute; top:5px; right:5px; width:17px; height:17px; border-radius:50%;
    background:${G.redDim}; border:1px solid rgba(220,38,38,.2);
    color:${G.red}; font-size:9px; font-weight:900;
    cursor:pointer; display:flex; align-items:center; justify-content:center;
    opacity:0; transition:opacity .15s;
  }
  .pk-slot:hover .pk-slot-remove { opacity:1; }

  /* Team pool */
  .pk-pool { display:grid; grid-template-columns:repeat(auto-fill,minmax(130px,1fr)); gap:8px; margin-bottom:28px; }
  .pk-team-btn {
    background:${G.surface}; border:1.5px solid ${G.border};
    border-radius:10px; padding:14px 10px 12px;
    display:flex; flex-direction:column; align-items:center; gap:7px;
    cursor:pointer; transition:all .15s; font-family:inherit; position:relative;
  }
  .pk-team-btn:hover:not(:disabled) {
    border-color:${G.accent}; background:${G.accentDim};
    transform:translateY(-2px); box-shadow:0 4px 12px rgba(232,93,4,.12);
  }
  .pk-team-btn.selected { border-color:${G.blue}; background:${G.blueDim}; opacity:.6; cursor:default; transform:none; }
  .pk-team-btn:disabled:not(.selected) { opacity:.4; cursor:not-allowed; }
  .pk-team-logo { width:40px; height:40px; object-fit:contain; }
  .pk-team-logo-ph { width:40px; height:40px; border-radius:8px; background:${G.border}; }
  .pk-team-name { font-size:11px; font-weight:700; color:${G.text}; text-align:center; line-height:1.2; }
  .pk-team-order {
    position:absolute; top:6px; left:6px;
    font-family:'Barlow Condensed',sans-serif; font-size:14px; font-weight:900; color:${G.accent};
    background:${G.accentDim}; border-radius:4px; padding:1px 5px; line-height:1.3;
  }

  /* Form */
  .pk-form { display:flex; flex-direction:column; gap:16px; }
  .pk-input-group { display:flex; flex-direction:column; gap:6px; }
  .pk-label { font-size:12px; font-weight:700; color:${G.textSub}; letter-spacing:.05em; text-transform:uppercase; }
  .pk-input {
    background:${G.surface}; border:1.5px solid ${G.border}; border-radius:8px;
    padding:12px 14px; font-size:15px; font-family:inherit; color:${G.text};
    outline:none; transition:border-color .15s, box-shadow .15s; width:100%;
  }
  .pk-input:focus { border-color:${G.accent}; box-shadow:0 0 0 3px ${G.accentDim}; }
  .pk-input::placeholder { color:${G.muted}; }
  .pk-submit-btn {
    background:${G.accent}; color:#fff;
    font-family:'Barlow Condensed',sans-serif; font-size:17px; font-weight:900;
    letter-spacing:.08em; text-transform:uppercase; border:none; border-radius:10px;
    padding:16px 32px; cursor:pointer; transition:all .15s; width:100%;
    box-shadow:0 4px 14px rgba(232,93,4,.3);
  }
  .pk-submit-btn:hover:not(:disabled) { background:#d45200; transform:translateY(-1px); box-shadow:0 6px 18px rgba(232,93,4,.35); }
  .pk-submit-btn:disabled { opacity:.45; cursor:not-allowed; transform:none; box-shadow:none; }
  .pk-hint { font-size:12px; color:${G.muted}; text-align:center; }

  /* Success */
  .pk-success {
    text-align:center; padding:48px 20px; background:${G.surface};
    border-radius:16px; border:1.5px solid ${G.border};
  }
  .pk-success-icon { font-size:56px; margin-bottom:16px; }
  .pk-success-title {
    font-family:'Barlow Condensed',sans-serif; font-size:28px; font-weight:900;
    text-transform:uppercase; color:${G.green}; margin-bottom:8px;
  }

  /* Toast */
  .pk-toast {
    position:fixed; bottom:24px; left:50%; transform:translateX(-50%);
    background:${G.green}; color:#fff; font-weight:700; font-size:14px;
    padding:12px 24px; border-radius:8px; z-index:999; white-space:nowrap;
    box-shadow:0 4px 16px rgba(0,0,0,.15); animation:toast-in .25s ease;
  }
  .pk-toast.error { background:${G.red}; }
  @keyframes toast-in { from{opacity:0;transform:translateX(-50%) translateY(8px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }

  /* Loading */
  .pk-loading { text-align:center; padding:64px 20px; color:${G.muted}; }
  .pk-spinner {
    width:34px; height:34px; border:3px solid ${G.border};
    border-top-color:${G.accent}; border-radius:50%;
    animation:spin .7s linear infinite; margin:0 auto 16px;
  }
  @keyframes spin { to { transform:rotate(360deg); } }

  /* Table */
  .pk-table {
    width:100%; border-collapse:separate; border-spacing:0;
    background:${G.surface}; border:1.5px solid ${G.border};
    border-radius:12px; overflow:hidden; font-size:13px;
  }
  .pk-table th {
    background:${G.bg}; color:${G.muted}; font-size:10px; font-weight:700;
    letter-spacing:.1em; text-transform:uppercase; padding:10px 14px;
    border-bottom:1.5px solid ${G.border}; text-align:left;
  }
  .pk-table td {
    padding:10px 14px; border-bottom:1px solid ${G.border};
    color:${G.text}; vertical-align:middle;
  }
  .pk-table tr:last-child td { border-bottom:none; }
  .pk-table tr:hover td { background:${G.accentDim}; }
  .pk-rank-num {
    font-family:'Barlow Condensed',sans-serif; font-size:20px; font-weight:900;
    color:${G.muted}; text-align:center; width:44px;
  }
  .pk-score-pill {
    font-family:'Barlow Condensed',sans-serif; font-size:16px;
    font-weight:900; color:${G.accentText};
  }
  .pk-picks-preview { display:flex; flex-wrap:wrap; gap:4px; }
  .pk-pick-chip {
    font-size:10px; font-weight:600; padding:2px 7px; border-radius:4px;
    background:${G.bg}; border:1px solid ${G.border}; color:${G.textSub};
  }
  .pk-pick-chip.correct-pos  { background:${G.greenDim}; border-color:rgba(22,163,74,.3); color:${G.green}; }
  .pk-pick-chip.correct-team { background:${G.blueDim};  border-color:rgba(37,99,235,.3); color:${G.blue}; }

  /* User info in leaderboard */
  .pk-user-cell { display:flex; align-items:center; gap:8px; }
  .pk-user-avatar {
    width:26px; height:26px; border-radius:50%; object-fit:cover;
    border:1.5px solid ${G.border}; flex-shrink:0;
  }
  .pk-user-avatar-ph {
    width:26px; height:26px; border-radius:50%; background:${G.border};
    display:flex; align-items:center; justify-content:center;
    font-size:11px; font-weight:700; color:${G.muted}; flex-shrink:0;
  }
  .pk-user-name { font-weight:700; }
  .pk-user-method {
    font-size:10px; font-weight:600; padding:1px 5px; border-radius:3px;
    text-transform:uppercase; letter-spacing:.04em;
  }
  .pk-user-method.google { background:${G.blueDim}; color:${G.blue}; }
  .pk-user-method.manual { background:rgba(100,116,139,.08); color:${G.muted}; }

  /* Banner */
  .pk-banner {
    border-radius:10px; padding:12px 16px; margin-bottom:20px;
    display:flex; align-items:flex-start; gap:10px;
    font-size:13px; font-weight:600; line-height:1.5;
  }
  .pk-banner.amber { background:rgba(245,158,11,.08); border:1px solid rgba(245,158,11,.25); color:#92400e; }

  /* Admin */
  .pk-admin-box {
    background:${G.surface}; border:1.5px solid ${G.border};
    border-radius:12px; padding:24px; margin-bottom:20px;
  }
  .pk-admin-title {
    font-family:'Barlow Condensed',sans-serif; font-size:17px; font-weight:800;
    text-transform:uppercase; color:${G.text}; margin-bottom:16px;
    padding-bottom:12px; border-bottom:1px solid ${G.border};
  }
  .pk-admin-label { font-size:11px; font-weight:700; color:${G.muted}; margin-bottom:4px; text-transform:uppercase; letter-spacing:.05em; }
  .pk-admin-select {
    background:${G.bg}; border:1.5px solid ${G.border}; border-radius:8px;
    padding:8px 10px; color:${G.text}; font-size:13px; font-family:inherit;
    outline:none; width:100%; transition:border-color .15s;
  }
  .pk-admin-select:focus { border-color:${G.accent}; }
  .pk-admin-grid-results { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-bottom:18px; }
  @media(max-width:580px){ .pk-admin-grid-results { grid-template-columns:repeat(2,1fr); } }
  .pk-btn-row { display:flex; gap:8px; flex-wrap:wrap; }
  .pk-btn {
    font-family:'Barlow Condensed',sans-serif; font-size:13px; font-weight:700;
    letter-spacing:.06em; text-transform:uppercase; border-radius:8px;
    padding:10px 18px; cursor:pointer; transition:all .15s; border:1.5px solid;
  }
  .pk-btn-green  { background:${G.greenDim}; border-color:rgba(22,163,74,.3);  color:${G.green}; }
  .pk-btn-green:hover  { background:rgba(22,163,74,.15); }
  .pk-btn-red    { background:${G.redDim};   border-color:rgba(220,38,38,.3);  color:${G.red}; }
  .pk-btn-red:hover    { background:rgba(220,38,38,.15); }
  .pk-btn-accent { background:${G.accentDim}; border-color:rgba(232,93,4,.3); color:${G.accentText}; }
  .pk-btn-accent:hover { background:rgba(232,93,4,.15); }

  /* Delete btn */
  .pk-delete-btn {
    background:none; border:1px solid ${G.border}; border-radius:6px;
    padding:4px 8px; font-size:11px; font-weight:700; color:${G.muted};
    cursor:pointer; transition:all .15s; font-family:inherit;
  }
  .pk-delete-btn:hover { border-color:${G.red}; color:${G.red}; background:${G.redDim}; }

  /* Team selector */
  .pk-team-selector { display:grid; grid-template-columns:repeat(auto-fill,minmax(120px,1fr)); gap:8px; margin-bottom:16px; }
  .pk-ts-btn {
    background:${G.bg}; border:1.5px solid ${G.border}; border-radius:8px;
    padding:10px 8px; display:flex; flex-direction:column; align-items:center; gap:6px;
    cursor:pointer; font-family:inherit; transition:all .15s;
  }
  .pk-ts-btn:hover { border-color:${G.accent}; background:${G.accentDim}; }
  .pk-ts-btn.ts-selected { border-color:${G.green}; background:${G.greenDim}; }
  .pk-ts-logo { width:32px; height:32px; object-fit:contain; }
  .pk-ts-logo-ph { width:32px; height:32px; border-radius:6px; background:${G.border}; }
  .pk-ts-name { font-size:11px; font-weight:700; text-align:center; line-height:1.2; color:${G.text}; }
  .pk-ts-check { font-size:14px; }
  .pk-count-row { display:flex; align-items:center; gap:10px; margin-bottom:16px; flex-wrap:wrap; }
  .pk-count-label { font-size:13px; font-weight:600; color:${G.textSub}; }
  .pk-count-input {
    width:70px; background:${G.bg}; border:1.5px solid ${G.border}; border-radius:8px;
    padding:8px 10px; font-size:15px; font-family:inherit; color:${G.text}; outline:none; text-align:center;
  }
  .pk-count-input:focus { border-color:${G.accent}; }

  /* Legend */
  .pk-legend { display:flex; gap:14px; flex-wrap:wrap; margin-top:14px; }
  .pk-legend-item { display:flex; align-items:center; gap:5px; font-size:11px; font-weight:600; color:${G.textSub}; }
  .pk-legend-dot { width:9px; height:9px; border-radius:50%; display:inline-block; }
`;

// ── Helpers ───────────────────────────────────────────────────────
function scoreSubmission(picks, results) {
  if (!results || results.filter(Boolean).length === 0) return null;
  let pts = 0;
  picks.forEach((team, idx) => {
    if (results.includes(team)) {
      pts += 5;
      if (results[idx] === team) pts += 5;
    }
  });
  return pts;
}
function logoUrl(filename, teamName) {
  const f = (filename && filename !== "") ? filename : (teamName ? teamName + ".png" : null);
  if (!f) return null;
  return FILE_BASE + encodeURIComponent(f.replace(/ /g, "_"));
}
function logoFallback(e, teamName) {
  const fallback = FILE_BASE + encodeURIComponent((teamName + ".png").replace(/ /g, "_"));
  if (e.target.src !== fallback) { e.target.src = fallback; }
  else { e.target.style.display = "none"; }
}
function teamName(t) {
  return (t.display_name && t.display_name !== "") ? t.display_name : t.team;
}

// Google icon SVG
const GoogleIcon = () => (
  <svg className="pk-google-icon" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

// ── App ───────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("pick");

  // Auth state
  const [googleUser, setGoogleUser]     = useState(null); // Firebase user object
  const [manualName, setManualName]     = useState("");
  const [showManualInput, setShowManualInput] = useState(false);
  const [authLoading, setAuthLoading]   = useState(true);

  // Teams
  const [allWikiTeams, setAllWikiTeams] = useState([]);
  const [wikiLoading, setWikiLoading]   = useState(false);
  const [wikiErr, setWikiErr]           = useState(null);
  const [activeTeams, setActiveTeams]   = useState([]);

  // Picks
  const [picks, setPicks]               = useState([]);
  const [submitting, setSubmitting]     = useState(false);
  const [submitted, setSubmitted]       = useState(false);
  const [toast, setToast]               = useState(null);

  // Firestore
  const [submissions, setSubmissions]   = useState([]);
  const [published, setPublished]       = useState(false);
  const [adminResults, setAdminResults] = useState(Array(8).fill(""));
  const [qualifyCount, setQualifyCount] = useState(8);

  // Admin
  const [adminUnlocked, setAdminUnlocked]     = useState(false);
  const [adminPassInput, setAdminPassInput]   = useState("");
  const [adminTournInput, setAdminTournInput] = useState("");
  const [adminSelectedTeams, setAdminSelectedTeams] = useState([]);
  const [adminQualifyCount, setAdminQualifyCount]   = useState(8);

  const isClosed = new Date() > DEADLINE;

  // ── Auth listener ────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => {
      setGoogleUser(user);
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  // ── Firestore listeners ───────────────────────────────────────
  useEffect(() => {
    const metaRef = doc(db, "pickem", META_DOC);
    const unsubMeta = onSnapshot(metaRef, snap => {
      if (snap.exists()) {
        const d = snap.data();
        setPublished(d.published || false);
        setAdminResults(d.results || Array(8).fill(""));
        const at = (d.activeTeams || []).map(t =>
          typeof t === "string"
            ? { team: t, display_name: "", image: "", image_dark: "" }
            : t
        );
        setActiveTeams(at);
        setQualifyCount(d.qualifyCount || 8);
        if (d.activeTeams) setAdminSelectedTeams(at);
        if (d.qualifyCount) setAdminQualifyCount(d.qualifyCount);
        if (d.tournamentName) setAdminTournInput(d.tournamentName);
      }
    });
    const subsRef = collection(db, "pickem", META_DOC, SUBMISSIONS_COL);
    const unsubSubs = onSnapshot(subsRef, snap => {
      setSubmissions(snap.docs.map(d => d.data()));
    });
    return () => { unsubMeta(); unsubSubs(); };
  }, []);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ── Derived identity ─────────────────────────────────────────
  // docId used as Firestore key — uid for Google, lowercased name for manual
  const identity = googleUser
    ? { name: googleUser.displayName, photo: googleUser.photoURL, method: "google", docId: googleUser.uid }
    : manualName.trim()
    ? { name: manualName.trim(), photo: null, method: "manual", docId: "manual_" + manualName.trim().toLowerCase().replace(/\s+/g,"_") }
    : null;

  // ── Google sign in/out ────────────────────────────────────────
  const handleGoogleSignIn = async () => {
    try {
      await signInWithPopup(auth, gProvider);
      setShowManualInput(false);
    } catch(e) {
      showToast("Sign in failed. Try again.", "error");
    }
  };
  const handleSignOut = async () => {
    await signOut(auth);
    setManualName("");
    setShowManualInput(false);
  };

  // ── Load wiki teams ───────────────────────────────────────────
  const fetchWikiTeams = async (tournamentName) => {
    if (!tournamentName.trim()) { showToast("Enter tournament name", "error"); return; }
    setWikiLoading(true); setWikiErr(null);
    try {
      const url = `${WIKI_BASE}/api.php?action=cargoquery`
        + `&tables=Tournament_Teams`
        + `&fields=team,display_name,image,image_dark`
        + `&where=${encodeURIComponent(`tournament='${tournamentName.trim()}'`)}`
        + `&limit=100&format=json&origin=*`;
      const res  = await fetch(url);
      const data = await res.json();
      const rows = (data.cargoquery || []).map(r => r.title).filter(r => r.team && r.team !== "");
      if (rows.length === 0) throw new Error("No teams found. Check the tournament name.");
      setAllWikiTeams(rows);
    } catch(e) {
      setWikiErr(e.message);
    } finally {
      setWikiLoading(false);
    }
  };

  // ── Pick logic ────────────────────────────────────────────────
  const handlePickTeam = useCallback((name) => {
    if (isClosed) return;
    if (picks.includes(name)) return;
    if (picks.length >= qualifyCount) { showToast(`Already picked ${qualifyCount} teams!`, "error"); return; }
    setPicks(prev => [...prev, name]);
  }, [picks, isClosed, qualifyCount]);

  const handleRemovePick = (idx) => setPicks(prev => prev.filter((_,i) => i !== idx));

  // ── Submit ────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!identity) { showToast("Sign in or enter a username first", "error"); return; }
    if (picks.length < qualifyCount) { showToast(`Pick all ${qualifyCount} teams first`, "error"); return; }
    setSubmitting(true);
    try {
      const subsRef = collection(db, "pickem", META_DOC, SUBMISSIONS_COL);
      await setDoc(doc(subsRef, identity.docId), {
        docId:     identity.docId,
        name:      identity.name,
        photo:     identity.photo || "",
        method:    identity.method,
        picks,
        timestamp: new Date().toISOString(),
      });
      setSubmitted(true);
      showToast("Picks submitted! Good luck!");
    } catch(e) {
      showToast("Failed to save. Try again.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Admin ─────────────────────────────────────────────────────
  const handleAdminLogin = () => {
    if (adminPassInput === ADMIN_PASS) setAdminUnlocked(true);
    else showToast("Wrong password", "error");
  };

  const toggleAdminTeam = (teamObj) => {
    const name = teamName(teamObj);
    setAdminSelectedTeams(prev =>
      prev.some(t => (typeof t === "string" ? t : teamName(t)) === name)
        ? prev.filter(t => (typeof t === "string" ? t : teamName(t)) !== name)
        : [...prev, teamObj]
    );
  };
  const isAdminSelected = (name) =>
    adminSelectedTeams.some(t => (typeof t === "string" ? t : teamName(t)) === name);

  const handleSaveTeams = async () => {
    if (adminSelectedTeams.length === 0) { showToast("Select at least one team", "error"); return; }
    try {
      await setDoc(doc(db, "pickem", META_DOC), {
        activeTeams: adminSelectedTeams,
        qualifyCount: adminQualifyCount,
        tournamentName: adminTournInput,
        published, results: adminResults,
      });
      showToast(`Saved ${adminSelectedTeams.length} teams`);
    } catch(e) { showToast("Save failed", "error"); }
  };

  const handleSaveResults = async () => {
    const filled = adminResults.filter(Boolean);
    if (filled.length < qualifyCount) { showToast(`Fill all ${qualifyCount} positions`, "error"); return; }
    try {
      await setDoc(doc(db, "pickem", META_DOC), { results: adminResults }, { merge: true });
      showToast("Results saved");
    } catch(e) { showToast("Save failed", "error"); }
  };

  const handlePublish = async () => {
    try {
      await setDoc(doc(db, "pickem", META_DOC), { published: true }, { merge: true });
      showToast("Scores published!");
    } catch(e) { showToast("Failed", "error"); }
  };

  const handleUnpublish = async () => {
    try {
      await setDoc(doc(db, "pickem", META_DOC), { published: false }, { merge: true });
      showToast("Scores hidden");
    } catch(e) { showToast("Failed", "error"); }
  };

  const handleDeleteSubmission = async (docId) => {
    if (!window.confirm("Delete this submission?")) return;
    try {
      const subsRef = collection(db, "pickem", META_DOC, SUBMISSIONS_COL);
      await deleteDoc(doc(subsRef, docId));
      showToast("Submission deleted");
    } catch(e) { showToast("Delete failed", "error"); }
  };

  // ── Scored leaderboard ────────────────────────────────────────
  const scoredSubs = published
    ? [...submissions]
        .map(s => ({ ...s, score: scoreSubmission(s.picks, adminResults) }))
        .sort((a,b) => b.score - a.score)
    : [...submissions].sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));

  const step = picks.length < qualifyCount ? 1 : !identity ? 2 : 3;

  // ── Avatar helper ─────────────────────────────────────────────
  const Avatar = ({ photo, name, size = 26 }) => {
    if (photo) return <img className="pk-user-avatar" src={photo} alt="" style={{width:size,height:size}} onError={e=>e.target.style.display='none'}/>;
    return (
      <div className="pk-user-avatar-ph" style={{width:size,height:size,fontSize:size*0.42}}>
        {(name||"?")[0].toUpperCase()}
      </div>
    );
  };

  // ── Render ────────────────────────────────────────────────────
  return (
    <>
      <style>{css}</style>
      <div className="pk-root">

        {/* Hero */}
        <div className="pk-hero">
          <div className="pk-hero-eyebrow">BGMI · BMIS 2026 · Semifinals</div>
          <div className="pk-hero-title">PICK<span>'</span>EM</div>
          <div className="pk-hero-sub">
            Pick the top {qualifyCount} qualifying teams in order
          </div>
          <div className={`pk-deadline${isClosed ? " closed" : ""}`}>
            {isClosed ? "⛔ Submissions Closed" : "⏰ Closes Mar 12, 2026 · 2:00 PM IST"}
          </div>
        </div>

        {/* Auth bar */}
        {!authLoading && (
          <div className="pk-auth-bar">
            {googleUser ? (
              // Signed in with Google
              <div className="pk-auth-info">
                <Avatar photo={googleUser.photoURL} name={googleUser.displayName} size={32}/>
                <div>
                  <div className="pk-auth-name">{googleUser.displayName}</div>
                </div>
                <span className="pk-auth-badge">Google</span>
              </div>
            ) : manualName.trim() ? (
              // Manual username set
              <div className="pk-auth-info">
                <Avatar photo={null} name={manualName} size={32}/>
                <div className="pk-auth-name">{manualName}</div>
                <span className="pk-auth-badge manual">Guest</span>
              </div>
            ) : showManualInput ? (
              // Manual input form
              <div style={{display:"flex", gap:8, alignItems:"center", flexWrap:"wrap"}}>
                <input className="pk-input" style={{width:200, padding:"8px 12px", fontSize:13}}
                  placeholder="Enter your name"
                  value={manualName}
                  onChange={e=>setManualName(e.target.value)}
                  onKeyDown={e=>e.key==="Enter"&&manualName.trim()&&setShowManualInput(false)}/>
                <button className="pk-btn pk-btn-accent"
                  onClick={()=>manualName.trim() && setShowManualInput(false)}>
                  Confirm
                </button>
                <button className="pk-manual-toggle" onClick={()=>setShowManualInput(false)}>Cancel</button>
              </div>
            ) : (
              // Not signed in
              <div style={{display:"flex", gap:10, alignItems:"center", flexWrap:"wrap"}}>
                <span style={{fontSize:13, color:G.textSub}}>Sign in to submit your picks:</span>
                <button className="pk-google-btn" onClick={handleGoogleSignIn}>
                  <GoogleIcon/> Sign in with Google
                </button>
                <button className="pk-manual-toggle" onClick={()=>setShowManualInput(true)}>
                  or continue as guest
                </button>
              </div>
            )}

            {/* Sign out button */}
            {(googleUser || manualName.trim()) && (
              <button className="pk-signout-btn" onClick={googleUser ? handleSignOut : ()=>{setManualName("");setShowManualInput(false);}}>
                {googleUser ? "Sign out" : "Change name"}
              </button>
            )}
          </div>
        )}

        {/* Scoring legend */}
        <div className="pk-scoring">
          <div className="pk-scoring-item">
            <span className="pk-scoring-dot" style={{background:G.green}}/>
            Correct position = 10 pts
          </div>
          <div className="pk-scoring-item">
            <span className="pk-scoring-dot" style={{background:G.blue}}/>
            Correct team, wrong position = 5 pts
          </div>
          <div className="pk-scoring-item" style={{color:G.muted}}>
            Max {qualifyCount * 10} pts
          </div>
        </div>

        {/* Nav */}
        <div className="pk-nav">
          {[
            { id:"pick",        label:"Make Picks" },
            { id:"leaderboard", label:`Submissions (${submissions.length})` },
            { id:"admin",       label:"Admin" },
          ].map(t => (
            <button key={t.id}
              className={`pk-nav-btn${tab===t.id?" active":""}`}
              onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ══ PICK TAB ══ */}
        {tab === "pick" && (
          <div className="pk-container">
            {activeTeams.length === 0 ? (
              <div className="pk-loading">
                <div className="pk-spinner"/>
                Waiting for admin to configure teams...
              </div>
            ) : submitted ? (
              <div className="pk-success">
                <div className="pk-success-icon">✅</div>
                <div className="pk-success-title">Picks Submitted!</div>
                <div style={{color:G.textSub, fontSize:14, marginBottom:20}}>
                  {identity?.name} · {picks.length} teams picked
                </div>
                <div className="pk-picks-preview" style={{justifyContent:"center", marginBottom:24}}>
                  {picks.map((p,i) => <span key={i} className="pk-pick-chip">#{i+1} {p}</span>)}
                </div>
                <button className="pk-submit-btn" style={{maxWidth:260}}
                  onClick={()=>{setSubmitted(false);setPicks([]);}}>
                  Edit Picks
                </button>
              </div>
            ) : isClosed ? (
              <div className="pk-loading">
                <div style={{fontSize:13, color:G.red, fontWeight:600}}>
                  ⛔ Submissions closed on March 12, 2026 at 2:00 PM IST.
                </div>
              </div>
            ) : (
              <>
                {/* Steps */}
                <div className="pk-steps">
                  {[
                    {n:1, l:`Pick ${qualifyCount} Teams`},
                    {n:2, l:"Sign In / Name"},
                    {n:3, l:"Submit"},
                  ].map(s => (
                    <div key={s.n} className={`pk-step${step===s.n?" active":step>s.n?" done":""}`}>
                      <span className="pk-step-num">{step>s.n?"✓":s.n}</span>{s.l}
                    </div>
                  ))}
                </div>

                {/* Slots */}
                <div className="pk-section-label">Your picks — {picks.length}/{qualifyCount}</div>
                <div className="pk-slots">
                  {Array.from({length: qualifyCount}).map((_,i) => {
                    const team  = picks[i];
                    const tData = activeTeams.find(t => teamName(t) === team);
                    return (
                      <div key={i} className={`pk-slot${team?" filled":" pk-slot-empty"}`}>
                        <div className="pk-slot-num">{i+1}</div>
                        {team ? (
                          <>
                            <img className="pk-slot-logo" src={logoUrl(tData?.image, tData?.team)} alt=""
                              onError={e=>logoFallback(e, tData?.team||"")}/>
                            <div className="pk-slot-name">{team}</div>
                            <button className="pk-slot-remove" onClick={()=>handleRemovePick(i)}>✕</button>
                          </>
                        ) : (
                          <div className="pk-slot-name">Empty</div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Team pool */}
                <div className="pk-section-label">
                  {picks.length < qualifyCount
                    ? `Click to pick #${picks.length + 1}`
                    : "All picked — scroll up to review or remove"}
                </div>
                <div className="pk-pool">
                  {activeTeams.map(t => {
                    const name = teamName(t);
                    const sel  = picks.includes(name);
                    const idx  = picks.indexOf(name);
                    return (
                      <button key={t.team}
                        className={`pk-team-btn${sel?" selected":""}`}
                        onClick={() => handlePickTeam(name)}
                        disabled={sel || picks.length >= qualifyCount}>
                        {idx >= 0 && <div className="pk-team-order">#{idx+1}</div>}
                        <img className="pk-team-logo" src={logoUrl(t.image, t.team)} alt=""
                          onError={e=>logoFallback(e, t.team)}/>
                        <div className="pk-team-name">{name}</div>
                      </button>
                    );
                  })}
                </div>

                {/* Submit */}
                {picks.length === qualifyCount && (
                  <div className="pk-form" style={{maxWidth:420}}>
                    {!identity ? (
                      <div style={{background:G.accentDim, border:`1px solid rgba(232,93,4,.2)`, borderRadius:10, padding:"14px 16px", fontSize:13, color:G.accentText, fontWeight:600}}>
                        Please sign in with Google or enter a guest name above to submit your picks.
                      </div>
                    ) : (
                      <>
                        <div style={{display:"flex", alignItems:"center", gap:10, background:G.greenDim, border:`1px solid rgba(22,163,74,.2)`, borderRadius:10, padding:"12px 16px"}}>
                          <Avatar photo={identity.photo} name={identity.name} size={32}/>
                          <div>
                            <div style={{fontSize:13, fontWeight:700}}>{identity.name}</div>
                            <div style={{fontSize:11, color:G.muted}}>Submitting as this name</div>
                          </div>
                        </div>
                        <button className="pk-submit-btn" onClick={handleSubmit} disabled={submitting}>
                          {submitting ? "Submitting..." : "Submit Picks"}
                        </button>
                        <div className="pk-hint">
                          Submitting again with the same account overwrites your previous picks.
                        </div>
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ══ SUBMISSIONS TAB ══ */}
        {tab === "leaderboard" && (
          <div className="pk-container">
            {!published && (
              <div className="pk-banner amber">
                ⏳ Scores will be revealed after the semifinals. All picks are visible now.
              </div>
            )}
            <table className="pk-table">
              <thead>
                <tr>
                  <th style={{width:44}}>#</th>
                  <th>User</th>
                  {published && <th style={{textAlign:"right", width:60}}>Score</th>}
                  <th>Picks</th>
                </tr>
              </thead>
              <tbody>
                {scoredSubs.map((s,i) => (
                  <tr key={s.docId || s.name}>
                    <td className="pk-rank-num">
                      {published && i===0 ? "🥇"
                        : published && i===1 ? "🥈"
                        : published && i===2 ? "🥉"
                        : i+1}
                    </td>
                    <td>
                      <div className="pk-user-cell">
                        <Avatar photo={s.photo} name={s.name} size={26}/>
                        <span className="pk-user-name">{s.name}</span>
                        <span className={`pk-user-method ${s.method||"manual"}`}>
                          {s.method === "google" ? "Google" : "Guest"}
                        </span>
                      </div>
                    </td>
                    {published && (
                      <td style={{textAlign:"right", whiteSpace:"nowrap"}}>
                        <span className="pk-score-pill">{s.score} pts</span>
                      </td>
                    )}
                    <td>
                      <div className="pk-picks-preview">
                        {(s.picks||[]).map((p,pi) => {
                          const correctPos  = published && adminResults[pi] === p;
                          const correctTeam = published && !correctPos && adminResults.includes(p);
                          return (
                            <span key={pi} className={`pk-pick-chip${correctPos?" correct-pos":correctTeam?" correct-team":""}`}>
                              #{pi+1} {p}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                ))}
                {submissions.length === 0 && (
                  <tr>
                    <td colSpan={published?4:3} style={{textAlign:"center", color:G.muted, padding:32}}>
                      No submissions yet. Be the first!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {published && (
              <div className="pk-legend">
                <div className="pk-legend-item">
                  <span className="pk-legend-dot" style={{background:G.green}}/>Correct position (10 pts)
                </div>
                <div className="pk-legend-item">
                  <span className="pk-legend-dot" style={{background:G.blue}}/>Correct team (5 pts)
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ ADMIN TAB ══ */}
        {tab === "admin" && (
          <div className="pk-container">
            {!adminUnlocked ? (
              <div className="pk-admin-box" style={{maxWidth:380}}>
                <div className="pk-admin-title">Admin Access</div>
                <div className="pk-input-group" style={{marginBottom:14}}>
                  <label className="pk-label">Password</label>
                  <input className="pk-input" type="password"
                    placeholder="Enter admin password"
                    value={adminPassInput}
                    onChange={e=>setAdminPassInput(e.target.value)}
                    onKeyDown={e=>e.key==="Enter"&&handleAdminLogin()}/>
                </div>
                <button className="pk-submit-btn" onClick={handleAdminLogin}>Unlock</button>
              </div>
            ) : (
              <>
                {/* Team setup */}
                <div className="pk-admin-box">
                  <div className="pk-admin-title">Step 1 — Select Participating Teams</div>
                  <div style={{display:"flex", gap:8, marginBottom:16, flexWrap:"wrap"}}>
                    <input className="pk-input" style={{flex:1, minWidth:200}}
                      placeholder="Tournament page name e.g. Battlegrounds Mobile India Series 2026"
                      value={adminTournInput}
                      onChange={e=>setAdminTournInput(e.target.value)}/>
                    <button className="pk-btn pk-btn-accent"
                      onClick={()=>fetchWikiTeams(adminTournInput)}
                      disabled={wikiLoading}>
                      {wikiLoading ? "Loading..." : "Load Teams"}
                    </button>
                  </div>
                  {wikiErr && <div style={{color:G.red, fontSize:13, marginBottom:12}}>{wikiErr}</div>}
                  <div className="pk-count-row">
                    <span className="pk-count-label">Teams that qualify:</span>
                    <input className="pk-count-input" type="number" min={1} max={20}
                      value={adminQualifyCount}
                      onChange={e=>setAdminQualifyCount(parseInt(e.target.value)||8)}/>
                    <span style={{fontSize:13, color:G.muted}}>
                      {adminSelectedTeams.length} of {allWikiTeams.length} selected
                    </span>
                  </div>
                  {allWikiTeams.length > 0 && (
                    <>
                      <div className="pk-section-label" style={{marginBottom:10}}>Click to select / deselect</div>
                      <div className="pk-team-selector">
                        {allWikiTeams.map(t => {
                          const name = teamName(t);
                          const sel  = isAdminSelected(name);
                          return (
                            <button key={t.team} className={`pk-ts-btn${sel?" ts-selected":""}`}
                              onClick={()=>toggleAdminTeam(t)}>
                              <img className="pk-ts-logo" src={logoUrl(t.image, t.team)} alt=""
                                onError={e=>logoFallback(e, t.team)}/>
                              <div className="pk-ts-name">{name}</div>
                              {sel && <div className="pk-ts-check">✓</div>}
                            </button>
                          );
                        })}
                      </div>
                      <div className="pk-btn-row">
                        <button className="pk-btn pk-btn-green" onClick={handleSaveTeams}>
                          Save Teams ({adminSelectedTeams.length})
                        </button>
                        <button className="pk-btn pk-btn-accent"
                          onClick={()=>setAdminSelectedTeams([...allWikiTeams])}>
                          Select All
                        </button>
                        <button className="pk-btn pk-btn-red"
                          onClick={()=>setAdminSelectedTeams([])}>
                          Clear All
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {/* Results */}
                <div className="pk-admin-box">
                  <div className="pk-admin-title">Step 2 — Enter Actual Results</div>
                  <div style={{fontSize:13, color:G.muted, marginBottom:14}}>
                    {submissions.length} submissions received
                  </div>
                  <div className="pk-admin-grid-results">
                    {Array.from({length: qualifyCount}).map((_,i) => (
                      <div key={i}>
                        <div className="pk-admin-label">#{i+1} Place</div>
                        <select className="pk-admin-select"
                          value={adminResults[i] || ""}
                          onChange={e => {
                            const v = e.target.value;
                            setAdminResults(prev => { const n=[...prev]; n[i]=v; return n; });
                          }}>
                          <option value="">— Select —</option>
                          {activeTeams.map(t => {
                            const name = teamName(t);
                            return <option key={t.team} value={name}>{name}</option>;
                          })}
                        </select>
                      </div>
                    ))}
                  </div>
                  <div className="pk-btn-row">
                    <button className="pk-btn pk-btn-green" onClick={handleSaveResults}>Save Results</button>
                    {!published
                      ? <button className="pk-btn pk-btn-accent" onClick={handlePublish}>Publish Scores</button>
                      : <button className="pk-btn pk-btn-red" onClick={handleUnpublish}>Hide Scores</button>
                    }
                  </div>
                </div>

                {/* All submissions with delete */}
                <div className="pk-admin-box">
                  <div className="pk-admin-title">All Submissions ({submissions.length})</div>
                  <table className="pk-table">
                    <thead>
                      <tr>
                        <th>#</th><th>User</th><th>Submitted (IST)</th><th>Picks</th><th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...submissions]
                        .sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp))
                        .map((s,i) => (
                        <tr key={s.docId || s.name}>
                          <td className="pk-rank-num">{i+1}</td>
                          <td>
                            <div className="pk-user-cell">
                              <Avatar photo={s.photo} name={s.name} size={24}/>
                              <span style={{fontWeight:700}}>{s.name}</span>
                              <span className={`pk-user-method ${s.method||"manual"}`}>
                                {s.method === "google" ? "Google" : "Guest"}
                              </span>
                            </div>
                          </td>
                          <td style={{fontSize:12, color:G.muted}}>
                            {new Date(s.timestamp).toLocaleString("en-IN",{
                              timeZone:"Asia/Kolkata", day:"2-digit",
                              month:"short", hour:"2-digit", minute:"2-digit"
                            })}
                          </td>
                          <td>
                            <div className="pk-picks-preview">
                              {(s.picks||[]).map((p,pi)=>(
                                <span key={pi} className="pk-pick-chip">#{pi+1} {p}</span>
                              ))}
                            </div>
                          </td>
                          <td>
                            <button className="pk-delete-btn"
                              onClick={()=>handleDeleteSubmission(s.docId || ("manual_" + (s.name||"").toLowerCase().replace(/\s+/g,"_")))}>
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                      {submissions.length===0 && (
                        <tr><td colSpan={5} style={{textAlign:"center",color:G.muted,padding:24}}>No submissions yet.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* Toast */}
        {toast && <div className={`pk-toast${toast.type==="error"?" error":""}`}>{toast.msg}</div>}
      </div>
    </>
  );
}
