import fs from 'fs';

const content = fs.readFileSync('src/components/Notepad.tsx', 'utf8');
const lines = content.split('\n');

console.log("=== SEARCHING CATALOGLAYOUT OR VIEWMODE ===");
lines.forEach((line, index) => {
  if (line.includes("catalogLayout") || line.includes("layout === '") || line.includes("layout === \"") || line.includes("catalog") || line.includes("Grid") || line.includes("List")) {
    if (line.includes("layout") || line.includes("Layout") || line.includes("Grid") || line.includes("List") || line.includes("View") || line.includes("view")) {
       if (line.length < 150) {
          console.log(`${index + 1}: ${line.trim()}`);
       }
    }
  }
});
