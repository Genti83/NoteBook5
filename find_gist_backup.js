import fs from 'fs';

const content = fs.readFileSync('src/components/Notepad.tsx', 'utf8');
const lines = content.split('\n');

lines.forEach((line, index) => {
  if (line.includes('Gist') || line.includes('gist') || line.includes('Backup') || line.includes('backup') || line.includes('export') || line.includes('import')) {
    if (line.length < 150) {
      console.log(`${index + 1}: ${line.trim()}`);
    }
  }
});
