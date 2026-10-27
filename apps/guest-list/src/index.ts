import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

interface OrderRow {
  Type: string;
  Description: string;
  'Order ID': string;
  'Order cancelled': string;
  Name: string;
  'First Name': string;
  'Last Name': string;
  Email: string;
  'Attendee name': string;
  'What is your e-mail?': string;
  'What is your phone number?': string;
  "What is your home group's name?": string;
  'What name would you like displayed on your badge?': string;
}

interface BadgeRow {
  'Badge Name': string;
  Homegroup: string;
  Email: string;
  'Phone Number': string;
  'Order ID': string;
  'Ticket Type': string;
}

interface DinnerRow {
  'Purchaser Name': string;
  'Order ID': string;
  'Dinner Quantity': number;
}

const SERVICE_PANEL_COUNT = 18;

function repoRoot(): string {
  return path.join(__dirname, '..', '..', '..');
}

function findExport(root: string): string {
  const arg = process.argv[2];
  if (arg) {
    const resolved = path.resolve(arg);
    if (!fs.existsSync(resolved)) {
      console.error('Export CSV not found:', resolved);
      process.exit(1);
    }
    return resolved;
  }

  const preferred = path.join(root, 'exports', '2026');
  const exportsDir = path.join(root, 'exports');
  const candidates = listCsvFiles(fs.existsSync(preferred) ? preferred : exportsDir);
  if (candidates.length > 0) {
    candidates.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
    return candidates[0];
  }

  const fixture = path.join(root, 'fixtures', '2026-sample.csv');
  if (fs.existsSync(fixture)) {
    return fixture;
  }

  console.error('No order export found under exports/, and fixtures/2026-sample.csv is missing.');
  process.exit(1);
}

function listCsvFiles(dir: string): string[] {
  const found: string[] = [];
  if (!fs.existsSync(dir)) {
    return found;
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...listCsvFiles(full));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.csv')) {
      found.push(full);
    }
  }
  return found;
}

function readOrders(filePath: string): OrderRow[] {
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  return parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
    relax_column_count: true,
  }) as OrderRow[];
}

function isCancelled(row: OrderRow): boolean {
  const value = (row['Order cancelled'] || '').trim().toLowerCase();
  return value !== '' && value !== '0' && value !== 'false' && value !== 'no';
}

function collapse(value: string | undefined): string {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function capitalizeFirstLetter(value: string): string {
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function fallbackBadgeName(row: OrderRow): string {
  const attendee = collapse(row['Attendee name']);
  const parts = attendee.split(' ').filter(Boolean);
  if (parts.length > 0) {
    const first = capitalizeFirstLetter(parts[0]);
    const lastInitial = parts.length > 1 ? `${parts[parts.length - 1].charAt(0).toUpperCase()}.` : '';
    return lastInitial ? `${first} ${lastInitial}` : first;
  }

  const first = capitalizeFirstLetter(collapse(row['First Name']));
  const lastInitial = collapse(row['Last Name']).charAt(0).toUpperCase();
  if (first && lastInitial) {
    return `${first} ${lastInitial}.`;
  }
  return first;
}

function badgeName(row: OrderRow): string {
  const chosen = collapse(row['What name would you like displayed on your badge?']);
  return chosen || fallbackBadgeName(row);
}

function isPlaceholderName(name: string): boolean {
  return name.trim().toLowerCase() === 'no name';
}

function attendeeEmail(row: OrderRow): string {
  return collapse(row['What is your e-mail?']).toLowerCase() || collapse(row.Email).toLowerCase();
}

function attendeePhone(row: OrderRow): string {
  return collapse(row['What is your phone number?']).replace(/[\s()\-]/g, '');
}

function transform(inputPath: string, outDir: string): void {
  console.log(`Reading file: ${inputPath}`);
  const orders = readOrders(inputPath).filter((row) => !isCancelled(row));

  const badgeRows: BadgeRow[] = [];
  const dinnerByOrder = new Map<string, DinnerRow>();
  let onlineCount = 0;
  let ignoredNames = 0;

  for (const row of orders) {
    const type = collapse(row.Type).toUpperCase();
    const description = collapse(row.Description);

    if (type === 'TICKET' && description.toLowerCase() === 'registration') {
      const name = badgeName(row);
      if (isPlaceholderName(name)) {
        ignoredNames++;
        continue;
      }
      badgeRows.push({
        'Badge Name': name,
        Homegroup: collapse(row["What is your home group's name?"]),
        Email: attendeeEmail(row),
        'Phone Number': attendeePhone(row),
        'Order ID': collapse(row['Order ID']),
        'Ticket Type': 'Registration',
      });
    } else if (type === 'TICKET' && description.toLowerCase() === 'online only') {
      onlineCount++;
    } else if (type === 'PRODUCT' && description.toLowerCase().includes('dinner')) {
      const orderId = collapse(row['Order ID']);
      const existing = dinnerByOrder.get(orderId);
      if (existing) {
        existing['Dinner Quantity'] += 1;
      } else {
        dinnerByOrder.set(orderId, {
          'Purchaser Name': collapse(row.Name),
          'Order ID': orderId,
          'Dinner Quantity': 1,
        });
      }
    }
  }

  badgeRows.sort((a, b) => a['Badge Name'].localeCompare(b['Badge Name']));

  for (let i = 0; i < SERVICE_PANEL_COUNT; i++) {
    badgeRows.push({
      'Badge Name': 'Service Panel',
      Homegroup: '',
      Email: '',
      'Phone Number': '',
      'Order ID': '',
      'Ticket Type': 'Service Panel',
    });
  }

  const dinnerRows = Array.from(dinnerByOrder.values()).sort((a, b) =>
    a['Purchaser Name'].localeCompare(b['Purchaser Name'])
  );

  fs.mkdirSync(outDir, { recursive: true });

  const consolidatedPath = path.join(outDir, 'consolidated.csv');
  fs.writeFileSync(consolidatedPath, stringify(badgeRows, { header: true }), 'utf-8');

  const dinnerPath = path.join(outDir, 'dinner.csv');
  fs.writeFileSync(dinnerPath, stringify(dinnerRows, { header: true }), 'utf-8');

  const registrationCount = badgeRows.filter((row) => row['Ticket Type'] === 'Registration').length;
  const dinnerCount = dinnerRows.reduce((sum, row) => sum + row['Dinner Quantity'], 0);

  console.log('Transformation complete.');
  console.log(`Badge list: ${consolidatedPath}`);
  console.log(`Dinner roster: ${dinnerPath}`);
  console.log(`Registration badges: ${registrationCount}`);
  console.log(`Ignored "No name" badges: ${ignoredNames}`);
  console.log(`Service Panel placeholders: ${SERVICE_PANEL_COUNT}`);
  console.log(`Online Only tickets excluded from badges: ${onlineCount}`);
  console.log(`Dinner add-ons: ${dinnerCount} across ${dinnerRows.length} orders`);
}

const root = repoRoot();
const inputPath = findExport(root);
transform(inputPath, path.join(root, 'out'));
