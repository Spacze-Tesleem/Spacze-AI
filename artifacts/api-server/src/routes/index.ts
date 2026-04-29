import { Router, type IRouter } from "express";
import healthRouter from "./health";
import openaiRouter from "./openai";
import projectsRouter from "./projects";

const router: IRouter = Router();

router.use(healthRouter);
router.use(openaiRouter);
router.use(projectsRouter);

export default router;
