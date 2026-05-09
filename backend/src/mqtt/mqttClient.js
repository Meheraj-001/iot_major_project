import mqtt from 'mqtt';
import axios from 'axios';

class MQTTClientService {
    constructor() {
        this.client = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
    }

    async connect() {
        try {
            // Use environment variables with fallbacks
            const brokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://broker.hivemq.com:1883';
            const apiPort = process.env.PORT || 3001;
            const apiUrl = process.env.API_URL || `http://localhost:${apiPort}`;
            
            // Store for use in methods
            this.apiBaseUrl = apiUrl;
            
            console.log(`Connecting to MQTT broker: ${brokerUrl}`);
            
            const mqttOptions = {
                clientId: `backend_server_${process.pid}_${Math.random().toString(16).substr(2, 8)}`,
                clean: true,
                connectTimeout: 10000,
                reconnectPeriod: 5000,
                keepalive: 60
            };
            
            // Add authentication if provided
            if (process.env.MQTT_USERNAME && process.env.MQTT_PASSWORD) {
                mqttOptions.username = process.env.MQTT_USERNAME;
                mqttOptions.password = process.env.MQTT_PASSWORD;
            }
            
            this.client = mqtt.connect(brokerUrl, mqttOptions);

            this.client.on('connect', () => {
                console.log('✅ MQTT connected to broker');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                
                // Subscribe to all device topics
                const topics = [
                    '+/sensor/telemetry',
                    '+/device/heartbeat',
                    '+/device/status',
                    '+/device/response'
                ];
                
                topics.forEach(topic => {
                    this.client.subscribe(topic, { qos: 1 }, (err) => {
                        if (err) {
                            console.error(`Failed to subscribe to ${topic}:`, err);
                        } else {
                            console.log(`📡 Subscribed to: ${topic}`);
                        }
                    });
                });
            });

            this.client.on('message', (topic, message) => {
                this.handleMessage(topic, message).catch(err => {
                    console.error('Error in message handler:', err);
                });
            });

            this.client.on('error', (err) => {
                console.error('MQTT Error:', err);
                this.isConnected = false;
            });

            this.client.on('close', () => {
                console.log('MQTT connection closed');
                this.isConnected = false;
            });

            this.client.on('reconnect', () => {
                this.reconnectAttempts++;
                console.log(`MQTT reconnecting... (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
                
                if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                    console.error('Max reconnection attempts reached. Giving up.');
                    this.client.end(true);
                }
            });

        } catch (error) {
            console.error('Failed to connect to MQTT:', error);
            this.isConnected = false;
            throw error;
        }
    }

    async handleMessage(topic, message) {
        try {
            if (!topic || typeof topic !== 'string') {
                console.error('Invalid topic received:', topic);
                return;
            }

            const parts = topic.split('/');
            
            if (parts.length < 2) {
                console.error('Invalid topic format:', topic);
                return;
            }

            const deviceId = parts[0];
            const messageType = parts[1];
            const subType = parts[2];
            
            let payload;
            try {
                const messageStr = message.toString();
                console.log(`Received MQTT message on topic "${topic}": ${messageStr}`);
                payload = JSON.parse(messageStr);
            } catch (parseError) {
                payload = { data: message.toString() };
            }

            console.log(`📨 MQTT - Device: ${deviceId}, Type: ${messageType}/${subType || ''}`);

            // Route to appropriate API endpoint
            switch (messageType) {
                case 'sensor':
                    if (subType === 'telemetry') {
                        await this.ingestTelemetry(deviceId, payload);
                    }
                    break;
                    
                case 'device':
                    switch (subType) {
                        case 'heartbeat':
                            await this.ingestHeartbeat(deviceId, payload);
                            break;
                        case 'status':
                            await this.ingestStatus(deviceId, payload);
                            break;
                        case 'response':
                            await this.handleCommandResponse(deviceId, payload);
                            break;
                        default:
                            console.log(`Unknown device sub-type: ${subType}`);
                    }
                    break;
                    
                default:
                    console.log(`Unknown message type: ${messageType}`);
            }
            
        } catch (error) {
            console.error('Error handling MQTT message:', error);
        }
    }

   async ingestTelemetry(deviceId, payload) {
    try {
        const apiPayload = {
            deviceId: deviceId,
            t: payload.t,
            h: payload.h,
            l: payload.l,
            r: payload.r,
            m: payload.m,
            rssi: payload.rssi,
            timestamp: Date.now()
        };
        
        const response = await axios.post(`${this.apiBaseUrl}/api/ingest/telemetry`, apiPayload, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 5000
        });
        
        if (response.data?.success) {
            // Fix: Only show temperature/humidity if they exist
            const tempMsg = payload.t !== undefined ? ` T=${payload.t}°C` : '';
            const humMsg = payload.h !== undefined ? ` H=${payload.h}%` : '';
            const lightMsg = payload.l !== undefined ? ` L=${payload.l}` : '';
            console.log(`✅ Telemetry ingested: ${deviceId}${tempMsg}${humMsg}${lightMsg}`);
        }
    } catch (error) {
        console.error(`Failed to ingest telemetry for ${deviceId}:`, error.message);
    }
}
    async ingestHeartbeat(deviceId, payload) {
        try {
            const apiPayload = {
                deviceId: deviceId,
                rssi: payload.rssi,
                free_heap: payload.free_heap,
                timestamp: Date.now()
            };
            
            await axios.post(`${this.apiBaseUrl}/api/ingest/heartbeat`, apiPayload, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 5000
            });
            
            console.log(`💓 Heartbeat: ${deviceId} RSSI=${payload.rssi}dBm`);
        } catch (error) {
            console.error(`Failed to ingest heartbeat for ${deviceId}:`, error.message);
        }
    }

    async ingestStatus(deviceId, payload) {
        try {
            let status = 'offline';
            if (typeof payload === 'string') {
                status = payload;
            } else if (payload.data) {
                status = payload.data;
            } else if (payload.status) {
                status = payload.status;
            }
            
            const apiPayload = {
                deviceId: deviceId,
                status: status,
                timestamp: Date.now()
            };
            
            await axios.post(`${this.apiBaseUrl}/api/ingest/status`, apiPayload, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 5000
            });
            
            console.log(`📊 Status: ${deviceId} = ${status}`);
        } catch (error) {
            console.error(`Failed to ingest status for ${deviceId}:`, error.message);
        }
    }

    async handleCommandResponse(deviceId, payload) {
        try {
            console.log(`📨 Command response from ${deviceId}:`, payload);
            // Store command response in database if needed
        } catch (error) {
            console.error(`Failed to handle command response for ${deviceId}:`, error.message);
        }
    }

    async sendCommand(deviceId, command, params = {}) {
        if (!this.isConnected || !this.client) {
            console.error('MQTT not connected');
            return { success: false, error: 'MQTT not connected' };
        }
        
        const topic = `${deviceId}/device/command`;
        let payload = {};
        
        // Format command for ESP32
        switch(command) {
            case 'relay':
                payload = { relay: params.state === 'ON' ? 'ON' : 'OFF' };
                break;
            case 'mode':
                payload = { mode: params.mode === 'AUTO' ? 'AUTO' : 'MANUAL' };
                break;
            case 'temp_high':
                payload = { temp_high: params.value };
                break;
            case 'temp_low':
                payload = { temp_low: params.value };
                break;
            case 'humidity_high':
                payload = { humidity_high: params.value };
                break;
            case 'humidity_low':
                payload = { humidity_low: params.value };
                break;
            case 'light_threshold':
                payload = { light_threshold: params.value };
                break;
            default:
                payload = { command: command, ...params };
        }
        
        return new Promise((resolve) => {
            this.client.publish(topic, JSON.stringify(payload), { qos: 1 }, (err) => {
                if (err) {
                    console.error(`Failed to send command to ${deviceId}:`, err);
                    resolve({ success: false, error: err.message });
                } else {
                    console.log(`✅ Command sent to ${deviceId}:`, payload);
                    resolve({ success: true, command: payload });
                }
            });
        });
    }

    publishCommand(deviceId, command) {
        // Maintain compatibility with existing code
        this.sendCommand(deviceId, Object.keys(command)[0], command);
    }

    publishConfig(deviceId, config) {
        const topic = `${deviceId}/device/config`;
        this.client.publish(topic, JSON.stringify(config), { qos: 1 }, (err) => {
            if (err) {
                console.error(`Failed to send config to ${deviceId}:`, err);
            } else {
                console.log(`✅ Config sent to ${deviceId}`);
            }
        });
    }

    disconnect() {
        return new Promise((resolve) => {
            if (this.client) {
                this.client.end(false, {}, () => {
                    this.isConnected = false;
                    console.log('MQTT disconnected');
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }
}

// Singleton instance
const mqttClient = new MQTTClientService();
export default mqttClient;