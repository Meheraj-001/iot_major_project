import dotenv from "dotenv";
import DatabaseService from "./db.js";
import { app } from './app.js';
import mqttClient from "./mqtt/mqttClient.js";
import queueService from "./utils/queueService.js";

dotenv.config({ path: './.env' });

const PORT = process.env.PORT || 3001;

async function startServer() {
    try {
        // Connect to database
        await DatabaseService.connect();
        console.log('✅ Database connected');

        // Recover queue from previous crash
        await queueService.recoverFromCrash();
        console.log('✅ Queue recovered');

        // Connect to MQTT (handleMessage is internal, don't call it directly)
        await mqttClient.connect();
        console.log('✅ MQTT connected');

        // Start server
        const server = app.listen(PORT, () => {
            console.log(`
╔═══════════════════════════════════════════════════╗
║     Sensor Queue System - Backend Server         ║
╠═══════════════════════════════════════════════════╣
║  Server running on: http://localhost:${PORT}      ║
║  Health check:     http://localhost:${PORT}/health ║
║  API info:         http://localhost:${PORT}/api/info ║
║                                                   ║
║  MQTT Status:      Connected
║  Database:         Connected
║  Queue:            Ready
╚═══════════════════════════════════════════════════╝
            `);
        });

        // Graceful shutdown with server close
        process.on('SIGTERM', () => shutdown('SIGTERM', server));
        process.on('SIGINT', () => shutdown('SIGINT', server));
        
    } catch (err) {
        console.error("❌ Server startup failed: ", err);
        process.exit(1);
    }
}

// Graceful shutdown
async function shutdown(signal, server) {
    console.log(`\n🛑 Received ${signal}. Shutting down gracefully...`);
    
    // Stop accepting new connections
    if (server) {
        server.close(async () => {
            console.log('✅ HTTP server closed');
            await cleanup();
        });
    } else {
        await cleanup();
    }
}

async function cleanup() {
    try {
        // Drain queue before shutting down
        if (queueService.queue.length > 0) {
            console.log(`⏳ Waiting for ${queueService.queue.length} queue items to process...`);
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
        
        await mqttClient.disconnect();
        console.log('✅ MQTT disconnected');
        
        await DatabaseService.close();
        console.log('✅ Database closed');
        
        console.log('✅ Graceful shutdown complete');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error during shutdown:', err);
        process.exit(1);
    }
}

process.on("uncaughtException", (err) => {
    console.error("❌ Uncaught Exception:", err);
    process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
    console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
    process.exit(1);
});

startServer();