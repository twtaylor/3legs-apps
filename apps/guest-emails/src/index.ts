import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

interface OrderRow {
  Type: string;
  Description: string;
  'Order cancelled': string;
  Email: string;
  'What is your e-mail?': string;
  'What is your phone number?': string;
}

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

function collapse(value: string | undefined): string {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function isCancelled(row: OrderRow): boolean {
  const value = collapse(row['Order cancelled']).toLowerCase();
  return value !== '' && value !== '0' && value !== 'false' && value !== 'no';
}

function isAttendanceTicket(row: OrderRow): boolean {
  if (collapse(row.Type).toUpperCase() !== 'TICKET') {
    return false;
  }
  const description = collapse(row.Description).toLowerCase();
  return description === 'registration' || description === 'online only';
}

function extractGuestEmails(): void {
  const root = repoRoot();
  const csvPath = findExport(root);
  console.log(`Reading: ${csvPath}`);

  const records = parse(fs.readFileSync(csvPath, 'utf-8'), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
    relax_column_count: true,
  }) as OrderRow[];

  const emailSet = new Set<string>();
  const phoneSet = new Set<string>();

  for (const record of records) {
    if (isCancelled(record) || !isAttendanceTicket(record)) {
      continue;
    }

    const email = collapse(record['What is your e-mail?']).toLowerCase() || collapse(record.Email).toLowerCase();
    if (email) {
      emailSet.add(email);
    }

    const phone = collapse(record['What is your phone number?']).replace(/[\s()\-]/g, '');
    if (phone) {
      phoneSet.add(phone);
    }
  }

  const emailString = Array.from(emailSet).sort().join(',');
  const phoneString = Array.from(phoneSet).sort().join(',');
  const outDir = path.join(root, 'out');
  fs.mkdirSync(outDir, { recursive: true });

  const emailOutputPath = path.join(outDir, 'guest-emails.txt');
  const phoneOutputPath = path.join(outDir, 'guest-phones.txt');
  fs.writeFileSync(emailOutputPath, emailString);
  fs.writeFileSync(phoneOutputPath, phoneString);

  console.log(`Unique emails: ${emailSet.size}`);
  console.log(`Unique phones: ${phoneSet.size}`);
  console.log(`Email list: ${emailOutputPath}`);
  console.log(`Phone list: ${phoneOutputPath}`);
}

extractGuestEmails();
