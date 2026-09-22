import { Router } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { conversations, messages } from "@workspace/db/schema";
import { adminAuth } from "../middlewares/adminAuth";

const router = Router();

router.get("/dashboard", adminAuth, async (_req, res) => {
  try {
    const [
      conversationCount,
      messageCount,
      todayMessageCount,
      todayConversationCount,
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(conversations),
      db.select({ count: sql<number>`count(*)` }).from(messages),
      db
        .select({ count: sql<number>`count(*)` })
        .from(messages)
        .where(sql`"created_at" >= CURRENT_DATE`),
      db
        .select({ count: sql<number>`count(*)` })
        .from(conversations)
        .where(sql`"created_at" >= CURRENT_DATE`),
    ]);

    res.json({
      ok: true,
      dashboard: {
        conversations: Number(conversationCount[0]?.count ?? 0),
        messages: Number(messageCount[0]?.count ?? 0),
        todayMessages: Number(todayMessageCount[0]?.count ?? 0),
        todayConversations: Number(todayConversationCount[0]?.count ?? 0),
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("[admin-dashboard]", error);

    res.status(500).json({
      error: "DashboardError",
      message: "Dashboard verileri alınamadı.",
    });
  }
});

export default router;
