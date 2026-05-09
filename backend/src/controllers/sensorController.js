import DatabaseService from "../db.js";
import mqttClient from "../mqtt/mqttClient.js";

async function getLatestReadings(req, res) {
  try {
    const limit = Number(req.query.limit) || 50;
    const readings = await DatabaseService.getLatestReadings(limit);

    res.json({
      success: true,
      count: readings.length,
      readings
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

async function getLatestTelemetry(req, res) {
  try {
    const limit = Number(req.query.limit) || 50;
    const telemetry = await DatabaseService.getLatestTelemetry(limit);

    res.json({
      success: true,
      count: telemetry.length,
      telemetry
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

async function getAllDevices(req, res) {
  try {
    const devices = await DatabaseService.getDevices();

    const now = Date.now();

    const formatted = devices.map((device) => ({
      ...device,
      online: device.last_seen ? now - device.last_seen < 120000 : false
    }));

    res.json({
      success: true,
      count: formatted.length,
      devices: formatted
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

async function getDeviceById(req, res) {
  try {
    const { deviceId } = req.params;

    const device = await DatabaseService.getDeviceById(deviceId);

    if (!device) {
      return res.status(404).json({
        success: false,
        error: "Device not found"
      });
    }

    res.json({
      success: true,
      device: {
        ...device,
        online: device.last_seen ? Date.now() - device.last_seen < 120000 : false
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

async function getSensorHistory(req, res) {
  try {
    const { deviceId } = req.params;
    const hours = Number(req.query.hours) || 24;

    const history = await DatabaseService.getDeviceHistory(deviceId, hours);

    res.json({
      success: true,
      deviceId,
      hours,
      count: history.length,
      history
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

async function getTemperatureStats(req, res) {
  try {
    const hours = Number(req.query.hours) || 24;
    const stats = await DatabaseService.getStats("temperature", hours);

    res.json({ success: true, sensorType: "temperature", hours, stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

async function getHumidityStats(req, res) {
  try {
    const hours = Number(req.query.hours) || 24;
    const stats = await DatabaseService.getStats("humidity", hours);

    res.json({ success: true, sensorType: "humidity", hours, stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

async function getLightStats(req, res) {
  try {
    const hours = Number(req.query.hours) || 24;
    const stats = await DatabaseService.getStats("light", hours);

    res.json({ success: true, sensorType: "light", hours, stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

async function getDashboardStats(req, res) {
  try {
    const stats = await DatabaseService.getDashboardStats();

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

async function sendDeviceCommand(req, res) {
  try {
    const { deviceId } = req.params;
    const { relay, mode, light_threshold } = req.body;

    const command = {};

    if (relay) command.relay = relay;
    if (mode) command.mode = mode;
    if (light_threshold !== undefined) command.light_threshold = Number(light_threshold);

    mqttClient.publishCommand(deviceId, command);

    res.json({
      success: true,
      message: "Command sent",
      deviceId,
      command
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

async function sendDeviceConfig(req, res) {
  try {
    const { deviceId } = req.params;
    const config = req.body;

    mqttClient.publishConfig(deviceId, config);

    res.json({
      success: true,
      message: "Config sent",
      deviceId,
      config
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export {
  getLatestReadings,
  getLatestTelemetry,
  getAllDevices,
  getDeviceById,
  getSensorHistory,
  getTemperatureStats,
  getHumidityStats,
  getLightStats,
  getDashboardStats,
  sendDeviceCommand,
  sendDeviceConfig
};