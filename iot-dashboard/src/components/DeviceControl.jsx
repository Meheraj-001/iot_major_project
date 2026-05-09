import React, { useState } from 'react';
import { Card, Button, Space, Switch, Select, InputNumber, message, Modal, Slider, Row, Col, Tag, Divider, Alert } from 'antd';
import { 
  ThunderboltOutlined, 
  BulbOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  SettingOutlined,
  SendOutlined,
  WifiOutlined,
  CheckOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import { sensorApi } from '../api';

const DeviceControl = ({ device, onCommandSent }) => {
  const [loading, setLoading] = useState(false);
  const [tempHigh, setTempHigh] = useState(device?.temp_threshold_high || 30);
  const [tempLow, setTempLow] = useState(device?.temp_threshold_low || 25);
  const [humidityHigh, setHumidityHigh] = useState(device?.humidity_threshold_high || 80);
  const [humidityLow, setHumidityLow] = useState(device?.humidity_threshold_low || 40);
  const [ldrDark, setLdrDark] = useState(device?.dark_threshold || 2500);
  const [ldrLight, setLdrLight] = useState(device?.light_threshold || 1500);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const isDHT = device?.id?.startsWith('dht11');
  const isLDR = device?.id?.startsWith('ldr');

  const sendCommand = async (command) => {
    setLoading(true);
    try {
      await sensorApi.sendCommand(device.id, command);
      message.success(`Command sent to ${device.id}`);
      if (onCommandSent) onCommandSent();
    } catch (error) {
      message.error('Failed to send command');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleRelayToggle = (checked) => {
    sendCommand({ relay: checked ? 'ON' : 'OFF' });
  };

  const handleModeToggle = (checked) => {
    sendCommand({ mode: checked ? 'AUTO' : 'MANUAL' });
  };

  const handleThresholdsUpdate = () => {
    const command = {};
    if (isDHT) {
      if (tempHigh) command.temp_high = tempHigh;
      if (tempLow) command.temp_low = tempLow;
      if (humidityHigh) command.humidity_high = humidityHigh;
      if (humidityLow) command.humidity_low = humidityLow;
    }
    if (isLDR) {
      if (ldrDark) command.ldr_dark = ldrDark;
      if (ldrLight) command.ldr_light = ldrLight;
    }
    sendCommand(command);
    setIsModalOpen(false);
  };

  const isOnline = device?.status === 'online' || device?.online;

  return (
    <Card 
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isDHT ? <ThunderboltOutlined /> : <BulbOutlined />}
          <span>{device?.id}</span>
          <Tag color={isOnline ? 'success' : 'error'} style={{ marginLeft: '8px' }}>
            {isOnline ? <WifiOutlined /> : <CloseOutlined />}
            {' '}{isOnline ? 'Online' : 'Offline'}
          </Tag>
        </div>
      }
      size="small"
      style={{ marginBottom: '16px' }}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        {/* Relay Control */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span><ThunderboltOutlined /> Relay Control</span>
          <Switch
            checked={device?.relay_state === 'ON'}
            onChange={handleRelayToggle}
            checkedChildren="ON"
            unCheckedChildren="OFF"
            disabled={!isOnline}
            loading={loading}
          />
        </div>

        {/* Mode Control */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span><SettingOutlined /> Mode</span>
          <Switch
            checked={device?.mode === 'AUTO'}
            onChange={handleModeToggle}
            checkedChildren="AUTO"
            unCheckedChildren="MANUAL"
            disabled={!isOnline}
            loading={loading}
          />
        </div>

        {/* Device Type Specific Controls */}
        <Divider style={{ margin: '8px 0' }} />
        
        {isDHT && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span><SettingOutlined /> Threshold Settings</span>
              <Button 
                size="small" 
                icon={<SettingOutlined />}
                onClick={() => setIsModalOpen(true)}
                disabled={!isOnline}
              >
                Configure
              </Button>
            </div>
            <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#666' }}>
              <span>Temp: {device?.temp_threshold_low || tempLow}°C - {device?.temp_threshold_high || tempHigh}°C</span>
              <span>Humidity: {device?.humidity_threshold_low || humidityLow}% - {device?.humidity_threshold_high || humidityHigh}%</span>
            </div>
          </div>
        )}

        {isLDR && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span><SettingOutlined /> Light Thresholds</span>
              <Button 
                size="small" 
                icon={<SettingOutlined />}
                onClick={() => setIsModalOpen(true)}
                disabled={!isOnline}
              >
                Configure
              </Button>
            </div>
            <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#666' }}>
              <span>Dark above: {device?.dark_threshold || ldrDark}</span>
              <span>Light below: {device?.light_threshold || ldrLight}</span>
            </div>
          </div>
        )}

        {!isOnline && (
          <Alert
            message="Device Offline"
            description="This device is not responding. Commands may not be delivered."
            type="warning"
            showIcon
            size="small"
          />
        )}
      </Space>

      {/* Threshold Configuration Modal */}
      <Modal
        title={`Configure ${device?.id}`}
        open={isModalOpen}
        onOk={handleThresholdsUpdate}
        onCancel={() => setIsModalOpen(false)}
        okText="Apply"
        cancelText="Cancel"
      >
        {isDHT && (
          <div style={{ padding: '16px 0' }}>
            <h4>Temperature Thresholds</h4>
            <Row gutter={16}>
              <Col span={12}>
                <div style={{ marginBottom: '16px' }}>
                  <label>High Temperature (°C)</label>
                  <InputNumber
                    min={0}
                    max={50}
                    value={tempHigh}
                    onChange={setTempHigh}
                    style={{ width: '100%', marginTop: '8px' }}
                  />
                </div>
              </Col>
              <Col span={12}>
                <div style={{ marginBottom: '16px' }}>
                  <label>Low Temperature (°C)</label>
                  <InputNumber
                    min={0}
                    max={50}
                    value={tempLow}
                    onChange={setTempLow}
                    style={{ width: '100%', marginTop: '8px' }}
                  />
                </div>
              </Col>
            </Row>
            <h4 style={{ marginTop: '16px' }}>Humidity Thresholds</h4>
            <Row gutter={16}>
              <Col span={12}>
                <div style={{ marginBottom: '16px' }}>
                  <label>High Humidity (%)</label>
                  <InputNumber
                    min={0}
                    max={100}
                    value={humidityHigh}
                    onChange={setHumidityHigh}
                    style={{ width: '100%', marginTop: '8px' }}
                  />
                </div>
              </Col>
              <Col span={12}>
                <div style={{ marginBottom: '16px' }}>
                  <label>Low Humidity (%)</label>
                  <InputNumber
                    min={0}
                    max={100}
                    value={humidityLow}
                    onChange={setHumidityLow}
                    style={{ width: '100%', marginTop: '8px' }}
                  />
                </div>
              </Col>
            </Row>
          </div>
        )}

        {isLDR && (
          <div style={{ padding: '16px 0' }}>
            <h4>Light Intensity Thresholds</h4>
            <div style={{ marginBottom: '16px' }}>
              <label>Dark Threshold (above this = DARK)</label>
              <InputNumber
                min={0}
                max={4095}
                value={ldrDark}
                onChange={setLdrDark}
                style={{ width: '100%', marginTop: '8px' }}
              />
              <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                When light &gt; {ldrDark}, relay turns ON (if in AUTO mode)
              </div>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label>Light Threshold (below this = BRIGHT)</label>
              <InputNumber
                min={0}
                max={4095}
                value={ldrLight}
                onChange={setLdrLight}
                style={{ width: '100%', marginTop: '8px' }}
              />
              <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                When light &lt; {ldrLight}, relay turns OFF (if in AUTO mode)
              </div>
            </div>
          </div>
        )}
      </Modal>
    </Card>
  );
};

export default DeviceControl;