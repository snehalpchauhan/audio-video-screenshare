import React, { useState, useEffect, useCallback } from "react";
import {
  FiKey, FiPlus, FiCopy, FiCheckCircle, FiTrash2, FiCode,
  FiZap, FiActivity, FiBook, FiTerminal, FiLink, FiShield,
  FiVideo, FiMic, FiMonitor, FiExternalLink, FiRefreshCw,
  FiGrid, FiChevronRight, FiAlertCircle,
} from "react-icons/fi";
import { getUser, keysAPI, createSessionToken, getServerUrl } from "../services/api";

const BASE = () => getServerUrl();

// ─── small helpers ─────────────────────────────────────────────────────────

function CopyButton({ text, small }) {
  const [done, setDone] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setDone(true);
      setTimeout(() => setDone(false), 2000);
    });
  };
  return (
    <button className={`dp-copy-btn${small ? " dp-copy-btn--sm" : ""}`} onClick={copy} title="Copy">
      {done ? <FiCheckCircle size={14} /> : <FiCopy size={14} />}
      {!small && (done ? "Copied" : "Copy")}
    </button>
  );
}

function CodeBlock({ lang, children }) {
  return (
    <div className="dp-code-block">
      {lang && <span className="dp-code-lang">{lang}</span>}
      <CopyButton text={children} small />
      <pre><code>{children}</code></pre>
    </div>
  );
}

function StatCard({ icon, label, value, accent }) {
  return (
    <div className={`dp-stat-card${accent ? " dp-stat-card--accent" : ""}`}>
      <div className="dp-stat-icon">{icon}</div>
      <div className="dp-stat-body">
        <span className="dp-stat-value">{value}</span>
        <span className="dp-stat-label">{label}</span>
      </div>
    </div>
  );
}

// ─── NAV items ─────────────────────────────────────────────────────────────

const NAV = [
  { id: "dashboard", label: "Dashboard",    icon: <FiGrid size={16} /> },
  { id: "keys",      label: "API Keys",     icon: <FiKey size={16} /> },
  { id: "tokens",    label: "Session Tokens", icon: <FiZap size={16} /> },
  { id: "quickstart",label: "Quick Start",  icon: <FiTerminal size={16} /> },
  { id: "reference", label: "API Reference",icon: <FiBook size={16} /> },
];

// ═══════════════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function DeveloperPortal() {
  const profile = getUser() || {};
  const [section, setSection] = useState("dashboard");
  const [keys, setKeys] = useState([]);
  const [keysLoading, setKeysLoading] = useState(true);
  const [globalError, setGlobalError] = useState("");

  const loadKeys = useCallback(async () => {
    setKeysLoading(true);
    try {
      const d = await keysAPI.list();
      setKeys(d.keys || []);
    } catch {
      setKeys([]);
    } finally {
      setKeysLoading(false);
    }
  }, []);

  useEffect(() => { loadKeys(); }, [loadKeys]);

  return (
    <div className="dp-root">
      {/* ── Left nav ─────────────────────────────────────── */}
      <nav className="dp-nav">
        <div className="dp-nav-brand">
          <div className="dp-nav-logo"><FiCode size={18} /></div>
          <div>
            <div className="dp-nav-brand-name">Developer</div>
            <div className="dp-nav-brand-sub">Console</div>
          </div>
        </div>

        <ul className="dp-nav-list">
          {NAV.map(n => (
            <li key={n.id}>
              <button
                className={`dp-nav-item${section === n.id ? " active" : ""}`}
                onClick={() => setSection(n.id)}
              >
                {n.icon}
                <span>{n.label}</span>
                {section === n.id && <FiChevronRight size={13} className="dp-nav-arrow" />}
              </button>
            </li>
          ))}
        </ul>

        {/* account pill at bottom */}
        <div className="dp-nav-account">
          <div className="dp-nav-av">{(profile.username || "?")[0].toUpperCase()}</div>
          <div className="dp-nav-acct-info">
            <span className="dp-nav-acct-name">{profile.username}</span>
            <span className="dp-nav-acct-co">{profile.companyName || "Personal"}</span>
          </div>
        </div>
      </nav>

      {/* ── Content ──────────────────────────────────────── */}
      <main className="dp-content">
        {globalError && (
          <div className="dp-alert dp-alert--error">
            <FiAlertCircle size={16} /> {globalError}
            <button onClick={() => setGlobalError("")} className="dp-alert-close">✕</button>
          </div>
        )}

        {section === "dashboard" && (
          <Dashboard profile={profile} keys={keys} keysLoading={keysLoading} setSection={setSection} />
        )}
        {section === "keys" && (
          <ApiKeys
            keys={keys}
            keysLoading={keysLoading}
            reload={loadKeys}
            onError={setGlobalError}
          />
        )}
        {section === "tokens" && (
          <SessionTokens keys={keys} onError={setGlobalError} />
        )}
        {section === "quickstart" && <QuickStart profile={profile} keys={keys} />}
        {section === "reference"  && <Reference />}
      </main>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════

function Dashboard({ profile, keys, keysLoading, setSection }) {
  return (
    <div className="dp-page">
      {/* Page header */}
      <div className="dp-page-header">
        <div>
          <h1 className="dp-page-title">Welcome back, {profile.companyName || profile.username}</h1>
          <p className="dp-page-sub">Build real-time audio, video and screen share into your product.</p>
        </div>
        <a href="https://github.com/snehalpchauhan/audio-video-screenshare" target="_blank" rel="noreferrer"
          className="dp-btn dp-btn--ghost dp-btn--sm">
          <FiExternalLink size={14} /> Docs
        </a>
      </div>

      {/* Stat row */}
      <div className="dp-stats-row">
        <StatCard icon={<FiKey size={20} />}    label="Active API Keys"  value={keysLoading ? "—" : keys.length} accent />
        <StatCard icon={<FiActivity size={20} />} label="Capabilities"   value="Audio · Video · Screen" />
        <StatCard icon={<FiShield size={20} />}  label="Auth method"     value="JWT + X-Api-Key" />
        <StatCard icon={<FiLink size={20} />}    label="API Base URL"    value="voicelink.vnnovate.net" />
      </div>

      {/* Account card */}
      <div className="dp-section-title">Your Account</div>
      <div className="dp-account-card">
        <div className="dp-account-grid">
          <div className="dp-account-field">
            <span className="dp-field-label">Account SID</span>
            <div className="dp-field-value-row">
              <code className="dp-mono">{profile.id || "—"}</code>
              {profile.id && <CopyButton text={profile.id} small />}
            </div>
          </div>
          <div className="dp-account-field">
            <span className="dp-field-label">Username</span>
            <div className="dp-field-value-row">
              <code className="dp-mono">{profile.username}</code>
            </div>
          </div>
          {profile.companyName && (
            <div className="dp-account-field">
              <span className="dp-field-label">Organization</span>
              <div className="dp-field-value-row">
                <span className="dp-mono">{profile.companyName}</span>
              </div>
            </div>
          )}
          {profile.email && (
            <div className="dp-account-field">
              <span className="dp-field-label">Email</span>
              <div className="dp-field-value-row">
                <span className="dp-mono">{profile.email}</span>
              </div>
            </div>
          )}
          <div className="dp-account-field">
            <span className="dp-field-label">API Base URL</span>
            <div className="dp-field-value-row">
              <code className="dp-mono">{BASE()}</code>
              <CopyButton text={BASE()} small />
            </div>
          </div>
        </div>
      </div>

      {/* Capabilities */}
      <div className="dp-section-title" style={{ marginTop: 32 }}>What you can build</div>
      <div className="dp-caps-grid">
        {[
          { icon: <FiVideo size={22} />,   title: "1-on-1 Video Calls",    desc: "Peer-to-peer WebRTC video with mute, camera toggle and end-call controls." },
          { icon: <FiMic size={22} />,     title: "Audio-only Calls",      desc: "Low-bandwidth voice calls with noise-aware UX." },
          { icon: <FiMonitor size={22} />, title: "Screen Sharing",        desc: "Replace camera with screen share mid-call, no plugin required." },
          { icon: <FiZap size={22} />,     title: "Group Video Rooms",     desc: "Mesh WebRTC for up to ~6 participants in named rooms." },
          { icon: <FiKey size={22} />,     title: "Session Tokens",        desc: "Issue short-lived tokens so your users join without a VoiceLink account." },
          { icon: <FiShield size={22} />,  title: "Scoped Permissions",    desc: "Control video, audio and screen per session token." },
        ].map(c => (
          <div className="dp-cap-card" key={c.title}>
            <div className="dp-cap-icon">{c.icon}</div>
            <strong>{c.title}</strong>
            <p>{c.desc}</p>
          </div>
        ))}
      </div>

      {/* CTA strip */}
      <div className="dp-cta-strip">
        <div className="dp-cta-strip-text">
          <strong>Ready to integrate?</strong>
          <span>Generate an API key and add audio/video to your app in minutes.</span>
        </div>
        <button className="dp-btn dp-btn--primary" onClick={() => setSection("keys")}>
          <FiKey size={15} /> Manage API Keys
        </button>
        <button className="dp-btn dp-btn--ghost" onClick={() => setSection("quickstart")}>
          <FiTerminal size={15} /> Quick Start
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  API KEYS
// ═══════════════════════════════════════════════════════════════════════════

function ApiKeys({ keys, keysLoading, reload, onError }) {
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState(null);
  const [revoking, setRevoking] = useState(null);
  const [localError, setLocalError] = useState("");

  const create = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true); setLocalError(""); setNewKey(null);
    try {
      const d = await keysAPI.create(name.trim());
      setNewKey(d.apiKey);
      setName("");
      reload();
    } catch (err) {
      setLocalError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (id, label) => {
    if (!window.confirm(`Revoke key "${label}"? Any integrations using it will immediately stop working.`)) return;
    setRevoking(id);
    try {
      await keysAPI.revoke(id);
      reload();
    } catch (err) {
      onError(err.message);
    } finally {
      setRevoking(null);
    }
  };

  return (
    <div className="dp-page">
      <div className="dp-page-header">
        <div>
          <h1 className="dp-page-title">API Keys</h1>
          <p className="dp-page-sub">Keys authenticate your backend server to VoiceLink. Never expose them in mobile or browser code.</p>
        </div>
        <button className="dp-btn dp-btn--ghost dp-btn--sm" onClick={reload}>
          <FiRefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* New key form */}
      <div className="dp-card">
        <div className="dp-card-head">
          <FiPlus size={16} />
          <span>Create a new API key</span>
        </div>
        {localError && <p className="dp-inline-error"><FiAlertCircle size={13} /> {localError}</p>}
        <form className="dp-key-form" onSubmit={create}>
          <input
            className="dp-input"
            placeholder="Label — e.g. Production, Staging, Vibe6-App"
            value={name}
            onChange={e => setName(e.target.value)}
            autoComplete="off"
          />
          <button className="dp-btn dp-btn--primary" type="submit" disabled={creating || !name.trim()}>
            <FiPlus size={15} />
            {creating ? "Generating…" : "Generate key"}
          </button>
        </form>
      </div>

      {/* Reveal banner */}
      {newKey && (
        <div className="dp-reveal-banner">
          <div className="dp-reveal-head">
            <FiCheckCircle size={18} className="dp-reveal-icon" />
            <span>API key created — copy it now. It will not be shown again.</span>
          </div>
          <div className="dp-reveal-row">
            <code className="dp-reveal-key">{newKey}</code>
            <CopyButton text={newKey} />
          </div>
        </div>
      )}

      {/* Keys list */}
      <div className="dp-card" style={{ marginTop: 20 }}>
        <div className="dp-card-head">
          <FiKey size={16} />
          <span>Active keys ({keysLoading ? "…" : keys.length})</span>
        </div>
        {keysLoading ? (
          <p className="dp-muted">Loading…</p>
        ) : keys.length === 0 ? (
          <div className="dp-empty">
            <FiKey size={36} />
            <p>No API keys yet. Create one above.</p>
          </div>
        ) : (
          <div className="dp-keys-table">
            <div className="dp-keys-table-head">
              <span>Label</span>
              <span>Key preview</span>
              <span>Created</span>
              <span></span>
            </div>
            {keys.map(k => (
              <div className="dp-keys-table-row" key={k.id}>
                <span className="dp-key-name">{k.name}</span>
                <code className="dp-key-preview">{k.keyPreview}</code>
                <span className="dp-key-date">{new Date(k.createdAt).toLocaleDateString()}</span>
                <button
                  className="dp-btn dp-btn--danger dp-btn--sm"
                  disabled={revoking === k.id}
                  onClick={() => revoke(k.id, k.name)}
                >
                  <FiTrash2 size={13} />
                  {revoking === k.id ? "…" : "Revoke"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Security tip */}
      <div className="dp-tip">
        <FiShield size={15} />
        <span><strong>Security:</strong> Store API keys in environment variables only. Never commit them to git or expose them in client-side bundles.</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  SESSION TOKEN GENERATOR
// ═══════════════════════════════════════════════════════════════════════════

function SessionTokens({ keys, onError }) {
  const [form, setForm] = useState({
    apiKey: "",
    participantName: "",
    roomName: "",
    expiresIn: "1h",
    video: true,
    audio: true,
    screen: true,
  });
  const [result, setResult]     = useState(null);
  const [loading, setLoading]   = useState(false);
  const [localErr, setLocalErr] = useState("");

  const generate = async (e) => {
    e.preventDefault();
    setLoading(true); setLocalErr(""); setResult(null);
    try {
      const d = await createSessionToken(form.apiKey, {
        participantName: form.participantName,
        roomName: form.roomName || undefined,
        expiresIn: form.expiresIn,
        permissions: { video: form.video, audio: form.audio, screen: form.screen },
      });
      setResult(d);
    } catch (err) {
      setLocalErr(err.message);
    } finally {
      setLoading(false);
    }
  };

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="dp-page">
      <div className="dp-page-header">
        <div>
          <h1 className="dp-page-title">Session Tokens</h1>
          <p className="dp-page-sub">Mint a short-lived join token for any participant — no VoiceLink account required on their end.</p>
        </div>
      </div>

      <div className="dp-two-col">
        {/* Form */}
        <div className="dp-card">
          <div className="dp-card-head"><FiZap size={16} /><span>Generate a token</span></div>
          {localErr && <p className="dp-inline-error"><FiAlertCircle size={13} /> {localErr}</p>}
          <form className="dp-token-form" onSubmit={generate}>

            <label className="dp-label">API Key</label>
            {keys.length > 0 ? (
              <select className="dp-input dp-select" value={form.apiKey} onChange={e => f("apiKey", e.target.value)} required>
                <option value="">— select a key —</option>
                {keys.map(k => <option key={k.id} value={k.id}>{k.name} ({k.keyPreview})</option>)}
              </select>
            ) : (
              <input className="dp-input" placeholder="vl_your_api_key" value={form.apiKey}
                onChange={e => f("apiKey", e.target.value)} required />
            )}

            <label className="dp-label">Participant display name <span className="dp-req">*</span></label>
            <input className="dp-input" placeholder="e.g. Alice" value={form.participantName}
              onChange={e => f("participantName", e.target.value)} required />

            <label className="dp-label">Room name <span className="dp-optional">(creates if absent)</span></label>
            <input className="dp-input" placeholder="e.g. Sales Standup" value={form.roomName}
              onChange={e => f("roomName", e.target.value)} />

            <label className="dp-label">Token expiry</label>
            <select className="dp-input dp-select" value={form.expiresIn} onChange={e => f("expiresIn", e.target.value)}>
              <option value="30m">30 minutes</option>
              <option value="1h">1 hour</option>
              <option value="2h">2 hours</option>
              <option value="8h">8 hours</option>
              <option value="24h">24 hours</option>
            </select>

            <label className="dp-label">Permissions</label>
            <div className="dp-perms-row">
              {[["video", "Video", <FiVideo size={13} />], ["audio", "Audio", <FiMic size={13} />], ["screen", "Screen", <FiMonitor size={13} />]].map(([k, label, icon]) => (
                <label key={k} className={`dp-perm-chip${form[k] ? " on" : ""}`}>
                  <input type="checkbox" checked={form[k]} onChange={e => f(k, e.target.checked)} />
                  {icon} {label}
                </label>
              ))}
            </div>

            <button className="dp-btn dp-btn--primary" type="submit"
              disabled={loading || !form.apiKey || !form.participantName}>
              <FiZap size={15} />
              {loading ? "Generating…" : "Create session token"}
            </button>
          </form>
        </div>

        {/* Result */}
        <div>
          {result ? (
            <div className="dp-card dp-result-card">
              <div className="dp-card-head dp-card-head--success">
                <FiCheckCircle size={16} />
                <span>Token created</span>
                <span className="dp-result-exp">expires {new Date(result.expiresAt).toLocaleString()}</span>
              </div>

              <div className="dp-result-field">
                <span className="dp-field-label">Join URL</span>
                <div className="dp-field-value-row">
                  <a href={result.joinUrl} target="_blank" rel="noreferrer" className="dp-join-link">
                    {result.joinUrl}
                  </a>
                  <CopyButton text={result.joinUrl} small />
                </div>
                <p className="dp-field-hint">Send this to the participant. They open it in a browser and join the call immediately.</p>
              </div>

              <div className="dp-result-field">
                <span className="dp-field-label">Session Token (for Socket.IO)</span>
                <div className="dp-field-value-row" style={{ flexWrap: "wrap" }}>
                  <code className="dp-reveal-key" style={{ fontSize: "0.72rem" }}>{result.sessionToken}</code>
                  <CopyButton text={result.sessionToken} small />
                </div>
              </div>

              <div className="dp-result-meta">
                <div><span>Room</span><code>{result.roomName}</code></div>
                <div><span>Room ID</span><code>{result.roomId}</code></div>
                <div><span>Permissions</span><code>{JSON.stringify(result.permissions)}</code></div>
              </div>
            </div>
          ) : (
            <div className="dp-card dp-placeholder-card">
              <FiZap size={36} />
              <p>Fill the form and click <strong>Create session token</strong>.<br />
              The join URL appears here — send it to your participant.</p>
            </div>
          )}

          {/* How it works */}
          <div className="dp-card" style={{ marginTop: 16 }}>
            <div className="dp-card-head"><FiBook size={16} /><span>How session tokens work</span></div>
            <ol className="dp-how-list">
              <li>Your backend calls <code>POST /api/sessions/token</code> with your API key.</li>
              <li>VoiceLink returns a signed JWT <strong>sessionToken</strong> and a <strong>joinUrl</strong>.</li>
              <li>Send the <code>joinUrl</code> to your user — they click it and join the call directly.</li>
              <li>Alternatively pass <code>sessionToken</code> as Socket.IO <code>auth.token</code> for custom UI.</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  QUICK START
// ═══════════════════════════════════════════════════════════════════════════

function QuickStart({ profile, keys }) {
  const base = BASE();
  const apiKeyEx = keys[0]?.keyPreview ? `vl_${keys[0].keyPreview}…` : "vl_YOUR_API_KEY";
  const accountId = profile.id || "YOUR_ACCOUNT_ID";

  const curlToken = `curl -X POST ${base}/api/sessions/token \\
  -H "X-Api-Key: ${apiKeyEx}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "participantName": "Alice",
    "roomName": "Team Standup",
    "expiresIn": "1h",
    "permissions": { "video": true, "audio": true, "screen": true }
  }'`;

  const nodeToken = `const res = await fetch('${base}/api/sessions/token', {
  method: 'POST',
  headers: {
    'X-Api-Key': process.env.VOICELINK_API_KEY,  // server-side only
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    participantName: 'Alice',
    roomName: 'Team Standup',
    expiresIn: '1h',
    permissions: { video: true, audio: true, screen: true },
  }),
});
const { sessionToken, joinUrl, expiresAt } = await res.json();

// Option A — redirect user to joinUrl in a browser tab
window.open(joinUrl, '_blank');

// Option B — pass sessionToken to Socket.IO in your own React/JS UI
const socket = io('${base}', {
  auth: { token: sessionToken },
});`;

  const reactSnippet = `// In your React component:
import { io } from 'socket.io-client';

const socket = io('${base}', {
  auth: { token: sessionToken },  // token from your backend
});

socket.on('connect', () => console.log('Connected:', socket.id));
socket.emit('join-room', roomId);   // join a video room
socket.on('user-joined-room', ({ socketId, username }) => {
  console.log(username, 'joined');
});`;

  return (
    <div className="dp-page">
      <div className="dp-page-header">
        <div>
          <h1 className="dp-page-title">Quick Start</h1>
          <p className="dp-page-sub">Add audio, video and screen share to your app in four steps.</p>
        </div>
      </div>

      {/* Account context */}
      <div className="dp-qs-account">
        <span className="dp-qs-account-label">Account SID</span>
        <code className="dp-mono">{accountId}</code>
        <CopyButton text={accountId} small />
        <span className="dp-qs-account-label" style={{ marginLeft: 24 }}>Base URL</span>
        <code className="dp-mono">{base}</code>
        <CopyButton text={base} small />
      </div>

      {/* Steps */}
      {[
        {
          step: "01",
          title: "Create an API key",
          desc: "Go to the API Keys section, click Generate key, and copy the secret. Store it in an environment variable on your backend — never in client code.",
          cta: null,
        },
        {
          step: "02",
          title: "Mint a session token (from your backend)",
          desc: "Call the session token endpoint from your server with your API key. You get back a signed JWT and a ready-to-use join URL.",
          code: [{ lang: "curl", src: curlToken }, { lang: "node / fetch", src: nodeToken }],
        },
        {
          step: "03",
          title: "Send the join URL to your user",
          desc: "The simplest integration: send joinUrl to your user. They open it and land directly in the video room — no account or install required.",
          response: `// Response from POST /api/sessions/token
{
  "sessionToken": "eyJhbGci…",
  "joinUrl": "${base}?sessionToken=eyJhbGci…",
  "roomId": "uuid",
  "roomName": "Team Standup",
  "expiresAt": "2026-04-26T11:00:00.000Z",
  "permissions": { "video": true, "audio": true, "screen": true }
}`,
        },
        {
          step: "04",
          title: "Custom integration via Socket.IO (advanced)",
          desc: "If you're building your own call UI, pass the sessionToken as Socket.IO auth.token and use the signaling events directly.",
          code: [{ lang: "react / javascript", src: reactSnippet }],
        },
      ].map(s => (
        <div className="dp-qs-step" key={s.step}>
          <div className="dp-qs-step-num">{s.step}</div>
          <div className="dp-qs-step-body">
            <h3 className="dp-qs-step-title">{s.title}</h3>
            <p className="dp-qs-step-desc">{s.desc}</p>
            {s.response && <CodeBlock lang="json">{s.response}</CodeBlock>}
            {s.code && s.code.map(c => <CodeBlock key={c.lang} lang={c.lang}>{c.src}</CodeBlock>)}
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  API REFERENCE
// ═══════════════════════════════════════════════════════════════════════════

function Reference() {
  const base = BASE();
  const endpoints = [
    {
      group: "Auth",
      items: [
        { method: "POST", path: "/api/auth/register", auth: "—", desc: "Register → returns JWT" },
        { method: "POST", path: "/api/auth/login",    auth: "—", desc: "Login → returns JWT" },
        { method: "GET",  path: "/api/auth/verify",   auth: "Bearer JWT", desc: "Verify stored token" },
      ],
    },
    {
      group: "Rooms",
      items: [
        { method: "GET",  path: "/api/rooms",       auth: "Bearer JWT", desc: "List all rooms" },
        { method: "POST", path: "/api/rooms",       auth: "Bearer JWT", desc: "Create a room" },
        { method: "GET",  path: "/api/rooms/:id",   auth: "Bearer JWT", desc: "Get room info" },
      ],
    },
    {
      group: "API Keys",
      items: [
        { method: "POST",   path: "/api/keys",       auth: "Bearer JWT", desc: "Generate API key" },
        { method: "GET",    path: "/api/keys",       auth: "Bearer JWT", desc: "List your API keys" },
        { method: "DELETE", path: "/api/keys/:id",   auth: "Bearer JWT", desc: "Revoke API key" },
      ],
    },
    {
      group: "Session Tokens",
      items: [
        { method: "POST",  path: "/api/sessions/token",  auth: "X-Api-Key",       desc: "Create a join token for a participant" },
        { method: "GET",   path: "/api/sessions/verify", auth: "X-Session-Token", desc: "Validate a session token" },
      ],
    },
  ];

  const socketEvents = [
    { dir: "emit",   event: "join-room",    payload: "roomId",                   desc: "Join a group call room" },
    { dir: "emit",   event: "leave-room",   payload: "roomId",                   desc: "Leave a group call room" },
    { dir: "emit",   event: "call-user",    payload: "{ to, signal }",           desc: "Initiate 1-on-1 call" },
    { dir: "emit",   event: "answer-call",  payload: "{ to, signal }",           desc: "Answer a 1-on-1 call" },
    { dir: "emit",   event: "end-call",     payload: "{ to }",                   desc: "End a 1-on-1 call" },
    { dir: "emit",   event: "room-signal",  payload: "{ to, signal }",           desc: "WebRTC signal in group call" },
    { dir: "on",     event: "me",           payload: "socketId",                 desc: "Your socket ID on connect" },
    { dir: "on",     event: "users",        payload: "User[]",                   desc: "Updated online users list" },
    { dir: "on",     event: "incoming-call",payload: "{ from, signal }",         desc: "Incoming 1-on-1 call" },
    { dir: "on",     event: "call-accepted",payload: "{ signal }",               desc: "Your call was answered" },
    { dir: "on",     event: "call-ended",   payload: "—",                        desc: "Remote party ended the call" },
    { dir: "on",     event: "room-joined",  payload: "{ roomId, peers }",        desc: "You joined a room" },
    { dir: "on",     event: "user-joined-room", payload: "{ socketId, username }",desc: "Peer joined your room" },
    { dir: "on",     event: "user-left-room",   payload: "{ socketId }",          desc: "Peer left your room" },
    { dir: "on",     event: "group-call-started", payload: "{ roomId, callerName }",desc: "Group call notification" },
    { dir: "on",     event: "room-signal",  payload: "{ from, signal }",         desc: "WebRTC signal from peer" },
  ];

  return (
    <div className="dp-page">
      <div className="dp-page-header">
        <div>
          <h1 className="dp-page-title">API Reference</h1>
          <p className="dp-page-sub">Base URL: <code className="dp-mono dp-mono--inline">{base}</code></p>
        </div>
      </div>

      {endpoints.map(g => (
        <div key={g.group}>
          <div className="dp-section-title" style={{ marginTop: 28 }}>{g.group}</div>
          <div className="dp-card dp-ref-table-card">
            <div className="dp-ref-table-head">
              <span>Method</span><span>Path</span><span>Auth</span><span>Description</span>
            </div>
            {g.items.map(r => (
              <div className="dp-ref-table-row" key={r.path + r.method}>
                <span className={`dp-method dp-method--${r.method.toLowerCase()}`}>{r.method}</span>
                <code className="dp-ref-path">{r.path}</code>
                <code className="dp-ref-auth">{r.auth}</code>
                <span className="dp-ref-desc">{r.desc}</span>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Socket.IO */}
      <div className="dp-section-title" style={{ marginTop: 32 }}>Socket.IO Events</div>
      <p className="dp-page-sub" style={{ marginBottom: 12 }}>
        Connect: <code className="dp-mono dp-mono--inline">{`io("${base}", { auth: { token: "<JWT or sessionToken>" } })`}</code>
      </p>
      <div className="dp-card dp-ref-table-card">
        <div className="dp-ref-table-head">
          <span>Direction</span><span>Event</span><span>Payload</span><span>Description</span>
        </div>
        {socketEvents.map(e => (
          <div className="dp-ref-table-row" key={e.event + e.dir}>
            <span className={`dp-dir dp-dir--${e.dir}`}>{e.dir === "emit" ? "↑ emit" : "↓ on"}</span>
            <code className="dp-ref-path">{e.event}</code>
            <code className="dp-ref-auth" style={{ fontSize: "0.75rem" }}>{e.payload}</code>
            <span className="dp-ref-desc">{e.desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
