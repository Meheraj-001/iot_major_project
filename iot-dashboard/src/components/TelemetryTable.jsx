import { Card, Table, Tag, Typography } from "antd";
import dayjs from "dayjs";

const { Text } = Typography;

function TelemetryTable({ telemetry, loading }) {
  const columns = [
    {
      title: "Device",
      dataIndex: "device_id",
      key: "device_id",
      render: (value) => <Text strong>{value}</Text>,
    },
    {
      title: "Type",
      dataIndex: "device_type",
      key: "device_type",
      render: (value) => <Tag color="blue">{value || "UNKNOWN"}</Tag>,
    },
    {
      title: "Temp",
      dataIndex: "temperature",
      key: "temperature",
      render: (value) => (value !== null && value !== undefined ? `${value}°C` : "-"),
    },
    {
      title: "Humidity",
      dataIndex: "humidity",
      key: "humidity",
      render: (value) => (value !== null && value !== undefined ? `${value}%` : "-"),
    },
    {
      title: "Light",
      dataIndex: "light",
      key: "light",
      render: (value) => value ?? "-",
    },
    {
      title: "Relay",
      dataIndex: "relay_state",
      key: "relay_state",
      render: (value) => (
        <Tag color={value === "ON" ? "red" : "default"}>{value || "-"}</Tag>
      ),
    },
    {
      title: "Mode",
      dataIndex: "mode",
      key: "mode",
      render: (value) => (
        <Tag color={value === "AUTO" ? "green" : "orange"}>{value || "-"}</Tag>
      ),
    },
    {
      title: "RSSI",
      dataIndex: "rssi",
      key: "rssi",
      render: (value) => value ?? "-",
    },
    {
      title: "Time",
      dataIndex: "timestamp",
      key: "timestamp",
      render: (value) => (value ? dayjs(value).format("HH:mm:ss") : "-"),
    },
  ];

  return (
    <Card
      title="Latest Telemetry"
      className="shadow-sm border border-slate-200"
    >
      <Table
        rowKey="id"
        columns={columns}
        dataSource={telemetry}
        loading={loading}
        pagination={{ pageSize: 8 }}
        scroll={{ x: 900 }}
      />
    </Card>
  );
}

export default TelemetryTable;