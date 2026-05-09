import { useState } from "react";
import {
    Card,
    Tag,
    Button,
    Space,
    Typography,
    Progress,
    InputNumber,
    Divider,
    message,
} from "antd";
import {
    WifiOutlined,
    DisconnectOutlined,
    ThunderboltOutlined,
    FireOutlined,
    CloudOutlined,
    BulbOutlined,
    SettingOutlined,
    PoweroffOutlined,
} from "@ant-design/icons";
import { sendDeviceCommand } from "../api/";

const { Text, Title } = Typography;

function DeviceCard({ device, onRefresh }) {
    const [loading, setLoading] = useState(false);
    const [threshold, setThreshold] = useState(null);

    const isOnline = Boolean(device.online);
    const isDHT = device.device_type === "DHT11";
    const isLDR = device.device_type === "LDR";

    const lightPercent =
        device.last_light !== null && device.last_light !== undefined
            ? Math.min(100, Math.round((Number(device.last_light) / 4095) * 100))
            : 0;

    async function handleCommand(command) {
        try {
            setLoading(true);
            await sendDeviceCommand(device.id, command);
            message.success("Command sent successfully");
            await onRefresh();
        } catch (error) {
            message.error(error.response?.data?.error || error.message);
        } finally {
            setLoading(false);
        }
    }

    async function handleThreshold() {
        if (threshold === null || threshold === undefined) {
            message.warning("Enter light threshold first");
            return;
        }

        await handleCommand({
            light_threshold: Number(threshold),
        });

        setThreshold(null);
    }

    return (
        <Card
            className="h-full shadow-sm border border-slate-200 hover:shadow-lg transition-all duration-300"
            styles={{
                body: {
                    padding: 20,
                },
            }}
        >
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="flex items-center gap-2">
                        <ThunderboltOutlined className="text-blue-600" />
                        <Title level={5} className="!m-0">
                            {device.name || device.id}
                        </Title>
                    </div>

                    <Text type="secondary" className="text-xs break-all">
                        {device.id}
                    </Text>
                </div>

                <Tag
                    icon={isOnline ? <WifiOutlined /> : <DisconnectOutlined />}
                    color={isOnline ? "success" : "error"}
                    className="rounded-full px-3 py-1"
                >
                    {isOnline ? "Online" : "Offline"}
                </Tag>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
                <Tag color="blue">{device.device_type || "UNKNOWN"}</Tag>
                <Tag color={device.mode === "AUTO" ? "green" : "orange"}>
                    {device.mode || "AUTO"}
                </Tag>
                <Tag color={device.relay_state === "ON" ? "red" : "default"}>
                    Relay {device.relay_state || "OFF"}
                </Tag>
                <Tag>RSSI {device.rssi ?? "N/A"}</Tag>
            </div>

            <Divider className="!my-4" />

            {isDHT && (
                <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-red-50 p-4 border border-red-100">
                        <div className="flex items-center gap-2 text-red-600">
                            <FireOutlined />
                            <Text strong>Temperature</Text>
                        </div>

                        <div className="mt-2 text-2xl font-extrabold text-slate-900">
                            {device.last_temperature !== null &&
                                device.last_temperature !== undefined
                                ? `${Number(device.last_temperature).toFixed(1)}°C`
                                : "N/A"}
                        </div>
                    </div>

                    <div className="rounded-2xl bg-blue-50 p-4 border border-blue-100">
                        <div className="flex items-center gap-2 text-blue-600">
                            <CloudOutlined />
                            <Text strong>Humidity</Text>
                        </div>

                        <div className="mt-2 text-2xl font-extrabold text-slate-900">
                            {device.last_humidity !== null &&
                                device.last_humidity !== undefined
                                ? `${Number(device.last_humidity).toFixed(0)}%`
                                : "N/A"}
                        </div>
                    </div>
                </div>
            )}

            {isLDR && (
                <div className="rounded-2xl bg-amber-50 p-4 border border-amber-100">
                    <div className="flex items-center gap-2 text-amber-600">
                        <BulbOutlined />
                        <Text strong>Light Level</Text>
                    </div>

                    <div className="mt-2 flex items-end justify-between gap-3">
                        <div className="text-3xl font-extrabold text-slate-900">
                            {device.last_light !== null && device.last_light !== undefined
                                ? device.last_light
                                : "No data"}
                        </div>
                        <Text type="secondary">0 - 4095</Text>
                    </div>

                    {device.last_light !== null && device.last_light !== undefined ? (
                        <>
                            <Progress
                                percent={lightPercent}
                                status="active"
                                strokeColor={{
                                    from: "#f59e0b",
                                    to: "#22c55e",
                                }}
                                className="!mt-3"
                            />
                            <div className="text-xs text-center mt-2 text-gray-500">
                                {lightPercent > 70 ? "🌙 Dark" : lightPercent < 30 ? "☀️ Bright" : "🌤️ Moderate"}
                            </div>
                        </>
                    ) : (
                        <div className="text-center text-gray-400 text-sm mt-4">
                            <BulbOutlined className="mr-1" />
                            Waiting for light data...
                            <div className="text-xs mt-1">Check ESP32 LDR connection</div>
                        </div>
                    )}
                </div>
            )}

            <Divider className="!my-4" />

            <div className="grid grid-cols-2 gap-3">
                <Button
                    icon={<PoweroffOutlined />}
                    type="primary"
                    danger
                    loading={loading}
                    onClick={() => handleCommand({ relay: "ON" })}
                >
                    Relay ON
                </Button>

                <Button
                    loading={loading}
                    onClick={() => handleCommand({ relay: "OFF" })}
                >
                    Relay OFF
                </Button>

                <Button
                    type="primary"
                    ghost
                    loading={loading}
                    onClick={() => handleCommand({ mode: "AUTO" })}
                >
                    Auto
                </Button>

                <Button
                    loading={loading}
                    onClick={() => handleCommand({ mode: "MANUAL" })}
                >
                    Manual
                </Button>
            </div>

            {isLDR && (
                <div className="mt-4 rounded-2xl bg-slate-50 p-3 border border-slate-200">
                    <Space.Compact className="w-full">
                        <InputNumber
                            className="!w-full"
                            min={0}
                            max={4095}
                            placeholder="Light threshold"
                            value={threshold}
                            onChange={setThreshold}
                            prefix={<SettingOutlined />}
                        />

                        <Button type="primary" loading={loading} onClick={handleThreshold}>
                            Set
                        </Button>
                    </Space.Compact>
                </div>
            )}
        </Card>
    );
}

export default DeviceCard;