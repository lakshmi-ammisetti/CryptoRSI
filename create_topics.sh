#!/bin/bash
# Run this after `docker-compose up -d`
# Requires rpk available (rpk is included in the redpanda image)
set -e
echo "Creating topics: trade-data and rsi-data"
docker exec -i redpanda rpk topic create trade-data --partitions 1 --replicas 1 || true
docker exec -i redpanda rpk topic create rsi-data --partitions 1 --replicas 1 || true
echo "Topics created (or already existed)."
