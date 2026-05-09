import DatabaseService from "../db.js";
import queueService from "../utils/queueService.js";

function detectDeviceType(deviceId) {
  if (!deviceId) return "UNKNOWN";
  if (deviceId.startsWith("dht11_")) return "DHT11";
  if (deviceId.startsWith("ldr_")) return "LDR";
  if (deviceId.startsWith("esp32_")) return "ESP32";
  if (deviceId.startsWith("EMR_")) return "ESP32";
  return "UNKNOWN";
}

function parseRelay(value) {
  if (value === 1 || value === true || value === "ON" || value === "on") return "ON";
  if (value === 0 || value === false || value === "OFF" || value === "off") return "OFF";
  return null;
}

function parseMode(value) {
  if (value === 1 || value === true || value === "AUTO" || value === "auto") return "AUTO";
  if (value === 0 || value === false || value === "MANUAL" || value === "manual") return "MANUAL";
  return null;
}

// In ingestController.js - Update the ingestTelemetry function
async function ingestTelemetry(req, res) {
  try {
    const body = req.body;

    const deviceId = body.deviceId || body.device_id || body.espId || body.esp_id || body.id;

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        error: "deviceId is required"
      });
    }

    const timestamp = body.timestamp || Date.now();
    const deviceType = body.deviceType || body.device_type || detectDeviceType(deviceId);

    const temperature = body.temperature ?? body.t ?? null;
    const humidity = body.humidity ?? body.h ?? null;
    const light = body.light ?? body.l ?? null;  // Support both field names
    const relayState = parseRelay(body.relayState ?? body.relay_state ?? body.r);
    const mode = parseMode(body.mode ?? body.m);
    const rssi = body.rssi ?? null;

    // Save telemetry
    await DatabaseService.saveTelemetry({
      deviceId,
      deviceType,
      temperature,
      humidity,
      light,
      relayState,
      mode,
      rssi,
      timestamp
    });

    // Update device with light value
    await DatabaseService.updateDevice(deviceId, {
      deviceType,
      status: "online",
      lastSeen: timestamp,
      lastTemperature: temperature,
      lastHumidity: humidity,
      lastLight: light,  // Make sure this is included
      relayState,
      mode,
      rssi
    });

    // Add to queue for processing
    if (temperature !== null) {
      await queueService.addToQueue({
        deviceId,
        sensorType: "temperature",
        value: Number(temperature),
        timestamp
      });
    }

    if (humidity !== null) {
      await queueService.addToQueue({
        deviceId,
        sensorType: "humidity",
        value: Number(humidity),
        timestamp
      });
    }

    if (light !== null) {
      await queueService.addToQueue({
        deviceId,
        sensorType: "light",
        value: Number(light),
        timestamp
      });
    }

    res.json({
      success: true,
      message: "Telemetry ingested",
      deviceId
    });
  } catch (error) {
    console.error("[IngestController] Telemetry error:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
async function ingestHeartbeat(req, res) {
  try {
    const body = req.body;

    const deviceId =
      body.deviceId ||
      body.device_id ||
      body.espId ||
      body.esp_id ||
      body.id;

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        error: "deviceId is required"
      });
    }

    await DatabaseService.updateDevice(deviceId, {
      deviceType: body.deviceType || body.device_type || detectDeviceType(deviceId),
      status: "online",
      lastSeen: Date.now(),
      rssi: body.rssi ?? null
    });

    await DatabaseService.saveEvent({
      deviceId,
      event: "heartbeat",
      reason: "Heartbeat received",
      timestamp: Date.now()
    });

    res.json({
      success: true,
      message: "Heartbeat ingested",
      deviceId
    });
  } catch (error) {
    console.error("[IngestController] Heartbeat error:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

async function ingestStatus(req, res) {
  try {
    const body = req.body;

    const deviceId =
      body.deviceId ||
      body.device_id ||
      body.espId ||
      body.esp_id ||
      body.id;

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        error: "deviceId is required"
      });
    }

    const status = body.status || body.message || "online";

    await DatabaseService.updateDevice(deviceId, {
      deviceType: body.deviceType || body.device_type || detectDeviceType(deviceId),
      status,
      lastSeen: Date.now(),
      rssi: body.rssi ?? null
    });

    await DatabaseService.saveEvent({
      deviceId,
      event: "status",
      reason: status,
      timestamp: Date.now()
    });

    res.json({
      success: true,
      message: "Status ingested",
      deviceId,
      status
    });
  } catch (error) {
    console.error("[IngestController] Status error:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export {
  ingestTelemetry,
  ingestHeartbeat,
  ingestStatus
};