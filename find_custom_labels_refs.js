import fs from 'fs';

const content = fs.readFileSync('src/components/Notepad.tsx', 'utf8');
const lines = content.split('\n');

lines.forEach((line, index) => {
  if (line.includes('customLabels')) {
    console.log(`${index + 1}: ${line.trim()}`);
  }
});
