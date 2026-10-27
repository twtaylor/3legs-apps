import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import PDFDocument from 'pdfkit';

interface BadgeRow {
  'Badge Name': string;
  Homegroup: string;
}

const PAGE_WIDTH = 8.5 * 72;
const PAGE_HEIGHT = 11 * 72;
const BADGE_WIDTH = 3.5 * 72;
const BADGE_HEIGHT = 2.219 * 72;
const LEFT_MARGIN = 0.75 * 72;
const TOP_MARGIN = 1.062 * 72;
const COLS = 2;
const ROWS = 4;
const BADGES_PER_PAGE = COLS * ROWS;
const NAME_SIZE = 20;
const GROUP_SIZE = 11;

function repoRoot(): string {
  return path.join(__dirname, '..', '..', '..');
}

function parseCSV(filePath: string): BadgeRow[] {
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  return parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  }) as BadgeRow[];
}

function fittedNameSize(doc: PDFKit.PDFDocument, name: string, width: number): number {
  let size = NAME_SIZE;
  doc.font('Helvetica-Bold');
  while (size > 12 && doc.fontSize(size).widthOfString(name) > width) {
    size -= 1;
  }
  return size;
}

function generatePDF(badges: BadgeRow[], outputPath: string): void {
  const doc = new PDFDocument({
    size: [PAGE_WIDTH, PAGE_HEIGHT],
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
  });

  const stream = fs.createWriteStream(outputPath);
  doc.pipe(stream);

  badges.forEach((badge, index) => {
    const badgeIndex = index % BADGES_PER_PAGE;
    if (index > 0 && badgeIndex === 0) {
      doc.addPage({
        size: [PAGE_WIDTH, PAGE_HEIGHT],
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
      });
    }

    const col = badgeIndex % COLS;
    const row = Math.floor(badgeIndex / COLS);
    const x = LEFT_MARGIN + col * BADGE_WIDTH;
    const y = TOP_MARGIN + row * BADGE_HEIGHT;
    const padding = 12;
    const contentX = x + padding;
    const contentWidth = BADGE_WIDTH - 2 * padding;
    const name = (badge['Badge Name'] || '').trim();
    const homegroup = (badge.Homegroup || '').trim();

    const nameSize = fittedNameSize(doc, name, contentWidth);
    doc.font('Helvetica-Bold').fontSize(nameSize);
    const nameHeight = doc.heightOfString(name, { width: contentWidth, align: 'center' });

    let groupHeight = 0;
    if (homegroup) {
      doc.font('Helvetica').fontSize(GROUP_SIZE);
      groupHeight = Math.min(
        doc.heightOfString(homegroup, { width: contentWidth, align: 'center' }),
        44
      );
    }

    const gap = homegroup ? 6 : 0;
    const blockHeight = nameHeight + gap + groupHeight;
    let textY = y + (BADGE_HEIGHT - blockHeight) / 2;

    doc.font('Helvetica-Bold').fontSize(nameSize).fillColor('#000000');
    doc.text(name, contentX, textY, { width: contentWidth, align: 'center' });
    textY += nameHeight + gap;

    if (homegroup) {
      doc.font('Helvetica').fontSize(GROUP_SIZE).fillColor('#000000');
      doc.text(homegroup, contentX, textY, {
        width: contentWidth,
        align: 'center',
        height: 44,
        ellipsis: true,
      });
    }
  });

  doc.end();

  stream.on('finish', () => {
    console.log('PDF generated.');
    console.log(`Output: ${outputPath}`);
    console.log(`Badges: ${badges.length}`);
    console.log(`Pages: ${Math.ceil(badges.length / BADGES_PER_PAGE)}`);
  });

  stream.on('error', (err) => {
    console.error('Error writing PDF:', err);
    process.exit(1);
  });
}

const root = repoRoot();
const inputPath = path.join(root, 'out', 'consolidated.csv');
const outputPath = path.join(root, 'out', 'badges.pdf');

if (!fs.existsSync(inputPath)) {
  console.error('Consolidated guest list not found:', inputPath);
  console.error('Run the guest-list app first.');
  process.exit(1);
}

console.log(`Reading consolidated guest list: ${inputPath}`);
const badges = parseCSV(inputPath).filter((badge) => {
  const name = (badge['Badge Name'] || '').trim();
  return name !== '' && name.toLowerCase() !== 'no name';
});
console.log(`Generating ${badges.length} badges`);
generatePDF(badges, outputPath);
