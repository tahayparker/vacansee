#!/usr/bin/env node

/**
 * Test script to demonstrate the ignore build functionality
 */

const { execSync } = require('child_process');

// Test cases
const testMessages = [
  'Add new feature',
  'Fix bug [skip ci]',
  'Update docs skip deploy',
  'Minor typo fix [SKIP CI]',
  'Important security update'
];

console.log('Testing ignore build logic:\n');

testMessages.forEach((message, index) => {
  const skipPatterns = ['[skip ci]', 'skip deploy'];
  const shouldSkip = skipPatterns.some(pattern =>
    message.toLowerCase().includes(pattern.toLowerCase())
  );

  console.log(`Test ${index + 1}: "${message}"`);
  console.log(`Result: ${shouldSkip ? '🚫 SKIP BUILD' : '✅ BUILD'}\n`);
});
