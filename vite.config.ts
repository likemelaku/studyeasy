import type { Connect } from "vite";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const SYSTEM_PROMPT = `You are a study assistant built specifically for high school students. Students at this school struggle with: short assignment deadlines, phone distractions happening up to 7 times a week, early school start times causing sleep loss, too much homework, balancing sports and family with school, and group project partners who do not contribute. Give short practical advice under 120 words. Speak like a helpful older student not a teacher. Be warm and direct.`;

const MODEL = "claude-sonnet-4-20250514";

type ApiChatMessage = { role: "user" | "assistant"; content: string };

function readBody(req: Connect.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c as Buffer));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function studyChatMiddleware(apiKey: string | undefined): Connect.NextHandleFunction {
  return async (req, res, next) => {
    const pathOnly = req.url?.split("?")[0] ?? "";
    if (pathOnly !== "/api/study-chat" || req.method !== "POST") {
      next();
      return;
    }

    if (!apiKey) {
      res.statusCode = 503;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          error:
            "Missing ANTHROPIC_API_KEY. Add it to your .env file and restart the dev or preview server.",
        })
      );
      return;
    }

    let raw: string;
    try {
      raw = await readBody(req);
    } catch {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Could not read request body." }));
      return;
    }

    let body: unknown;
    try {
      body = JSON.parse(raw || "{}");
    } catch {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Invalid JSON body." }));
      return;
    }

    const messages =
      typeof body === "object" &&
      body !== null &&
      "messages" in body &&
      Array.isArray((body as { messages: unknown }).messages)
        ? (body as { messages: unknown[] }).messages
        : null;

    if (!messages) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Expected { messages: [...] }." }));
      return;
    }

    const normalized: ApiChatMessage[] = [];
    for (const m of messages) {
      if (
        typeof m !== "object" ||
        m === null ||
        !("role" in m) ||
        !("content" in m)
      ) {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Invalid message shape." }));
        return;
      }
      const role = (m as { role: unknown }).role;
      const content = (m as { content: unknown }).content;
      if (
        (role !== "user" && role !== "assistant") ||
        typeof content !== "string" ||
        !content.trim()
      ) {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Invalid message role or content." }));
        return;
      }
      normalized.push({ role, content });
    }

    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          messages: normalized,
        }),
      });

      const data: unknown = await r.json().catch(() => ({}));

      if (!r.ok) {
        const errMsg =
          typeof data === "object" &&
          data !== null &&
          "error" in data &&
          typeof (data as { error: unknown }).error === "object" &&
          (data as { error: { message?: unknown } }).error !== null &&
          typeof (data as { error: { message?: unknown } }).error.message ===
            "string"
            ? (data as { error: { message: string } }).error.message
            : `Anthropic API error (${r.status})`;
        res.statusCode = 502;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: errMsg }));
        return;
      }

      const contentBlocks =
        typeof data === "object" &&
        data !== null &&
        "content" in data &&
        Array.isArray((data as { content: unknown }).content)
          ? (data as { content: unknown[] }).content
          : [];

      let text = "";
      for (const block of contentBlocks) {
        if (
          typeof block === "object" &&
          block !== null &&
          "type" in block &&
          (block as { type: unknown }).type === "text" &&
          "text" in block &&
          typeof (block as { text: unknown }).text === "string"
        ) {
          text += (block as { text: string }).text;
        }
      }

      if (!text.trim()) {
        res.statusCode = 502;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "No text in model response." }));
        return;
      }

      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ text: text.trim() }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upstream request failed.";
      res.statusCode = 502;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: msg }));
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [
      react(),
      {
        name: "studyease-study-chat-api",
        configureServer(server) {
          server.middlewares.use(studyChatMiddleware(env.ANTHROPIC_API_KEY));
        },
        configurePreviewServer(server) {
          server.middlewares.use(studyChatMiddleware(env.ANTHROPIC_API_KEY));
        },
      },
    ],
  };
});
