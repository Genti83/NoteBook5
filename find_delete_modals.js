import fs from 'fs';

const content = fs.readFileSync('src/components/Notepad.tsx', 'utf8');
const lines = content.split('\n');

lines.forEach((line, index) => {
  if (line.includes('confirm') || line.includes('Modal') || line.includes('Dele')) {
    if (line.toLowerCase().includes('delete') && line.toLowerCase().includes('modal')) {
      console.log(`L${index + 1}: ${line.trim()}`);
    } else if (line.includes('confirm') && line.toLowerCase().includes('state')) {
      console.log(`L${index + 1}: ${line.trim()}`);
    } else if (line.includes('showConfirm') || line.includes('deleteConf')) {
      console.log(`L${index + 1}: ${line.trim()}`);
    }
  }
});
