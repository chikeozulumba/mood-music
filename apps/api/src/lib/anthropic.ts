// Raw fetch to the Claude Messages API rather than the Node SDK — keeps the
// Worker bundle small and avoids any Workers-runtime compatibility questions.
// We force a tool call so the response is always strict, parseable JSON (no
// markdown fences to strip, no "here's your answer:" preamble to trim).

export interface MoodInterpretation {
  vibeSummary: string;
  searchQueries: string[];
}

const EXTRACT_MOOD_TOOL = {
  name: "submit_mood_queries",
  description:
    "Submit the interpreted vibe and a set of Spotify playlist search queries for the user's mood.",
  input_schema: {
    type: "object",
    properties: {
      vibeSummary: {
        type: "string",
        description:
          "One short, human-readable sentence describing the mood/vibe, to show back to the user.",
      },
      searchQueries: {
        type: "array",
        items: { type: "string" },
        minItems: 3,
        maxItems: 5,
        description:
          "3-5 short search phrases (genres, moods, activities, adjectives) suited to Spotify's playlist search, e.g. 'rainy day lofi', 'melancholy indie folk', 'late night study beats'.",
      },
    },
    required: ["vibeSummary", "searchQueries"],
  },
};

export async function interpretMood(
  moodText: string,
  apiKey: string
): Promise<MoodInterpretation> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 500,
      system:
        "You translate a person's free-text mood or situation into search terms that will find good matching playlists on Spotify. Favor the kind of phrasing real Spotify playlist titles use (e.g. 'sad girl autumn', 'gym pump up', 'sunday morning jazz') over clinical mood labels.",
      messages: [{ role: "user", content: moodText }],
      tools: [EXTRACT_MOOD_TOOL],
      tool_choice: { type: "tool", name: "submit_mood_queries" },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Claude API error (${res.status}): ${text}`);
  }

  const data = (await res.json()) as {
    content: Array<{ type: string; input?: unknown }>;
  };

  const toolUse = data.content.find((block) => block.type === "tool_use");

  if (!toolUse) {
    throw new Error("Claude did not return the expected tool call.");
  }

  return toolUse.input as MoodInterpretation;
}
