/**
 * Server-only bootstrap prompt builder.
 *
 * Generates a prompt instructing the model to return a single JSON object
 * containing characters, locations, and scenes derived solely from
 * Work.title and Work.description.
 */
export function buildBootstrapPrompt(title: string, description: string): string {
  const t = title.trim();
  const d = description.trim();

  return `You are a narrative data extraction and cataloguing assistant.

PRIORITY RULE — Canonical Facts First:
If the story title refers to a known published work (novel, TV series, film, game, manga, or any other published narrative), you MUST extract accurate canonical facts from your knowledge of that work. Use real character names, real locations, real plot events, and real quotes. Do NOT invent fictional details when the actual story facts are known to you.

If the story title does NOT refer to any known published work, then use the description below as creative inspiration to generate plausible narrative content.

Story Title: ${t}
Story Description: ${d}

Extract or generate a JSON object with exactly these three keys: "characters", "locations", "scenes".

Provide 5 to 8 characters, 3 to 5 locations, and 8 to 12 scenes.

Use this exact JSON structure:

{
  "characters": [
    {
      "name": "Character name",
      "house": "Faction, family, or group name. Use empty string if unknown.",
      "description": "Character description in 2–3 sentences.",
      "signatureQuote": "A memorable canonical quote from the character, or null if not applicable."
    }
  ],
  "locations": [
    {
      "name": "Location name",
      "region": "Region or area name. Use empty string if unknown.",
      "description": "Location description in 2–3 sentences."
    }
  ],
  "scenes": [
    {
      "title": "Scene title",
      "chapter_number": 1,
      "chapter_title": "Chapter title string, or null.",
      "summary": "Scene summary in 3–5 sentences describing what happens.",
      "locationIndex": 0,
      "characterIndices": [0, 1],
      "imageCaption": "A vivid visual description suitable for scene illustration."
    }
  ]
}

Rules you MUST follow:
1. "house" and "region" MUST be strings. Use "" (empty string) if unknown. Never use null.
2. "signatureQuote" may be null or a non-empty string. Never use "".
3. "locationIndex" MUST be a valid zero-based index into the "locations" array.
4. "characterIndices" MUST be valid zero-based indices into the "characters" array. Include 1 to 4 characters per scene.
5. Scenes MUST be ordered by "chapter_number" (ascending, starting from 1).
6. Every scene MUST reference exactly one location via "locationIndex".
7. Use the same language as the story title and description for all generated content.
8. Output ONLY the JSON object. No markdown, no explanation, no additional text.`;
}
