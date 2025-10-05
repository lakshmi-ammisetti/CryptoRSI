const express = require("express");
const { Kafka } = require("kafkajs");

const app = express();
const PORT = process.env.PORT || 4000;

// ✅ CORS - Allow frontend access
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*"); // Use * for dev
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  next();
});

// Connected SSE clients
let clients = [];

// SSE endpoint
app.get("/events", (req, res) => {
  console.log("📡 New SSE client connected");

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders(); // flush headers immediately

  res.write("retry: 10000\n\n"); // retry every 10s if disconnected
  clients.push(res);

  req.on("close", () => {
    console.log("❌ SSE client disconnected");
    clients = clients.filter((c) => c !== res);
  });
});

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    clients: clients.length,
    timestamp: new Date().toISOString(),
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ SSE server listening on http://localhost:${PORT}`);
  console.log(`   Test it: curl http://localhost:${PORT}/health`);
  console.log(`   Or visit in browser: http://localhost:${PORT}/health`);
  connectKafka();
});

// Connect Kafka and broadcast messages
async function connectKafka() {
  try {
    console.log("🔄 Connecting to Kafka...");

    const kafka = new Kafka({
      brokers: ["localhost:9092"],
      connectionTimeout: 10000,
      requestTimeout: 30000,
    });

    const consumer = kafka.consumer({ groupId: "sse-group" });
    await consumer.connect();
    console.log("✅ Kafka connected");

    await consumer.subscribe({ topic: "rsi-data", fromBeginning: false });
    console.log("✅ Subscribed to rsi-data topic");

    await consumer.run({
      eachMessage: async ({ message }) => {
        if (!message.value) return;

        const raw = message.value.toString();
        let obj;
        try {
          obj = JSON.parse(raw);
        } catch {
          obj = { token: "UNKNOWN", timestamp: new Date().toISOString(), rsi: Number(raw) || 0 };
        }

        const payload = JSON.stringify(obj);
        // Broadcast to all SSE clients
        clients.forEach((res) => {
          try {
            res.write(`data: ${payload}\n\n`);
            res.flush?.(); // optional, ensures immediate flush
          } catch (err) {
            console.error("❌ Error writing to client:", err.message);
          }
        });

        console.log(`📤 Broadcasted to ${clients.length} client(s):`, payload);
      },
    });

  } catch (error) {
    console.error("❌ Kafka connection failed:", error.message);
    console.log("⚠️ SSE server running, but Kafka not connected.");
    console.log("   Make sure Kafka is running: docker-compose up -d");
  }
}
