import express from "express";
import cors from "cors";
import helmet from "helmet";
import ingestRoutes from "./routes/ingestRoutes.js";
import sensorRoutes from "./routes/sensorRoutes.js";
import queueRoutes from "./routes/queueRoutes.js";
import DatabaseService from "./db.js";
import mqttClient from "./mqtt/mqttClient.js";
import queueService from "./utils/queueService.js";

const app = express();

// 1. Security middleware
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// 2. CORS configuration
app.use(cors({
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ["http://localhost:3000", "http://localhost:3001"],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key']
}));

// 3. Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 4. Request logging
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} ${res.statusCode} - ${duration}ms`);
    });
    next();
});

// 5. HEALTH CHECK ENDPOINT (MUST BE BEFORE OTHER ROUTES)
app.get("/health", (req, res) => {
    const health = {
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        services: {
            database: {
                connected: DatabaseService.isConnected === true,
                status: DatabaseService.isConnected ? "up" : "down"
            },
            mqtt: {
                connected: mqttClient.isConnected === true,
                status: mqttClient.isConnected ? "connected" : "disconnected"
            },
            queue: {
                size: queueService.queue.length,
                paused: queueService.paused,
                processing: queueService.processing
            }
        },
        mqtt: { connected: mqttClient.isConnected },
        database: { connected: DatabaseService.isConnected },
        memory: process.memoryUsage(),
        version: "1.0.0"
    };
    
    const httpStatus = health.services.database.connected && health.services.mqtt.connected ? 200 : 503;
    res.status(httpStatus).json(health);
});

// 6. API Routes
app.use("/api/sensors", sensorRoutes);
app.use("/api/queue", queueRoutes);
app.use("/api/ingest", ingestRoutes);

// 7. API Info
app.get("/api/info", (req, res) => {
    res.json({
        name: "Distributed ESP32 Sensor Backend",
        version: "1.0.0",
        description: "Backend server for DHT11 and LDR ESP32 distributed sensor system",
        endpoints: {
            sensors: {
                latest: "GET /api/sensors/latest",
                telemetry: "GET /api/sensors/telemetry/latest",
                devices: "GET /api/sensors/devices",
                device: "GET /api/sensors/devices/:deviceId",
                history: "GET /api/sensors/history/:deviceId",
                stats: {
                    temperature: "GET /api/sensors/stats/temperature",
                    humidity: "GET /api/sensors/stats/humidity",
                    light: "GET /api/sensors/stats/light"
                },
                dashboard: "GET /api/sensors/dashboard/stats",
                command: "POST /api/sensors/devices/:deviceId/command",
                config: "POST /api/sensors/devices/:deviceId/config"
            },
            queue: {
                status: "GET /api/queue/status",
                pending: "GET /api/queue/pending",
                failed: "GET /api/queue/failed",
                stats: "GET /api/queue/stats",
                pause: "POST /api/queue/pause",
                resume: "POST /api/queue/resume",
                clear: "POST /api/queue/clear",
                retry: "POST /api/queue/failed/:id/retry",
                retryAll: "POST /api/queue/failed/retry-all"
            },
            ingest: {
                telemetry: "POST /api/ingest/telemetry",
                heartbeat: "POST /api/ingest/heartbeat",
                status: "POST /api/ingest/status"
            },
            system: {
                health: "GET /health",
                info: "GET /api/info",
                metrics: "GET /metrics"
            }
        }
    });
});

// 8. Metrics endpoint
app.get("/metrics", async (req, res) => {
    const dbInfo = await DatabaseService.getDatabaseInfo().catch(() => ({}));
    res.json({
        uptime: process.uptime(),
        memory: {
            rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
            heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
            heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
            external: Math.round(process.memoryUsage().external / 1024 / 1024)
        },
        queue: queueService.getStatus(),
        database: dbInfo,
        mqtt: { connected: mqttClient.isConnected },
        activeConnections: process._getActiveRequests?.()?.length || 0
    });
});

// 9. 404 handler (MUST BE LAST)
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: `Route not found: ${req.method} ${req.path}`
    });
});

// 10. Global error handler
app.use((err, req, res, next) => {
    console.error("[APP ERROR]", err);
    
    if (err.type === 'entity.too.large') {
        return res.status(413).json({
            success: false,
            error: "Request entity too large"
        });
    }
    
    res.status(err.status || 500).json({
        success: false,
        error: process.env.NODE_ENV === "production" 
            ? "Internal server error" 
            : err.message,
        ...(process.env.NODE_ENV !== "production" && { stack: err.stack })
    });
});

export { app };