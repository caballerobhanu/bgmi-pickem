import { useState, useEffect, useCallback } from "react";
import { initializeApp } from "firebase/app";
import {
  getFirestore, collection, doc,
  setDoc, deleteDoc, getDoc, onSnapshot
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

const SUBMISSIONS_COL = "pickem_bgis2026_submissions";
const META_DOC        = "pickem_bgis2026_meta";
const LS_TOKEN_KEY    = "bgis2026_edit_token";   // localStorage key
const LS_DOCID_KEY    = "bgis2026_doc_id";        // localStorage key

// ── Constants ─────────────────────────────────────────────────────
const WIKI_BASE  = "https://esportsamaze.in";
const FILE_BASE  = `${WIKI_BASE}/index.php?title=Special:Redirect/file/`;
const DEADLINE   = new Date("2026-03-12T08:30:00Z"); // 2 PM IST
const ADMIN_PASS = "bgmi2026admin";

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
  .pk-hero { background:${G.hero}; padding:44px 24px 36px; text-align:center; position:relative; overflow:hidden; }
  .pk-hero::after { content:''; position:absolute; inset:0; background:radial-gradient(ellipse at 50% 100%,rgba(232,93,4,.18),transparent 60%); pointer-events:none; }
  .pk-eyebrow { font-family:'Barlow Condensed',sans-serif; font-size:11px; font-weight:700; letter-spacing:.22em; text-transform:uppercase; color:${G.accent}; margin-bottom:12px; position:relative; z-index:1; }
  .pk-title { font-family:'Barlow Condensed',sans-serif; font-size:clamp(40px,8vw,72px); font-weight:900; line-height:.9; color:#fff; text-transform:uppercase; margin-bottom:12px; position:relative; z-index:1; }
  .pk-title span { color:${G.accent}; }
  .pk-hero-sub { font-size:14px; color:rgba(255,255,255,.55); margin-bottom:22px; position:relative; z-index:1; }
  .pk-deadline { display:inline-flex; align-items:center; gap:8px; background:rgba(232,93,4,.15); border:1px solid rgba(232,93,4,.35); border-radius:6px; padding:7px 16px; font-size:13px; font-weight:700; color:${G.accent}; position:relative; z-index:1; }
  .pk-deadline.closed { background:rgba(220,38,38,.12); border-color:rgba(220,38,38,.3); color:${G.red}; }

  /* Scoring bar */
  .pk-score-bar { background:${G.surface}; border-bottom:1px solid ${G.border}; padding:10px 24px; display:flex; align-items:center; justify-content:center; gap:20px; flex-wrap:wrap; font-size:12px; font-weight:600; color:${G.sub}; }
  .pk-score-dot { width:8px; height:8px; border-radius:50%; display:inline-block; margin-right:5px; }

  /* Nav */
  .pk-nav { display:flex; background:${G.surface}; border-bottom:2px solid ${G.border}; overflow-x:auto; position:sticky; top:0; z-index:10; box-shadow:0 1px 3px rgba(0,0,0,.06); }
  .pk-nav-btn { padding:14px 28px; font-family:'Barlow Condensed',sans-serif; font-size:14px; font-weight:700; letter-spacing:.07em; text-transform:uppercase; color:${G.muted}; background:none; border:none; border-bottom:3px solid transparent; margin-bottom:-2px; cursor:pointer; white-space:nowrap; transition:color .15s,border-color .15s; }
  .pk-nav-btn:hover { color:${G.text}; }
  .pk-nav-btn.active { color:${G.accent}; border-bottom-color:${G.accent}; }

  /* Container */
  .pk-wrap { max-width:980px; margin:0 auto; padding:28px 16px 0; }

  /* Steps */
  .pk-steps { display:flex; margin-bottom:24px; border-radius:10px; overflow:hidden; border:1px solid ${G.border}; }
  .pk-step { flex:1; padding:12px 8px; text-align:center; font-family:'Barlow Condensed',sans-serif; font-size:12px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:${G.muted}; background:${G.surface}; border-right:1px solid ${G.border}; transition:all .2s; }
  .pk-step:last-child { border-right:none; }
  .pk-step.active { color:${G.accent}; background:${G.accentDim}; }
  .pk-step.done   { color:${G.green};  background:${G.greenDim}; }
  .pk-step-n { display:inline-flex; width:20px; height:20px; border-radius:50%; background:${G.border}; align-items:center; justify-content:center; font-size:11px; margin-right:5px; vertical-align:middle; }
  .pk-step.active .pk-step-n { background:${G.accent}; color:#fff; }
  .pk-step.done   .pk-step-n { background:${G.green};  color:#fff; }

  /* Username box */
  .pk-ubox { background:${G.surface}; border:1.5px solid ${G.border}; border-radius:12px; padding:28px 24px; margin-bottom:24px; }
  .pk-ubox-title { font-family:'Barlow Condensed',sans-serif; font-size:18px; font-weight:800; text-transform:uppercase; color:${G.text}; margin-bottom:6px; }
  .pk-ubox-sub { font-size:13px; color:${G.sub}; margin-bottom:18px; line-height:1.6; }
  .pk-platform-toggle { display:flex; border:1.5px solid ${G.border}; border-radius:8px; overflow:hidden; width:fit-content; margin-bottom:14px; }
  .pk-plat-btn { padding:7px 18px; font-size:12px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; background:none; border:none; cursor:pointer; font-family:inherit; color:${G.muted}; transition:all .15s; }
  .pk-plat-btn.active { background:${G.text}; color:#fff; }
  .pk-urow { display:flex; gap:8px; flex-wrap:wrap; }

  /* User bar (after confirmed) */
  .pk-ubar { display:flex; align-items:center; gap:10px; background:${G.greenDim}; border:1px solid rgba(22,163,74,.25); border-radius:10px; padding:12px 16px; margin-bottom:24px; flex-wrap:wrap; }
  .pk-ubar-name { font-size:18px; font-weight:900; font-family:'Barlow Condensed',sans-serif; flex:1; }
  .pk-plat-chip { font-size:10px; font-weight:700; padding:2px 8px; border-radius:4px; text-transform:uppercase; letter-spacing:.05em; }
  .pk-plat-chip.instagram { background:rgba(225,48,108,.1); color:#e1306c; }
  .pk-plat-chip.x { background:rgba(0,0,0,.07); color:#000; }
  .pk-edit-chip { font-size:10px; font-weight:700; padding:2px 8px; border-radius:4px; background:${G.accentDim}; border:1px solid rgba(232,93,4,.2); color:${G.accentTxt}; }
  .pk-change-btn { background:none; border:1px solid ${G.border}; border-radius:6px; padding:5px 10px; font-size:11px; font-weight:600; color:${G.muted}; cursor:pointer; font-family:inherit; transition:all .15s; }
  .pk-change-btn:hover { border-color:${G.accent}; color:${G.accentTxt}; }

  /* Section label */
  .pk-lbl { font-family:'Barlow Condensed',sans-serif; font-size:11px; font-weight:700; letter-spacing:.16em; text-transform:uppercase; color:${G.muted}; margin-bottom:12px; }

  /* Slots */
  .pk-slots { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin-bottom:28px; }
  @media(max-width:580px){ .pk-slots { grid-template-columns:repeat(2,1fr); } }
  .pk-slot { background:${G.surface}; border:1.5px solid ${G.border}; border-radius:10px; padding:10px 12px; display:flex; align-items:center; gap:9px; min-height:58px; position:relative; transition:all .15s; }
  .pk-slot.filled { border-color:${G.accent}; box-shadow:0 0 0 3px ${G.accentDim}; }
  .pk-slot-n { font-family:'Barlow Condensed',sans-serif; font-size:20px; font-weight:900; color:${G.muted}; min-width:22px; text-align:center; }
  .pk-slot.filled .pk-slot-n { color:${G.accent}; }
  .pk-slot-logo { width:30px; height:30px; object-fit:contain; flex-shrink:0; }
  .pk-slot-name { font-size:12px; font-weight:700; line-height:1.2; flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .pk-slot.empty .pk-slot-name { color:${G.muted}; font-weight:400; }
  .pk-slot-rm { position:absolute; top:5px; right:5px; width:17px; height:17px; border-radius:50%; background:${G.redDim}; border:1px solid rgba(220,38,38,.2); color:${G.red}; font-size:9px; font-weight:900; cursor:pointer; display:flex; align-items:center; justify-content:center; opacity:0; transition:opacity .15s; }
  .pk-slot:hover .pk-slot-rm { opacity:1; }

  /* Pool */
  .pk-pool { display:grid; grid-template-columns:repeat(auto-fill,minmax(130px,1fr)); gap:8px; margin-bottom:28px; }
  .pk-team { background:${G.surface}; border:1.5px solid ${G.border}; border-radius:10px; padding:14px 10px 12px; display:flex; flex-direction:column; align-items:center; gap:7px; cursor:pointer; transition:all .15s; font-family:inherit; position:relative; }
  .pk-team:hover:not(:disabled) { border-color:${G.accent}; background:${G.accentDim}; transform:translateY(-2px); box-shadow:0 4px 12px rgba(232,93,4,.12); }
  .pk-team.sel { border-color:${G.blue}; background:${G.blueDim}; opacity:.6; cursor:default; transform:none; }
  .pk-team:disabled:not(.sel) { opacity:.4; cursor:not-allowed; }
  .pk-team-logo { width:40px; height:40px; object-fit:contain; }
  .pk-team-name { font-size:11px; font-weight:700; color:${G.text}; text-align:center; line-height:1.2; }
  .pk-team-order { position:absolute; top:6px; left:6px; font-family:'Barlow Condensed',sans-serif; font-size:14px; font-weight:900; color:${G.accent}; background:${G.accentDim}; border-radius:4px; padding:1px 5px; line-height:1.3; }

  /* Inputs & buttons */
  .pk-input { background:${G.surface}; border:1.5px solid ${G.border}; border-radius:8px; padding:12px 14px; font-size:15px; font-family:inherit; color:${G.text}; outline:none; transition:border-color .15s,box-shadow .15s; width:100%; }
  .pk-input:focus { border-color:${G.accent}; box-shadow:0 0 0 3px ${G.accentDim}; }
  .pk-input::placeholder { color:${G.muted}; }
  .pk-submit { background:${G.accent}; color:#fff; font-family:'Barlow Condensed',sans-serif; font-size:17px; font-weight:900; letter-spacing:.08em; text-transform:uppercase; border:none; border-radius:10px; padding:16px 32px; cursor:pointer; transition:all .15s; width:100%; box-shadow:0 4px 14px rgba(232,93,4,.3); }
  .pk-submit:hover:not(:disabled) { background:#d45200; transform:translateY(-1px); }
  .pk-submit:disabled { opacity:.45; cursor:not-allowed; transform:none; box-shadow:none; }
  .pk-hint { font-size:12px; color:${G.muted}; text-align:center; }
  .pk-btn { font-family:'Barlow Condensed',sans-serif; font-size:13px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; border-radius:8px; padding:10px 18px; cursor:pointer; transition:all .15s; border:1.5px solid; }
  .pk-btn-green  { background:${G.greenDim}; border-color:rgba(22,163,74,.3); color:${G.green}; }
  .pk-btn-green:hover { background:rgba(22,163,74,.15); }
  .pk-btn-red    { background:${G.redDim}; border-color:rgba(220,38,38,.3); color:${G.red}; }
  .pk-btn-red:hover { background:rgba(220,38,38,.15); }
  .pk-btn-acc    { background:${G.accentDim}; border-color:rgba(232,93,4,.3); color:${G.accentTxt}; }
  .pk-btn-acc:hover { background:rgba(232,93,4,.15); }

  /* Toast */
  .pk-toast { position:fixed; bottom:24px; left:50%; transform:translateX(-50%); background:${G.green}; color:#fff; font-weight:700; font-size:14px; padding:12px 24px; border-radius:8px; z-index:999; white-space:nowrap; box-shadow:0 4px 16px rgba(0,0,0,.15); animation:toast-in .25s ease; }
  .pk-toast.err { background:${G.red}; }
  @keyframes toast-in { from{opacity:0;transform:translateX(-50%) translateY(8px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }

  /* Loading */
  .pk-loading { text-align:center; padding:64px 20px; color:${G.muted}; }
  .pk-spinner { width:34px; height:34px; border:3px solid ${G.border}; border-top-color:${G.accent}; border-radius:50%; animation:spin .7s linear infinite; margin:0 auto 16px; }
  @keyframes spin { to{transform:rotate(360deg)} }

  /* Success */
  .pk-success { text-align:center; padding:48px 20px; background:${G.surface}; border-radius:16px; border:1.5px solid ${G.border}; }
  .pk-success-icon { font-size:56px; margin-bottom:16px; }
  .pk-success-title { font-family:'Barlow Condensed',sans-serif; font-size:28px; font-weight:900; text-transform:uppercase; color:${G.green}; margin-bottom:8px; }

  /* Token info box */
  .pk-token-box { background:rgba(245,158,11,.06); border:1px solid rgba(245,158,11,.3); border-radius:10px; padding:14px 16px; margin-top:18px; font-size:12px; color:#92400e; line-height:1.6; }
  .pk-token-box strong { display:block; font-size:13px; margin-bottom:4px; }

  /* Table */
  .pk-table { width:100%; border-collapse:separate; border-spacing:0; background:${G.surface}; border:1.5px solid ${G.border}; border-radius:12px; overflow:hidden; font-size:13px; }
  .pk-table th { background:${G.bg}; color:${G.muted}; font-size:10px; font-weight:700; letter-spacing:.1em; text-transform:uppercase; padding:10px 14px; border-bottom:1.5px solid ${G.border}; text-align:left; }
  .pk-table td { padding:10px 14px; border-bottom:1px solid ${G.border}; vertical-align:middle; }
  .pk-table tr:last-child td { border-bottom:none; }
  .pk-table tr:hover td { background:${G.accentDim}; }
  .pk-rank { font-family:'Barlow Condensed',sans-serif; font-size:20px; font-weight:900; color:${G.muted}; text-align:center; width:44px; }
  .pk-score-pill { font-family:'Barlow Condensed',sans-serif; font-size:16px; font-weight:900; color:${G.accentTxt}; }
  .pk-chips { display:flex; flex-wrap:wrap; gap:4px; }
  .pk-chip { font-size:10px; font-weight:600; padding:2px 7px; border-radius:4px; background:${G.bg}; border:1px solid ${G.border}; color:${G.sub}; }
  .pk-chip.pos  { background:${G.greenDim}; border-color:rgba(22,163,74,.3); color:${G.green}; }
  .pk-chip.team { background:${G.blueDim};  border-color:rgba(37,99,235,.3); color:${G.blue}; }
  .pk-ucell { display:flex; align-items:center; gap:7px; }

  /* Locked submissions banner */
  .pk-locked { background:${G.surface}; border:1.5px solid ${G.border}; border-radius:12px; padding:40px 24px; text-align:center; }
  .pk-locked-icon { font-size:40px; margin-bottom:12px; }
  .pk-locked-title { font-family:'Barlow Condensed',sans-serif; font-size:22px; font-weight:900; text-transform:uppercase; color:${G.text}; margin-bottom:8px; }
  .pk-locked-sub { font-size:13px; color:${G.sub}; line-height:1.6; }

  /* Banner */
  .pk-banner { border-radius:10px; padding:12px 16px; margin-bottom:20px; font-size:13px; font-weight:600; line-height:1.5; }
  .pk-banner.amber { background:rgba(245,158,11,.08); border:1px solid rgba(245,158,11,.25); color:#92400e; }

  /* Admin */
  .pk-abox { background:${G.surface}; border:1.5px solid ${G.border}; border-radius:12px; padding:24px; margin-bottom:20px; }
  .pk-atitle { font-family:'Barlow Condensed',sans-serif; font-size:17px; font-weight:800; text-transform:uppercase; color:${G.text}; margin-bottom:16px; padding-bottom:12px; border-bottom:1px solid ${G.border}; }
  .pk-alabel { font-size:11px; font-weight:700; color:${G.muted}; margin-bottom:4px; text-transform:uppercase; letter-spacing:.05em; }
  .pk-aselect { background:${G.bg}; border:1.5px solid ${G.border}; border-radius:8px; padding:8px 10px; color:${G.text}; font-size:13px; font-family:inherit; outline:none; width:100%; }
  .pk-aselect:focus { border-color:${G.accent}; }
  .pk-agrid { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-bottom:18px; }
  @media(max-width:580px){ .pk-agrid { grid-template-columns:repeat(2,1fr); } }
  .pk-btn-row { display:flex; gap:8px; flex-wrap:wrap; }
  .pk-del { background:none; border:1px solid ${G.border}; border-radius:6px; padding:4px 8px; font-size:11px; font-weight:700; color:${G.muted}; cursor:pointer; transition:all .15s; font-family:inherit; }
  .pk-del:hover { border-color:${G.red}; color:${G.red}; background:${G.redDim}; }
  .pk-ts-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(120px,1fr)); gap:8px; margin-bottom:16px; }
  .pk-ts-btn { background:${G.bg}; border:1.5px solid ${G.border}; border-radius:8px; padding:10px 8px; display:flex; flex-direction:column; align-items:center; gap:6px; cursor:pointer; font-family:inherit; transition:all .15s; }
  .pk-ts-btn:hover { border-color:${G.accent}; background:${G.accentDim}; }
  .pk-ts-btn.sel { border-color:${G.green}; background:${G.greenDim}; }
  .pk-ts-logo { width:32px; height:32px; object-fit:contain; }
  .pk-ts-name { font-size:11px; font-weight:700; text-align:center; line-height:1.2; color:${G.text}; }
  .pk-count-row { display:flex; align-items:center; gap:10px; margin-bottom:16px; flex-wrap:wrap; }
  .pk-count-lbl { font-size:13px; font-weight:600; color:${G.sub}; }
  .pk-count-in { width:70px; background:${G.bg}; border:1.5px solid ${G.border}; border-radius:8px; padding:8px 10px; font-size:15px; font-family:inherit; color:${G.text}; outline:none; text-align:center; }
  .pk-count-in:focus { border-color:${G.accent}; }
  .pk-legend { display:flex; gap:14px; flex-wrap:wrap; margin-top:14px; }
  .pk-legend-item { display:flex; align-items:center; gap:5px; font-size:11px; font-weight:600; color:${G.sub}; }
  .pk-legend-dot { width:9px; height:9px; border-radius:50%; display:inline-block; }

  /* PIN screen */
  .pk-pin-box { background:${G.surface}; border:1.5px solid ${G.border}; border-radius:12px; padding:28px 24px; margin-bottom:24px; }
  .pk-pin-title { font-family:'Barlow Condensed',sans-serif; font-size:18px; font-weight:800; text-transform:uppercase; color:${G.text}; margin-bottom:6px; }
  .pk-pin-sub { font-size:13px; color:${G.sub}; margin-bottom:20px; line-height:1.6; }
  .pk-pin-input { background:${G.bg}; border:2px solid ${G.border}; border-radius:10px; padding:16px; font-size:32px; font-family:'Barlow Condensed',sans-serif; font-weight:900; letter-spacing:.3em; color:${G.text}; outline:none; width:100%; text-align:center; transition:border-color .15s; }
  .pk-pin-input:focus { border-color:${G.accent}; }
  .pk-pin-input.err { border-color:${G.red}; }
  .pk-pin-error { font-size:12px; color:${G.red}; font-weight:600; margin-top:8px; }
  .pk-pin-back { background:none; border:none; font-size:12px; color:${G.muted}; cursor:pointer; font-family:inherit; text-decoration:underline; margin-top:10px; display:inline-block; }
  .pk-pin-back:hover { color:${G.text}; }
`;

// ── Helpers ───────────────────────────────────────────────────────
async function hashPin(pin) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pin));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,"0")).join("");
}
function scoreSubmission(picks, results) {
  if (!results || !results.filter(Boolean).length) return null;
  let pts = 0;
  picks.forEach((t, i) => {
    if (results.includes(t)) { pts += 5; if (results[i] === t) pts += 5; }
  });
  return pts;
}
function logoUrl(filename, tName) {
  const f = (filename && filename !== "") ? filename : (tName ? tName + ".png" : null);
  if (!f) return "";
  return FILE_BASE + encodeURIComponent(f.replace(/ /g, "_"));
}
function logoFallback(e, tName) {
  const fb = FILE_BASE + encodeURIComponent((tName + ".png").replace(/ /g, "_"));
  if (e.target.src !== fb) e.target.src = fb;
  else e.target.style.display = "none";
}
function tName(t) {
  return (t.display_name && t.display_name !== "") ? t.display_name : t.team;
}

// ── App ───────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("pick");

  // Identity & token
  const [platform, setPlatform]         = useState("instagram");
  const [usernameInput, setUsernameInput] = useState("");
  const [identity, setIdentity]         = useState(null); // { username, platform, docId, token, isReturning }
  const [identityLoading, setIdentityLoading] = useState(false);
  // PIN flow states: "username" | "pin_new" | "pin_verify"
  const [pinFlow, setPinFlow]       = useState("username");
  const [pinInput, setPinInput]     = useState("");
  const [pinError, setPinError]     = useState("");
  const [pendingDocId, setPendingDocId] = useState(null); // docId waiting for PIN

  // Teams
  const [allWikiTeams, setAllWikiTeams] = useState([]);
  const [wikiLoading, setWikiLoading]   = useState(false);
  const [wikiErr, setWikiErr]           = useState(null);
  const [activeTeams, setActiveTeams]   = useState([]);

  // Picks
  const [picks, setPicks]           = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(false);
  const [toast, setToast]           = useState(null);

  // Firestore
  const [mySubmission, setMySubmission] = useState(null); // own submission
  const [allSubmissions, setAllSubmissions] = useState([]); // only post-deadline
  const [published, setPublished]       = useState(false);
  const [adminResults, setAdminResults] = useState(Array(8).fill(""));
  const [qualifyCount, setQualifyCount] = useState(8);

  // Admin
  const [adminUnlocked, setAdminUnlocked]     = useState(false);
  const [adminPassInput, setAdminPassInput]   = useState("");
  const [adminTournInput, setAdminTournInput] = useState("");
  const [adminSelectedTeams, setAdminSelectedTeams] = useState([]);
  const [adminQualifyCount, setAdminQualifyCount]   = useState(8);
  const [subCount, setSubCount] = useState(0);

  const isClosed = new Date() > DEADLINE;
  const isDeadlinePassed = isClosed; // same — after deadline, show all

  // ── Restore identity from localStorage on mount ───────────────
  useEffect(() => {
    const savedToken = localStorage.getItem(LS_TOKEN_KEY);
    const savedDocId = localStorage.getItem(LS_DOCID_KEY);
    if (savedToken && savedDocId) {
      // Restore identity silently from localStorage
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
      setPublished(d.published || false);
      setAdminResults(d.results || Array(8).fill(""));
      const at = (d.activeTeams || []).map(t =>
        typeof t === "string" ? { team:t, display_name:"", image:"", image_dark:"" } : t
      );
      setActiveTeams(at);
      setQualifyCount(d.qualifyCount || 8);
      if (d.activeTeams) setAdminSelectedTeams(at);
      if (d.qualifyCount) setAdminQualifyCount(d.qualifyCount);
      if (d.tournamentName) setAdminTournInput(d.tournamentName);
    });
    return unsub;
  }, []);

  // ── Firestore: own submission (real-time) ─────────────────────
  useEffect(() => {
    if (!identity) { setMySubmission(null); return; }
    const ref = doc(db, "pickem", META_DOC, SUBMISSIONS_COL, identity.docId);
    const unsub = onSnapshot(ref, snap => {
      setMySubmission(snap.exists() ? snap.data() : null);
    });
    return unsub;
  }, [identity]);

  // ── Firestore: all submissions (only after deadline or admin) ─
  useEffect(() => {
    if (!isDeadlinePassed && !adminUnlocked) return;
    const ref = collection(db, "pickem", META_DOC, SUBMISSIONS_COL);
    const unsub = onSnapshot(ref, snap => {
      const docs = snap.docs.map(d => d.data());
      setAllSubmissions(docs);
      setSubCount(docs.length);
    });
    return unsub;
  }, [isDeadlinePassed, adminUnlocked]);

  // Sub count for nav (always)
  useEffect(() => {
    const ref = collection(db, "pickem", META_DOC, SUBMISSIONS_COL);
    const unsub = onSnapshot(ref, snap => setSubCount(snap.size));
    return unsub;
  }, []);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Step 1: Check username ───────────────────────────────────
  const handleConfirm = async () => {
    const clean = usernameInput.trim().replace(/^@/, "").toLowerCase();
    if (!clean || clean.length < 2) { showToast("Enter a valid username", "error"); return; }
    setIdentityLoading(true); setPinError("");
    try {
      const docId = `${platform}_${clean}`;
      const subRef = doc(db, "pickem", META_DOC, SUBMISSIONS_COL, docId);
      const existing = await getDoc(subRef);

      if (existing.exists()) {
        // Username already submitted
        const savedDocId = localStorage.getItem(LS_DOCID_KEY);
        const savedToken = localStorage.getItem(LS_TOKEN_KEY);
        if (savedDocId === docId && savedToken === existing.data().token) {
          // Same browser — auto login
          setIdentity({ username: clean, platform, docId, token: savedToken, isReturning: true });
          setPicks(existing.data().picks || []);
          showToast(`Welcome back @${clean}! Update your picks.`);
        } else {
          // Different browser — ask for PIN
          setPendingDocId(docId);
          setPinFlow("pin_verify");
        }
      } else {
        // New user — ask them to set a PIN
        setPendingDocId(docId);
        setPinFlow("pin_new");
      }
    } catch(e) {
      showToast("Something went wrong. Try again.", "error");
    } finally {
      setIdentityLoading(false);
    }
  };

  // ── Step 2a: New user sets PIN ────────────────────────────────
  const handleSetPin = async () => {
    if (!/^\d{6}$/.test(pinInput)) { setPinError("PIN must be exactly 6 digits"); return; }
    const clean = usernameInput.trim().replace(/^@/, "").toLowerCase();
    const token = await hashPin(pinInput);
    localStorage.setItem(LS_TOKEN_KEY, token);
    localStorage.setItem(LS_DOCID_KEY, pendingDocId);
    setIdentity({ username: clean, platform, docId: pendingDocId, token, isReturning: false });
    setPinFlow("username"); setPinInput(""); setPinError("");
  };

  // ── Step 2b: Returning user verifies PIN ──────────────────────
  const handleVerifyPin = async () => {
    if (!/^\d{6}$/.test(pinInput)) { setPinError("PIN must be exactly 6 digits"); return; }
    setIdentityLoading(true); setPinError("");
    try {
      const subRef = doc(db, "pickem", META_DOC, SUBMISSIONS_COL, pendingDocId);
      const existing = await getDoc(subRef);
      const token = await hashPin(pinInput);
      if (existing.exists() && existing.data().token === token) {
        const clean = usernameInput.trim().replace(/^@/, "").toLowerCase();
        localStorage.setItem(LS_TOKEN_KEY, token);
        localStorage.setItem(LS_DOCID_KEY, pendingDocId);
        setIdentity({ username: clean, platform, docId: pendingDocId, token, isReturning: true });
        setPicks(existing.data().picks || []);
        showToast(`Welcome back @${clean}!`);
        setPinFlow("username"); setPinInput(""); setPinError("");
      } else {
        setPinError("Incorrect PIN. Try again.");
      }
    } catch(e) {
      setPinError("Something went wrong. Try again.");
    } finally {
      setIdentityLoading(false);
    }
  };

  // ── Pick logic ────────────────────────────────────────────────
  const handlePickTeam = useCallback((name) => {
    if (isClosed || !identity) return;
    if (picks.includes(name)) return;
    if (picks.length >= qualifyCount) { showToast(`Already picked ${qualifyCount} teams!`, "error"); return; }
    setPicks(prev => [...prev, name]);
  }, [picks, isClosed, qualifyCount, identity]);

  const handleRemovePick = (idx) => setPicks(prev => prev.filter((_,i) => i !== idx));

  // ── Submit ────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!identity) return;
    if (picks.length < qualifyCount) { showToast(`Pick all ${qualifyCount} teams`, "error"); return; }
    setSubmitting(true);
    try {
      await setDoc(doc(db, "pickem", META_DOC, SUBMISSIONS_COL, identity.docId), {
        docId:     identity.docId,
        username:  identity.username,
        platform:  identity.platform,
        token:     identity.token,   // stored server-side for verification
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
    if (adminPassInput === ADMIN_PASS) {
      setAdminUnlocked(true);
    } else showToast("Wrong password", "error");
  };

  const toggleTeam = (teamObj) => {
    const name = tName(teamObj);
    setAdminSelectedTeams(prev =>
      prev.some(t => (typeof t === "string" ? t : tName(t)) === name)
        ? prev.filter(t => (typeof t === "string" ? t : tName(t)) !== name)
        : [...prev, teamObj]
    );
  };
  const isSelTeam = (name) =>
    adminSelectedTeams.some(t => (typeof t === "string" ? t : tName(t)) === name);

  const handleSaveTeams = async () => {
    if (!adminSelectedTeams.length) { showToast("Select at least one team", "error"); return; }
    try {
      await setDoc(doc(db, "pickem", META_DOC), {
        activeTeams: adminSelectedTeams, qualifyCount: adminQualifyCount,
        tournamentName: adminTournInput, published, results: adminResults,
      });
      showToast(`Saved ${adminSelectedTeams.length} teams`);
    } catch(e) { showToast("Save failed", "error"); }
  };

  const handleSaveResults = async () => {
    if (adminResults.filter(Boolean).length < qualifyCount) {
      showToast(`Fill all ${qualifyCount} positions`, "error"); return;
    }
    try {
      await setDoc(doc(db, "pickem", META_DOC), { results: adminResults }, { merge: true });
      showToast("Results saved");
    } catch(e) { showToast("Save failed", "error"); }
  };

  const handlePublish  = async () => { try { await setDoc(doc(db,"pickem",META_DOC),{published:true},{merge:true}); showToast("Scores published!"); } catch{ showToast("Failed","error"); } };
  const handleUnpublish= async () => { try { await setDoc(doc(db,"pickem",META_DOC),{published:false},{merge:true}); showToast("Scores hidden"); } catch{ showToast("Failed","error"); } };

  const handleDelete = async (docId) => {
    if (!window.confirm("Delete this submission?")) return;
    try {
      await deleteDoc(doc(db, "pickem", META_DOC, SUBMISSIONS_COL, docId));
      showToast("Deleted");
    } catch { showToast("Delete failed", "error"); }
  };

  const fetchWikiTeams = async (tName_) => {
    if (!tName_.trim()) { showToast("Enter tournament name", "error"); return; }
    setWikiLoading(true); setWikiErr(null);
    try {
      const url = `${WIKI_BASE}/api.php?action=cargoquery&tables=Tournament_Teams`
        + `&fields=team,display_name,image,image_dark`
        + `&where=${encodeURIComponent(`tournament='${tName_.trim()}'`)}`
        + `&limit=100&format=json&origin=*`;
      const data = await (await fetch(url)).json();
      const rows = (data.cargoquery||[]).map(r=>r.title).filter(r=>r.team&&r.team!=="");
      if (!rows.length) throw new Error("No teams found. Check the tournament name.");
      setAllWikiTeams(rows);
    } catch(e) { setWikiErr(e.message); }
    finally { setWikiLoading(false); }
  };

  // ── Leaderboard data ──────────────────────────────────────────
  const scoredSubs = published
    ? [...allSubmissions].map(s=>({...s,score:scoreSubmission(s.picks,adminResults)})).sort((a,b)=>b.score-a.score)
    : [...allSubmissions].sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp));

  const step = !identity ? 1 : picks.length < qualifyCount ? 2 : 3;

  // ── Render ────────────────────────────────────────────────────
  return (
    <>
      <style>{css}</style>
      <div className="pk">

        {/* ── Hero ── */}
        <div className="pk-hero">
          <div className="pk-eyebrow">BGMI · BGIS 2026 · Semifinals</div>
          <div className="pk-title">PICK<span>'</span>EM</div>
          <div className="pk-hero-sub">Pick the top {qualifyCount} qualifying teams in order</div>
          <div className={`pk-deadline${isClosed?" closed":""}`}>
            {isClosed ? "⛔ Submissions Closed" : "⏰ Closes Mar 12, 2026 · 2:00 PM IST"}
          </div>
        </div>

        {/* ── Scoring bar ── */}
        <div className="pk-score-bar">
          <span><span className="pk-score-dot" style={{background:G.green}}/>Correct position = 10 pts</span>
          <span><span className="pk-score-dot" style={{background:G.blue}}/>Correct team, wrong position = 5 pts</span>
          <span style={{color:G.muted}}>Max {qualifyCount*10} pts</span>
        </div>

        {/* ── Nav ── */}
        <div className="pk-nav">
          {[
            {id:"pick",        label:"Make Picks"},
            {id:"leaderboard", label:`Submissions (${subCount})`},
            {id:"admin",       label:"Admin"},
          ].map(t=>(
            <button key={t.id} className={`pk-nav-btn${tab===t.id?" active":""}`} onClick={()=>setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ════════ PICK TAB ════════ */}
        {tab==="pick" && (
          <div className="pk-wrap">
            {activeTeams.length===0 ? (
              <div className="pk-loading"><div className="pk-spinner"/>Waiting for admin to configure teams...</div>
            ) : submitted ? (
              <div className="pk-success">
                <div className="pk-success-icon">✅</div>
                <div className="pk-success-title">Picks Submitted!</div>
                <div style={{color:G.sub,fontSize:14,marginBottom:20}}>@{identity?.username} · {picks.length} teams picked</div>
                <div className="pk-chips" style={{justifyContent:"center",marginBottom:24}}>
                  {picks.map((p,i)=><span key={i} className="pk-chip">#{i+1} {p}</span>)}
                </div>
                <button className="pk-submit" style={{maxWidth:260}} onClick={()=>{setSubmitted(false);setPicks([]);}}>
                  Edit Picks
                </button>
                <div className="pk-token-box">
                  <strong>📱 Want to edit from another device?</strong>
                  Your picks are saved to this browser. To edit from another device, you must use the same browser on this device.
                </div>
              </div>
            ) : isClosed ? (
              <div className="pk-loading" style={{color:G.red,fontWeight:600,fontSize:15}}>
                ⛔ Submissions closed on March 12, 2026 at 2:00 PM IST.
              </div>
            ) : (
              <>
                {/* Steps */}
                <div className="pk-steps">
                  {[{n:1,l:"Enter Username"},{n:2,l:`Pick ${qualifyCount} Teams`},{n:3,l:"Submit"}].map(s=>(
                    <div key={s.n} className={`pk-step${step===s.n?" active":step>s.n?" done":""}`}>
                      <span className="pk-step-n">{step>s.n?"✓":s.n}</span>{s.l}
                    </div>
                  ))}
                </div>

                {/* Step 1 — Username / PIN screens */}
                {!identity ? (
                  <>
                  {/* Screen A: Enter username */}
                  {pinFlow === "username" && (
                    <div className="pk-ubox">
                      <div className="pk-ubox-title">Enter your username to continue</div>
                      <div className="pk-ubox-sub">
                        Your Instagram or X (Twitter) handle. This will appear on the leaderboard after submissions close.
                      </div>
                      <div className="pk-platform-toggle">
                        <button className={`pk-plat-btn${platform==="instagram"?" active":""}`} onClick={()=>setPlatform("instagram")}>Instagram</button>
                        <button className={`pk-plat-btn${platform==="x"?" active":""}`} onClick={()=>setPlatform("x")}>X / Twitter</button>
                      </div>
                      <div className="pk-urow">
                        <input className="pk-input" style={{flex:1,minWidth:180}}
                          placeholder={platform==="instagram"?"@yourusername":"@yourhandle"}
                          value={usernameInput}
                          onChange={e=>setUsernameInput(e.target.value)}
                          onKeyDown={e=>e.key==="Enter"&&handleConfirm()}/>
                        <button className="pk-btn pk-btn-acc"
                          onClick={handleConfirm}
                          disabled={identityLoading||!usernameInput.trim()}>
                          {identityLoading?"Checking...":"Continue →"}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Screen B: New user — set a PIN */}
                  {pinFlow === "pin_new" && (
                    <div className="pk-pin-box">
                      <div className="pk-pin-title">Set a 6-digit PIN</div>
                      <div className="pk-pin-sub">
                        Choose a 6-digit PIN to protect your picks. You'll need this PIN if you want to edit your picks from a different browser or device.
                        <br/><strong>Don't share it with anyone.</strong>
                      </div>
                      <input
                        className={`pk-pin-input${pinError?" err":""}`}
                        type="number" inputMode="numeric" maxLength={6}
                        placeholder="000000"
                        value={pinInput}
                        onChange={e=>{ setPinInput(e.target.value.slice(0,6)); setPinError(""); }}
                        onKeyDown={e=>e.key==="Enter"&&handleSetPin()}/>
                      {pinError && <div className="pk-pin-error">{pinError}</div>}
                      <div style={{display:"flex",gap:10,marginTop:16,flexWrap:"wrap"}}>
                        <button className="pk-btn pk-btn-green"
                          onClick={handleSetPin}
                          disabled={pinInput.length!==6}>
                          Set PIN &amp; Continue →
                        </button>
                        <button className="pk-pin-back" onClick={()=>{setPinFlow("username");setPinInput("");setPinError("");}}>
                          ← Back
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Screen C: Returning user on new browser — verify PIN */}
                  {pinFlow === "pin_verify" && (
                    <div className="pk-pin-box">
                      <div className="pk-pin-title">Enter your PIN</div>
                      <div className="pk-pin-sub">
                        @{usernameInput.replace(/^@/,"").toLowerCase()} already has a submission.
                        Enter your 6-digit PIN to access and edit your picks.
                      </div>
                      <input
                        className={`pk-pin-input${pinError?" err":""}`}
                        type="number" inputMode="numeric" maxLength={6}
                        placeholder="000000"
                        value={pinInput}
                        onChange={e=>{ setPinInput(e.target.value.slice(0,6)); setPinError(""); }}
                        onKeyDown={e=>e.key==="Enter"&&handleVerifyPin()}/>
                      {pinError && <div className="pk-pin-error">{pinError}</div>}
                      <div style={{display:"flex",gap:10,marginTop:16,flexWrap:"wrap"}}>
                        <button className="pk-btn pk-btn-acc"
                          onClick={handleVerifyPin}
                          disabled={identityLoading||pinInput.length!==6}>
                          {identityLoading?"Verifying...":"Verify PIN →"}
                        </button>
                        <button className="pk-pin-back" onClick={()=>{setPinFlow("username");setPinInput("");setPinError("");}}>
                          ← Back
                        </button>
                      </div>
                    </div>
                  )}
                  </>
                ) : (
                  /* User bar */
                  <div className="pk-ubar">
                    <div className="pk-ubar-name">@{identity.username}</div>
                    <span className={`pk-plat-chip ${identity.platform}`}>
                      {identity.platform==="x"?"X":"Instagram"}
                    </span>
                    {identity.isReturning && <span className="pk-edit-chip">Editing</span>}
                    <div style={{flex:1}}/>
                    <button className="pk-change-btn" onClick={()=>{setIdentity(null);setUsernameInput("");setPicks([]);setPinFlow("username");setPinInput("");setPinError("");localStorage.removeItem(LS_TOKEN_KEY);localStorage.removeItem(LS_DOCID_KEY);}}>
                      Change
                    </button>
                  </div>
                )}

                {/* Steps 2 & 3 — only after username */}
                {identity && (
                  <>
                    <div className="pk-lbl">Your picks — {picks.length}/{qualifyCount}</div>
                    <div className="pk-slots">
                      {Array.from({length:qualifyCount}).map((_,i)=>{
                        const team  = picks[i];
                        const tData = activeTeams.find(t=>tName(t)===team);
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

                    <div className="pk-lbl">
                      {picks.length<qualifyCount?`Click to pick #${picks.length+1}`:"All picked — scroll up to review"}
                    </div>
                    <div className="pk-pool">
                      {activeTeams.map(t=>{
                        const name=tName(t); const sel=picks.includes(name); const idx=picks.indexOf(name);
                        return (
                          <button key={t.team} className={`pk-team${sel?" sel":""}`}
                            onClick={()=>handlePickTeam(name)}
                            disabled={sel||picks.length>=qualifyCount}>
                            {idx>=0&&<div className="pk-team-order">#{idx+1}</div>}
                            <img className="pk-team-logo" src={logoUrl(t.image,t.team)} alt="" onError={e=>logoFallback(e,t.team)}/>
                            <div className="pk-team-name">{name}</div>
                          </button>
                        );
                      })}
                    </div>

                    {picks.length===qualifyCount && (
                      <div style={{display:"flex",flexDirection:"column",gap:16,maxWidth:420}}>
                        <button className="pk-submit" onClick={handleSubmit} disabled={submitting}>
                          {submitting?"Submitting...":"Submit Picks"}
                        </button>
                        <div className="pk-hint">Already submitted? Coming back with the same username on this browser will let you update your picks.</div>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* ════════ SUBMISSIONS TAB ════════ */}
        {tab==="leaderboard" && (
          <div className="pk-wrap">
            {!isDeadlinePassed ? (
              /* Before deadline — show only own submission */
              <div>
                <div className="pk-locked">
                  <div className="pk-locked-icon">🔒</div>
                  <div className="pk-locked-title">Submissions are hidden until March 12</div>
                  <div className="pk-locked-sub">
                    All picks will be revealed after submissions close on March 12 at 2:00 PM IST.<br/>
                    You can see your own picks below if you've already submitted.
                  </div>
                </div>

                {/* Show own submission below the lock message */}
                {mySubmission && (
                  <div style={{marginTop:20}}>
                    <div className="pk-lbl" style={{marginBottom:12}}>Your submission</div>
                    <div style={{background:G.surface,border:`1.5px solid ${G.border}`,borderRadius:12,padding:"16px 20px"}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
                        <span style={{fontWeight:700,fontSize:15}}>@{mySubmission.username}</span>
                        <span className={`pk-plat-chip ${mySubmission.platform||"instagram"}`}>
                          {mySubmission.platform==="x"?"X":"Instagram"}
                        </span>
                        <span style={{fontSize:12,color:G.muted,marginLeft:"auto"}}>
                          {new Date(mySubmission.timestamp).toLocaleString("en-IN",{timeZone:"Asia/Kolkata",day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})}
                        </span>
                      </div>
                      <div className="pk-chips">
                        {(mySubmission.picks||[]).map((p,i)=>(
                          <span key={i} className="pk-chip">#{i+1} {p}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {!mySubmission && identity && (
                  <div style={{textAlign:"center",color:G.muted,fontSize:13,marginTop:20}}>
                    You haven't submitted yet. Go to Make Picks!
                  </div>
                )}
                {!identity && (
                  <div style={{textAlign:"center",color:G.muted,fontSize:13,marginTop:20}}>
                    Enter your username in Make Picks to see your submission here.
                  </div>
                )}
              </div>
            ) : (
              /* After deadline — show all */
              <>
                {!published && (
                  <div className="pk-banner amber">
                    ⏳ Scores will be revealed once admin publishes results. All picks are now visible.
                  </div>
                )}
                <table className="pk-table">
                  <thead>
                    <tr>
                      <th style={{width:44}}>#</th>
                      <th>User</th>
                      {published&&<th style={{textAlign:"right",width:70}}>Score</th>}
                      <th>Picks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scoredSubs.map((s,i)=>(
                      <tr key={s.docId}>
                        <td className="pk-rank">
                          {published&&i===0?"🥇":published&&i===1?"🥈":published&&i===2?"🥉":i+1}
                        </td>
                        <td>
                          <div className="pk-ucell">
                            <span style={{fontWeight:700}}>@{s.username}</span>
                            <span className={`pk-plat-chip ${s.platform||"instagram"}`}>
                              {s.platform==="x"?"X":"Instagram"}
                            </span>
                          </div>
                        </td>
                        {published&&(
                          <td style={{textAlign:"right",whiteSpace:"nowrap"}}>
                            <span className="pk-score-pill">{s.score} pts</span>
                          </td>
                        )}
                        <td>
                          <div className="pk-chips">
                            {(s.picks||[]).map((p,pi)=>{
                              const cp=published&&adminResults[pi]===p;
                              const ct=published&&!cp&&adminResults.includes(p);
                              return <span key={pi} className={`pk-chip${cp?" pos":ct?" team":""}`}>#{pi+1} {p}</span>;
                            })}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!scoredSubs.length&&(
                      <tr><td colSpan={published?4:3} style={{textAlign:"center",color:G.muted,padding:32}}>No submissions yet.</td></tr>
                    )}
                  </tbody>
                </table>
                {published&&(
                  <div className="pk-legend">
                    <div className="pk-legend-item"><span className="pk-legend-dot" style={{background:G.green}}/>Correct position (10 pts)</div>
                    <div className="pk-legend-item"><span className="pk-legend-dot" style={{background:G.blue}}/>Correct team (5 pts)</div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ════════ ADMIN TAB ════════ */}
        {tab==="admin" && (
          <div className="pk-wrap">
            {!adminUnlocked ? (
              <div className="pk-abox" style={{maxWidth:380}}>
                <div className="pk-atitle">Admin Access</div>
                <div style={{marginBottom:14}}>
                  <div className="pk-alabel">Password</div>
                  <input className="pk-input" type="password" placeholder="Enter admin password"
                    value={adminPassInput} onChange={e=>setAdminPassInput(e.target.value)}
                    onKeyDown={e=>e.key==="Enter"&&handleAdminLogin()}/>
                </div>
                <button className="pk-submit" onClick={handleAdminLogin}>Unlock</button>
              </div>
            ) : (
              <>
                {/* Team setup */}
                <div className="pk-abox">
                  <div className="pk-atitle">Step 1 — Select Participating Teams</div>
                  <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
                    <input className="pk-input" style={{flex:1,minWidth:200}}
                      placeholder="Tournament page name e.g. Battlegrounds India Series 2026"
                      value={adminTournInput} onChange={e=>setAdminTournInput(e.target.value)}/>
                    <button className="pk-btn pk-btn-acc" onClick={()=>fetchWikiTeams(adminTournInput)} disabled={wikiLoading}>
                      {wikiLoading?"Loading...":"Load Teams"}
                    </button>
                  </div>
                  {wikiErr&&<div style={{color:G.red,fontSize:13,marginBottom:12}}>{wikiErr}</div>}
                  <div className="pk-count-row">
                    <span className="pk-count-lbl">Teams that qualify:</span>
                    <input className="pk-count-in" type="number" min={1} max={20}
                      value={adminQualifyCount} onChange={e=>setAdminQualifyCount(parseInt(e.target.value)||8)}/>
                    <span style={{fontSize:13,color:G.muted}}>{adminSelectedTeams.length} of {allWikiTeams.length} selected</span>
                  </div>
                  {allWikiTeams.length>0&&(
                    <>
                      <div className="pk-lbl" style={{marginBottom:10}}>Click to select / deselect</div>
                      <div className="pk-ts-grid">
                        {allWikiTeams.map(t=>{
                          const name=tName(t); const sel=isSelTeam(name);
                          return (
                            <button key={t.team} className={`pk-ts-btn${sel?" sel":""}`} onClick={()=>toggleTeam(t)}>
                              <img className="pk-ts-logo" src={logoUrl(t.image,t.team)} alt="" onError={e=>logoFallback(e,t.team)}/>
                              <div className="pk-ts-name">{name}</div>
                              {sel&&<span style={{fontSize:14}}>✓</span>}
                            </button>
                          );
                        })}
                      </div>
                      <div className="pk-btn-row">
                        <button className="pk-btn pk-btn-green" onClick={handleSaveTeams}>Save Teams ({adminSelectedTeams.length})</button>
                        <button className="pk-btn pk-btn-acc" onClick={()=>setAdminSelectedTeams([...allWikiTeams])}>Select All</button>
                        <button className="pk-btn pk-btn-red" onClick={()=>setAdminSelectedTeams([])}>Clear All</button>
                      </div>
                    </>
                  )}
                </div>

                {/* Results */}
                <div className="pk-abox">
                  <div className="pk-atitle">Step 2 — Enter Actual Results</div>
                  <div style={{fontSize:13,color:G.muted,marginBottom:14}}>{subCount} submissions received</div>
                  <div className="pk-agrid">
                    {Array.from({length:qualifyCount}).map((_,i)=>(
                      <div key={i}>
                        <div className="pk-alabel">#{i+1} Place</div>
                        <select className="pk-aselect" value={adminResults[i]||""}
                          onChange={e=>{const v=e.target.value;setAdminResults(p=>{const n=[...p];n[i]=v;return n;});}}>
                          <option value="">— Select —</option>
                          {activeTeams.map(t=>{const name=tName(t);return <option key={t.team} value={name}>{name}</option>;})}
                        </select>
                      </div>
                    ))}
                  </div>
                  <div className="pk-btn-row">
                    <button className="pk-btn pk-btn-green" onClick={handleSaveResults}>Save Results</button>
                    {!published
                      ?<button className="pk-btn pk-btn-acc" onClick={handlePublish}>Publish Scores</button>
                      :<button className="pk-btn pk-btn-red" onClick={handleUnpublish}>Hide Scores</button>}
                  </div>
                </div>

                {/* All submissions */}
                <div className="pk-abox">
                  <div className="pk-atitle">All Submissions ({subCount})</div>
                  <table className="pk-table">
                    <thead>
                      <tr><th>#</th><th>User</th><th>Submitted (IST)</th><th>Picks</th><th></th></tr>
                    </thead>
                    <tbody>
                      {[...allSubmissions].sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp)).map((s,i)=>(
                        <tr key={s.docId}>
                          <td className="pk-rank">{i+1}</td>
                          <td>
                            <div className="pk-ucell">
                              <span style={{fontWeight:700}}>@{s.username}</span>
                              <span className={`pk-plat-chip ${s.platform||"instagram"}`}>{s.platform==="x"?"X":"Instagram"}</span>
                            </div>
                          </td>
                          <td style={{fontSize:12,color:G.muted}}>
                            {new Date(s.timestamp).toLocaleString("en-IN",{timeZone:"Asia/Kolkata",day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})}
                          </td>
                          <td><div className="pk-chips">{(s.picks||[]).map((p,pi)=><span key={pi} className="pk-chip">#{pi+1} {p}</span>)}</div></td>
                          <td><button className="pk-del" onClick={()=>handleDelete(s.docId)}>Delete</button></td>
                        </tr>
                      ))}
                      {!allSubmissions.length&&<tr><td colSpan={5} style={{textAlign:"center",color:G.muted,padding:24}}>No submissions yet.</td></tr>}
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
