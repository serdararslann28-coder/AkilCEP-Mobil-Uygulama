import { Router, type IRouter } from "express";
import healthRouter from "./health";
import voiceRouter from "./openai/voice";
import conversationsRouter from "./openai/conversations";
import geminiTestRouter from "./gemini/test";
import geminiChatRouter from "./gemini/chat";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/openai", conversationsRouter);
router.use("/openai", voiceRouter);
router.use("/gemini", geminiTestRouter);
router.use("/gemini", geminiChatRouter);

export default router;
