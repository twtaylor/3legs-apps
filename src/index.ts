import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

interface GuestRecord {
  'Order number': string;
  'Order date': string;
  'Guest first name': string;
  'Guest last name': string;
  'Email': string;
  'Ticket type': string;
  'Ticket number': string;
  'Ticket price': string;
  'Benefit': string;
  'Coupon': string;
  'Tax': string;
  'Total ticket price': string;
  'Wix service fee': string;
  'Ticket revenue': string;
  'Payment status': string;
  'Checked in': string;
  'Home group': string;
  [key: string]: string; // For additional dynamic columns
}

interface ConsolidatedGuest {
  'First Name': string;
  'Last Name': string;
  'Email': string;
  'Homegroup': string;
  'Order Numbers': string;
  'Ticket Type': string;
  'Ticket Quantity': number;
  'Coffee': number;
  'Dinner': number;
  'Pin': number;
  'Scholarship Donation': number;
  'Total Revenue': string;
  [key: string]: string | number;
}

// Determine ticket type (mutually exclusive)
function getTicketType(ticketType: string): string | null {
  const type = ticketType.trim();
  
  if (type.startsWith('Early Bird')) {
    return 'Early Bird';
  } else if (type.startsWith('Admission')) {
    return 'Admission';
  } else if (type.startsWith('Online')) {
    return 'Online';
  } else if (type.startsWith('Zoom')) {
    return 'Zoom';
  }
  
  return null;
}

// Categorize add-ons
function categorizeAddOns(ticketType: string): {
  coffee?: number;
  dinner?: number;
  pin?: number;
  scholarship?: number;
} {
  const type = ticketType.toLowerCase();
  const result: any = {};

  // Add-ons
  if (type.includes('coffee')) {
    result.coffee = 1;
  }
  if (type.includes('dinner')) {
    result.dinner = 1;
  }
  if (type.includes('pin')) {
    result.pin = 1;
  }
  if (type.includes('scholarship')) {
    result.scholarship = 1;
  }

  return result;
}

function parseMoneyValue(value: string): number {
  return parseFloat(value.replace(/[$,]/g, '')) || 0;
}

function formatMoney(value: number): string {
  return `$${value.toFixed(2)}`;
}

function transformGuestList(inputPath: string, outputPath: string): void {
  console.log(`Reading file: ${inputPath}`);
  
  // Handle UTF-16LE encoding
  let fileContent: string;
  try {
    // Try reading as UTF-16LE first
    const buffer = fs.readFileSync(inputPath);
    fileContent = buffer.toString('utf16le');
    // Remove BOM if present
    if (fileContent.charCodeAt(0) === 0xFEFF) {
      fileContent = fileContent.slice(1);
    }
  } catch (err) {
    // Fallback to UTF-8
    fileContent = fs.readFileSync(inputPath, 'utf-8');
  }
  
  // Parse CSV
  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    delimiter: '\t',
    relax_quotes: true,
    trim: true,
  }) as GuestRecord[];

  console.log(`Found ${records.length} ticket records`);

  // Group by guest (using email as unique key since names can be duplicated)
  const guestMap = new Map<string, {
    firstName: string;
    lastName: string;
    email: string;
    homegroup: string;
    orderNumbers: Set<string>;
    tickets: GuestRecord[];
    ticketType: string | null;
  }>();

  for (const record of records) {
    const email = record.Email?.trim().toLowerCase();
    const firstName = record['Guest first name']?.trim();
    const lastName = record['Guest last name']?.trim();
    const homegroup = record['Home group']?.trim() || '';
    
    if (!email) continue;

    if (!guestMap.has(email)) {
      guestMap.set(email, {
        firstName,
        lastName,
        email: record.Email?.trim(),
        orderNumbers: new Set(),
        tickets: [],
        ticketType: null,
      });
    }
    
    const guest = guestMap.get(email)!;
    guest.orderNumbers.add(record['Order number']);
    guest.tickets.push(record);
    
    // Set ticket type (should only be one per guest)
    const ticketType = getTicketType(record['Ticket type']);
    if (ticketType && !guest.ticketType) {
      guest.ticketType = ticketType;
    }
  }

  console.log(`Found ${guestMap.size} unique guests`);

  // Create consolidated records
  const consolidatedRecords: ConsolidatedGuest[] = [];

  for (const [, guestData] of guestMap.entries()) {
    const { firstName, lastName, email, orderNumbers, tickets } = guestData;
    
    // Group tickets by primary ticket type
    const ticketsByType = new Map<string, GuestRecord[]>();
    const addOnTickets: GuestRecord[] = [];
    
    for (const ticket of tickets) {
      const ticketTypeMatch = getTicketType(ticket['Ticket type']);
      if (ticketTypeMatch) {
        if (!ticketsByType.has(ticketTypeMatch)) {
          ticketsByType.set(ticketTypeMatch, []);
        }
        ticketsByType.get(ticketTypeMatch)!.push(ticket);
      } else {
        // This is an add-on only (no primary ticket)
        addOnTickets.push(ticket);
      }
    }
    
    // If guest has no primary tickets, create a single "None" row
    if (ticketsByType.size === 0) {
      let coffee = 0;
      let dinner = 0;
      let pin = 0;
      let scholarship = 0;
      let totalRevenue = 0;

      for (const ticket of addOnTickets) {
        const addOns = categorizeAddOns(ticket['Ticket type']);
        coffee += addOns.coffee || 0;
        dinner += addOns.dinner || 0;
        pin += addOns.pin || 0;
        scholarship += addOns.scholarship || 0;
        totalRevenue += parseMoneyValue(ticket['Ticket revenue']);
      }

      consolidatedRecords.push({
        'First Name': firstName,
        'Last Name': lastName,
        'Email': email,
        'Homegroup': homegroup,
        'Order Numbers': Array.from(orderNumbers).join(', '),
        'Ticket Type': 'None',
        'Ticket Quantity': 0,
        'Coffee': coffee,
        'Dinner': dinner,
        'Pin': pin,
        'Scholarship Donation': scholarship,
        'Total Revenue': formatMoney(totalRevenue),
      });
    } else {
      // Create one row per ticket type
      let isFirstRow = true;
      
      for (const [ticketType, typeTickets] of ticketsByType.entries()) {
        const ticketQuantity = typeTickets.length;
        
        // Calculate revenue for this ticket type
        const ticketRevenue = typeTickets.reduce((sum, ticket) => {
          return sum + parseMoneyValue(ticket['Ticket revenue']);
        }, 0);
        
        // Only include add-ons in the first row to avoid duplication
        let coffee = 0;
        let dinner = 0;
        let pin = 0;
        let scholarship = 0;
        let addOnRevenue = 0;
        
        if (isFirstRow) {
          // Count all add-ons across all tickets (including add-on-only tickets)
          const allTickets = [...tickets];
          for (const ticket of allTickets) {
            const addOns = categorizeAddOns(ticket['Ticket type']);
            coffee += addOns.coffee || 0;
            dinner += addOns.dinner || 0;
            pin += addOns.pin || 0;
            scholarship += addOns.scholarship || 0;
            
            // If this ticket has no primary type, add its revenue
            if (!getTicketType(ticket['Ticket type'])) {
              addOnRevenue += parseMoneyValue(ticket['Ticket revenue']);
            }
          }
          isFirstRow = false;
        }
        
        consolidatedRecords.push({
          'First Name': firstName,
          'Last Name': lastName,
          'Email': email,
          'Homegroup': homegroup,
          'Order Numbers': Array.from(orderNumbers).join(', '),
          'Ticket Type': ticketType,
          'Ticket Quantity': ticketQuantity,
          'Coffee': coffee,
          'Dinner': dinner,
          'Pin': pin,
          'Scholarship Donation': scholarship,
          'Total Revenue': formatMoney(ticketRevenue + addOnRevenue),
        });
      }
    }
  }

  // Sort by last name, then first name
  consolidatedRecords.sort((a, b) => {
    const lastNameCompare = a['Last Name'].localeCompare(b['Last Name']);
    if (lastNameCompare !== 0) return lastNameCompare;
    return a['First Name'].localeCompare(b['First Name']);
  });

  // Write output CSV
  const output = stringify(consolidatedRecords, {
    header: true,
  });
  fs.writeFileSync(outputPath, output, 'utf-8');
  console.log(`✅ Transformation complete!`);
  console.log(`Output written to: ${outputPath}`);
  console.log(`\nSummary:`);
  console.log(`- Total ticket records in CSV: ${records.length}`);
  console.log(`- Unique guests (by email): ${guestMap.size}`);
  console.log(`- Output rows: ${consolidatedRecords.length}`);
  
  // Count unique guests and ticket quantities per type
  const ebGuests = new Set(consolidatedRecords.filter(r => r['Ticket Type'] === 'Early Bird').map(r => r['Email'].toLowerCase())).size;
  const adGuests = new Set(consolidatedRecords.filter(r => r['Ticket Type'] === 'Admission').map(r => r['Email'].toLowerCase())).size;
  const onGuests = new Set(consolidatedRecords.filter(r => r['Ticket Type'] === 'Online').map(r => r['Email'].toLowerCase())).size;
  const zmGuests = new Set(consolidatedRecords.filter(r => r['Ticket Type'] === 'Zoom').map(r => r['Email'].toLowerCase())).size;
  
  const ebQty = consolidatedRecords.filter(r => r['Ticket Type'] === 'Early Bird').reduce((sum, r) => sum + r['Ticket Quantity'], 0);
  const adQty = consolidatedRecords.filter(r => r['Ticket Type'] === 'Admission').reduce((sum, r) => sum + r['Ticket Quantity'], 0);
  const onQty = consolidatedRecords.filter(r => r['Ticket Type'] === 'Online').reduce((sum, r) => sum + r['Ticket Quantity'], 0);
  const zmQty = consolidatedRecords.filter(r => r['Ticket Type'] === 'Zoom').reduce((sum, r) => sum + r['Ticket Quantity'], 0);
  
  console.log(`\nTicket Type Breakdown:`);
  console.log(`- Early Bird: ${ebGuests} unique guests, ${ebQty} total tickets`);
  console.log(`- Admission: ${adGuests} unique guests, ${adQty} total tickets`);
  console.log(`- Online: ${onGuests} unique guests, ${onQty} total tickets`);
  console.log(`- Zoom: ${zmGuests} unique guests, ${zmQty} total tickets`);
  
  // Count add-ons
  const coffeeCount = consolidatedRecords.reduce((sum, r) => sum + r['Coffee'], 0);
  const dinnerCount = consolidatedRecords.reduce((sum, r) => sum + r['Dinner'], 0);
  const pinCount = consolidatedRecords.reduce((sum, r) => sum + r['Pin'], 0);
  const scholarshipCount = consolidatedRecords.reduce((sum, r) => sum + r['Scholarship Donation'], 0);
  
  console.log(`\nAdd-ons:`);
  console.log(`- Coffee: ${coffeeCount}`);
  console.log(`- Dinner: ${dinnerCount}`);
  console.log(`- Pins: ${pinCount}`);
  console.log(`- Scholarship Donations: ${scholarshipCount}`);
}

// Main execution
const ordersDir = path.join(__dirname, '..', 'orders');
const guestListFiles = fs.readdirSync(ordersDir).filter(f => f.includes('Guest list') && f.endsWith('.csv'));
if (guestListFiles.length === 0) {
  console.error('❌ No Guest list CSV files found in orders directory');
  console.error('Please ensure the file name contains "Guest list"');
  process.exit(1);
}

// Process the first guest list file found
const inputFile = guestListFiles[0];
const inputPath = path.join(ordersDir, inputFile);
const outputPath = path.join(ordersDir, `consolidated-${inputFile}`);

transformGuestList(inputPath, outputPath);
