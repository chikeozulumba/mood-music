import { useEffect, useState } from "react";
import {
  clearAnthropicKey,
  fetchAnthropicKeyStatus,
  saveAnthropicKey,
} from "@/lib/api-client";
import { toast } from "sonner";

interface AnthropicKeyModalProps {
  open: boolean;
  onClose: () => void;
}

export function AnthropicKeyModal({ open, onClose }: AnthropicKeyModalProps) {
  const [hasOwnKey, setHasOwnKey] = useState<boolean | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setApiKey("");
    fetchAnthropicKeyStatus()
      .then((data) => setHasOwnKey(data.hasOwnKey))
      .catch(() => setHasOwnKey(false));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  async function handleSave() {
    const trimmed = apiKey.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      const data = await saveAnthropicKey(trimmed);
      setHasOwnKey(data.hasOwnKey);
      setApiKey("");
      toast.success("Your Anthropic API key is saved.", {
        description: "Your searches now use your own key, with no weekly limit.",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      toast.error("Couldn't save that key", { description: message });
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    setSaving(true);
    try {
      const data = await clearAnthropicKey();
      setHasOwnKey(data.hasOwnKey);
      toast("Removed your API key.", {
        description: "Searches will use the shared key again (10/week).",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      toast.error("Couldn't remove that key", { description: message });
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 px-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="anthropic-key-modal-title"
        className="w-full max-w-sm rounded-2xl bg-white p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="anthropic-key-modal-title"
          className="font-serif text-xl text-ink-900 mb-2"
        >
          Your Anthropic API key
        </h2>
        <p className="text-sm text-ink-500 mb-4">
          Mood searches use a shared key, capped at 10 per week. Add your own
          Anthropic API key to search without that limit — it's used only
          for your own searches.
        </p>

        {hasOwnKey && (
          <div className="mb-4 rounded-xl bg-cream-100 px-3 py-2 text-sm text-ink-700">
            A key is currently saved on your account.
          </div>
        )}

        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-ant-..."
          autoComplete="off"
          className="mb-4 w-full rounded-xl border border-ink-900/10 bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-ink-300 focus:outline-none focus:border-clay-600/40"
        />

        <div className="flex flex-col gap-2">
          <button
            onClick={handleSave}
            disabled={saving || !apiKey.trim()}
            className="rounded-full bg-clay-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-clay-700 disabled:bg-ink-300 disabled:cursor-not-allowed"
          >
            {saving ? "Saving…" : "Save key"}
          </button>
          {hasOwnKey && (
            <button
              onClick={handleRemove}
              disabled={saving}
              className="rounded-full px-4 py-2 text-sm text-ink-500 hover:text-ink-900"
            >
              Remove saved key
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded-full px-4 py-2 text-sm text-ink-500 hover:text-ink-900"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
