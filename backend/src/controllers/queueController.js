import queueService from "../utils/queueService.js";

async function getQueueStatus(req, res) {
  try {
    const status = queueService.getStatus();
    res.json({
      success: true,
      queue: status
    });
  } catch (error) {
    console.error('[QueueController] Error getting queue status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

async function getPendingItems(req, res) {
  try {
    const items = queueService.getPendingItems();
    res.json({
      success: true,
      count: items.length,
      items: items
    });
  } catch (error) {
    console.error('[QueueController] Error getting pending items:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

async function pauseQueue(req, res) {
  try {
    queueService.pause();
    res.json({
      success: true,
      message: 'Queue paused',
      status: queueService.getStatus()
    });
  } catch (error) {
    console.error('[QueueController] Error pausing queue:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

async function resumeQueue(req, res) {
  try {
    queueService.resume();
    res.json({
      success: true,
      message: 'Queue resumed',
      status: queueService.getStatus()
    });
  } catch (error) {
    console.error('[QueueController] Error resuming queue:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

async function clearQueue(req, res) {
  try {
    queueService.clear();
    res.json({
      success: true,
      message: 'Queue cleared',
      status: queueService.getStatus()
    });
  } catch (error) {
    console.error('[QueueController] Error clearing queue:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

async function getFailedItems(req, res) {
  try {
    const failed = queueService.getFailedItems();
    res.json({
      success: true,
      count: failed.length,
      items: failed
    });
  } catch (error) {
    console.error('[QueueController] Error getting failed items:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

async function retryItem(req, res) {
  try {
    const { id } = req.params;
    const result = await queueService.retryItem(id);
    if (result) {
      res.json({
        success: true,
        message: `Item ${id} queued for retry`
      });
    } else {
      res.status(404).json({
        success: false,
        message: `Item ${id} not found in failed queue`
      });
    }
  } catch (error) {
    console.error('[QueueController] Error retrying item:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

async function retryAllFailed(req, res) {
  try {
    const count = await queueService.retryAllFailed();
    res.json({
      success: true,
      message: `${count} items queued for retry`,
      count
    });
  } catch (error) {
    console.error('[QueueController] Error retrying all failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

async function clearFailed(req, res) {
  try {
    queueService.clearFailed();
    res.json({
      success: true,
      message: 'Failed queue cleared'
    });
  } catch (error) {
    console.error('[QueueController] Error clearing failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

async function getQueueStats(req, res) {
  try {
    const status = queueService.getStatus();
    const pendingItems = queueService.getPendingItems();
    
    // Calculate average processing time if available
    const stats = {
      currentSize: status.size,
      isProcessing: status.processing,
      isPaused: status.paused,
      failedCount: status.failedCount || 0,
      pendingDetails: {
        count: pendingItems.length,
        oldest: pendingItems.length > 0 ? pendingItems[0].queuedAt : null,
        newest: pendingItems.length > 0 ? pendingItems[pendingItems.length - 1].queuedAt : null
      }
    };
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('[QueueController] Error getting queue stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

export {
  getQueueStatus,
  getPendingItems,
  pauseQueue,
  resumeQueue,
  clearQueue,
  getFailedItems,
  retryItem,
  retryAllFailed,
  clearFailed,
  getQueueStats
};