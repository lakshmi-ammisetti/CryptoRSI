const fs = require("fs");
const csv = require("csv-parser");
const { Kafka } = require("kafkajs");

const kafka = new Kafka({ brokers: ["localhost:9092"] });
const producer = kafka.producer();

async function run() {
  await producer.connect();
  console.log("✅ Kafka producer connected");

  fs.createReadStream("..//trades_data.csv")
    .pipe(csv())
    .on("data", async (row) => {
      await producer.send({
        topic: "trade-data",
        messages: [{ value: JSON.stringify(row) }],
      });
    })
    .on("end", () => {
      console.log("✅ CSV ingestion complete");
      process.exit(0);
    });
}

run().catch(console.error);

