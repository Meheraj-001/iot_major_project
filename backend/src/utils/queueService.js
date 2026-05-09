import { nanoid } from "nanoid";
import DatabaseService from "../db.js";

class QueueService {
    constructor() {
        this.queue = [];
        this.failed = [];
        this.processing = false;
        this.paused = false;
        this.maxRetries = parseInt(process.env.QUEUE_MAX_RETRIES || '3', 10);
        this.batchSize = parseInt(process.env.QUEUE_BATCH_SIZE || '10', 10);
        this.processingLock = false;
        this.processedIds = new Map(); // Store with timestamp for auto-cleanup
        
        // Auto-cleanup processed IDs every minute
        setInterval(() => this.cleanupProcessedIds(), 60000);
    }

    cleanupProcessedIds() {
        const now = Date.now();
        let removed = 0;
        for (const [key, timestamp] of this.processedIds.entries()) {
            if (now - timestamp > 60000) { // 1 minute
                this.processedIds.delete(key);
                removed++;
            }
        }
        if (removed > 0) {
            console.log(`[QUEUE] Cleaned ${removed} old processed IDs`);
        }
    }

    async addToQueue(item) {
        const id = item.id || nanoid();
        
        // Duplicate detection (10 second window)
        const duplicateKey = `${item.deviceId}_${item.sensorType}_${Math.floor(item.timestamp / 10000)}`;
        
        if (this.processedIds.has(duplicateKey)) {
            console.log(`[QUEUE] Duplicate skipped: ${duplicateKey}`);
            return;
        }

        this.processedIds.set(duplicateKey, Date.now());

        const queueItem = {
            ...item,
            id,
            retries: item.retries || 0,
            queuedAt: Date.now()
        };

        this.queue.push(queueItem);
        
        // Persist asynchronously, don't wait
        DatabaseService.persistQueueItem(queueItem).catch((err) => {
            console.warn("[QUEUE] Persistence failed:", err.message);
        });

        console.log(`[QUEUE] Added: ${queueItem.deviceId}/${queueItem.sensorType} = ${queueItem.value} (Queue size: ${this.queue.length})`);

        // Start processing if not already
        if (!this.processing && !this.paused && !this.processingLock) {
            setImmediate(() => this.processQueue());
        }
    }

    async processQueue() {
        // Prevent concurrent processing
        if (this.processingLock || this.processing || this.paused || this.queue.length === 0) {
            return;
        }
        
        this.processingLock = true;
        this.processing = true;
        
        console.log(`[QUEUE] Starting batch processing. Items in queue: ${this.queue.length}`);
        
        try {
            while (this.queue.length > 0 && !this.paused) {
                // Take batch
                const batch = this.queue.splice(0, this.batchSize);
                console.log(`[QUEUE] Processing batch of ${batch.length} items`);
                
                // Process batch with Promise.all for better performance
                const results = await Promise.allSettled(
                    batch.map(item => this.processItem(item))
                );
                
                // Handle failures
                const failedItems = [];
                results.forEach((result, index) => {
                    if (result.status === 'rejected') {
                        failedItems.push({ item: batch[index], error: result.reason });
                    }
                });
                
                // Re-queue failed items with retry count
                for (const { item, error } of failedItems) {
                    if (item.retries < this.maxRetries) {
                        item.retries += 1;
                        this.queue.push(item);
                        console.log(`[QUEUE] Retry ${item.retries}/${this.maxRetries} for ${item.id}`);
                        
                        // Update persistence
                        await DatabaseService.persistQueueItem(item).catch(() => {});
                    } else {
                        // Max retries exceeded, move to dead letter
                        this.failed.push({
                            ...item,
                            failedAt: Date.now(),
                            error: error.message
                        });
                        
                        await DatabaseService.addToDeadLetter(item, error.message).catch(() => {});
                        await DatabaseService.removeQueueItem(item.id).catch(() => {});
                        console.log(`[QUEUE] Item ${item.id} moved to dead letter after ${this.maxRetries} retries`);
                    }
                }
                
                // Small delay between batches to prevent overwhelming the database
                if (this.queue.length > 0 && !this.paused) {
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
            }
        } catch (error) {
            console.error('[QUEUE] Fatal error in processQueue:', error);
        } finally {
            this.processing = false;
            this.processingLock = false;
            
            // If there are still items and not paused, continue processing
            if (this.queue.length > 0 && !this.paused) {
                setImmediate(() => this.processQueue());
            }
        }
    }
    
    async processItem(item) {
        await DatabaseService.saveReading({
            deviceId: item.deviceId,
            sensorType: item.sensorType,
            value: item.value,
            timestamp: item.timestamp
        });
        
        await DatabaseService.removeQueueItem(item.id).catch(() => {});
        console.log(`[QUEUE] Saved: ${item.deviceId}/${item.sensorType} = ${item.value}`);
    }

    async recoverFromCrash() {
        try {
            const pending = await DatabaseService.getPendingQueueItems();
            
            if (!pending || pending.length === 0) {
                console.log('[QUEUE] No pending items to recover');
                return;
            }
            
            console.log(`[QUEUE] Recovering ${pending.length} items from database`);
            
            for (const item of pending) {
                this.queue.push({
                    id: item.id,
                    deviceId: item.device_id,
                    sensorType: item.sensor_type,
                    value: item.value,
                    timestamp: item.timestamp,
                    retries: item.retries || 0,
                    queuedAt: Date.now()
                });
            }
            
            console.log(`[QUEUE] Recovered ${this.queue.length} items`);
            
            if (!this.processing && !this.paused && !this.processingLock) {
                setImmediate(() => this.processQueue());
            }
        } catch (error) {
            console.error('[QUEUE] Error during recovery:', error);
        }
    }

    getStatus() {
        return {
            size: this.queue.length,
            processing: this.processing,
            paused: this.paused,
            failedCount: this.failed.length,
            maxRetries: this.maxRetries,
            batchSize: this.batchSize,
            processedIdsCacheSize: this.processedIds.size
        };
    }

    getPendingItems() {
        return [...this.queue];
    }

    getFailedItems() {
        return [...this.failed];
    }

    pause() {
        this.paused = true;
        console.log('[QUEUE] Paused');
    }

    resume() {
        this.paused = false;
        console.log('[QUEUE] Resumed');
        
        if (this.queue.length > 0 && !this.processing && !this.processingLock) {
            setImmediate(() => this.processQueue());
        }
    }

    async clear() {
        const count = this.queue.length;
        this.queue = [];
        await DatabaseService.clearQueuePersistence().catch(() => {});
        console.log(`[QUEUE] Cleared ${count} pending items`);
    }

    clearFailed() {
        const count = this.failed.length;
        this.failed = [];
        console.log(`[QUEUE] Cleared ${count} failed items`);
    }

    async retryItem(id) {
        const item = this.failed.find(x => x.id === id);
        
        if (!item) return false;
        
        this.failed = this.failed.filter(x => x.id !== id);
        
        delete item.failedAt;
        delete item.error;
        item.retries = 0;
        
        await this.addToQueue(item);
        console.log(`[QUEUE] Queued item ${id} for retry`);
        
        return true;
    }

    async retryAllFailed() {
        const items = [...this.failed];
        this.failed = [];
        
        console.log(`[QUEUE] Retrying ${items.length} failed items`);
        
        for (const item of items) {
            delete item.failedAt;
            delete item.error;
            item.retries = 0;
            await this.addToQueue(item);
        }
        
        return items.length;
    }
}

export default new QueueService();