import { useEffect, useRef, useState } from "react";
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
  const [saveError, setSaveError] = useState<string | null>(null);
  const [remember, setRemember] = useState(false);
  const [hasSecret, setHasSecret] = useState(false);
  const [loading, setLoading] = useState(true);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialog.current?.showModal();
    void window.api.getCredentialSettings().then((settings) => {
      setClientId(settings.clientId);
      setHasSecret(settings.hasSecret);
      setRemember(settings.remember);
    }).catch((error) => setSaveError(error instanceof Error ? error.message : "Could not read credentials."))
      .finally(() => setLoading(false));
  }, []);

  async function forget(): Promise<void> {
    setSaving(true);
    try {
      await window.api.forgetApiCredentials();
      setClientId(""); setClientSecret(""); setHasSecret(false); setRemember(false); setSaveError(null);
    } catch { setSaveError("Could not remove saved credentials. Please try again."); }
    finally { setSaving(false); }
  }

  async function handleSave(): Promise<void> {
    if (!clientId.trim() || (!clientSecret.trim() && !hasSecret)) return;
    setSaving(true);
    setSaveError(null);
    try {
      const result = await window.api.setApiCredentials(clientId.trim(), clientSecret.trim(), remember);
      if (!result.ok) {
        setSaveError(result.error);
        return;
      }
      onSaved();
      onClose();
    } catch {
      setSaveError("Could not save credentials. Check that the app folder is writable and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog ref={dialog} className="settings-dialog" onCancel={(event) => { if (saving) event.preventDefault(); else onClose(); }}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <span id="settings-title">Settings</span>
          <button className="modal-close" aria-label="Close settings" onClick={onClose} disabled={saving}>
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
          <input type="text" value={clientId} onChange={(e) => { setClientId(e.target.value); setHasSecret(false); }} placeholder="e.g. 12345" disabled={saving || loading} />
        </label>

        <label className="modal-field">
          <span className="field-label">Client Secret</span>
          <input
            type="password"
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
            placeholder={hasSecret ? "Leave blank to keep the current secret" : "Paste your client secret"}
            disabled={saving || loading}
          />
        </label>

        <label className="remember-credentials">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} disabled={saving || loading} />
          Remember on this PC
        </label>
        <p className="modal-note">
          Saves your client ID and secret securely for this Windows account, even when you move or replace the app.
          Uncheck and save to use them only until you close the app.
        </p>
        <p className="modal-note">
          Register an OAuth app at{" "}
          <a href="https://osu.ppy.sh/home/account/edit" target="_blank" rel="noreferrer">
            osu.ppy.sh/home/account/edit
          </a>{" "}
          (client-credentials grant, no redirect URI needed).
        </p>

        {saveError && <p className="error-text" role="alert">{saveError}</p>}

        <button className="primary-button" onClick={handleSave} disabled={saving || loading || !clientId.trim() || (!clientSecret.trim() && !hasSecret)}>
          {saving ? "Saving..." : "Save"}
        </button>
        <button onClick={() => void forget()} disabled={saving || loading}>Forget saved credentials</button>
      </div>
    </dialog>
  );
}
