import { Router } from "express";
import * as sensorController from "../controllers/sensorController.js";

const router = Router();

router.get("/latest", sensorController.getLatestReadings);
router.get("/telemetry/latest", sensorController.getLatestTelemetry);

router.get("/devices", sensorController.getAllDevices);
router.get("/devices/:deviceId", sensorController.getDeviceById);
router.get("/history/:deviceId", sensorController.getSensorHistory);

router.get("/stats/temperature", sensorController.getTemperatureStats);
router.get("/stats/humidity", sensorController.getHumidityStats);
router.get("/stats/light", sensorController.getLightStats);

router.get("/dashboard/stats", sensorController.getDashboardStats);

router.post("/devices/:deviceId/command", sensorController.sendDeviceCommand);
router.post("/devices/:deviceId/config", sensorController.sendDeviceConfig);

export default router;