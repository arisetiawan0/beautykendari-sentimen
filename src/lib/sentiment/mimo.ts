import { z } from "zod";

import { getMimoConfig } from "@/lib/config";

const SentimentResultSchema = z.object({
  id: z.string(),
  sentiment: z.enum(["positive", "negative", "neutral"]),
  category: z.enum(["pertanyaan_produk", "komplain", "pujian", "spam", "lainnya"]),
  confidence: z.number().min(0).max(1),
  summary_reason: z.string().max(300).optional().default(""),
});

const SentimentResultsSchema = z.array(SentimentResultSchema);

type ClassifyCommentInput = {
  id: string;
  text: string;
};

export type SentimentResult = z.infer<typeof SentimentResultSchema>;

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

function getChatCompletionsEndpoint(baseUrl: string) {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");

  if (normalizedBaseUrl.endsWith("/chat/completions")) {
    return normalizedBaseUrl;
  }

  if (normalizedBaseUrl.endsWith("/v1")) {
    return `${normalizedBaseUrl}/chat/completions`;
  }

  return `${normalizedBaseUrl}/v1/chat/completions`;
}

function parseJsonContent(content: string) {
  const trimmed = content.trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    const arrayMatch = trimmed.match(/\[[\s\S]*\]/);

    if (arrayMatch) {
      return JSON.parse(arrayMatch[0]);
    }

    throw new Error("LLM response is not valid JSON");
  }
}

export async function classifyCommentsWithMimo(comments: ClassifyCommentInput[]) {
  if (comments.length === 0) {
    return [];
  }

  const config = getMimoConfig();

  const endpoint = getChatCompletionsEndpoint(config.mimoApiBaseUrl);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.mimoApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.mimoModel,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Kamu adalah classifier sentimen komentar Instagram/TikTok untuk bisnis beauty clinic di Kendari. Balas hanya JSON object valid dengan key results. Jangan markdown.",
        },
        {
          role: "user",
          content: JSON.stringify({
            task:
              "Klasifikasikan setiap komentar Bahasa Indonesia/slang ke sentimen, kategori, confidence, dan alasan singkat.",
            allowed_sentiment: ["positive", "negative", "neutral"],
            allowed_category: ["pertanyaan_produk", "komplain", "pujian", "spam", "lainnya"],
            output_schema: {
              results: [
                {
                  id: "raw_comment_id",
                  sentiment: "positive | negative | neutral",
                  category: "pertanyaan_produk | komplain | pujian | spam | lainnya",
                  confidence: 0.85,
                  summary_reason: "alasan singkat",
                },
              ],
            },
            comments,
          }),
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Mimo classification failed: ${response.status} ${body}`);
  }

  const body = (await response.json()) as ChatCompletionResponse;
  const content = body.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("Mimo response missing choices[0].message.content");
  }

  const parsed = parseJsonContent(content);
  const maybeArray = Array.isArray(parsed) ? parsed : parsed.results;

  return SentimentResultsSchema.parse(maybeArray) satisfies SentimentResult[];
}
