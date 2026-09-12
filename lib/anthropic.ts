import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface MoodInterpretation {
  vibeSummary: string;
  searchQueries: string[];
}

// We force Claude to answer through a tool call rather than free text so we
// get back strict, parseable JSON every time (no markdown fences to strip,
// no "here's your answer:" preamble to trim).
const EXTRACT_MOOD_TOOL: Anthropic.Tool = {
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
  moodText: string
): Promise<MoodInterpretation> {
  const message = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 500,
    system:
      "You translate a person's free-text mood or situation into search terms that will find good matching playlists on Spotify. Favor the kind of phrasing real Spotify playlist titles use (e.g. 'sad girl autumn', 'gym pump up', 'sunday morning jazz') over clinical mood labels.",
    messages: [{ role: "user", content: moodText }],
    tools: [EXTRACT_MOOD_TOOL],
    tool_choice: { type: "tool", name: "submit_mood_queries" },
  });

  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );

  if (!toolUse) {
    throw new Error("Claude did not return the expected tool call.");
  }

  return toolUse.input as MoodInterpretation;
}
