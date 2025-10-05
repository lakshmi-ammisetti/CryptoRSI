const { Kafka } = require('kafkajs');

const kafka = new Kafka({ brokers: ['localhost:9092'] });
const producer = kafka.producer();

async function sendTestData() {
  try {
    await producer.connect();
    console.log(' Producer connected to Kafka');

    let counter = 0;
    
    setInterval(async () => {
      const tokens = ['SOLANA', 'BITCOIN', 'ETHEREUM', 'BONK'];
      const randomToken = tokens[Math.floor(Math.random() * tokens.length)];
      
      const message = {
        token: randomToken,
        timestamp: new Date().toISOString(),
        rsi: Math.random() * 100  // Random RSI between 0-100
      };

      await producer.send({
        topic: 'rsi-data',
        messages: [{ value: JSON.stringify(message) }]
      });

      counter++;
      console.log(`📤 Message ${counter} sent:`, message);
    }, 2000); // Send every 2 seconds

  } catch (error) {
    console.error(' Producer error:', error);
    process.exit(1);
  }
}

sendTestData();
