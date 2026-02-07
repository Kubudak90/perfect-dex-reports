#!/usr/bin/env node

/**
 * BaseBook WebSocket Load Testing Script
 *
 * Usage:
 *   node websocket-load-test.js [options]
 *
 * Options:
 *   --clients <number>     Number of concurrent clients (default: 100)
 *   --duration <seconds>   Test duration in seconds (default: 60)
 *   --url <url>            WebSocket URL (default: ws://localhost:3000/ws)
 *   --ramp-up <seconds>    Ramp-up time to connect all clients (default: 10)
 */

import WebSocket from 'ws';

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  clients: 100,
  duration: 60,
  url: 'ws://localhost:3000/ws',
  rampUp: 10,
};

for (let i = 0; i < args.length; i += 2) {
  const key = args[i].replace('--', '');
  const value = args[i + 1];

  if (key === 'clients') options.clients = parseInt(value);
  if (key === 'duration') options.duration = parseInt(value);
  if (key === 'url') options.url = value;
  if (key === 'ramp-up') options.rampUp = parseInt(value);
}

console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║       BaseBook WebSocket Load Testing                   ║');
console.log('╚══════════════════════════════════════════════════════════╝');
console.log(`
Configuration:
  • Concurrent Clients: ${options.clients}
  • Test Duration: ${options.duration}s
  • WebSocket URL: ${options.url}
  • Ramp-up Time: ${options.rampUp}s
`);

// Metrics
const metrics = {
  connected: 0,
  disconnected: 0,
  messagesSent: 0,
  messagesReceived: 0,
  errors: 0,
  latencies: [],
  connectionTimes: [],
  subscriptions: 0,
  startTime: null,
  endTime: null,
};

// Active clients
const clients = [];

/**
 * Create and connect a WebSocket client
 */
function createClient(index) {
  return new Promise((resolve) => {
    const startConnect = Date.now();
    const ws = new WebSocket(options.url);
    const client = {
      id: `client-${index}`,
      ws,
      connected: false,
      subscribed: false,
      messagesSent: 0,
      messagesReceived: 0,
    };

    ws.on('open', () => {
      const connectionTime = Date.now() - startConnect;
      metrics.connectionTimes.push(connectionTime);
      client.connected = true;
      metrics.connected++;
      resolve(client);
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        client.messagesReceived++;
        metrics.messagesReceived++;

        // Handle different message types
        if (message.type === 'connected') {
          // Subscribe to a channel
          const channels = ['prices:8453', 'pools:8453', 'swaps:8453'];
          const channel = channels[index % channels.length];

          ws.send(JSON.stringify({
            type: 'subscribe',
            channel,
          }));
          client.messagesSent++;
          metrics.messagesSent++;
        } else if (message.type === 'subscribed') {
          client.subscribed = true;
          metrics.subscriptions++;
        }
      } catch (error) {
        metrics.errors++;
      }
    });

    ws.on('error', (error) => {
      metrics.errors++;
      console.error(`Client ${client.id} error:`, error.message);
    });

    ws.on('close', () => {
      client.connected = false;
      metrics.disconnected++;
    });

    clients.push(client);
  });
}

/**
 * Send periodic pings from clients
 */
function startPinging() {
  const pingInterval = setInterval(() => {
    let activePings = 0;

    for (const client of clients) {
      if (client.connected && client.ws.readyState === WebSocket.OPEN) {
        const pingStart = Date.now();

        client.ws.send(JSON.stringify({ type: 'ping' }));
        client.messagesSent++;
        metrics.messagesSent++;
        activePings++;

        // Measure latency on pong
        const originalOnMessage = client.ws.onmessage;
        client.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data.toString());
            if (message.type === 'pong') {
              const latency = Date.now() - pingStart;
              metrics.latencies.push(latency);
            }
          } catch (e) {
            // Ignore parse errors
          }
          if (originalOnMessage) originalOnMessage(event);
        };
      }
    }
  }, 5000); // Ping every 5 seconds

  return pingInterval;
}

/**
 * Calculate statistics
 */
function calculateStats() {
  const duration = (metrics.endTime - metrics.startTime) / 1000;

  const avgLatency = metrics.latencies.length > 0
    ? metrics.latencies.reduce((a, b) => a + b, 0) / metrics.latencies.length
    : 0;

  const avgConnectionTime = metrics.connectionTimes.length > 0
    ? metrics.connectionTimes.reduce((a, b) => a + b, 0) / metrics.connectionTimes.length
    : 0;

  const p50Latency = percentile(metrics.latencies, 50);
  const p95Latency = percentile(metrics.latencies, 95);
  const p99Latency = percentile(metrics.latencies, 99);

  return {
    duration,
    avgLatency,
    avgConnectionTime,
    p50Latency,
    p95Latency,
    p99Latency,
    messagesPerSecond: metrics.messagesReceived / duration,
  };
}

/**
 * Calculate percentile
 */
function percentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = arr.slice().sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[index];
}

/**
 * Print real-time status
 */
function printStatus() {
  const elapsed = metrics.startTime ? (Date.now() - metrics.startTime) / 1000 : 0;
  const connected = clients.filter(c => c.connected).length;
  const subscribed = clients.filter(c => c.subscribed).length;

  process.stdout.write('\r\x1b[K'); // Clear line
  process.stdout.write(
    `⏱️  ${elapsed.toFixed(0)}s | ` +
    `🟢 ${connected}/${options.clients} connected | ` +
    `📡 ${subscribed} subscribed | ` +
    `📨 ${metrics.messagesReceived} msgs received | ` +
    `❌ ${metrics.errors} errors`
  );
}

/**
 * Main test execution
 */
async function runLoadTest() {
  console.log('🚀 Starting load test...\n');

  metrics.startTime = Date.now();

  // Ramp-up: Connect clients gradually
  const rampUpDelay = (options.rampUp * 1000) / options.clients;

  console.log(`📈 Ramping up ${options.clients} clients over ${options.rampUp}s...`);

  for (let i = 0; i < options.clients; i++) {
    createClient(i).catch(err => {
      console.error(`Failed to create client ${i}:`, err.message);
      metrics.errors++;
    });

    if (rampUpDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, rampUpDelay));
    }
  }

  // Wait for all clients to connect
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log(`\n✅ ${metrics.connected} clients connected`);
  console.log(`📡 ${metrics.subscriptions} subscriptions established`);
  console.log(`\n🔄 Running test for ${options.duration}s...\n`);

  // Start pinging
  const pingInterval = startPinging();

  // Print status every second
  const statusInterval = setInterval(printStatus, 1000);

  // Wait for test duration
  await new Promise(resolve => setTimeout(resolve, options.duration * 1000));

  // Cleanup
  clearInterval(pingInterval);
  clearInterval(statusInterval);

  console.log('\n\n🛑 Stopping test...');

  // Close all connections
  for (const client of clients) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.close();
    }
  }

  await new Promise(resolve => setTimeout(resolve, 1000));

  metrics.endTime = Date.now();

  // Print results
  printResults();
}

/**
 * Print final results
 */
function printResults() {
  const stats = calculateStats();

  console.log('\n\n╔══════════════════════════════════════════════════════════╗');
  console.log('║                  TEST RESULTS                            ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  console.log('📊 Connection Stats:');
  console.log(`   • Total Clients: ${options.clients}`);
  console.log(`   • Successfully Connected: ${metrics.connected}`);
  console.log(`   • Subscription Success: ${metrics.subscriptions}`);
  console.log(`   • Avg Connection Time: ${stats.avgConnectionTime.toFixed(2)}ms`);
  console.log(`   • Disconnections: ${metrics.disconnected}`);
  console.log(`   • Errors: ${metrics.errors}\n`);

  console.log('📨 Message Stats:');
  console.log(`   • Messages Sent: ${metrics.messagesSent}`);
  console.log(`   • Messages Received: ${metrics.messagesReceived}`);
  console.log(`   • Messages/sec: ${stats.messagesPerSecond.toFixed(2)}\n`);

  console.log('⚡ Latency Stats (ping/pong):');
  console.log(`   • Average: ${stats.avgLatency.toFixed(2)}ms`);
  console.log(`   • P50: ${stats.p50Latency.toFixed(2)}ms`);
  console.log(`   • P95: ${stats.p95Latency.toFixed(2)}ms`);
  console.log(`   • P99: ${stats.p99Latency.toFixed(2)}ms\n`);

  console.log('⏱️  Test Duration:', `${stats.duration.toFixed(2)}s\n`);

  // Success criteria
  const successRate = (metrics.connected / options.clients) * 100;
  const errorRate = (metrics.errors / metrics.messagesSent) * 100;

  console.log('✅ Success Criteria:');
  console.log(`   • Connection Success Rate: ${successRate.toFixed(2)}% (${successRate >= 95 ? '✅ PASS' : '❌ FAIL'})`);
  console.log(`   • Error Rate: ${errorRate.toFixed(2)}% (${errorRate < 5 ? '✅ PASS' : '❌ FAIL'})`);
  console.log(`   • Avg Latency: ${stats.avgLatency.toFixed(2)}ms (${stats.avgLatency < 100 ? '✅ PASS' : '❌ FAIL'})`);
  console.log(`   • P95 Latency: ${stats.p95Latency.toFixed(2)}ms (${stats.p95Latency < 200 ? '✅ PASS' : '❌ FAIL'})\n`);

  // Overall result
  const passed = successRate >= 95 && errorRate < 5 && stats.avgLatency < 100 && stats.p95Latency < 200;

  if (passed) {
    console.log('🎉 LOAD TEST PASSED! 🎉\n');
  } else {
    console.log('❌ LOAD TEST FAILED ❌\n');
  }
}

// Run the test
runLoadTest().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
