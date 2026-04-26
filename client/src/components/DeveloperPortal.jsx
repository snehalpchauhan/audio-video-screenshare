import React, { useState, useEffect, useCallback } from "react";
import {
  FiKey,
  FiPlus,
  FiCopy,
  FiCheckCircle,
  FiBook,
  FiHome,
  FiTrash2,
  FiCode,
  FiShield,
} from "react-icons/fi";
import { getUser, keysAPI, createSessionToken, getServerUrl } from "../services/api";

const serverUrl = () => getServerUrl();

export default function DeveloperPortal() {
  const profile = getUser() || {};
  const [tab, setTab] = useState("overview");

  const [keys, setKeys] = useState([]);
  const [keysLoading, setKeysLoading] = useState(true);
  const [newKeyName, setNewKeyName] = useState("");
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const [sessionForm, setSessionForm] = useState({ participantName: "", roomName: "", apiKey: "" });
  const [sessionResult, setSessionResult] = useState(null);
  const [genError, setGenError] = useState("");
  const [revokingId, setRevokingId] = useState(null);

  const loadKeys = useCallback(async () => {
    setKeysLoading(true);
    try {
      const data = await keysAPI.list();
      setKeys(data.keys || []);
    } catch {
      setKeys([]);
    } finally {
      setKeysLoading(false);
    }
  }, []);

  useEffect(() => {
    loadKeys();
  }, [loadKeys]);

  const copyText = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const createKey = async (e) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    setCreating(true);
    setError("");
    try {
      const data = await keysAPI.create(newKeyName.trim());
      setNewKey(data.apiKey);
      setNewKeyName("");
      loadKeys();
    } catch (e) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  };

  const revokeKey = async (id, name) => {
    if (!window.confirm(`Revoke API key "${name}"? Integrations using it will stop working.`)) return;
    setRevokingId(id);
    try {
      await keysAPI.revoke(id);
      loadKeys();
    } catch (e) {
      setError(e.message);
    } finally {
      setRevokingId(null);
    }
  };

  const generateSessionToken = async (e) => {
    e.preventDefault();
    setGenError("");
    setSessionResult(null);
    try {
      const data = await createSessionToken(sessionForm.apiKey, {
        participantName: sessionForm.participantName,
        roomName: sessionForm.roomName || undefined,
      });
      setSessionResult(data);
    } catch (e) {
      setGenError(e.message);
    }
  };

  const base = serverUrl();
  const curlExample = `curl -X POST ${base}/api/sessions/token \\
  -H "X-Api-Key: vl_your_secret_key" \\
  -H "Content-Type: application/json" \\
  -d '{"participantName":"Alice","roomName":"Sales standup"}'`;

  return (
    <div className="apikeys-view dev-portal">
      <div className="dev-portal-hero">
        <div className="view-header dev-portal-title">
          <FiCode size={22} />
          <div>
            <h2>Developer Portal</h2>
            <p className="dev-portal-tagline">
              Register as a client, create API keys, and embed VoiceLink audio and video in your product.
            </p>
          </div>
        </div>
      </div>

      <nav className="dev-portal-tabs" aria-label="Developer sections">
        <button type="button" className={tab === "overview" ? "active" : ""} onClick={() => setTab("overview")}>
          <FiHome size={15} /> Overview
        </button>
        <button type="button" className={tab === "keys" ? "active" : ""} onClick={() => setTab("keys")}>
          <FiKey size={15} /> API keys
        </button>
        <button type="button" className={tab === "reference" ? "active" : ""} onClick={() => setTab("reference")}>
          <FiBook size={15} /> API reference
        </button>
      </nav>

      {error && <p className="error-msg">{error}</p>}

      {tab === "overview" && (
        <div className="dev-portal-panel">
          <div className="dev-account-card">
            <span className="section-title" style={{ marginBottom: 8 }}>Your account</span>
            <p className="dev-account-name">{profile.username}</p>
            {profile.companyName && (
              <p className="dev-account-meta"><strong>Organization</strong> {profile.companyName}</p>
            )}
            {profile.email && (
              <p className="dev-account-meta"><strong>Email</strong> {profile.email}</p>
            )}
            {!profile.email && !profile.companyName && (
              <p className="dev-account-hint">
                Add organization and email on your next registration, or contact support to update your profile.
              </p>
            )}
          </div>

          <div className="api-explainer dev-overview-steps">
            <h3>How integration works</h3>
            <ol>
              <li>Create an <strong>API key</strong> under API keys (keep it on your server only).</li>
              <li>From your backend, call <code>POST /api/sessions/token</code> with header <code>X-Api-Key</code>.</li>
              <li>Use the returned <strong>joinUrl</strong> for participants or pass <strong>sessionToken</strong> to Socket.IO.</li>
              <li>Participants get real-time audio, video, and screen share inside the VoiceLink room.</li>
            </ol>
          </div>

          <div className="dev-capabilities">
            <div className="dev-cap-item">
              <FiShield className="dev-cap-icon" />
              <div>
                <strong>Scoped sessions</strong>
                <p>Optional permissions object for video, audio, and screen per token.</p>
              </div>
            </div>
            <div className="dev-cap-item">
              <FiKey className="dev-cap-icon" />
              <div>
                <strong>Key rotation</strong>
                <p>Issue multiple keys, revoke any time from this portal.</p>
              </div>
            </div>
          </div>

          <button type="button" className="join-btn dev-portal-cta" onClick={() => setTab("keys")}>
            <FiKey size={16} /> Manage API keys
          </button>
        </div>
      )}

      {tab === "keys" && (
        <div className="dev-portal-panel">
          <h3 className="section-title">Create API key</h3>
          <p className="dev-panel-lead">Keys authenticate your server to VoiceLink. Never expose them in mobile or browser bundles.</p>

          <form className="create-room-form" onSubmit={createKey}>
            <input
              className="join-input"
              placeholder="Label (e.g. Production CRM)"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              autoComplete="off"
            />
            <button className="join-btn create-btn" type="submit" disabled={creating || !newKeyName.trim()}>
              <FiPlus size={16} />
              {creating ? "Generating…" : "Generate key"}
            </button>
          </form>

          {newKey && (
            <div className="new-key-banner">
              <span className="key-label">Copy this secret now — it is not shown again:</span>
              <div className="key-display">
                <code>{newKey}</code>
                <button type="button" className="copy-btn" onClick={() => copyText(newKey)}>
                  {copied ? <FiCheckCircle size={16} /> : <FiCopy size={16} />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
          )}

          <h3 className="section-title" style={{ marginTop: 28 }}>Active keys</h3>
          {keysLoading ? (
            <p className="muted-text">Loading…</p>
          ) : keys.length === 0 ? (
            <p className="muted-text">No keys yet. Create one above.</p>
          ) : (
            <div className="keys-list">
              {keys.map((k) => (
                <div key={k.id} className="key-card key-card-with-actions">
                  <div className="key-card-main">
                    <span className="key-name">{k.name}</span>
                    <span className="key-preview">{k.keyPreview}</span>
                    <span className="key-date">{new Date(k.createdAt).toLocaleString()}</span>
                  </div>
                  <button
                    type="button"
                    className="btn-revoke-key"
                    disabled={revokingId === k.id}
                    onClick={() => revokeKey(k.id, k.name)}
                    title="Revoke key"
                  >
                    <FiTrash2 size={14} />
                    {revokingId === k.id ? "…" : "Revoke"}
                  </button>
                </div>
              ))}
            </div>
          )}

          <h3 className="section-title" style={{ marginTop: 32 }}>Try it — session token</h3>
          <p className="dev-panel-lead">Paste a key you just created to mint a join link (same request your backend will make).</p>
          <form className="session-form" onSubmit={generateSessionToken}>
            <input
              className="join-input"
              placeholder="API key (vl_…)"
              value={sessionForm.apiKey}
              onChange={(e) => setSessionForm((p) => ({ ...p, apiKey: e.target.value }))}
              autoComplete="off"
            />
            <input
              className="join-input"
              placeholder="Participant display name"
              value={sessionForm.participantName}
              onChange={(e) => setSessionForm((p) => ({ ...p, participantName: e.target.value }))}
            />
            <input
              className="join-input"
              placeholder="Room name (optional — auto-created if empty)"
              value={sessionForm.roomName}
              onChange={(e) => setSessionForm((p) => ({ ...p, roomName: e.target.value }))}
            />
            <button
              className="join-btn"
              type="submit"
              disabled={!sessionForm.apiKey || !sessionForm.participantName}
            >
              Create session token
            </button>
          </form>

          {genError && <p className="error-msg">{genError}</p>}

          {sessionResult && (
            <div className="session-result">
              <p className="result-label">
                Session created. Expires {new Date(sessionResult.expiresAt).toLocaleString()}
              </p>
              <div className="result-item">
                <span>Join URL</span>
                <a href={sessionResult.joinUrl} target="_blank" rel="noreferrer" className="join-link">
                  {sessionResult.joinUrl}
                </a>
                <button type="button" className="copy-btn" onClick={() => copyText(sessionResult.joinUrl)}>
                  <FiCopy size={14} /> Copy
                </button>
              </div>
              <div className="result-item">
                <span>Room</span>
                <code>{sessionResult.roomName} ({sessionResult.roomId})</code>
              </div>
              <div className="result-item">
                <span>Permissions</span>
                <code>{JSON.stringify(sessionResult.permissions)}</code>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "reference" && (
        <div className="dev-portal-panel">
          <div className="api-explainer">
            <h3>Base URL</h3>
            <p className="dev-ref-p">Your deployment API root:</p>
            <div className="code-block">
              <code>{base}</code>
            </div>
          </div>

          <h3 className="section-title" style={{ marginTop: 24 }}>POST /api/sessions/token</h3>
          <p className="dev-ref-p">Headers: <code>X-Api-Key</code>, <code>Content-Type: application/json</code></p>
          <p className="dev-ref-p">Body fields:</p>
          <ul className="dev-ref-list">
            <li><code>participantName</code> (required) — shown in the call</li>
            <li><code>roomName</code> — if omitted with no <code>roomId</code>, a room is created for you</li>
            <li><code>roomId</code> — join an existing room owned by your account</li>
            <li><code>permissions</code> — <code>{`{ "video": true, "audio": true, "screen": true }`}</code></li>
            <li><code>expiresIn</code> — JWT expiry string (default 1h), e.g. <code>&quot;2h&quot;</code></li>
          </ul>
          <div className="code-block">
            <code>{curlExample}</code>
          </div>

          <h3 className="section-title" style={{ marginTop: 24 }}>Socket.IO</h3>
          <p className="dev-ref-p">Connect with the <code>sessionToken</code> as auth to join the room from a custom client:</p>
          <div className="code-block">
            <code>{`io("${base}", { auth: { token: "<sessionToken>" } })`}</code>
          </div>

          <h3 className="section-title" style={{ marginTop: 24 }}>GET /api/sessions/verify</h3>
          <p className="dev-ref-p">Header <code>X-Session-Token</code> — validate a token server-side before redirecting users.</p>
        </div>
      )}
    </div>
  );
}
