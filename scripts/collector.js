#!/usr/bin/env node
/**
 * Bear Chat Transcript Collector
 * Runs at 3:00 AM daily on Henry's Mac
 * Fetches messages from all channels and saves raw transcripts
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Config
const API_BASE = 'https://chat.roffhenryaidev.cc/api';
const TOKEN = fs.readFileSync(path.join(process.env.HOME, '.bear-chat-token'), 'utf8').trim();
const OUTPUT_DIR = path.join(process.env.HOME, 'bear-knowledge', 'chat-logs');

// All channels to collect
const CHANNELS = [
  'general',
  'coding', 
  'bear-agency',
  'bears-only',
  'beramonium',
  'consciousness'
];

// Date range: yesterday 3:45 AM to today 3:00 AM
function getDateRange() {
  const now = new Date();
  const today3AM = new Date(now);
  today3AM.setHours(3, 0, 0, 0);
  
  const yesterday345PM = new Date(today3AM);
  yesterday345PM.setDate(yesterday345PM.getDate() - 1);
  yesterday345PM.setHours(3, 45, 0, 0);
  
  return {
    after: yesterday345PM.toISOString(),
    before: today3AM.toISOString(),
    dateStr: yesterday345PM.toISOString().split('T')[0] // Label with the day the messages are FROM
  };
}

// Fetch messages from a channel (API now supports date filtering!)
async function fetchMessages(channelId, after, before) {
  return new Promise((resolve, reject) => {
    const url = `${API_BASE}/channels/${channelId}/messages?after_date=${encodeURIComponent(after.split('T')[0])}&before_date=${encodeURIComponent(before.split('T')[0])}&limit=500`;
    
    const options = {
      headers: {
        'Authorization': `Bearer ${TOKEN}`
      }
    };
    
    https.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`Failed to parse JSON: ${e.message}`));
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    }).on('error', reject);
  });
}

// Format transcript
function formatTranscript(messages, channel) {
  const lines = [`# ${channel} — ${new Date().toISOString().split('T')[0]}`, ''];
  
  for (const msg of messages) {
    const time = new Date(msg.createdAt).toLocaleTimeString('pl-PL', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    const author = msg.displayName || msg.userId;
    const content = msg.content || '';
    
    lines.push(`### ${time} — ${author}`);
    lines.push('');
    lines.push(content);
    lines.push('');
  }
  
  return lines.join('\n');
}

// Main
async function main() {
  const { after, before, dateStr } = getDateRange();
  const outputDir = path.join(OUTPUT_DIR, dateStr);
  
  fs.mkdirSync(outputDir, { recursive: true });
  
  console.log(`Collecting Bear Chat transcripts for ${dateStr}`);
  console.log(`Range: ${after} to ${before}`);
  console.log('');
  
  for (const channel of CHANNELS) {
    try {
      console.log(`Fetching #${channel}...`);
      const response = await fetchMessages(channel, after, before);
      const messages = response.messages || response;
      
      if (messages.length === 0) {
        console.log(`  No messages in #${channel}`);
        continue;
      }
      
      const transcript = formatTranscript(messages, channel);
      const outputPath = path.join(outputDir, `${channel}.md`);
      fs.writeFileSync(outputPath, transcript);
      
      console.log(`  ✓ ${messages.length} messages → ${outputPath}`);
    } catch (err) {
      console.error(`  ✗ Error: ${err.message}`);
    }
  }
  
  console.log('');
  console.log('Collection complete.');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
