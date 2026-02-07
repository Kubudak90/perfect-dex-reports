#!/usr/bin/env node

/**
 * BaseBook WebSocket Integration Tests
 *
 * Usage:
 *   node websocket.test.js
 */

import WebSocket from 'ws';
import assert from 'assert';

const WS_URL = process.env.WS_URL || 'ws://localhost:3000/ws';
const TIMEOUT = 10000; // 10 seconds

console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║       BaseBook WebSocket Integration Tests              ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

let testsRun = 0;
let testsPassed = 0;
let testsFailed = 0;

/**
 * Test runner
 */
async function runTest(name, testFn) {
  testsRun++;
  process.stdout.write(`⏳ ${name}... `);

  try {
    await testFn();
    testsPassed++;
    console.log('✅ PASS');
  } catch (error) {
    testsFailed++;
    console.log('❌ FAIL');
    console.error(`   Error: ${error.message}`);
  }
}

/**
 * Create WebSocket client with timeout
 */
function createClient() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('Connection timeout'));
    }, TIMEOUT);

    ws.on('open', () => {
      clearTimeout(timeout);
      resolve(ws);
    });

    ws.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

/**
 * Wait for specific message type
 */
function waitForMessage(ws, expectedType, timeout = TIMEOUT) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for message type: ${expectedType}`));
    }, timeout);

    const handler = (data) => {
      try {
        const message = JSON.parse(data.toString());
        if (message.type === expectedType) {
          clearTimeout(timer);
          ws.removeListener('message', handler);
          resolve(message);
        }
      } catch (error) {
        clearTimeout(timer);
        reject(error);
      }
    };

    ws.on('message', handler);
  });
}

/**
 * Test 1: Connection establishment
 */
await runTest('Connection establishment', async () => {
  const ws = await createClient();
  const message = await waitForMessage(ws, 'connected');

  assert(message.data.clientId, 'Should receive client ID');
  assert(message.data.chainId === 8453, 'Should have default chain ID');

  ws.close();
});

/**
 * Test 2: Subscribe to prices channel
 */
await runTest('Subscribe to prices channel', async () => {
  const ws = await createClient();

  // Wait for connection
  await waitForMessage(ws, 'connected');

  // Subscribe
  ws.send(JSON.stringify({
    type: 'subscribe',
    channel: 'prices:8453',
  }));

  // Wait for subscription confirmation
  const subMessage = await waitForMessage(ws, 'subscribed');
  assert(subMessage.channel === 'prices:8453', 'Should confirm subscription');

  ws.close();
});

/**
 * Test 3: Unsubscribe from channel
 */
await runTest('Unsubscribe from channel', async () => {
  const ws = await createClient();
  await waitForMessage(ws, 'connected');

  // Subscribe
  ws.send(JSON.stringify({
    type: 'subscribe',
    channel: 'prices:8453',
  }));
  await waitForMessage(ws, 'subscribed');

  // Unsubscribe
  ws.send(JSON.stringify({
    type: 'unsubscribe',
    channel: 'prices:8453',
  }));

  const unsubMessage = await waitForMessage(ws, 'unsubscribed');
  assert(unsubMessage.channel === 'prices:8453', 'Should confirm unsubscription');

  ws.close();
});

/**
 * Test 4: Ping/Pong
 */
await runTest('Ping/Pong', async () => {
  const ws = await createClient();
  await waitForMessage(ws, 'connected');

  // Send ping
  ws.send(JSON.stringify({ type: 'ping' }));

  // Wait for pong
  const pongMessage = await waitForMessage(ws, 'pong');
  assert(pongMessage.type === 'pong', 'Should receive pong');

  ws.close();
});

/**
 * Test 5: Change chain
 */
await runTest('Change chain', async () => {
  const ws = await createClient();
  const connectMessage = await waitForMessage(ws, 'connected');
  assert(connectMessage.data.chainId === 8453, 'Should start with chain 8453');

  // Change chain (note: this doesn't send a confirmation, just changes internal state)
  ws.send(JSON.stringify({
    type: 'setChain',
    chainId: 42161,
  }));

  // Wait a bit
  await new Promise(resolve => setTimeout(resolve, 100));

  ws.close();
});

/**
 * Test 6: Invalid message handling
 */
await runTest('Invalid message handling', async () => {
  const ws = await createClient();
  await waitForMessage(ws, 'connected');

  // Send invalid message
  ws.send(JSON.stringify({
    type: 'invalid_type',
  }));

  const errorMessage = await waitForMessage(ws, 'error');
  assert(errorMessage.error, 'Should receive error message');

  ws.close();
});

/**
 * Test 7: Multiple subscriptions
 */
await runTest('Multiple subscriptions', async () => {
  const ws = await createClient();
  await waitForMessage(ws, 'connected');

  const channels = ['prices:8453', 'pools:8453', 'swaps:8453'];

  for (const channel of channels) {
    ws.send(JSON.stringify({
      type: 'subscribe',
      channel,
    }));
    const subMessage = await waitForMessage(ws, 'subscribed');
    assert(subMessage.channel === channel, `Should confirm subscription to ${channel}`);
  }

  ws.close();
});

/**
 * Test 8: Connection cleanup on close
 */
await runTest('Connection cleanup on close', async () => {
  const ws = await createClient();
  await waitForMessage(ws, 'connected');

  // Subscribe to a channel
  ws.send(JSON.stringify({
    type: 'subscribe',
    channel: 'prices:8453',
  }));
  await waitForMessage(ws, 'subscribed');

  // Close connection
  ws.close();

  // Wait for cleanup
  await new Promise(resolve => setTimeout(resolve, 500));

  // Connection should be cleaned up
  assert(ws.readyState === WebSocket.CLOSED, 'Connection should be closed');
});

/**
 * Test 9: Concurrent connections
 */
await runTest('Concurrent connections', async () => {
  const clientCount = 10;
  const clients = [];

  // Create multiple clients
  for (let i = 0; i < clientCount; i++) {
    const ws = await createClient();
    await waitForMessage(ws, 'connected');
    clients.push(ws);
  }

  assert(clients.length === clientCount, `Should create ${clientCount} clients`);

  // Close all
  for (const ws of clients) {
    ws.close();
  }
});

/**
 * Test 10: Subscription persistence
 */
await runTest('Subscription persistence', async () => {
  const ws = await createClient();
  await waitForMessage(ws, 'connected');

  // Subscribe to channel
  ws.send(JSON.stringify({
    type: 'subscribe',
    channel: 'prices:8453',
  }));
  await waitForMessage(ws, 'subscribed');

  // Send ping to verify connection is still active
  ws.send(JSON.stringify({ type: 'ping' }));
  await waitForMessage(ws, 'pong');

  ws.close();
});

// Print summary
console.log('\n╔══════════════════════════════════════════════════════════╗');
console.log('║                  TEST SUMMARY                            ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

console.log(`Total Tests: ${testsRun}`);
console.log(`✅ Passed: ${testsPassed}`);
console.log(`❌ Failed: ${testsFailed}\n`);

if (testsFailed === 0) {
  console.log('🎉 ALL TESTS PASSED! 🎉\n');
  process.exit(0);
} else {
  console.log('❌ SOME TESTS FAILED ❌\n');
  process.exit(1);
}
