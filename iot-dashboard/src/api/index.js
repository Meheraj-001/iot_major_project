import axios from "axios";

const API_BASE_URL = "http://localhost:3001";

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

export async function getHealth() {
    try {
        const res = await api.get("/health");
        const data = res.data;
        
        // Transform to expected format
        return {
            mqtt: {
                connected: data?.services?.mqtt?.connected || data?.mqtt?.connected || false
            },
            database: {
                connected: data?.services?.database?.connected || data?.database?.connected || false
            },
            ...data
        };
    } catch (error) {
        console.error("Health check failed:", error);
        return {
            mqtt: { connected: false },
            database: { connected: false }
        };
    }
}

export async function getDashboardStats() {
  const res = await api.get("/api/sensors/dashboard/stats");
  return res.data;
}

export async function getDevices() {
  const res = await api.get("/api/sensors/devices");
  return res.data;
}

export async function getLatestTelemetry() {
  const res = await api.get("/api/sensors/telemetry/latest?limit=20");
  return res.data;
}

export async function getQueueStatus() {
  const res = await api.get("/api/queue/status");
  return res.data;
}

export async function pauseQueue() {
  const res = await api.post("/api/queue/pause");
  return res.data;
}

export async function resumeQueue() {
  const res = await api.post("/api/queue/resume");
  return res.data;
}

export async function clearQueue() {
  const res = await api.post("/api/queue/clear");
  return res.data;
}

export async function sendDeviceCommand(deviceId, command) {
  const res = await api.post(`/api/sensors/devices/${deviceId}/command`, command);
  return res.data;
}

export default api;