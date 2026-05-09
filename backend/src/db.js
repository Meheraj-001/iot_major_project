import sqlite3 from "sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class DatabaseService {
    constructor() {
        this.db = null;
        this.dbPath = path.join(__dirname, "..", "data", "sensors.db");
        this.isConnected = false;
        this.writeQueue = [];
        this.isWriting = false;
        this.writeTimeout = null;
    }

    async connect() {
        return new Promise((resolve, reject) => {
            const dbDir = path.dirname(this.dbPath);

            if (!fs.existsSync(dbDir)) {
                fs.mkdirSync(dbDir, { recursive: true });
            }

            this.db = new sqlite3.Database(this.dbPath, async (err) => {
                if (err) {
                    reject(err);
                    return;
                }

                this.isConnected = true;
                console.log("[DB] Connected:", this.dbPath);

                try {
                    await this.createTables();
                    await this.runOptimizations();
                    resolve();
                } catch (error) {
                    reject(error);
                }
            });
        });
    }

    async runOptimizations() {
        // Enable WAL mode for better concurrency
        await this.run("PRAGMA journal_mode=WAL");
        await this.run("PRAGMA synchronous=NORMAL");
        await this.run("PRAGMA cache_size=-64000"); // 64MB cache
        await this.run("PRAGMA temp_store=MEMORY");
        console.log("[DB] Optimizations applied");
    }

    async createTables() {
        const queries = [
            `CREATE TABLE IF NOT EXISTS readings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                device_id TEXT NOT NULL,
                sensor_type TEXT NOT NULL,
                value REAL NOT NULL,
                timestamp INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS telemetry (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                device_id TEXT NOT NULL,
                device_type TEXT,
                temperature REAL,
                humidity REAL,
                light REAL,
                relay_state TEXT,
                mode TEXT,
                rssi INTEGER,
                timestamp INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS devices (
                id TEXT PRIMARY KEY,
                device_type TEXT,
                name TEXT,
                location TEXT,
                status TEXT DEFAULT 'offline',
                last_seen INTEGER,
                last_temperature REAL,
                last_humidity REAL,
                last_light REAL,
                relay_state TEXT DEFAULT 'OFF',
                mode TEXT DEFAULT 'AUTO',
                rssi INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                device_id TEXT NOT NULL,
                event TEXT NOT NULL,
                reason TEXT,
                timestamp INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS queue_persistence (
                id TEXT PRIMARY KEY,
                device_id TEXT NOT NULL,
                sensor_type TEXT NOT NULL,
                value REAL NOT NULL,
                timestamp INTEGER NOT NULL,
                retries INTEGER DEFAULT 0,
                status TEXT DEFAULT 'pending',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS dead_letter_queue (
                id TEXT PRIMARY KEY,
                device_id TEXT NOT NULL,
                sensor_type TEXT NOT NULL,
                value REAL NOT NULL,
                timestamp INTEGER NOT NULL,
                error TEXT,
                failed_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            // Indexes for performance
            `CREATE INDEX IF NOT EXISTS idx_readings_device_time ON readings(device_id, timestamp)`,
            `CREATE INDEX IF NOT EXISTS idx_readings_type_time ON readings(sensor_type, timestamp)`,
            `CREATE INDEX IF NOT EXISTS idx_telemetry_device_time ON telemetry(device_id, timestamp)`,
            `CREATE INDEX IF NOT EXISTS idx_events_device_time ON events(device_id, timestamp)`,
            `CREATE INDEX IF NOT EXISTS idx_queue_status ON queue_persistence(status, created_at)`,
        ];

        for (const query of queries) {
            await this.run(query);
        }

        console.log("[DB] Tables ready");
    }

    // Write queue for handling concurrent writes
    async run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.writeQueue.push({ sql, params, resolve, reject });
            this.processWriteQueue();
        });
    }

    async processWriteQueue() {
        if (this.isWriting || this.writeQueue.length === 0) return;
        
        this.isWriting = true;
        
        const processNext = async () => {
            if (this.writeQueue.length === 0) {
                this.isWriting = false;
                return;
            }
            
            const { sql, params, resolve, reject } = this.writeQueue.shift();
            
            try {
                const result = await this._run(sql, params);
                resolve(result);
            } catch (err) {
                reject(err);
            }
            
            // Use setImmediate to prevent stack overflow
            setImmediate(() => processNext());
        };
        
        await processNext();
    }

    _run(sql, params = []) {
        return new Promise((resolve, reject) => {
            if (!this.db) return reject(new Error("Database not connected"));
            
            this.db.run(sql, params, function(err) {
                if (err) reject(err);
                else resolve({ lastID: this.lastID, changes: this.changes });
            });
        });
    }

    get(sql, params = []) {
        return new Promise((resolve, reject) => {
            if (!this.db) return reject(new Error("Database not connected"));
            
            this.db.get(sql, params, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    all(sql, params = []) {
        return new Promise((resolve, reject) => {
            if (!this.db) return reject(new Error("Database not connected"));
            
            this.db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    async saveReading({ deviceId, sensorType, value, timestamp }) {
        return this.run(
            `INSERT INTO readings (device_id, sensor_type, value, timestamp)
             VALUES (?, ?, ?, ?)`,
            [deviceId, sensorType, value, timestamp]
        );
    }

    async saveTelemetry(data) {
        const {
            deviceId,
            deviceType,
            temperature,
            humidity,
            light,
            relayState,
            mode,
            rssi,
            timestamp
        } = data;

        return this.run(
            `INSERT INTO telemetry 
             (device_id, device_type, temperature, humidity, light, relay_state, mode, rssi, timestamp)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                deviceId,
                deviceType || null,
                temperature ?? null,
                humidity ?? null,
                light ?? null,
                relayState ?? null,
                mode ?? null,
                rssi ?? null,
                timestamp
            ]
        );
    }

    async updateDevice(deviceId, data = {}) {
        const existing = await this.get(
            `SELECT id FROM devices WHERE id = ?`,
            [deviceId]
        );

        const deviceType = data.deviceType || this.detectDeviceType(deviceId);

        if (!existing) {
            return this.run(
                `INSERT INTO devices 
                 (id, device_type, name, location, status, last_seen, last_temperature, last_humidity, last_light, relay_state, mode, rssi)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    deviceId,
                    deviceType,
                    data.name || deviceId,
                    data.location || "unknown",
                    data.status || "online",
                    data.lastSeen || Date.now(),
                    data.lastTemperature ?? null,
                    data.lastHumidity ?? null,
                    data.lastLight ?? null,
                    data.relayState || "OFF",
                    data.mode || "AUTO",
                    data.rssi ?? null
                ]
            );
        }

        const fields = [];
        const values = [];

        const map = {
            deviceType: "device_type",
            name: "name",
            location: "location",
            status: "status",
            lastSeen: "last_seen",
            lastTemperature: "last_temperature",
            lastHumidity: "last_humidity",
            lastLight: "last_light",
            relayState: "relay_state",
            mode: "mode",
            rssi: "rssi"
        };

        for (const [jsKey, dbKey] of Object.entries(map)) {
            if (data[jsKey] !== undefined) {
                fields.push(`${dbKey} = ?`);
                values.push(data[jsKey]);
            }
        }

        if (fields.length === 0) return { changes: 0 };

        values.push(deviceId);

        return this.run(
            `UPDATE devices SET ${fields.join(", ")} WHERE id = ?`,
            values
        );
    }

    detectDeviceType(deviceId) {
        if (!deviceId) return "UNKNOWN";
        if (deviceId.startsWith("dht11_")) return "DHT11";
        if (deviceId.startsWith("ldr_")) return "LDR";
        if (deviceId.startsWith("esp32_")) return "ESP32";
        if (deviceId.startsWith("EMR_")) return "ESP32";
        return "UNKNOWN";
    }

    async saveEvent({ deviceId, event, reason, timestamp }) {
        return this.run(
            `INSERT INTO events (device_id, event, reason, timestamp)
             VALUES (?, ?, ?, ?)`,
            [deviceId, event, reason || null, timestamp || Date.now()]
        );
    }

    async getLatestReadings(limit = 50) {
        return this.all(
            `SELECT * FROM readings ORDER BY timestamp DESC LIMIT ?`,
            [Math.min(limit, 1000)]
        );
    }

    async getLatestTelemetry(limit = 50) {
        return this.all(
            `SELECT * FROM telemetry ORDER BY timestamp DESC LIMIT ?`,
            [Math.min(limit, 1000)]
        );
    }

    async getDeviceHistory(deviceId, hours = 24) {
        const since = Date.now() - hours * 60 * 60 * 1000;

        return this.all(
            `SELECT * FROM telemetry
             WHERE device_id = ? AND timestamp >= ?
             ORDER BY timestamp ASC
             LIMIT 10000`,
            [deviceId, since]
        );
    }

    async getDevices() {
        return this.all(
            `SELECT * FROM devices ORDER BY last_seen DESC`
        );
    }

    async getDeviceById(deviceId) {
        return this.get(
            `SELECT * FROM devices WHERE id = ?`,
            [deviceId]
        );
    }

    async getStats(sensorType, hours = 24) {
        const since = Date.now() - hours * 60 * 60 * 1000;

        return this.get(
            `SELECT 
                AVG(value) as average,
                MIN(value) as minimum,
                MAX(value) as maximum,
                COUNT(*) as count
             FROM readings
             WHERE sensor_type = ? AND timestamp >= ?`,
            [sensorType, since]
        );
    }

    async getDashboardStats() {
        const since = Date.now() - 24 * 60 * 60 * 1000;
        const onlineSince = Date.now() - 2 * 60 * 1000;

        const [
            totalReadings,
            activeDevices,
            temperature,
            humidity,
            light,
            latestTelemetry,
            recentEvents
        ] = await Promise.all([
            this.get(`SELECT COUNT(*) as count FROM readings`),
            this.get(`SELECT COUNT(*) as count FROM devices WHERE last_seen >= ?`, [onlineSince]),
            this.getStats("temperature", 24),
            this.getStats("humidity", 24),
            this.getStats("light", 24),
            this.getLatestTelemetry(10),
            this.all(`SELECT * FROM events ORDER BY timestamp DESC LIMIT 20`)
        ]);

        return {
            totalReadings: totalReadings?.count || 0,
            activeDevices: activeDevices?.count || 0,
            temperature,
            humidity,
            light,
            latestTelemetry,
            recentEvents
        };
    }

    async persistQueueItem(item) {
        return this.run(
            `INSERT OR REPLACE INTO queue_persistence
             (id, device_id, sensor_type, value, timestamp, retries, status)
             VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
            [
                item.id,
                item.deviceId,
                item.sensorType,
                item.value,
                item.timestamp,
                item.retries || 0
            ]
        );
    }

    async getPendingQueueItems() {
        return this.all(
            `SELECT * FROM queue_persistence WHERE status = 'pending' ORDER BY created_at ASC LIMIT 10000`
        );
    }

    async removeQueueItem(id) {
        return this.run(
            `DELETE FROM queue_persistence WHERE id = ?`,
            [id]
        );
    }

    async clearQueuePersistence() {
        return this.run(`DELETE FROM queue_persistence`);
    }

    async addToDeadLetter(item, error) {
        return this.run(
            `INSERT OR REPLACE INTO dead_letter_queue
             (id, device_id, sensor_type, value, timestamp, error)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                item.id,
                item.deviceId,
                item.sensorType,
                item.value,
                item.timestamp,
                error
            ]
        );
    }

    async getDeadLetterItems() {
        return this.all(
            `SELECT * FROM dead_letter_queue ORDER BY failed_at DESC LIMIT 1000`
        );
    }

    async clearDeadLetter() {
        return this.run(`DELETE FROM dead_letter_queue`);
    }

    async getDatabaseInfo() {
        if (!fs.existsSync(this.dbPath)) {
            return {
                connected: this.isConnected,
                path: this.dbPath,
                sizeMB: "0.00"
            };
        }

        const stats = fs.statSync(this.dbPath);
        const walPath = this.dbPath + "-wal";
        const shmPath = this.dbPath + "-shm";

        return {
            connected: this.isConnected,
            path: this.dbPath,
            sizeMB: (stats.size / 1024 / 1024).toFixed(2),
            walSizeMB: fs.existsSync(walPath) ? (fs.statSync(walPath).size / 1024 / 1024).toFixed(2) : "0.00",
            modified: stats.mtime,
            writeQueueLength: this.writeQueue.length
        };
    }

    async close() {
        return new Promise((resolve, reject) => {
            if (!this.db) return resolve();
            
            // Wait for write queue to empty
            const waitForWrites = setInterval(() => {
                if (this.writeQueue.length === 0 && !this.isWriting) {
                    clearInterval(waitForWrites);
                    
                    this.db.close((err) => {
                        if (err) reject(err);
                        else {
                            this.isConnected = false;
                            console.log("[DB] Closed");
                            resolve();
                        }
                    });
                }
            }, 100);
            
            // Timeout after 10 seconds
            setTimeout(() => {
                clearInterval(waitForWrites);
                reject(new Error("Timeout waiting for writes to complete"));
            }, 10000);
        });
    }
}

export default new DatabaseService();