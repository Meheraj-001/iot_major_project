import { Router } from "express";
import {
  ingestTelemetry,
  ingestHeartbeat,
  ingestStatus
} from "../controllers/ingestController.js";

const router = Router();

router.post("/telemetry", ingestTelemetry);
router.post("/heartbeat", ingestHeartbeat);
router.post("/status", ingestStatus);

export default router;
