import { useState } from "react";
import { IconClose } from "./icons";

interface Props {
  onClose: () => void;
  onSaved: () => void;
  firstRun: boolean;
}

export function SettingsModal({ onClose, onSaved, firstRun }: Props) {
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave(): Promise<void> {
    if (!clientId.trim() || !clientSecret.trim()) return;
    setSaving(true);
    try {
      await window.api.setApiCredentials(clientId.trim(), clientSecret.trim());
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span>Settings</span>
          <button className="modal-close" onClick={onClose}>
            <IconClose />
          </button>
        </div>

        {firstRun && (
          <p className="modal-note">
            Set your osu! API credentials to get started. Search will not work without them.
          </p>
        )}

        <label className="modal-field">
          <span className="field-label">Client ID</span>
          <input type="text" value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="e.g. 12345" />
        </label>

        <label className="modal-field">
          <span className="field-label">Client Secret</span>
          <input
            type="password"
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
            placeholder="paste your client secret"
          />
        </label>

        <p className="modal-note">
          Register an OAuth app at{" "}
          <a href="https://osu.ppy.sh/home/account/edit" target="_blank" rel="noreferrer">
            osu.ppy.sh/home/account/edit
          </a>{" "}
          (client-credentials grant, no redirect URI needed).
        </p>

        <button className="primary-button" onClick={handleSave} disabled={saving || !clientId.trim() || !clientSecret.trim()}>
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}
