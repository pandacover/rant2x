import { generateText, Output } from "ai";
import { z } from "zod";
import { demoRewrite } from "@/lib/article";
import { getRewriteModel, hasAiCredentials } from "@/lib/rewrite-model";

const requestSchema = z.object({
  rant: z.string().trim().min(1, "Rant is required").max(20_000),
});

const articleSchema = z.object({
  title: z
    .string()
    .describe("A clear, specific headline. No clickbait, no fake numbers."),
  body: z
    .string()
    .describe(
      "The article body as paragraphs separated by blank lines. Faithful to the rant."
    ),
});

const SYSTEM = `You turn a spoken or pasted rant into a polished X (Twitter) Article.

Rules:
- Stay faithful to the author's point, examples, and tone. Punchy is fine; invention is not.
- Do not add statistics, quotes, named studies, products, or people that are not in the rant.
- Title: specific, human, under 90 characters. No all-caps. No hashtag dump.
- Body: 2–8 short paragraphs. You may include a few short section labels on their own lines.
- No preamble ("Here is your article"), no CTA to follow, no invented bio.
- Write in the author's voice, cleaned up for long-form reading.`;

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ error: "Send JSON with a rant string." }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid rant." },
      { status: 400 }
    );
  }

  const { rant } = parsed.data;

  if (!hasAiCredentials()) {
    const draft = demoRewrite(rant);
    return Response.json({ ...draft, demo: true });
  }

  try {
    const { output } = await generateText({
      model: getRewriteModel(),
      output: Output.object({ schema: articleSchema }),
      system: SYSTEM,
      prompt: `Rewrite this rant as an X Article.\n\n---\n${rant}\n---`,
      maxOutputTokens: 2500,
    });

    if (!output?.title?.trim() || !output?.body?.trim()) {
      return Response.json(
        { error: "The model returned an empty article. Try again." },
        { status: 502 }
      );
    }

    return Response.json({
      title: output.title.trim(),
      body: output.body.trim(),
      demo: false,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Rewrite failed. Try again.";
    return Response.json({ error: message }, { status: 502 });
  }
}
