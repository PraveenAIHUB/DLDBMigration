# Diamond Lease UI Theme Implementation

This document outlines the Diamond Lease theme implementation across the application.

## Color Scheme

### Primary Colors
- **Primary Red**: `#D50000` - Used for headers, navigation, and primary CTAs
- **Primary Red Hover**: `#B80000` - Darker shade for hover states
- **Secondary Grey**: `#333333` - Dark grey for primary text
- **Secondary Grey Light**: `#777777` - Lighter grey for secondary text
- **Accent Yellow**: `#FFB800` - Warm yellow/gold accent color
- **Accent Yellow Hover**: `#E6A500` - Darker shade for hover states

### Background Colors
- **White**: `#FFFFFF` - Main background
- **Light Grey**: `#F5F5F5` - Secondary background
- **Alt Grey**: `#F9F9F9` - Alternate background for table rows

### Border Colors
- **Medium Grey**: `#E0E0E0` - Borders and subtle lines
- **Light Grey**: `#DDD` - Lighter borders for tables

## Typography

### Font Families
- **Heading Font**: Poppins, Montserrat, Arial, Helvetica, sans-serif
- **Body Font**: Same as heading for consistency

### Size Hierarchy
- **H1**: 48px, weight 700, line-height 1.2
- **H2**: 36px, weight 600, line-height 1.3
- **H3**: 24px, weight 500, line-height 1.4
- **Body**: 16px, weight 400, line-height 1.5
- **Small/Caption**: 14px, weight 400, line-height 1.5

### Font Colors
- **Primary Text**: `#333333`
- **Secondary Text**: `#777777`

## Layout Patterns

### Grid System
- 12-column layout for desktop
- Cards span 3-4 columns
- Collapse to 1 column on mobile

### Spacing
- **Section Padding**: 60px top/bottom
- **Card Gap**: 24px
- **Card Padding**: 24px

### Responsive Breakpoints
- Mobile: < 640px
- Tablet: 640px - 1024px
- Desktop: > 1024px

## Component Styles

### Buttons

#### Primary Button
```css
.btn-primary {
  background: #D50000;
  color: white;
  padding: 12px 24px;
  border-radius: 4px;
  font-weight: 600;
}
```
- Hover: `#B80000`
- Focus: Ring with offset

#### Secondary Button
```css
.btn-secondary {
  background: white;
  border: 2px solid #D50000;
  color: #D50000;
  padding: 12px 24px;
  border-radius: 4px;
  font-weight: 600;
}
```
- Hover: Invert colors (red background, white text)

### Forms / Inputs

```css
.input-dl {
  background: #F5F5F5;
  border: 1px solid #E0E0E0;
  padding: 12px;
  border-radius: 4px;
}
```
- Focus: Border color changes to `#D50000`
- Labels: Above fields with 8px margin-bottom

### Cards

```css
.card-dl {
  background: white;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  padding: 24px;
}
```

### Modals / Overlays

```css
.modal-backdrop {
  background: rgba(0, 0, 0, 0.5);
}

.modal-dl {
  background: white;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  border-radius: 6px;
  padding: 24px;
}
```

### Tables

```css
.table-dl thead {
  background: #E0E0E0;
}

.table-dl thead th {
  font-weight: 500;
  padding: 12px;
}

.table-dl tbody tr:nth-child(even) {
  background: #F9F9F9;
}

.table-dl tbody tr:nth-child(odd) {
  background: white;
}

.table-dl tbody td {
  padding: 12px;
  border: 1px solid #DDD;
}
```

## Visual Elements

### Icons
- Flat style, stroke or minimal solid
- Size: ~24px
- Color: `#D50000` or `#333333` depending on context

### Shadows
- Subtle box-shadow: `0 4px 12px rgba(0, 0, 0, 0.1)` for cards/modals
- Larger shadow: `0 8px 24px rgba(0, 0, 0, 0.15)` for elevated elements

### Borders & Corners
- Border radius: 6px on cards/buttons
- Borders: Subtle `#E0E0E0`

### Accent Highlights
- Use accent yellow (`#FFB800`) for highlight bars/dividers or call-outs
- Class: `.accent-bar` - 4px height yellow bar

## CSS Variables

All theme colors are defined as CSS variables in `src/index.css`:

```css
:root {
  --primary-red: #D50000;
  --primary-red-hover: #B80000;
  --secondary-grey: #333333;
  --secondary-grey-light: #777777;
  --accent-yellow: #FFB800;
  --accent-yellow-hover: #E6A500;
  --bg-white: #FFFFFF;
  --bg-light-grey: #F5F5F5;
  --bg-alt-grey: #F9F9F9;
  --border-grey: #E0E0E0;
  --border-light: #DDD;
}
```

## Tailwind Classes

The theme is integrated with Tailwind CSS. Use these classes:

### Colors
- `bg-dl-red` - Primary red background
- `bg-dl-red-hover` - Red hover state
- `text-dl-grey` - Primary grey text
- `text-dl-grey-light` - Light grey text
- `bg-dl-grey-bg` - Light grey background
- `bg-dl-grey-bg-alt` - Alternate grey background
- `border-dl-grey-medium` - Medium grey border
- `bg-dl-yellow` - Accent yellow background

### Typography
- `text-h1`, `text-h2`, `text-h3` - Heading sizes
- `text-body` - Body text size
- `text-small` - Small/caption text

### Components
- `btn-primary` - Primary button style
- `btn-secondary` - Secondary button style
- `input-dl` - Input field style
- `card-dl` - Card container style
- `modal-dl` - Modal container style
- `table-dl` - Table styling
- `section-padding` - Section spacing (60px top/bottom)

## Implementation Status

✅ **Completed:**
- Tailwind config with Diamond Lease colors
- CSS variables defined
- Base typography styles
- Button component classes
- Input component classes
- Card component classes
- Modal component classes
- Table component classes
- Logo updated to use Diamond Lease red
- AdminLogin component updated

🔄 **In Progress:**
- Updating remaining components to use new theme classes

## Usage Examples

### Button
```tsx
<button className="btn-primary">Click Me</button>
<button className="btn-secondary">Cancel</button>
```

### Input
```tsx
<input type="text" className="input-dl" placeholder="Enter text..." />
```

### Card
```tsx
<div className="card-dl">
  <h3 className="text-h3">Card Title</h3>
  <p className="text-body">Card content...</p>
</div>
```

### Table
```tsx
<table className="table-dl">
  <thead>
    <tr>
      <th>Header</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Data</td>
    </tr>
  </tbody>
</table>
```

## Next Steps

1. Update all remaining components to use Diamond Lease theme classes
2. Ensure consistent spacing using `section-padding` class
3. Apply accent yellow highlights where appropriate
4. Test responsive design across all breakpoints
5. Verify color contrast for accessibility

