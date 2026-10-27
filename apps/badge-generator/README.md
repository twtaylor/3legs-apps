# Badge generator

Builds `out/badges.pdf` from `out/consolidated.csv` for Avery 5390 insert sheets.

Run the guest-list app first so the consolidated file exists.

```bash
npm install
npm run generate
```

Print the PDF at 100% (actual size) on US Letter. Each page holds eight inserts, two across and four down. Each insert is 3.5 inches wide by 2.25 inches tall. The name is centered, with the homegroup underneath. The sheet is perforated, so the PDF does not draw a border or any add-on icons.
