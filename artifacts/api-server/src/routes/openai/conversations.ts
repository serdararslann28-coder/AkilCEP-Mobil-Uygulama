/**
 * Conversations CRUD — list, create, get, delete.
 */
import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { conversations, messages } from "@workspace/db/schema";
import { insertConversationSchema } from "@workspace/db/schema";

const router: IRouter = Router();

// GET /openai/conversations
router.get("/conversations", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(conversations)
      .orderBy(conversations.createdAt);
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "list conversations error");
    res.status(500).json({ error: "Failed to list conversations" });
  }
});

// POST /openai/conversations
router.post("/conversations", async (req, res) => {
  const parsed = insertConversationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  try {
    const [row] = await db.insert(conversations).values(parsed.data).returning();
    res.status(201).json(row);
  } catch (err) {
    req.log.error({ err }, "create conversation error");
    res.status(500).json({ error: "Failed to create conversation" });
  }
});

// GET /openai/conversations/:id
router.get("/conversations/:id", async (req, res) => {
  const id = parseInt(req.params.id ?? "", 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    const [conv] = await db.select().from(conversations).where(eq(conversations.id, id));
    if (!conv) { res.status(404).json({ error: "Not found" }); return; }
    const msgs = await db.select().from(messages).where(eq(messages.conversationId, id));
    res.json({ ...conv, messages: msgs });
  } catch (err) {
    req.log.error({ err }, "get conversation error");
    res.status(500).json({ error: "Failed to get conversation" });
  }
});

// DELETE /openai/conversations/:id
router.delete("/conversations/:id", async (req, res) => {
  const id = parseInt(req.params.id ?? "", 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    const [row] = await db.delete(conversations).where(eq(conversations.id, id)).returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "delete conversation error");
    res.status(500).json({ error: "Failed to delete conversation" });
  }
});

export default router;
