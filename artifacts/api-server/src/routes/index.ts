import { Router, type IRouter } from "express";
import healthRouter from "./health";
import voiceRouter from "./openai/voice";
import conversationsRouter from "./openai/conversations";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/openai", conversationsRouter);
router.use("/openai", voiceRouter);

export default router;
