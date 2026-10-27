import * as fs from 'fs';
import * as path from 'path';

const downloadsDir = path.join(process.env.HOME || '', 'Downloads');
const projectDir = path.resolve(__dirname);
const outputDir = path.join(projectDir, 'assets', 'recordings');

// Parse GMT timestamp from filename
function parseGMTFilename(filename: string): Date | null {
  const match = filename.match(/^GMT(\d{8})-(\d{6})_(.+)$/);
  if (!match) return null;
  
  const [, dateStr, timeStr, suffix] = match;
  const year = parseInt(dateStr.substring(0, 4));
  const month = parseInt(dateStr.substring(4, 6)) - 1; // JS months are 0-indexed
  const day = parseInt(dateStr.substring(6, 8));
  const hour = parseInt(timeStr.substring(0, 2));
  const minute = parseInt(timeStr.substring(2, 4));
  const second = parseInt(timeStr.substring(4, 6));
  
  return new Date(Date.UTC(year, month, day, hour, minute, second));
}

// Convert to PST and format filename
function convertToPSTFilename(filename: string): string | null {
  const gmtDate = parseGMTFilename(filename);
  if (!gmtDate) return null;
  
  // Convert to PST (UTC-8)
  const pstDate = new Date(gmtDate.getTime() - 8 * 60 * 60 * 1000);
  
  const year = pstDate.getFullYear();
  const month = String(pstDate.getMonth() + 1).padStart(2, '0');
  const day = String(pstDate.getDate()).padStart(2, '0');
  const hour = String(pstDate.getHours()).padStart(2, '0');
  const minute = String(pstDate.getMinutes()).padStart(2, '0');
  const second = String(pstDate.getSeconds()).padStart(2, '0');
  
  const suffix = filename.substring(filename.indexOf('_'));
  
  return `PST${year}${month}${day}-${hour}${minute}${second}${suffix}`;
}

// Main execution
async function main() {
  try {
    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      console.log(`Created directory: ${outputDir}\n`);
    }
    
    const files = fs.readdirSync(downloadsDir);
    const gmtFiles = files.filter(f => f.startsWith('GMT') && f.endsWith('.m4a'));
    
    console.log(`Found ${gmtFiles.length} GMT recording files:\n`);
    
    for (const file of gmtFiles) {
      const pstFilename = convertToPSTFilename(file);
      if (pstFilename) {
        const sourcePath = path.join(downloadsDir, file);
        const destPath = path.join(outputDir, pstFilename);
        
        console.log(`Copying: ${file} → ${pstFilename}`);
        fs.copyFileSync(sourcePath, destPath);
      }
    }
    
    console.log(`\n✓ Successfully copied ${gmtFiles.length} files to ${outputDir}`);
  } catch (error) {
    console.error('Error:', error);
  }
}

main();

