import fs from 'fs';

const filePath = 'src/components/Notepad.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Replace non-standard Tailwind zinc classes with correct, standard classes
content = content.replace(/zinc-850/g, 'zinc-800');
content = content.replace(/zinc-750/g, 'zinc-700');
content = content.replace(/zinc-650/g, 'zinc-600');
content = content.replace(/zinc-250/g, 'zinc-200');
content = content.replace(/zinc-955/g, 'zinc-950');

// 2. Replace Row 1 Back Button
const row1BackTarget = 'className={`h-8 w-8 rounded-xl flex items-center justify-center active:scale-95 transition-all shadow-md shrink-0 ${\n                       isDark ? "bg-zinc-800 hover:bg-zinc-700 text-white shadow-zinc-950/20" : "bg-zinc-100 hover:bg-zinc-200 text-zinc-900 shadow-zinc-100"\n                    }`';
const row1BackReplacement = 'className="h-8 w-8 rounded-xl flex items-center justify-center active:scale-95 transition-all shadow-md shrink-0 bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20"';

if (content.indexOf(row1BackTarget) !== -1) {
  content = content.replace(row1BackTarget, row1BackReplacement);
  console.log('Successfully replaced Row 1 back button className!');
} else {
  // Let's try with a more relaxed match in case of whitespace/formatting
  const altRow1BackTarget = 'isDark ? "bg-zinc-800 hover:bg-zinc-700 text-white shadow-zinc-950/20" : "bg-zinc-100 hover:bg-zinc-200 text-zinc-900 shadow-zinc-100"';
  content = content.replace(altRow1BackTarget, 'isDark ? "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20" : "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20"');
  console.log('Fell back to alternative Row 1 back button replacement');
}

// Ensure arrow icon color inside Row 1 back button is white
// Let's find:
// <ArrowLeft className="w-4 h-4" />
// right after setShowConfirmClose
const r1ArrowTarget = '<button onClick={() => setShowConfirmClose(true)} className="h-8 w-8 rounded-xl flex items-center justify-center active:scale-95 transition-all shadow-md shrink-0 bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20" title={t("Kthehu", "Return")}>\n                    <ArrowLeft className="w-4 h-4" />';
const r1ArrowReplacement = '<button onClick={() => setShowConfirmClose(true)} className="h-8 w-8 rounded-xl flex items-center justify-center active:scale-95 transition-all shadow-md shrink-0 bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20" title={t("Kthehu", "Return")}>\n                    <ArrowLeft className="w-4 h-4 text-white font-bold" />';

// Relaxed replace
content = content.replace('<ArrowLeft className="w-4 h-4" />', '<ArrowLeft className="w-4 h-4 text-white font-bold" />');

// 3. Replace Row 2 Back Button
const row2BackTarget = `              {/* 1. BACK */}
              <button 
                 onClick={() => setShowConfirmClose(true)} 
                 className={\`h-9 w-9 rounded-xl flex items-center justify-center transition-all shadow-md hover:scale-[1.03] active:scale-95 shrink-0 \${
                    isDark ? "bg-zinc-800 hover:bg-zinc-800 text-white shadow-zinc-950/20" : "bg-zinc-100 hover:bg-zinc-200 text-zinc-900 shadow-zinc-100"
                 }\`} 
                 title="Kthehu"
              >
                 <ArrowLeft className="w-4 h-4 text-zinc-500" />
              </button>`;

const row2BackReplacement = `              {/* 1. BACK */}
              <button 
                 onClick={() => setShowConfirmClose(true)} 
                 className="h-9 w-9 rounded-xl flex items-center justify-center transition-all shadow-md hover:scale-[1.03] active:scale-95 shrink-0 bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20" 
                 title="Kthehu"
              >
                 <ArrowLeft className="w-4 h-4 text-white font-bold" />
              </button>`;

if (content.indexOf(row2BackTarget) !== -1) {
  content = content.replace(row2BackTarget, row2BackReplacement);
  console.log('Successfully replaced Row 2 back button!');
} else {
  // Let's do a more robust regex-based replacement for Row 2 Back Button
  const regex = /\{\/\*\s*1\.\s*BACK\s*\*\/\}\s*<button\s+onClick=\{\(\)\s*=>\s*setShowConfirmClose\(true\)\}\s+className=\{`h-9 w-9 rounded-xl flex items-center justify-center transition-all shadow-md hover:scale-\[1\.03\] active:scale-95 shrink-0 [^`]+`\}\s+title="Kthehu"\s*>\s*<ArrowLeft[^>]*\/>\s*<\/button>/;
  if (regex.test(content)) {
    content = content.replace(regex, row2BackReplacement);
    console.log('Successfully replaced Row 2 back button via Regex!');
  } else {
    console.log('Warning: Row 2 Back Button pattern match failed, trying chunk search...');
    // Let's just find the title="Kthehu" near ArrowLeft
    const chunkTarget = 'title="Kthehu"\n              >\n                 <ArrowLeft className="w-4 h-4 text-zinc-500" />';
    if (content.indexOf(chunkTarget) !== -1) {
      content = content.replace(chunkTarget, 'title="Kthehu"\n              >\n                 <ArrowLeft className="w-4 h-4 text-white font-bold" />');
      console.log('Successfully fixed Row 2 Back Button Arrow icon!');
    }
  }
}

// 4. Update formatting icons inside the colored buttons to text-white for higher contrast
content = content.replace('text-green-100', 'text-white');
content = content.replace('text-blue-100', 'text-white');
content = content.replace('text-red-100', 'text-white');
content = content.replace('text-emerald-100', 'text-white');
content = content.replace('text-rose-100', 'text-white');
content = content.replace('text-violet-100', 'text-white');
content = content.replace('text-amber-100', 'text-white');
content = content.replace('text-indigo-100', 'text-white');
content = content.replace('text-teal-100', 'text-white');
content = content.replace('text-black/60', 'text-yellow-950 font-bold');

// 5. Update Unlock (shkyçje) icon to inherit contrast
content = content.replace('<Unlock className="w-4 h-4 text-zinc-400" />', '<Unlock className="w-4 h-4" />');

// 6. Replace the grey button ternary colors with beautiful premium borders + high contrast
const originalTernary = 'isDark ? "bg-zinc-800 text-zinc-300 hover:bg-zinc-700" : "bg-zinc-200 text-zinc-700 hover:bg-zinc-300"';
const replacementTernary = 'isDark ? "bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700/60 shadow-md shadow-zinc-950/20" : "bg-white hover:bg-zinc-100 text-zinc-800 border border-zinc-200/80 shadow-sm"';

let count = 0;
while (content.indexOf(originalTernary) !== -1) {
  content = content.replace(originalTernary, replacementTernary);
  count++;
}
console.log(`Replaced grey ternary expression in ${count} places!`);

// 7. Replace the dark mode toggle button colors specifically
const originalToggleTernary = 'isDark ? "bg-zinc-800 text-yellow-500 hover:bg-zinc-700" : "bg-zinc-200 text-zinc-700 hover:bg-zinc-300"';
const replacementToggleTernary = 'isDark ? "bg-zinc-800 hover:bg-zinc-700 text-yellow-500 border border-zinc-700/60 shadow-md shadow-zinc-950/20" : "bg-white hover:bg-zinc-100 text-zinc-700 border border-zinc-200/80 shadow-sm"';
if (content.indexOf(originalToggleTernary) !== -1) {
  content = content.replace(originalToggleTernary, replacementToggleTernary);
  console.log('Successfully updated Toggle Theme button colors!');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('All replacements written successfully!');
