import { useEffect, useState, useRef } from "react";
import dynamic from "next/dynamic";

// Chart.js setup
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const Line = dynamic(() => import("react-chartjs-2").then((m) => m.Line), {
  ssr: false,
});

type RsiMsg = {
  token: string;
  timestamp: string;
  rsi: number;
};

export default function Dashboard() {
  const [selectedToken, setSelectedToken] = useState<string>("");
  const [allRsiPoints, setAllRsiPoints] = useState<Record<string, RsiMsg[]>>({});
  const [connectionStatus, setConnectionStatus] = useState<string>("Connecting...");
  const [messageCount, setMessageCount] = useState<number>(0);
  const eventRef = useRef<EventSource | null>(null);

  // SSE connection
  useEffect(() => {
    if (eventRef.current) return;

    console.log("🔌 Attempting to connect to SSE...");
    const es = new EventSource("http://localhost:4000/events");

    es.onopen = () => {
      console.log(" SSE Connected");
      setConnectionStatus("Connected");
    };

    es.onerror = (error) => {
      console.error("SSE Error:", error);
      setConnectionStatus("Connection failed - Is backend running?");
    };

    es.onmessage = (e) => {
      try {
        const parsed = JSON.parse(e.data) as RsiMsg;
        console.log("Incoming SSE:", parsed);

        setMessageCount(prev => prev + 1);

        setAllRsiPoints((prev) => {
          const tokenData = prev[parsed.token] || [];
          const nextTokenData = [...tokenData, parsed].slice(-100); // keep last 100
          return { ...prev, [parsed.token]: nextTokenData };
        });
      } catch (err) {
        console.error(" Bad SSE data", e.data, err);
      }
    };

    eventRef.current = es;

    return () => {
      console.log(" Closing SSE connection");
      es.close();
      eventRef.current = null;
    };
  }, []);

  // Auto-select first token
  useEffect(() => {
    const tokens = Object.keys(allRsiPoints);
    if (tokens.length > 0 && !selectedToken) {
      setSelectedToken(tokens[0]);
    }
  }, [allRsiPoints, selectedToken]);

  const rsiForSelected = allRsiPoints[selectedToken] || [];
  const labels = rsiForSelected.map((p) => 
    new Date(p.timestamp).toLocaleTimeString()
  );
  const values = rsiForSelected.map((p) => p.rsi);

  const data = {
    labels,
    datasets: [
      {
        label: `RSI - ${selectedToken}`,
        data: values,
        borderColor: "rgba(75,192,192,1)",
        backgroundColor: "rgba(75,192,192,0.2)",
        borderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 5,
        fill: true,
        tension: 0.4,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { 
        position: "top" as const,
        labels: { font: { size: 14 } }
      },
      title: { 
        display: true, 
        text: "Real-Time RSI Chart",
        font: { size: 18 }
      },
    },
    scales: {
      y: { 
        min: 0, 
        max: 100,
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
        }
      },
      x: {
        grid: {
          display: false,
        }
      }
    },
  };

  const getStatusColor = () => {
    if (connectionStatus === "Connected") return "#d4edda";
    return "#f8d7da";
  };

  const getRsiColor = (rsi: number) => {
    if (rsi > 70) return "#dc3545"; // Red - Overbought
    if (rsi < 30) return "#28a745"; // Green - Oversold
    return "#ffc107"; // Yellow - Neutral
  };

  const currentRsi = values.length > 0 ? values[values.length - 1] : null;

  return (
    <div style={{ padding: 40, fontFamily: "system-ui", maxWidth: 1200, margin: "0 auto" }}>
      <h1 style={{ marginBottom: 10 }}>CryptoRSI Dashboard</h1>
      <p style={{ color: "#666", marginBottom: 30 }}>Real-time RSI monitoring via Kafka + SSE</p>
      
      {/* Status Bar */}
      <div style={{ 
        padding: 15, 
        marginBottom: 20, 
        background: getStatusColor(),
        borderRadius: 8,
        border: "1px solid rgba(0,0,0,0.1)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center"
      }}>
        <div>
          <strong>Connection Status:</strong> {connectionStatus}
        </div>
        <div>
          <strong>Messages Received:</strong> {messageCount}
        </div>
      </div>

      {/* Token Selector */}
      <div style={{ 
        marginBottom: 20, 
        padding: 15, 
        background: "#f8f9fa", 
        borderRadius: 8,
        display: "flex",
        alignItems: "center",
        gap: 20
      }}>
        <div>
          <label style={{ fontWeight: "bold", marginRight: 10 }}>Select Token: </label>
          <select
            value={selectedToken}
            onChange={(e) => setSelectedToken(e.target.value)}
            style={{
              padding: "8px 12px",
              fontSize: 16,
              borderRadius: 5,
              border: "1px solid #ccc",
              minWidth: 150
            }}
          >
            {Object.keys(allRsiPoints).length === 0 ? (
              <option>Waiting for data...</option>
            ) : (
              Object.keys(allRsiPoints).map((token) => (
                <option key={token} value={token}>
                  {token}
                </option>
              ))
            )}
          </select>
        </div>
        
        <div>
          <strong>Data Points:</strong> {rsiForSelected.length}
        </div>

        {currentRsi !== null && (
          <div style={{
            marginLeft: "auto",
            padding: "8px 16px",
            background: getRsiColor(currentRsi),
            color: "white",
            borderRadius: 5,
            fontWeight: "bold"
          }}>
            Current RSI: {currentRsi.toFixed(2)}
          </div>
        )}
      </div>

      {/* Chart */}
      <div style={{ 
        background: "white", 
        padding: 20, 
        borderRadius: 8, 
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        height: 500 
      }}>
        {values.length > 0 ? (
          <Line data={data} options={options} />
        ) : (
          <div style={{ 
            height: "100%", 
            display: "flex", 
            flexDirection: "column",
            alignItems: "center", 
            justifyContent: "center",
            border: "2px dashed #ccc",
            borderRadius: 8,
            color: "#999"
          }}>
            <div style={{ fontSize: 48, marginBottom: 20 }}>📊</div>
            <div style={{ fontSize: 18 }}>Waiting for RSI data from Kafka...</div>
            <div style={{ fontSize: 14, marginTop: 10 }}>
              Make sure the test producer is running
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div style={{
        marginTop: 20,
        padding: 15,
        background: "#f8f9fa",
        borderRadius: 8,
        fontSize: 14
      }}>
        <strong>RSI Levels:</strong>
        <div style={{ display: "flex", gap: 20, marginTop: 10 }}>
          <span><span style={{ color: "#28a745" }}>●</span> &lt; 30: Oversold (Buy Signal)</span>
          <span><span style={{ color: "#ffc107" }}>●</span> 30-70: Neutral</span>
          <span><span style={{ color: "#dc3545" }}>●</span> &gt; 70: Overbought (Sell Signal)</span>
        </div>
      </div>
    </div>
  );
}