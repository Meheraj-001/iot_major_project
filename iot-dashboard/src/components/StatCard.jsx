import { Card, Statistic } from "antd";

function StatCard({ title, value, suffix, prefix, loading }) {
  return (
    <Card
      loading={loading}
      className="shadow-sm border border-slate-200"
      styles={{
        body: {
          padding: 18,
        },
      }}
    >
      <Statistic
        title={<span className="text-slate-500 font-medium">{title}</span>}
        value={value}
        suffix={suffix}
        prefix={prefix}
        valueStyle={{
          fontWeight: 800,
          color: "#0f172a",
          fontSize: 26,
        }}
      />
    </Card>
  );
}

export default StatCard;
