import fs from 'fs';

const filePath = 'src/components/Notepad.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Remove view button from Row 1
// First let's find the search container block
const searchTarget = `              {/* Search Input for active document & Transferred View Button */}
              <div className="flex items-center gap-2 shrink-0">
                 <div className="relative max-w-[120px] sm:max-w-[180px] shrink-0">`;

const searchReplacement = `              {/* Search Input for active document */}
              <div className="relative max-w-[120px] sm:max-w-[180px] shrink-0">`;

if (content.includes(searchTarget)) {
  content = content.replace(searchTarget, searchReplacement);
  console.log('Successfully updated search wrapper in Row 1!');
}

// Next, let's remove the eye button in Row 1
const eyeTargetRow1 = `                 {/* Transferred View Button */}
                 <button 
                    onClick={() => setPreviewSelectedRows(true)} 
                    title="Shfaq Rrjeshtat e Shenjuar" 
                    className="h-8 w-8 rounded-xl flex items-center justify-center transition-all shadow-md hover:scale-[1.05] active:scale-95 shrink-0 bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20"
                 >
                    <Eye className="w-4 h-4 text-white font-bold" />
                 </button>
              </div>`;

const eyeReplacementRow1 = `              </div>`;

if (content.includes(eyeTargetRow1)) {
  content = content.replace(eyeTargetRow1, eyeReplacementRow1);
  console.log('Successfully removed the Eye button from Row 1!');
}

// 2. Remove view button from Row 2
const eyeTargetRow2 = `              {/* Show Selected Rows */}
              <button 
                 onClick={() => setPreviewSelectedRows(true)} 
                 title="Shfaq Rrjeshtat e Shenjuar" 
                 className={\`h-9 w-9 rounded-xl flex items-center justify-center transition-all shadow-md hover:scale-[1.03] active:scale-95 shrink-0 \\\${
                    isDark ? "bg-zinc-900 hover:bg-zinc-800 text-zinc-100 border border-zinc-700 hover:border-accent-500/60 shadow-md shadow-zinc-950/20" : "bg-white hover:bg-zinc-50 text-zinc-800 border border-zinc-200 hover:border-accent-500/60 shadow-sm font-semibold"
                 }\`}
              >
                 <Eye className="w-4 h-4" />
              </button>
              <div className="h-6 w-px bg-zinc-500/20 mx-1 shrink-0"></div>`;

const eyeReplacementRow2 = ``;

if (content.includes(eyeTargetRow2)) {
  content = content.replace(eyeTargetRow2, eyeReplacementRow2);
  console.log('Successfully removed the Eye button from Row 2!');
} else {
  // Let's do a more relaxed check for Row 2 eye button
  const altEyeTargetRow2 = `              {/* Show Selected Rows */}
              <button 
                 onClick={() => setPreviewSelectedRows(true)} 
                 title="Shfaq Rrjeshtat e Shenjuar" 
                 className={\`h-9 w-9 rounded-xl flex items-center justify-center transition-all shadow-md hover:scale-[1.03] active:scale-95 shrink-0 \\\${
                    isDark ? "bg-zinc-900 hover:bg-zinc-800 text-zinc-100 border border-zinc-700 hover:border-accent-500/60 shadow-md shadow-zinc-950/20" : "bg-white hover:bg-zinc-50 text-zinc-800 border border-zinc-200 hover:border-accent-500/60 shadow-sm font-semibold"
                 }\`}
              >
                 <Eye className="w-4 h-4" />
              </button>`;
  if (content.includes(altEyeTargetRow2)) {
    content = content.replace(altEyeTargetRow2, '');
    console.log('Successfully removed the Eye button from Row 2 (relaxed)!');
  }
}

// 3. Update export buttons to be colorful PDF, TXT, CSV with divider after PDF
const oldExportsBlock = `              {/* 12. PDF */}
              <button 
                 onClick={exportPdf} 
                 className="h-9 w-9 rounded-xl flex items-center justify-center transition-all shadow-md hover:scale-[1.05] active:scale-95 shrink-0 bg-red-600 hover:bg-red-500 text-white shadow-red-500/20" 
                 title="Shkarko PDF"
              >
                 <div className="relative flex items-center justify-center">
                    <FileText className="w-4 h-4 text-white font-bold" />
                    <span className="absolute -bottom-1.5 -right-1.5 bg-red-800 text-[7px] leading-none font-black text-white px-0.5 py-px rounded border border-white/40 shadow-xs scale-90">PDF</span>
                 </div>
              </button>
              <div className="h-6 w-px bg-zinc-500/20 mx-1 shrink-0"></div>
              {/* Others: TXT, CSV, Themes, DarkMode, Font, TextColor, TagColor, Columns, ShowSelected */}
              <button 
                 onClick={exportTxt} 
                 className={\`h-9 w-9 rounded-xl flex items-center justify-center transition-all shadow-md hover:scale-[1.03] active:scale-95 shrink-0 \\\${
                    isDark ? "bg-zinc-900 hover:bg-zinc-800 text-zinc-100 border border-zinc-700 hover:border-accent-500/60 shadow-md shadow-zinc-950/20" : "bg-white hover:bg-zinc-50 text-zinc-800 border border-zinc-200 hover:border-accent-500/60 shadow-sm font-semibold"
                 }\`} 
                 title="Shkarko TXT"
              >
                 <File className="w-4 h-4" />
              </button>
              <button 
                 onClick={exportCsv} 
                 className={\`h-9 w-9 rounded-xl flex items-center justify-center transition-all shadow-md hover:scale-[1.03] active:scale-95 shrink-0 \\\${
                    isDark ? "bg-zinc-900 hover:bg-zinc-800 text-zinc-100 border border-zinc-700 hover:border-accent-500/60 shadow-md shadow-zinc-950/20" : "bg-white hover:bg-zinc-50 text-zinc-800 border border-zinc-200 hover:border-accent-500/60 shadow-sm font-semibold"
                 }\`} 
                 title="Shkarko CSV"
              >
                 <FileSpreadsheet className="w-4 h-4" />
              </button>`;

const newExportsBlock = `              {/* 12. PDF */}
              <button 
                 onClick={exportPdf} 
                 className="h-9 w-9 rounded-xl flex items-center justify-center transition-all shadow-md hover:scale-[1.05] active:scale-95 shrink-0 bg-red-600 hover:bg-red-500 text-white shadow-red-500/20" 
                 title="Shkarko PDF"
              >
                 <div className="relative flex items-center justify-center">
                    <FileText className="w-4 h-4 text-white font-bold" />
                    <span className="absolute -bottom-1.5 -right-1.5 bg-red-800 text-[7px] leading-none font-black text-white px-0.5 py-px rounded border border-white/40 shadow-xs scale-90">PDF</span>
                 </div>
              </button>

              <div className="h-6 w-px bg-zinc-500/20 mx-1 shrink-0"></div>

              {/* 13. TXT */}
              <button 
                 onClick={exportTxt} 
                 className="h-9 w-9 rounded-xl flex items-center justify-center transition-all shadow-md hover:scale-[1.05] active:scale-95 shrink-0 bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20" 
                 title="Shkarko TXT"
              >
                 <div className="relative flex items-center justify-center">
                    <File className="w-4 h-4 text-white font-bold" />
                    <span className="absolute -bottom-1.5 -right-1.5 bg-blue-800 text-[7px] leading-none font-black text-white px-0.5 py-px rounded border border-white/40 shadow-xs scale-90">TXT</span>
                 </div>
              </button>

              {/* 14. CSV */}
              <button 
                 onClick={exportCsv} 
                 className="h-9 w-9 rounded-xl flex items-center justify-center transition-all shadow-md hover:scale-[1.05] active:scale-95 shrink-0 bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20" 
                 title="Shkarko CSV"
              >
                 <div className="relative flex items-center justify-center">
                    <FileSpreadsheet className="w-4 h-4 text-white font-bold" />
                    <span className="absolute -bottom-1.5 -right-1.5 bg-emerald-800 text-[7px] leading-none font-black text-white px-0.5 py-px rounded border border-white/40 shadow-xs scale-90">CSV</span>
                 </div>
              </button>`;

if (content.includes(oldExportsBlock)) {
  content = content.replace(oldExportsBlock, newExportsBlock);
  console.log('Successfully updated the PDF, TXT, and CSV buttons & layout!');
} else {
  console.log('Warning: Could not match exact oldExportsBlock, will perform targeted replacement.');
  // Targeted replacement for TXT and CSV
  const txtOld = `<button 
                 onClick={exportTxt} 
                 className={\`h-9 w-9 rounded-xl flex items-center justify-center transition-all shadow-md hover:scale-[1.03] active:scale-95 shrink-0 \\\${
                    isDark ? "bg-zinc-900 hover:bg-zinc-800 text-zinc-100 border border-zinc-700 hover:border-accent-500/60 shadow-md shadow-zinc-950/20" : "bg-white hover:bg-zinc-50 text-zinc-800 border border-zinc-200 hover:border-accent-500/60 shadow-sm font-semibold"
                 }\`} 
                 title="Shkarko TXT"
              >
                 <File className="w-4 h-4" />
              </button>`;
  const txtNew = `<button 
                 onClick={exportTxt} 
                 className="h-9 w-9 rounded-xl flex items-center justify-center transition-all shadow-md hover:scale-[1.05] active:scale-95 shrink-0 bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20" 
                 title="Shkarko TXT"
              >
                 <div className="relative flex items-center justify-center">
                    <File className="w-4 h-4 text-white font-bold" />
                    <span className="absolute -bottom-1.5 -right-1.5 bg-blue-800 text-[7px] leading-none font-black text-white px-0.5 py-px rounded border border-white/40 shadow-xs scale-90">TXT</span>
                 </div>
              </button>`;
  
  const csvOld = `<button 
                 onClick={exportCsv} 
                 className={\`h-9 w-9 rounded-xl flex items-center justify-center transition-all shadow-md hover:scale-[1.03] active:scale-95 shrink-0 \\\${
                    isDark ? "bg-zinc-900 hover:bg-zinc-800 text-zinc-100 border border-zinc-700 hover:border-accent-500/60 shadow-md shadow-zinc-950/20" : "bg-white hover:bg-zinc-50 text-zinc-800 border border-zinc-200 hover:border-accent-500/60 shadow-sm font-semibold"
                 }\`} 
                 title="Shkarko CSV"
              >
                 <FileSpreadsheet className="w-4 h-4" />
              </button>`;
  const csvNew = `<button 
                 onClick={exportCsv} 
                 className="h-9 w-9 rounded-xl flex items-center justify-center transition-all shadow-md hover:scale-[1.05] active:scale-95 shrink-0 bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20" 
                 title="Shkarko CSV"
              >
                 <div className="relative flex items-center justify-center">
                    <FileSpreadsheet className="w-4 h-4 text-white font-bold" />
                    <span className="absolute -bottom-1.5 -right-1.5 bg-emerald-800 text-[7px] leading-none font-black text-white px-0.5 py-px rounded border border-white/40 shadow-xs scale-90">CSV</span>
                 </div>
              </button>`;

  content = content.replace(txtOld, txtNew);
  content = content.replace(csvOld, csvNew);
  console.log('Targeted replacement applied for TXT and CSV.');
}

// 4. Update the palette/color buttons icons
// Theme Palette button
const themePaletteBtn = `              {/* Theme Menu Button */}
              <div className="relative shrink-0">
                 <button 
                    onClick={() => setShowThemeMenu(!showThemeMenu)}
                    className={\`h-9 w-9 rounded-xl flex items-center justify-center transition-all shadow-md hover:scale-[1.03] active:scale-95 shrink-0 \\\${
                       isDark ? "bg-zinc-900 hover:bg-zinc-800 text-zinc-100 border border-zinc-700 hover:border-accent-500/60 shadow-md shadow-zinc-950/20" : "bg-white hover:bg-zinc-50 text-zinc-800 border border-zinc-200 hover:border-accent-500/60 shadow-sm font-semibold"
                    }\`}
                    title="Ndërro Ngjyrën"
                 >
                    <Palette className="w-4 h-4" />
                 </button>`;

const newThemePaletteBtn = `              {/* Theme Menu Button */}
              <div className="relative shrink-0">
                 <button 
                    onClick={() => setShowThemeMenu(!showThemeMenu)}
                    className={\`h-9 w-9 rounded-xl flex items-center justify-center transition-all shadow-md hover:scale-[1.03] active:scale-95 shrink-0 \\\${
                       isDark ? "bg-zinc-900 hover:bg-zinc-800 text-zinc-100 border border-zinc-700 hover:border-accent-500/60 shadow-md shadow-zinc-950/20" : "bg-white hover:bg-zinc-50 text-zinc-800 border border-zinc-200 hover:border-accent-500/60 shadow-sm font-semibold"
                    }\`}
                    title="Ndërro Ngjyrën"
                 >
                    <Paintbrush className="w-4 h-4" />
                 </button>`;

if (content.includes(themePaletteBtn)) {
  content = content.replace(themePaletteBtn, newThemePaletteBtn);
  console.log('Successfully changed Theme Menu Button to use Paintbrush icon!');
}

// Text Color Button
const textColorBtn = `              {/* Text color settings */}
              <div className="relative shrink-0">
                  <button 
                     onClick={() => { setShowTextColorMenu(!showTextColorMenu); setShowTextMenu(false); }} 
                     className={\`h-9 w-9 rounded-xl flex items-center justify-center transition-all shadow-md hover:scale-[1.03] active:scale-95 shrink-0 \\\${
                        isDark ? "bg-zinc-900 hover:bg-zinc-800 text-zinc-100 border border-zinc-700 hover:border-accent-500/60 shadow-md shadow-zinc-950/20" : "bg-white hover:bg-zinc-50 text-zinc-800 border border-zinc-200 hover:border-accent-500/60 shadow-sm font-semibold"
                     }\`} 
                     title={t("Ngjyra e Tekstit", "Text Color")}
                  >
                     <Palette className="w-4 h-4" />
                  </button>`;

const newTextColorBtn = `              {/* Text color settings */}
              <div className="relative shrink-0">
                  <button 
                     onClick={() => { setShowTextColorMenu(!showTextColorMenu); setShowTextMenu(false); }} 
                     className={\`h-9 w-9 rounded-xl flex items-center justify-center transition-all shadow-md hover:scale-[1.03] active:scale-95 shrink-0 \\\${
                        isDark ? "bg-zinc-900 hover:bg-zinc-800 text-zinc-100 border border-zinc-700 hover:border-accent-500/60 shadow-md shadow-zinc-950/20" : "bg-white hover:bg-zinc-50 text-zinc-800 border border-zinc-200 hover:border-accent-500/60 shadow-sm font-semibold"
                     }\`} 
                     title={t("Ngjyra e Tekstit", "Text Color")}
                  >
                     <CaseSensitive className="w-[18px] h-[18px]" />
                  </button>`;

if (content.includes(textColorBtn)) {
  content = content.replace(textColorBtn, newTextColorBtn);
  console.log('Successfully changed Text Color Button to use CaseSensitive icon!');
}

// 5. Center the dropdown overlays (using left-1/2 -translate-x-1/2 instead of left-0 / right-0)

// Theme Menu overlay
const oldThemeOverlay = `                  {showThemeMenu && (
                     <div className={\`absolute right-0 top-full mt-2 p-2 rounded-xl border shadow-xl z-[150] flex flex-col gap-1.5 w-[220px] \${isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"}\`}>`;

const newThemeOverlay = `                  {showThemeMenu && (
                     <div className={\`absolute left-1/2 -translate-x-1/2 top-full mt-2 p-2 rounded-xl border shadow-xl z-[150] flex flex-col gap-1.5 w-[220px] \${isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"}\`}>`;

if (content.includes(oldThemeOverlay)) {
  content = content.replace(oldThemeOverlay, newThemeOverlay);
  console.log('Centered Theme Menu dropdown overlay!');
}

// Text Menu (Size & Weight) overlay
const oldTextOverlay = `                          <div className={\`absolute left-0 top-full mt-2 p-3 rounded-xl border shadow-xl z-[150] flex flex-col gap-3 w-[220px] \${isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"}\`}>`;

const newTextOverlay = `                          <div className={\`absolute left-1/2 -translate-x-1/2 top-full mt-2 p-3 rounded-xl border shadow-xl z-[150] flex flex-col gap-3 w-[220px] \${isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"}\`}>`;

if (content.includes(oldTextOverlay)) {
  content = content.replace(oldTextOverlay, newTextOverlay);
  console.log('Centered Font Size & Weight Menu dropdown overlay!');
}

// Text Color Menu overlay
const oldTextColorOverlay = `                          <div className={\`absolute left-0 top-full mt-2 p-2 rounded-xl border shadow-xl z-[150] flex flex-col gap-1.5 w-[200px] \${isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"}\`}>`;

const newTextColorOverlay = `                          <div className={\`absolute left-1/2 -translate-x-1/2 top-full mt-2 p-2 rounded-xl border shadow-xl z-[150] flex flex-col gap-1.5 w-[200px] \${isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"}\`}>`;

if (content.includes(oldTextColorOverlay)) {
  content = content.replace(oldTextColorOverlay, newTextColorOverlay);
  console.log('Centered Text Color Menu dropdown overlay!');
}

// Tag Color Menu overlay
const oldTagOverlay = `                          <div className={\`absolute left-0 top-full mt-2 p-2 rounded-xl border shadow-xl z-[150] flex flex-col gap-1.5 w-[200px] \${isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"}\`}>`;

const newTagOverlay = `                          <div className={\`absolute left-1/2 -translate-x-1/2 top-full mt-2 p-2 rounded-xl border shadow-xl z-[150] flex flex-col gap-1.5 w-[200px] \${isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"}\`}>`;

if (content.includes(oldTagOverlay)) {
  content = content.replace(oldTagOverlay, newTagOverlay);
  console.log('Centered Tag Color Menu dropdown overlay!');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('All toolbar changes successfully applied!');
