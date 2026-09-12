import { useEffect, useRef } from "react";

interface MoodFormProps {
  mood: string;
  onMoodChange: (mood: string) => void;
  onSubmit: () => void;
  loading: boolean;
}

export function MoodForm({ mood, onMoodChange, onSubmit, loading }: MoodFormProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [mood]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="relative rounded-3xl bg-white border border-ink-900/10 shadow-input focus-within:border-clay-600/40 transition-colors">
        <textarea
          ref={textareaRef}
          value={mood}
          onChange={(e) => onMoodChange(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder="e.g. it's raining, I'm on my third coffee, and I have three deadlines today"
          className="w-full resize-none bg-transparent px-5 pt-4 pb-14 text-[15px] leading-6 text-ink-900 placeholder:text-ink-300 focus:outline-none"
        />
        <div className="absolute bottom-3 right-3">
          <button
            type="submit"
            disabled={loading || !mood.trim()}
            aria-label="Find playlists"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-clay-600 text-white transition-colors hover:bg-clay-700 disabled:bg-ink-300 disabled:cursor-not-allowed"
          >
            {loading ? (
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                />
              </svg>
            ) : (
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path
                  d="M12 19V5M5 12l7-7 7 7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
