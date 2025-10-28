// src/components/analytics/HourCurveCard.jsx
import React, { useMemo } from "react";
import styles from "./HourCurveCard.module.css";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

function groupByHour(trades){
  const arr = new Array(24).fill(0).map((_,h)=>({h, n:0, sumR:0}));
  for(const t of trades){
    const h = new Date(t.createdAt).getHours();
    const r = Number(t.netR||0);
    arr[h].n++; arr[h].sumR+=r;
  }
  return arr.map(x=>({ hour:x.h, exp: x.n? x.sumR/x.n : 0, n:x.n }));
}

export default function HourCurveCard({ trades }) {
  const rows = useMemo(()=>groupByHour(trades),[trades]);
  return (
    <section className={styles.card}>
      <h3>Кривая по часу (Exp R)</h3>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={rows} margin={{left:6,right:6,top:6,bottom:0}}>
          <CartesianGrid vertical={false} strokeOpacity={0.15}/>
          <XAxis dataKey="hour" />
          <YAxis width={40}/>
          <Tooltip />
          <Line dataKey="exp" dot={false}/>
        </LineChart>
      </ResponsiveContainer>
    </section>
  );
}
