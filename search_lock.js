import fs from 'fs';

const content = fs.readFileSync('src/components/Notepad.tsx', 'utf8');
const lines = content.split('\n');

console.log("=== SEARCHING <Lock ===");
lines.forEach((line, index) => {
  if (line.includes("<Lock") || line.includes("isDocAllDeletedX")) {
    console.log(`${index + 1}: ${line.trim()}`);
  }
});
