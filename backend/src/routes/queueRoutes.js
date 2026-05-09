import { Router } from "express";
import * as queueController from "../controllers/queueController.js";

const router = Router();

router.get("/status", queueController.getQueueStatus);
router.get("/pending", queueController.getPendingItems);
router.get("/failed", queueController.getFailedItems);

router.post("/pause", queueController.pauseQueue);
router.post("/resume", queueController.resumeQueue);
router.post("/clear", queueController.clearQueue);

router.post("/failed/:id/retry", queueController.retryItem);
router.post("/failed/retry-all", queueController.retryAllFailed);
router.post("/failed/clear", queueController.clearFailed);

export default router;