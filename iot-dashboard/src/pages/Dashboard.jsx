import { useEffect, useState } from "react";
import {
  Layout,
  Row,
  Col,
  Button,
  Tag,
  Typography,
  Alert,
  Spin,
  Empty,
  Card,
} from "antd";
import {
  ReloadOutlined,
  CloudServerOutlined,
  WifiOutlined,
  DatabaseOutlined,
  ClusterOutlined,
  FireOutlined,
  CloudOutlined,
  BulbOutlined,
  OrderedListOutlined,
} from "@ant-design/icons";

import {
  getDashboardStats,
  getDevices,
  getHealth,
  getLatestTelemetry,
  getQueueStatus,
} from "../api/index";

import StatCard from "../components/StatCard";
import DeviceCard from "../components/DeviceCard";
import QueuePanel from "../components/QueuePanel";
import TelemetryTable from "../components/TelemetryTable";

const { Header, Content } = Layout;
const { Title, Text } = Typography;

function Dashboard() {
  const [health, setHealth] = useState(null);
  const [stats, setStats] = useState(null);
  const [devices, setDevices] = useState([]);
  const [telemetry, setTelemetry] = useState([]);
  const [queue, setQueue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState("");
async function loadData() {
    try {
        setError("");
        setLoading(true);

        const [healthRes, statsRes, devicesRes, telemetryRes, queueRes] =
            await Promise.all([
                getHealth(),
                getDashboardStats(),
                getDevices(),
                getLatestTelemetry(),
                getQueueStatus(),
            ]);

        // Transform health data if needed
        const transformedHealth = {
            mqtt: {
                connected: healthRes?.services?.mqtt?.connected || 
                          healthRes?.mqtt?.connected || 
                          healthRes?.mqtt || 
                          false
            },
            database: {
                connected: healthRes?.services?.database?.connected || 
                          healthRes?.database?.connected || 
                          healthRes?.database || 
                          false
            }
        };

        setHealth(transformedHealth);
        setStats(statsRes.stats);
        setDevices(devicesRes.devices || []);
        setTelemetry(telemetryRes.telemetry || []);
        setQueue(queueRes.queue);
        setLastUpdated(new Date());
    } catch (err) {
        console.error(err);
        setError("Unable to connect to backend. Check http://localhost:3001");
    } finally {
        setLoading(false);
    }
}

  useEffect(() => {
    loadData();

    const interval = setInterval(loadData, 5000);

    return () => clearInterval(interval);
  }, []);

  const avgTemp = stats?.temperature?.average
    ? Number(stats.temperature.average).toFixed(1)
    : 0;

  const avgHumidity = stats?.humidity?.average
    ? Number(stats.humidity.average).toFixed(0)
    : 0;

  const avgLight = stats?.light?.average
    ? Number(stats.light.average).toFixed(0)
    : 0;

  return (
    <Layout className="min-h-screen !bg-slate-100">
      <Header className="!h-auto !px-4 md:!px-8 !py-5 !bg-transparent">
        <div className="rounded-[28px] bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-6 md:p-8 text-white shadow-2xl">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
            <div>
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center">
                  <CloudServerOutlined className="text-2xl text-blue-300" />
                </div>

                <div>
                  <Title level={2} className="!text-white !m-0">
                    Distributed ESP32 Sensor System
                  </Title>
                  <Text className="!text-slate-300">
                    DHT11 + LDR monitoring with MQTT, queue, SQLite and live control
                  </Text>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Tag
                icon={<WifiOutlined />}
                color={health?.mqtt?.connected ? "success" : "error"}
                className="!px-3 !py-1 !rounded-full"
              >
                MQTT {health?.mqtt?.connected ? "Connected" : "Disconnected"}
              </Tag>

              <Tag
                icon={<DatabaseOutlined />}
                color={health?.database?.connected ? "success" : "error"}
                className="!px-3 !py-1 !rounded-full"
              >
                DB {health?.database?.connected ? "Connected" : "Disconnected"}
              </Tag>

              <Button
                icon={<ReloadOutlined spin={loading} />}
                onClick={loadData}
                loading={loading}
              >
                Refresh
              </Button>
            </div>
          </div>

          <div className="mt-5 text-slate-400 text-sm">
            Last updated:{" "}
            <span className="text-white font-semibold">
              {lastUpdated ? lastUpdated.toLocaleTimeString() : "N/A"}
            </span>
          </div>
        </div>
      </Header>

      <Content className="!px-4 md:!px-8 !pb-8">
        {error && (
          <Alert
            type="error"
            showIcon
            message={error}
            className="!mb-5"
          />
        )}

        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={8} xl={4}>
            <StatCard
              loading={loading}
              title="Active Devices"
              value={stats?.activeDevices ?? 0}
              prefix={<ClusterOutlined />}
            />
          </Col>

          <Col xs={24} sm={12} lg={8} xl={4}>
            <StatCard
              loading={loading}
              title="Total Readings"
              value={stats?.totalReadings ?? 0}
              prefix={<DatabaseOutlined />}
            />
          </Col>

          <Col xs={24} sm={12} lg={8} xl={4}>
            <StatCard
              loading={loading}
              title="Avg Temperature"
              value={avgTemp}
              suffix="°C"
              prefix={<FireOutlined />}
            />
          </Col>

          <Col xs={24} sm={12} lg={8} xl={4}>
            <StatCard
              loading={loading}
              title="Avg Humidity"
              value={avgHumidity}
              suffix="%"
              prefix={<CloudOutlined />}
            />
          </Col>

          <Col xs={24} sm={12} lg={8} xl={4}>
            <StatCard
              loading={loading}
              title="Avg Light"
              value={avgLight}
              prefix={<BulbOutlined />}
            />
          </Col>

          <Col xs={24} sm={12} lg={8} xl={4}>
            <StatCard
              loading={loading}
              title="Queue Size"
              value={queue?.size ?? 0}
              prefix={<OrderedListOutlined />}
            />
          </Col>
        </Row>

        <Row gutter={[18, 18]} className="mt-5">
          <Col xs={24} xl={16}>
            <Card
              title="ESP32 Devices"
              extra={<Tag color="blue">{devices.length} devices</Tag>}
              className="shadow-sm border border-slate-200"
            >
              {loading && devices.length === 0 ? (
                <div className="py-20 flex justify-center">
                  <Spin size="large" />
                </div>
              ) : devices.length > 0 ? (
                <Row gutter={[16, 16]}>
                  {devices.map((device) => (
                    <Col xs={24} lg={12} key={device.id}>
                      <DeviceCard device={device} onRefresh={loadData} />
                    </Col>
                  ))}
                </Row>
              ) : (
                <Empty
                  description="No ESP32 device found yet. Start ESP32 or publish MQTT test data."
                  className="py-16"
                />
              )}
            </Card>
          </Col>

          <Col xs={24} xl={8}>
            <QueuePanel queue={queue} onRefresh={loadData} />
          </Col>
        </Row>

        <div className="mt-5">
          <TelemetryTable telemetry={telemetry} loading={loading} />
        </div>
      </Content>
    </Layout>
  );
}

export default Dashboard;