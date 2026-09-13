import { useEffect, useRef, useState } from "react";
import { IconClose } from "./icons";
import type { OsuFolderSelection, OsuFolderSettings } from "@shared/types";
import { MIRRORS, type MirrorId } from "@shared/mirrors";

interface Props {
  onClose: () => void;
  onSaved: () => void;
  firstRun: boolean;
  downloading: boolean;
  onFolderChanged: (selection: OsuFolderSelection | null) => void;
}

export function SettingsModal({ onClose, onSaved, firstRun, downloading, onFolderChanged }: Props) {
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [remember, setRemember] = useState(false);
  const [hasSecret, setHasSecret] = useState(false);
  const [loading, setLoading] = useState(true);
  const dialog = useRef<HTMLDialogElement>(null);
  const [folderSettings, setFolderSettings] = useState<OsuFolderSettings>({ remember: false, autoDetect: false });
  const [folder, setFolder] = useState<OsuFolderSelection | null>(null);
  const [folderLoading, setFolderLoading] = useState(true);
  const [folderSaving, setFolderSaving] = useState(false);
  const [folderMessage, setFolderMessage] = useState("");
  const [folderError, setFolderError] = useState("");
  const [disabledMirrors, setDisabledMirrors] = useState<MirrorId[] | null>(null);
  const [mirrorSaving, setMirrorSaving] = useState(false);
  const [mirrorError, setMirrorError] = useState("");

  useEffect(() => {
    dialog.current?.showModal();
    void Promise.all([window.api.getOsuFolderSettings(), window.api.getOsuFolder()]).then(([preferences, selection]) => {
      setFolderSettings(preferences);
      setFolder(selection);
    }).catch(() => setFolderError("Could not read osu! folder preferences."))
      .finally(() => setFolderLoading(false));
    void window.api.getDisabledMirrors().then(setDisabledMirrors)
      .catch(() => setMirrorError("Could not read mirror settings."));
    void window.api.getCredentialSettings().then((settings) => {
      setClientId(settings.clientId);
      setHasSecret(settings.hasSecret);
      setRemember(settings.remember);
    }).catch((error) => setSaveError(error instanceof Error ? error.message : "Could not read credentials."))
      .finally(() => setLoading(false));
  }, []);

  async function updateFolder(choose = false): Promise<void> {
    setFolderSaving(true); setFolderMessage(""); setFolderError("");
    try {
      const selection = choose ? await window.api.chooseOsuFolder() : await window.api.setOsuFolderSettings(folderSettings);
      if (choose && !selection) return;
      setFolder(selection);
      onFolderChanged(selection);
      if (!choose) setFolderMessage(selection ? "Folder preferences saved." : folderSettings.autoDetect ? "Preferences saved. No installation found; choose your osu! folder manually." : "Preferences saved. Choose a folder to use during this session.");
    } catch (error) { setFolderError(error instanceof Error ? error.message : "Could not save folder preferences."); }
    finally { setFolderSaving(false); }
  }

  async function toggleMirror(id: MirrorId, enabled: boolean): Promise<void> {
    setMirrorSaving(true); setMirrorError("");
    try { setDisabledMirrors(await window.api.setMirrorEnabled(id, enabled)); }
    catch (error) { setMirrorError(error instanceof Error ? error.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, "") : "Could not save mirror settings."); }
    finally { setMirrorSaving(false); }
  }

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
    <dialog ref={dialog} className="settings-dialog" onCancel={(event) => { if (saving || folderSaving) event.preventDefault(); else onClose(); }}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <span id="settings-title">Settings</span>
          <button className="modal-close" aria-label="Close settings" onClick={onClose} disabled={saving || folderSaving}>
            <IconClose />
          </button>
        </div>

        {firstRun && (
          <p className="modal-note">
            Set your osu! API credentials to get started. Search will not work without them.
          </p>
        )}

        <div className="modal-columns">
          <section className="modal-col" aria-labelledby="api-settings-title">
            <strong id="api-settings-title" className="modal-section-title">osu! API</strong>
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

        <div className="modal-actions">
          <button className="primary-button" onClick={handleSave} disabled={saving || loading || !clientId.trim() || (!clientSecret.trim() && !hasSecret)}>
            {saving ? "Saving..." : "Save credentials"}
          </button>
          <button onClick={() => void forget()} disabled={saving || loading}>Forget saved credentials</button>
        </div>
          </section>
          <section className="modal-col" aria-labelledby="folder-settings-title">
            <strong id="folder-settings-title" className="modal-section-title">osu! folder</strong>
          <label className="remember-credentials">
            <input type="checkbox" checked={folderSettings.remember} disabled={downloading || folderLoading || folderSaving} onChange={(e) => setFolderSettings({ ...folderSettings, remember: e.target.checked })} />
            Remember my osu! folder on this PC
          </label>
          <label className="remember-credentials">
            <input type="checkbox" checked={folderSettings.autoDetect} disabled={downloading || folderLoading || folderSaving} onChange={(e) => setFolderSettings({ ...folderSettings, autoDetect: e.target.checked })} />
            Find osu! automatically at launch
          </label>
          <p className="modal-note">Uses your remembered location first. Automatic detection checks registered and common installations, including their configured Songs folder. These preferences survive portable app updates.</p>
          {folder && <p className="folder-location">osu!: {folder.osuFolder}<br />Songs: {folder.songsFolder}</p>}
          <div className="preset-actions">
            <button onClick={() => void updateFolder(true)} disabled={downloading || folderLoading || folderSaving}>Choose folder</button>
            <button onClick={() => void updateFolder()} disabled={downloading || folderLoading || folderSaving}>{folderSaving ? "Saving…" : "Save folder preferences"}</button>
          </div>
          {folderMessage && <p className="modal-note" role="status">{folderMessage}</p>}
          {folderError && <p className="error-text" role="alert">{folderError}</p>}
          </section>
        </div>

        <section className="mirror-settings" aria-labelledby="mirror-settings-title">
          <strong id="mirror-settings-title" className="modal-section-title">Download mirrors</strong>
          <div className="mirror-options">
            {MIRRORS.map((mirror) => {
              const enabled = disabledMirrors !== null && !disabledMirrors.includes(mirror.id);
              const lastEnabled = enabled && disabledMirrors.length === MIRRORS.length - 1;
              return (
                <label key={mirror.id} className="remember-credentials" title={lastEnabled ? "At least one mirror has to stay on" : new URL(mirror.template).host}>
                  <input
                    type="checkbox"
                    checked={enabled}
                    disabled={downloading || disabledMirrors === null || mirrorSaving || lastEnabled}
                    onChange={(e) => void toggleMirror(mirror.id, e.target.checked)}
                  />
                  {mirror.name}
                </label>
              );
            })}
          </div>
          <p className="modal-note">
            Each map is tried on the enabled mirrors from left to right until one has it. Turning off a mirror that is down or slow for you skips the wait on it. At least one has to stay on.
            {downloading && " Mirrors can be changed once the current batch is done."}
          </p>
          {mirrorError && <p className="error-text" role="alert">{mirrorError}</p>}
        </section>
      </div>
    </dialog>
  );
}
