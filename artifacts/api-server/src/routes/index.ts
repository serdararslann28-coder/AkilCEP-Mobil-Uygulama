import { Router, type IRouter } from "express";
import healthRouter from "./health";
import adminRouter from "./admin";
import adminDashboardRouter from "./adminDashboard";
import voiceRouter from "./openai/voice";
import conversationsRouter from "./openai/conversations";
import geminiTestRouter from "./gemini/test";
import geminiChatRouter from "./gemini/chat";
import geminiVisionRouter from "./gemini/vision";
import imageGenerateRouter from "./image/generate";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/admin", adminRouter);
router.use("/admin", adminDashboardRouter);
router.use("/openai", conversationsRouter);
router.use("/openai", voiceRouter);
router.use("/gemini", geminiTestRouter);
router.use("/gemini", geminiChatRouter);
router.use("/gemini", geminiVisionRouter);
router.use("/image", imageGenerateRouter);

export default router;
