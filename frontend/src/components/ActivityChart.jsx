import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export default function ActivityChart({ data }) {
  return <div className="chart-area"><ResponsiveContainer width="100%" height="100%"><BarChart data={data}><CartesianGrid vertical={false} stroke="#eaf0f2" /><XAxis dataKey={data[0]?.month ? 'month' : 'day'} tickLine={false} axisLine={false} tick={{ fill: '#8a9ba2', fontSize: 11 }} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: '#8a9ba2', fontSize: 11 }} /><Tooltip cursor={{ fill: '#f3f8fa' }} /><Bar dataKey="total" fill="#39a9a3" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></div>;
}
