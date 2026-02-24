#!/usr/bin/env node
/**
 * Bear Chat Transcript Summarizer
 * Runs at 3:15 AM daily as OpenClaw cron on Paddington
 * Reads raw transcripts and generates structured summaries
 */

const fs = require('fs');
const path = require('path');

const LOGS_DIR = path.join(process.env.HOME, 'bear-knowledge', 'chat-logs');
const SUMMARIES_DIR = path.join(process.env.HOME, 'bear-knowledge', 'chat-summaries');

// Get date from args or use today (collector saves to today's folder)
function getTargetDate() {
  if (process.argv[2]) {
    return process.argv[2];
  }
  const today = new Date();
  return today.toISOString().split('T')[0];
}

// Parse transcript
function parseTranscript(content) {
  const messages = [];
  const lines = content.split('\n');
  
  let currentMsg = null;
  
  for (const line of lines) {
    // Message header: "### HH:MM — Author"
    const headerMatch = line.match(/^### (\d{2}:\d{2}) — (.+)$/);
    if (headerMatch) {
      if (currentMsg) messages.push(currentMsg);
      currentMsg = {
        time: headerMatch[1],
        author: headerMatch[2],
        content: ''
      };
      continue;
    }
    
    // Content
    if (currentMsg && !line.startsWith('# ')) {
      currentMsg.content += (currentMsg.content ? '\n' : '') + line;
    }
  }
  
  if (currentMsg) messages.push(currentMsg);
  
  return messages;
}

// Extract key information from messages
function summarizeChannel(messages, channel) {
  const decisions = [];
  const actions = [];
  const links = [];
  const questions = [];
  
  for (const msg of messages) {
    const content = msg.content.toLowerCase();
    const fullContent = msg.content;
    
    // Detect decisions (look for decision keywords)
    if (content.includes('decyzj') || content.includes('decided') || 
        content.includes('let\'s ') || content.includes('we\'ll ') ||
        content.includes('so:') || content.includes('plan:') ||
        content.includes('✓') || content.includes('✅')) {
      decisions.push({
        who: msg.author,
        what: fullContent.slice(0, 200)
      });
    }
    
    // Detect action items
    if (content.includes('todo') || content.includes('task') || 
        content.includes('action') || content.includes('i\'ll ') ||
        content.includes('will ') || content.includes('should ')) {
      actions.push({
        who: msg.author,
        what: fullContent.slice(0, 200)
      });
    }
    
    // Extract links
    const urlMatch = fullContent.match(/https?:\/\/[^\s\)]+/g);
    if (urlMatch) {
      urlMatch.forEach(url => {
        links.push({ who: msg.author, url });
      });
    }
    
    // Detect questions
    if (content.includes('?') && !content.includes('http')) {
      questions.push({
        who: msg.author,
        what: fullContent.slice(0, 150)
      });
    }
  }
  
  return { decisions, actions, links, questions };
}

// Format summary
function formatSummary(channel, messages, summary) {
  const lines = [
    `# ${channel} — Summary`,
    '',
    `**Messages:** ${messages.length}`,
    '',
    '---',
    ''
  ];
  
  if (summary.decisions.length > 0) {
    lines.push('## Key Decisions');
    lines.push('');
    for (const d of summary.decisions.slice(0, 5)) {
      lines.push(`- **${d.who}**: ${d.what.slice(0, 150)}...`);
    }
    lines.push('');
  }
  
  if (summary.actions.length > 0) {
    lines.push('## Action Items');
    lines.push('');
    for (const a of summary.actions.slice(0, 5)) {
      lines.push(`- **${a.who}**: ${a.what.slice(0, 150)}...`);
    }
    lines.push('');
  }
  
  if (summary.links.length > 0) {
    lines.push('## Links Shared');
    lines.push('');
    for (const l of summary.links.slice(0, 10)) {
      lines.push(`- ${l.url} (${l.who})`);
    }
    lines.push('');
  }
  
  if (summary.questions.length > 0) {
    lines.push('## Open Questions');
    lines.push('');
    for (const q of summary.questions.slice(0, 5)) {
      lines.push(`- **${q.who}**: ${q.what}?`);
    }
    lines.push('');
  }
  
  return lines.join('\n');
}

// Main
async function main() {
  const dateStr = getTargetDate();
  const logsDir = path.join(LOGS_DIR, dateStr);
  const summariesDir = path.join(SUMMARIES_DIR, dateStr);
  
  if (!fs.existsSync(logsDir)) {
    console.log(`No logs found for ${dateStr}`);
    return;
  }
  
  fs.mkdirSync(summariesDir, { recursive: true });
  
  console.log(`Summarizing Bear Chat transcripts for ${dateStr}`);
  console.log('');
  
  const files = fs.readdirSync(logsDir).filter(f => f.endsWith('.md'));
  
  for (const file of files) {
    const channel = file.replace('.md', '');
    const inputPath = path.join(logsDir, file);
    const outputPath = path.join(summariesDir, file);
    
    try {
      const content = fs.readFileSync(inputPath, 'utf8');
      const messages = parseTranscript(content);
      
      // Skip channels with <3 messages
      if (messages.length < 3) {
        console.log(`Skipping #${channel} (${messages.length} messages)`);
        continue;
      }
      
      const summary = summarizeChannel(messages, channel);
      const formatted = formatSummary(channel, messages, summary);
      
      fs.writeFileSync(outputPath, formatted);
      console.log(`✓ #${channel}: ${messages.length} messages → summary`);
    } catch (err) {
      console.error(`✗ Error processing #${channel}: ${err.message}`);
    }
  }
  
  console.log('');
  console.log('Summarization complete.');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
