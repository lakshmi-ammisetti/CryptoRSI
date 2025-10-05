use rdkafka::consumer::{Consumer, StreamConsumer};
use rdkafka::producer::{FutureProducer, FutureRecord};
use rdkafka::Message;
use serde::{Deserialize, Serialize};
use tokio_stream::StreamExt;
use chrono::Utc;

#[derive(Deserialize)]
struct Trade {
    token_address: String,
    price_in_sol: f64,
    block_time: String,
}

#[derive(Serialize)]
struct RsiMsg {
    token: String,
    timestamp: String,
    rsi: f64,
}

// Calculate 14-period RSI
fn calc_rsi(prices: &[f64]) -> f64 {
    if prices.len() < 15 {
        return 50.0; // Neutral if not enough data
    }
    let mut gains = 0.0;
    let mut losses = 0.0;

    for i in 1..=14 {
        let diff = prices[i] - prices[i - 1];
        if diff > 0.0 { gains += diff; } else { losses -= diff; }
    }

    let avg_gain = gains / 14.0;
    let avg_loss = losses / 14.0;

    if avg_loss == 0.0 { return 100.0; }

    let rs = avg_gain / avg_loss;
    100.0 - (100.0 / (1.0 + rs))
}

#[tokio::main]
async fn main() {
    let consumer: StreamConsumer = rdkafka::config::ClientConfig::new()
        .set("group.id", "rsi-group")
        .set("bootstrap.servers", "localhost:9092")
        .create()
        .expect("Consumer creation failed");

    let producer: FutureProducer = rdkafka::config::ClientConfig::new()
        .set("bootstrap.servers", "localhost:9092")
        .create()
        .expect("Producer creation failed");

    consumer.subscribe(&["trade-data"]).unwrap();

    let mut token_prices: std::collections::HashMap<String, Vec<f64>> = std::collections::HashMap::new();

    let mut stream = consumer.stream();

    println!("🔄 RSI service running...");

    while let Some(message) = stream.next().await {
        if let Ok(msg) = message {
            if let Some(payload) = msg.payload_view::<str>().ok().flatten() {
                if let Ok(trade) = serde_json::from_str::<Trade>(payload) {
                    let prices = token_prices.entry(trade.token_address.clone()).or_default();
                    prices.push(trade.price_in_sol);
                    if prices.len() > 15 { prices.remove(0); }

                    if prices.len() >= 15 {
                        let rsi = calc_rsi(prices);
                        let rsi_msg = RsiMsg {
                            token: trade.token_address.clone(),
                            timestamp: Utc::now().to_rfc3339(),
                            rsi,
                        };
                        let json = serde_json::to_string(&rsi_msg).unwrap();

                        let record = FutureRecord::to("rsi-data").payload(&json);
                        producer.send(record, 0).await.unwrap();
                        println!("📤 Sent RSI for {}: {:.2}", trade.token_address, rsi);
                    }
                }
            }
        }
    }
}
