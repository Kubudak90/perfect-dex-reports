#!/usr/bin/env node

/**
 * BaseBook WebSocket Client Example (Node.js)
 *
 * Usage:
 *   node websocket-client.js
 */

import WebSocket from 'ws';

const WS_URL = 'ws://localhost:3000/ws';

class BaseBookWSClient {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.clientId = null;
  }

  connect() {
    console.log(`🔌 Connecting to ${this.url}...`);

    this.ws = new WebSocket(this.url);

    this.ws.on('open', () => {
      console.log('✅ Connected to BaseBook WebSocket server');
    });

    this.ws.on('message', (data) => {
      this.handleMessage(JSON.parse(data.toString()));
    });

    this.ws.on('close', () => {
      console.log('❌ Disconnected from server');
    });

    this.ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error.message);
    });
  }

  handleMessage(message) {
    switch (message.type) {
      case 'connected':
        this.clientId = message.data.clientId;
        console.log(`✅ Connected! Client ID: ${this.clientId}, Chain: ${message.data.chainId}`);

        // Auto-subscribe to prices
        this.subscribe('prices:8453');
        break;

      case 'subscribed':
        console.log(`✅ Subscribed to: ${message.channel}`);
        break;

      case 'unsubscribed':
        console.log(`❌ Unsubscribed from: ${message.channel}`);
        break;

      case 'pong':
        console.log('🏓 Pong received');
        break;

      case 'priceUpdate':
        console.log(`💰 Price Update [${message.channel}]:`);
        console.log(`   Prices for ${Object.keys(message.data.prices || {}).length} tokens`);
        console.log(`   Timestamp: ${new Date(message.data.timestamp).toISOString()}`);

        // Show first 3 prices
        const prices = Object.values(message.data.prices || {}).slice(0, 3);
        prices.forEach(price => {
          console.log(`   - ${price.symbol}: $${price.priceUsd} (${price.priceChange24h}%)`);
        });
        break;

      case 'poolUpdate':
        console.log(`🏊 Pool Update [${message.channel}]:`, JSON.stringify(message.data, null, 2));
        break;

      case 'swapEvent':
        console.log(`🔄 Swap Event [${message.channel}]:`, JSON.stringify(message.data, null, 2));
        break;

      case 'liquidityEvent':
        console.log(`💧 Liquidity Event [${message.channel}]:`, JSON.stringify(message.data, null, 2));
        break;

      case 'error':
        console.error(`❌ Error: ${message.error}`);
        break;

      default:
        console.log('Unknown message:', message);
    }
  }

  send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.error('❌ WebSocket not connected');
    }
  }

  subscribe(channel) {
    console.log(`📡 Subscribing to: ${channel}`);
    this.send({ type: 'subscribe', channel });
  }

  unsubscribe(channel) {
    console.log(`📡 Unsubscribing from: ${channel}`);
    this.send({ type: 'unsubscribe', channel });
  }

  ping() {
    console.log('🏓 Sending ping...');
    this.send({ type: 'ping' });
  }

  setChain(chainId) {
    console.log(`⛓️  Changing chain to: ${chainId}`);
    this.send({ type: 'setChain', chainId });
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

// Main
const client = new BaseBookWSClient(WS_URL);
client.connect();

// Send ping every 30 seconds to keep connection alive
setInterval(() => {
  client.ping();
}, 30000);

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('\n👋 Disconnecting...');
  client.disconnect();
  process.exit(0);
});

// Example: Subscribe to different channels after 5 seconds
setTimeout(() => {
  console.log('\n📡 Subscribing to additional channels...');
  client.subscribe('pools:8453');
  client.subscribe('swaps:8453');
}, 5000);
