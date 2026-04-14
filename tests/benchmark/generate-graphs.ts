import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import * as fs from 'fs';

const width = 1200;
const height = 630;

const renderer = new ChartJSNodeCanvas({
  width, height,
  backgroundColour: '#0d1117',
});

// ═══ GRAPH 1: Cost & Latency at Scale ═══

async function graph1() {
  const milestones = ['10', '50', '100', '250', '500', '1,000'];
  const woCost =   [0.04, 0.21, 0.41, 1.03, 2.07, 4.15];
  const wCost =    [0.04, 0.21, 0.41, 0.64, 0.94, 1.56];
  const woAvgLat = [1822, 2003, 1914, 1983, 1961, 1983];
  const wAvgLat =  [1619, 1921, 1918, 1271, 991, 871];

  const buf = await renderer.renderToBuffer({
    type: 'bar',
    data: {
      labels: milestones,
      datasets: [
        {
          label: 'Without MM ($)',
          data: woCost,
          backgroundColor: 'rgba(248, 81, 73, 0.75)',
          borderColor: 'rgb(248, 81, 73)',
          borderWidth: 1,
          borderRadius: 6,
          yAxisID: 'cost',
          order: 2,
        },
        {
          label: 'With MM ($)',
          data: wCost,
          backgroundColor: 'rgba(63, 185, 80, 0.75)',
          borderColor: 'rgb(63, 185, 80)',
          borderWidth: 1,
          borderRadius: 6,
          yAxisID: 'cost',
          order: 2,
        },
        {
          label: 'Without MM (latency)',
          data: woAvgLat,
          type: 'line' as const,
          borderColor: 'rgb(248, 81, 73)',
          backgroundColor: 'transparent',
          borderWidth: 3,
          borderDash: [8, 4],
          pointRadius: 6,
          pointBackgroundColor: 'rgb(248, 81, 73)',
          yAxisID: 'latency',
          order: 1,
        },
        {
          label: 'With MM (latency)',
          data: wAvgLat,
          type: 'line' as const,
          borderColor: 'rgb(63, 185, 80)',
          backgroundColor: 'transparent',
          borderWidth: 3,
          borderDash: [8, 4],
          pointRadius: 6,
          pointBackgroundColor: 'rgb(63, 185, 80)',
          yAxisID: 'latency',
          order: 1,
        },
      ],
    },
    options: {
      plugins: {
        title: {
          display: true,
          text: ['Muscle Memory: Cost & Latency at Scale', '1,000 real queries \u00b7 gpt-5.4 \u00b7 128 tools \u00b7 20 e-commerce patterns'],
          color: '#e6edf3',
          font: { size: 20, weight: 'bold' as const },
          padding: { bottom: 20 },
        },
        legend: {
          position: 'bottom' as const,
          labels: { color: '#e6edf3', padding: 20, usePointStyle: true, font: { size: 13 } },
        },
        subtitle: {
          display: true,
          text: '62% cost savings \u00b7 2.3x faster \u00b7 82% queries skip the LLM',
          color: '#3fb950',
          font: { size: 14 },
          padding: { bottom: 8 },
        },
      },
      scales: {
        x: {
          title: { display: true, text: 'Total Queries', color: '#8b949e', font: { size: 13 } },
          grid: { color: '#21262d' },
          ticks: { color: '#8b949e', font: { size: 13 } },
        },
        cost: {
          type: 'linear' as const, position: 'left' as const,
          title: { display: true, text: 'Total Cost (USD)', color: '#8b949e', font: { size: 13 } },
          grid: { color: '#21262d' },
          ticks: { color: '#8b949e', callback: (v: any) => '$' + Number(v).toFixed(1), font: { size: 12 } },
        },
        latency: {
          type: 'linear' as const, position: 'right' as const,
          title: { display: true, text: 'Avg Latency per Query (ms)', color: '#8b949e', font: { size: 13 } },
          grid: { display: false },
          ticks: { color: '#8b949e', callback: (v: any) => v + 'ms', font: { size: 12 } },
          min: 0, max: 2500,
        },
      },
    },
  });

  fs.writeFileSync('./graph1-cost-latency.png', buf);
  console.log('Saved graph1-cost-latency.png');
}

// ═══ GRAPH 2: Per-Pattern Latency Breakdown ═══

async function graph2() {
  const patterns = [
    { name: 'payment status', mem: 90, mmLat: 503, llmLat: 2181 },
    { name: 'reorder', mem: 90, mmLat: 508, llmLat: 1549 },
    { name: 'order details', mem: 90, mmLat: 470, llmLat: 3262 },
    { name: 'order status', mem: 88, mmLat: 478, llmLat: 1646 },
    { name: 'add to cart', mem: 88, mmLat: 510, llmLat: 1800 },
    { name: 'shipping rates', mem: 88, mmLat: 453, llmLat: 1467 },
    { name: 'track order', mem: 86, mmLat: 477, llmLat: 1848 },
    { name: 'refund', mem: 84, mmLat: 997, llmLat: 1850 },
    { name: 'coupon', mem: 84, mmLat: 1653, llmLat: 1614 },
    { name: 'cancel order', mem: 80, mmLat: 444, llmLat: 2201 },
    { name: 'return item', mem: 80, mmLat: 871, llmLat: 1941 },
    { name: 'invoice', mem: 80, mmLat: 446, llmLat: 1823 },
    { name: 'cancel sub', mem: 76, mmLat: 467, llmLat: 2398 },
    { name: 'check stock', mem: 74, mmLat: 460, llmLat: 1858 },
    { name: 'loyalty pts', mem: 70, mmLat: 473, llmLat: 2035 },
    { name: 'wishlist', mem: 64, mmLat: 487, llmLat: 2579 },
  ];

  const buf = await renderer.renderToBuffer({
    type: 'bar',
    data: {
      labels: patterns.map(p => p.name),
      datasets: [
        {
          label: 'LLM latency (ms)',
          data: patterns.map(p => p.llmLat),
          backgroundColor: 'rgba(248, 81, 73, 0.75)',
          borderColor: 'rgb(248, 81, 73)',
          borderWidth: 1,
          borderRadius: 4,
          yAxisID: 'latency',
        },
        {
          label: 'Memory latency (ms)',
          data: patterns.map(p => p.mmLat),
          backgroundColor: 'rgba(63, 185, 80, 0.75)',
          borderColor: 'rgb(63, 185, 80)',
          borderWidth: 1,
          borderRadius: 4,
          yAxisID: 'latency',
        },
        {
          label: 'Memory hit rate (%)',
          data: patterns.map(p => p.mem),
          type: 'line' as const,
          borderColor: 'rgb(136, 132, 216)',
          backgroundColor: 'transparent',
          borderWidth: 3,
          pointRadius: 5,
          pointBackgroundColor: 'rgb(136, 132, 216)',
          yAxisID: 'pct',
          order: 0,
        },
      ],
    },
    options: {
      plugins: {
        title: {
          display: true,
          text: ['Muscle Memory: Per-Pattern Latency Breakdown', 'Memory-served queries are 3.3x faster \u00b7 all 20 patterns learn successfully'],
          color: '#e6edf3',
          font: { size: 20, weight: 'bold' as const },
          padding: { bottom: 20 },
        },
        legend: {
          position: 'bottom' as const,
          labels: { color: '#e6edf3', padding: 20, usePointStyle: true, font: { size: 13 } },
        },
        subtitle: {
          display: true,
          text: 'Avg memory latency: 606ms \u00b7 Avg LLM latency: 1,983ms \u00b7 82% tokens saved',
          color: '#3fb950',
          font: { size: 14 },
          padding: { bottom: 8 },
        },
      },
      scales: {
        x: {
          grid: { color: '#21262d' },
          ticks: { color: '#8b949e', font: { size: 11 }, maxRotation: 45, minRotation: 45 },
        },
        latency: {
          type: 'linear' as const, position: 'left' as const,
          title: { display: true, text: 'Latency (ms)', color: '#8b949e', font: { size: 13 } },
          grid: { color: '#21262d' },
          ticks: { color: '#8b949e', font: { size: 12 } },
        },
        pct: {
          type: 'linear' as const, position: 'right' as const,
          title: { display: true, text: 'Memory Hit Rate (%)', color: '#8b949e', font: { size: 13 } },
          grid: { display: false },
          ticks: { color: '#8b949e', callback: (v: any) => v + '%', font: { size: 12 } },
          min: 0, max: 100,
        },
      },
    },
  });

  fs.writeFileSync('./graph2-per-pattern.png', buf);
  console.log('Saved graph2-per-pattern.png');
}

async function main() {
  await graph1();
  await graph2();
  console.log('Done!');
}

main().catch(console.error);
