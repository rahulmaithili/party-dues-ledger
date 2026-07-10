const fs = require('fs');
const path = require('path');

try {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const startTag = '<script>';
  const endTag = '</script>';
  
  let pos = 0;
  while (true) {
    const startIdx = html.indexOf(startTag, pos);
    if (startIdx === -1) break;
    const endIdx = html.indexOf(endTag, startIdx);
    if (endIdx === -1) break;
    
    const scriptContent = html.substring(startIdx + startTag.length, endIdx);
    
    // Test compilation
    try {
      new Function(scriptContent);
    } catch (e) {
      console.error("Syntax Error found in script block starting at character " + startIdx + ":");
      console.error(e.message);
      // Print surrounding lines
      const lineNum = html.substring(0, startIdx).split('\n').length;
      console.error("Approximate line number in index.html: " + lineNum);
      
      // Let's print the error stack
      console.error(e);
    }
    
    pos = endIdx + endTag.length;
  }
  console.log("Syntax check complete.");
} catch (err) {
  console.error(err);
}
