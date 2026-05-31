import { Router, type IRouter } from "express";
import healthRouter from "./health";
import voiceRouter from "./openai/voice";
import conversationsRouter from "./openai/conversations";
import geminiTestRouter from "./gemini/test";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/openai", conversationsRouter);
router.use("/openai", voiceRouter);
router.use("/gemini", geminiTestRouter);

export default router;
