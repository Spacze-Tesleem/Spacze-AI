import { Router } from "express";
import { db } from "@workspace/db";
import { conversations, messages } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import { generateImageBuffer } from "@workspace/integrations-openai-ai-server/image";
import {
  CreateOpenaiConversationBody,
  SendOpenaiMessageBody,
  GetOpenaiConversationParams,
  DeleteOpenaiConversationParams,
  ListOpenaiMessagesParams,
  SendOpenaiMessageParams,
  GenerateOpenaiImageBody,
} from "@workspace/api-zod";

const router = Router();

// List all conversations
router.get("/openai/conversations", async (req, res) => {
  const convs = await db
    .select()
    .from(conversations)
    .orderBy(desc(conversations.createdAt));
  res.json(convs);
});

// Create a conversation
router.post("/openai/conversations", async (req, res) => {
  const body = CreateOpenaiConversationBody.parse(req.body);
  const [conv] = await db
    .insert(conversations)
    .values({ title: body.title })
    .returning();
  res.status(201).json(conv);
});

// Get a conversation with messages
router.get("/openai/conversations/:id", async (req, res) => {
  const { id } = GetOpenaiConversationParams.parse({ id: parseInt(req.params.id) });
  const conv = await db.query.conversations.findFirst({
    where: eq(conversations.id, id),
  });
  if (!conv) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(messages.createdAt);
  res.json({ ...conv, messages: msgs });
});

// Delete a conversation
router.delete("/openai/conversations/:id", async (req, res) => {
  const { id } = DeleteOpenaiConversationParams.parse({ id: parseInt(req.params.id) });
  const [conv] = await db
    .delete(conversations)
    .where(eq(conversations.id, id))
    .returning();
  if (!conv) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  res.status(204).send();
});

// List messages
router.get("/openai/conversations/:id/messages", async (req, res) => {
  const { id } = ListOpenaiMessagesParams.parse({ id: parseInt(req.params.id) });
  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(messages.createdAt);
  res.json(msgs);
});

// Send a message (streaming SSE)
router.post("/openai/conversations/:id/messages", async (req, res) => {
  const { id } = SendOpenaiMessageParams.parse({ id: parseInt(req.params.id) });
  const body = SendOpenaiMessageBody.parse(req.body);

  const conv = await db.query.conversations.findFirst({
    where: eq(conversations.id, id),
  });
  if (!conv) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  // Strip any SYSTEM_HINT injected by the client toolbar before persisting.
  // The hint augments the system prompt; it must not appear in chat history.
  const HINT_RE = /^\[SYSTEM_HINT:([^\]]*)\]\n?/;
  const hintMatch = body.content.match(HINT_RE);
  const systemHint = hintMatch ? hintMatch[1].trim() : "";
  const userContent = body.content.replace(HINT_RE, "");

  // Save user message (without the hint prefix)
  await db.insert(messages).values({
    conversationId: id,
    role: "user",
    content: userContent,
  });

  // Get conversation history
  const history = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(messages.createdAt);

  const chatMessages = history.map((m) => ({
    role: m.role as "user" | "assistant" | "system",
    content: m.content,
  }));

  // Build system prompt, appending any client-side mode/tool hints
  const baseSystemContent = `You are Spacze AI Agent, an advanced AI-powered development assistant embedded in the Spacze cloud IDE. You help developers build, debug, and deploy full-stack applications using natural language. You can:
- Generate full application scaffolds from descriptions
- Provide intelligent code suggestions and completions
- Debug errors and suggest fixes
- Explain code and architecture decisions
- Support frameworks like React, Next.js, Flask, Django, Express, FastAPI, Vue
- Create full-stack applications end-to-end

Be concise, technical, and practical. Format code in markdown code blocks with the language specified.`;

  const systemPrompt = {
    role: "system" as const,
    content: systemHint
      ? `${baseSystemContent}\n\nAdditional instructions for this request: ${systemHint}`
      : baseSystemContent,
  };

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  let fullResponse = "";

  try {
    const stream = await openai.chat.completions.create({
      model: process.env.AI_CHAT_MODEL ?? "google/gemma-3-27b-it:free",
      max_tokens: 8192,
      messages: [systemPrompt, ...chatMessages],
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        fullResponse += content;
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    // Save assistant message
    await db.insert(messages).values({
      conversationId: id,
      role: "assistant",
      content: fullResponse,
    });

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: "AI service error" })}\n\n`);
    res.end();
  }
});

// Generate image
// Image generation requires a provider that supports it (e.g. OpenAI directly).
// When using OpenRouter's free tier this endpoint returns 503 with a clear message.
router.post("/openai/generate-image", async (req, res) => {
  const body = GenerateOpenaiImageBody.parse(req.body);

  if (!process.env.AI_INTEGRATIONS_OPENAI_BASE_URL?.includes("openai.com")) {
    res.status(503).json({
      error: "Image generation requires a direct OpenAI key. Set AI_INTEGRATIONS_OPENAI_BASE_URL=https://api.openai.com/v1 and a paid API key to enable this feature.",
    });
    return;
  }

  const size = (body.size || "1024x1024") as "1024x1024" | "1536x1024" | "1024x1536";
  const buffer = await generateImageBuffer(body.prompt, size);
  res.json({ b64_json: buffer.toString("base64") });
});

export default router;
