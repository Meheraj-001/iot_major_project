import { Card, Button, Space, Statistic, Row, Col, Tag, message, Badge, Tooltip } from "antd";
import {
  PauseCircleOutlined,
  PlayCircleOutlined,
  DeleteOutlined,
  DatabaseOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  ClockCircleOutlined,
} from "@ant-design/icons";
import { pauseQueue, resumeQueue, clearQueue } from "../api/index";
import { useState, useEffect } from "react";

function QueuePanel({ queue, onRefresh }) {
  const [loading, setLoading] = useState(false);
  const [lastProcessed, setLastProcessed] = useState(null);

  // Monitor queue activity
  useEffect(() => {
    if (queue?.size > 0 || queue?.processing) {
      setLastProcessed(new Date());
    }
  }, [queue?.size, queue?.processing]);

  async function runAction(action, successText) {
    try {
      setLoading(true);
      await action();
      message.success(successText);
      await onRefresh();
    } catch (error) {
      message.error(error.response?.data?.error || error.message);
    } finally {
      setLoading(false);
    }
  }

  // Determine queue status display
  const getQueueStatus = () => {
    if (queue?.paused) return { text: "Paused", color: "orange", icon: <PauseCircleOutlined /> };
    if (queue?.processing) return { text: "Processing", color: "blue", icon: <SyncOutlined spin /> };
    if (queue?.size > 0 && !queue?.processing) return { text: "Waiting", color: "warning", icon: <ClockCircleOutlined /> };
    return { text: "Idle", color: "success", icon: <CheckCircleOutlined /> };
  };

  const status = getQueueStatus();

  return (
    <Card
      title={
        <div className="flex items-center gap-2">
          <DatabaseOutlined className="text-blue-600" />
          <span>Queue System</span>
        </div>
      }
      extra={
        <Tooltip title={`Queue is ${status.text.toLowerCase()}`}>
          <Tag 
            icon={status.icon} 
            color={status.color}
            className="!px-3 !py-1 !rounded-full"
          >
            {status.text}
          </Tag>
        </Tooltip>
      }
      className="shadow-sm border border-slate-200"
    >
      <Row gutter={[12, 12]}>
        <Col span={12}>
          <Statistic 
            title="Pending" 
            value={queue?.size ?? 0}
            valueStyle={{ color: queue?.size > 0 ? "#faad14" : "#3f8600" }}
            suffix={queue?.size > 0 && <Tag color="orange" className="ml-2">Waiting</Tag>}
          />
          {queue?.size === 0 && (
            <div className="text-xs text-green-600 mt-1">
              <CheckCircleOutlined /> All caught up
            </div>
          )}
        </Col>

        <Col span={12}>
          <Statistic 
            title="Failed" 
            value={queue?.failedCount ?? 0}
            valueStyle={{ color: queue?.failedCount > 0 ? "#cf1322" : "#3f8600" }}
          />
        </Col>

        <Col span={12}>
          <Statistic
            title="Status"
            value={queue?.processing ? "Active" : "Idle"}
            prefix={queue?.processing ? <SyncOutlined spin /> : <CheckCircleOutlined />}
            valueStyle={{ color: queue?.processing ? "#1890ff" : "#52c41a" }}
          />
        </Col>

        <Col span={12}>
          <Statistic 
            title="Batch Size" 
            value={queue?.batchSize ?? 10}
            suffix={<span className="text-xs text-gray-400">items/batch</span>}
          />
        </Col>
      </Row>

      {/* Add activity indicator */}
      {(queue?.size > 0 || queue?.processing) && (
        <div className="mt-3 pt-3 border-t border-slate-200">
          <div className="flex items-center justify-between text-sm">
            <span className="text-blue-600">
              <SyncOutlined spin className="mr-2" />
              Processing queue...
            </span>
            {lastProcessed && (
              <span className="text-gray-400 text-xs">
                Active since: {lastProcessed.toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Add idle message */}
      {queue?.size === 0 && !queue?.processing && !queue?.paused && (
        <div className="mt-3 pt-3 border-t border-slate-200">
          <div className="text-center text-sm text-gray-400">
            <CheckCircleOutlined className="mr-1" />
            Queue idle - no pending items
          </div>
          <div className="text-center text-xs text-gray-300 mt-1">
            New telemetry will be processed instantly
          </div>
        </div>
      )}

      <Space wrap className="mt-4">
        <Button
          icon={<PauseCircleOutlined />}
          loading={loading}
          onClick={() => runAction(pauseQueue, "Queue paused")}
          disabled={queue?.paused}
        >
          Pause
        </Button>

        <Button
          type="primary"
          icon={<PlayCircleOutlined />}
          loading={loading}
          onClick={() => runAction(resumeQueue, "Queue resumed")}
          disabled={!queue?.paused}
        >
          Resume
        </Button>

        <Button
          danger
          icon={<DeleteOutlined />}
          loading={loading}
          onClick={() => runAction(clearQueue, "Queue cleared")}
          disabled={queue?.size === 0}
        >
          Clear
        </Button>
      </Space>

      {/* Help text */}
      <div className="mt-3 text-xs text-gray-400 border-t border-slate-200 pt-3">
        <div className="flex justify-between">
          <span>📊 Max Retries: {queue?.maxRetries ?? 3}</span>
          <span>⚡ Cache Size: {queue?.processedIdsCacheSize ?? 0}</span>
        </div>
      </div>
    </Card>
  );
}

export default QueuePanel;