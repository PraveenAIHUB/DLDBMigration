# Sample Excel Import Format

## Required Columns

Your Excel file must have these column headers (case-insensitive):

| Column Name | Required | Type | Example |
|------------|----------|------|---------|
| Lot# | **Required** | Text/Number | LOT-001, 20250116-001 |
| S# | Optional | Text/Number | 1, 2, 3... |
| Fleet # | Optional | Text | FL001, FL002 |
| Reg # | Optional | Text | ABC123, XYZ789 |
| Current Location | Optional | Text | Dubai, Abu Dhabi |
| Type / Model | Optional | Text | Camry, X5, C200 |
| Make | **Required** | Text | Toyota, BMW, Mercedes |
| Chassis # | Optional | Text | CH123456789 |
| Color | Optional | Text | Red, Black, White |
| Year | Optional | Number | 2020, 2019 |
| KM | Optional | Number | 45000, 52000 |
| Bid Price | Optional | Number | 25000, 23000 |

## Sample Data

### Minimum Required (2 columns)
```
Lot#      | Make
LOT-001   | Toyota
LOT-001   | Honda
LOT-001   | BMW
```

### Full Data Example
```
Lot#      | S# | Fleet # | Reg # | Current Location | Type / Model | Make      | Chassis #    | Color | Year | KM    | Bid Price
LOT-001   | 1  | FL001   | ABC123| Dubai            | Camry        | Toyota    | CH123456789  | Red   | 2020 | 45000 | 25000
LOT-001   | 2  | FL002   | XYZ789| Abu Dhabi        | Accord       | Honda     | CH987654321  | Black | 2019 | 52000 | 23000
LOT-001   | 3  | FL003   | DEF456| Sharjah          | X5           | BMW       | CH456789123  | White | 2021 | 32000 | 45000
LOT-001   | 4  | FL004   | GHI789| Dubai            | C200         | Mercedes  | CH789123456  | Silver| 2018 | 67000 | 28000
LOT-001   | 5  | FL005   | JKL012| Al Ain           | Patrol       | Nissan    | CH321654987  | Blue  | 2020 | 38000 | 35000
```

## Creating Your Excel File

### Method 1: Excel/Google Sheets
1. Open Excel or Google Sheets
2. Create headers in first row (A1:H1)
3. Add your data starting from row 2
4. Save as `.xlsx` or `.xls`

### Method 2: From CSV
1. Create a CSV file with headers
2. Import into Excel
3. Save as `.xlsx`

## Column Guidelines

### Lot# (Lot Number)
- **Required field** - Cannot be empty
- Unique identifier for the lot/group of vehicles
- All vehicles in the same file should have the same Lot#
- Example: LOT-001, LOT-20250116-001, 20250116-001
- Used to group vehicles together for bidding

### S# (Serial Number)
- Optional identifier
- Can be numeric or text
- Used for internal reference
- Example: 1, 2, 3 or SR001, SR002

### Fleet # (Fleet Number)
- Optional fleet tracking number
- Company-specific identifier
- Example: FL001, FLEET-001, F1234

### Reg # (Registration Number)
- Vehicle registration/license plate
- Recommended for identification
- Example: ABC123, DXB-12345, AD-A-1234

### Current Location
- Where the car is currently located
- Text field
- Example: Dubai, Abu Dhabi, Sharjah

### Type / Model
- Vehicle type or model name
- Optional field
- Examples: Camry, X5, C200, Accord, Patrol

### Make
- **Required field** - Cannot be empty
- Vehicle manufacturer/brand
- Examples:
  - Toyota
  - Honda
  - BMW
  - Mercedes
  - Nissan

### Chassis #
- Vehicle chassis number
- Unique identifier
- Example: CH123456789, VIN123456789

### Color
- Vehicle color
- Text field
- Example: Red, Black, White, Silver, Blue

### Year
- Manufacturing year
- Must be a number
- Example: 2020, 2019, 2021

### KM (Mileage)
- Total kilometers driven
- Must be a number (no commas)
- Example: 45000, 52000, 150000

### Bid Price (Optional - Not Displayed)
- Optional field - accepted in Excel but not displayed in the system
- Starting bid price or market value (for internal reference only)
- Must be a number (no currency symbols)
- Example: 25000, 45000, 100000
- **Note**: This field is stored but never shown to users

## Common Mistakes to Avoid

### ❌ Missing Required Field
```
S# | Fleet # | Reg # | Year | KM
1  | FL001   | ABC123| 2020 | 45000
```
**Problem**: Missing Lot# and Make columns
**Fix**: Add Lot# and Make columns with values

### ❌ Empty Required Values
```
Lot#      | Make              | Year | Bid Price
          |                   | 2020 | 25000
LOT-001   | Honda             | 2019 | 23000
```
**Problem**: First row has empty Lot# and Make
**Fix**: Fill in all Lot# and Make values

### ❌ Wrong Column Names
```
Manufacturer | Year Built | Kilometers
Toyota       | 2020       | 45000
```
**Problem**: Column names don't match required format
**Fix**: Use exact column names (Make, Year, KM)

### ❌ Special Characters in Numbers
```
KM      | PRICE
45,000  | $25,000
```
**Problem**: Commas and currency symbols in numbers
**Fix**: Use plain numbers (45000, 25000)

## Import Process

1. **Upload**: Click "Import Excel" in admin dashboard
2. **Validation**: System checks format and required fields
3. **Processing**: Each row is imported individually
4. **Results**: Shows success/failure count
5. **Review**: Check imported cars in the list

## After Import

Cars will be imported with:
- Status: **Disabled** (not visible to users)
- Bidding: **Disabled**
- Dates: **Not set**

You must:
1. Select cars
2. Set bidding dates
3. Enable bidding
4. Cars become "Active"

## Bulk Import Tips

### Small Batches (Recommended)
- Import 50-100 cars at a time
- Easier to verify
- Faster processing
- Better error handling

### Large Imports
- System can handle 500+ cars
- May take longer to process
- Review errors carefully
- Consider splitting into batches

## Download Sample File

You can create a sample file with this data:

| Lot# | S# | Fleet # | Reg # | Current Location | Type / Model | Make | Chassis # | Color | Year | KM | Bid Price |
|------|----|---------|-------|------------------|--------------|------|-----------|-------|------|-------|-----------|
| LOT-001 | 1 | FL001 | ABC123 | Dubai | Camry | Toyota | CH123456789 | Red | 2020 | 45000 | 25000 |
| LOT-001 | 2 | FL002 | XYZ789 | Abu Dhabi | Accord | Honda | CH987654321 | Black | 2019 | 52000 | 23000 |
| LOT-001 | 3 | FL003 | DEF456 | Sharjah | X5 | BMW | CH456789123 | White | 2021 | 32000 | 45000 |

Save as `.xlsx` and use it as a template.

## Validation Rules

### On Import:
- ✅ At least one row with Lot# and Make
- ✅ Numbers are valid (no text in number fields)
- ✅ File is valid Excel format (.xlsx, .xls)
- ✅ Column headers present

### Warnings (Non-blocking):
- ⚠️ Missing optional fields (will be null)
- ⚠️ Duplicate registration numbers (allowed)
- ⚠️ Very old years (< 1990)
- ⚠️ Very high mileage (> 500000)

## Troubleshooting

### "Failed to process file"
- Check file is .xlsx or .xls format
- Open in Excel to verify it's not corrupted
- Try exporting/saving again

### "Missing required column"
- Check column names are exactly "Lot#" and "Make"
- Remove extra spaces in headers
- Ensure headers are in first row

### "Row X failed to import"
- Check that row has Lot# and Make values
- Verify numbers don't have commas or symbols
- Check for special characters

### "No rows imported"
- Verify file has data (not just headers)
- Check first row is headers, data starts row 2
- Ensure at least one Lot# and Make value exists

## Best Practices

1. **Consistent Formatting**
   - Use same format for all reg numbers
   - Consistent location names
   - Standard make/model format

2. **Complete Data**
   - Fill in all available fields
   - More data = better for users
   - Easier to search and filter

3. **Verify Before Import**
   - Check sample in Excel
   - Verify calculations
   - Review for errors

4. **After Import**
   - Review imported cars
   - Fix any errors
   - Set up bidding dates
   - Enable for users

## Excel Template

Copy this into Excel:

```
Lot#	S#	Fleet #	Reg #	Current Location	Type / Model	Make	Chassis #	Color	Year	KM	Bid Price
LOT-001	1	FL001	ABC123	Dubai	Camry	Toyota	CH123456789	Red	2020	45000	25000
LOT-001	2	FL002	XYZ789	Abu Dhabi	Accord	Honda	CH987654321	Black	2019	52000	23000
LOT-001	3	FL003	DEF456	Sharjah	X5	BMW	CH456789123	White	2021	32000	45000
```

Replace with your data and save as .xlsx

---

**Ready to import? Head to Admin Dashboard → Import Excel!** 📊

*For more help, see ADMIN_QUICK_START.md*
