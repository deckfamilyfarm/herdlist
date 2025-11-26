# Herd Management Software - Design Guidelines

## Design Approach: Carbon Design System

**Rationale**: Selected Carbon Design System for its excellence in data-heavy, enterprise applications. This agricultural management tool requires efficient data entry, complex table views, reporting capabilities, and hierarchical information display—all Carbon's strengths.

**Core Principles**:
- Clarity over decoration: Every element serves data comprehension
- Efficient workflows: Minimize clicks for common tasks
- Data accuracy: Clear visual feedback for all actions
- Scalability: Design supports growing herd sizes and property counts

---

## Color Palette

**Light Mode**:
- Primary: 220 70% 50% (Blue - trust and reliability)
- Background: 0 0% 98%
- Surface: 0 0% 100%
- Border: 220 20% 85%
- Text Primary: 220 15% 20%
- Text Secondary: 220 10% 45%
- Success: 140 60% 45% (healthy animals, completed tasks)
- Warning: 35 95% 55% (alerts, breeding cycles)
- Error: 0 75% 55%

**Dark Mode**:
- Primary: 220 70% 60%
- Background: 220 15% 10%
- Surface: 220 12% 14%
- Border: 220 15% 25%
- Text Primary: 0 0% 95%
- Text Secondary: 220 5% 65%

**Accent** (use sparingly): 160 55% 45% (teal for active states, highlighting)

---

## Typography

**Families**:
- Primary: 'Inter' (body text, UI elements, data tables)
- Monospace: 'JetBrains Mono' (IDs, technical data, weights/measurements)

**Hierarchy**:
- Page Headers: 600 weight, 28px/2xl
- Section Headers: 600 weight, 20px/xl
- Data Labels: 500 weight, 14px/sm
- Body Text: 400 weight, 16px/base
- Table Data: 400 weight, 14px/sm
- Captions/Meta: 400 weight, 12px/xs

---

## Layout System

**Spacing Primitives**: Use Tailwind units of 2, 4, 6, 8, 12, 16
- Component padding: p-4 or p-6
- Section spacing: mb-8 or mb-12
- Card gaps: gap-6
- Form field spacing: space-y-4
- Table cell padding: px-4 py-2

**Grid Structure**:
- Dashboard: 12-column grid with sidebar (64px collapsed, 240px expanded)
- Data tables: Full-width with horizontal scroll on mobile
- Forms: 2-column on desktop (lg:grid-cols-2), single column mobile
- Cards: grid-cols-1 md:grid-cols-2 lg:grid-cols-3 for overview metrics

---

## Component Library

**Navigation**:
- Collapsible sidebar with icon-only compact mode
- Top bar: breadcrumbs, search, user profile, notifications
- Active states: Left border accent (4px) + background tint

**Data Display**:
- Tables: Striped rows, sortable headers, inline actions, sticky headers for long lists
- Cards: Elevated surface (shadow-sm), hover lift (shadow-md transition)
- Metrics Dashboard: Large number displays with trend indicators (↑↓)
- Timeline: Vertical for animal movement history with date markers

**Forms**:
- Input groups with clear labels above fields
- Dropdown selects for breeding methods, animal types, field selection
- Date pickers for breeding dates, movement logs
- Multi-select for batch operations
- Validation: Inline error messages below fields, red border on error state
- All inputs maintain consistent dark mode styling with proper contrast

**Action Elements**:
- Primary buttons: Solid fill, medium weight, rounded corners (rounded-md)
- Secondary: Outline variant with border
- Icon buttons: Square 40px touch target, icon-only for tables
- Floating action button for "Add Animal" (bottom-right, lg+ screens only)

**Data Visualization**:
- Bar charts for herd composition by type/location
- Line graphs for weight tracking over time
- Pie charts for breeding method distribution
- Heat maps for field utilization

**Modals & Overlays**:
- Modal dialogs: Centered, max-w-2xl, backdrop blur
- Side panels: Right-sliding for animal details (480px width)
- Toast notifications: Top-right positioned, auto-dismiss

---

## Key Screens Layout

**Dashboard**:
- Top metrics row: Total animals, by type (dairy/beef), active breeding
- Main content: Recent movements table, upcoming tasks, alerts panel
- Quick actions: Add animal, move animals, view reports

**Animal List/Table**:
- Filters: Type, location, breeding status, date ranges
- Columns: ID, Name, Type, Current Location, Breeding Method, Parent Info, Actions
- Batch selection for multi-animal operations

**Animal Detail View**:
- Header: Photo placeholder, name, ID, key stats
- Tabbed sections: Overview, Breeding History, Offspring, Movement Log, Measurements
- Relationship tree visualization for lineage

**Location Management**:
- Property cards with field list
- Map view (future enhancement placeholder)
- Animal count per location, capacity indicators
- Lease agreement status badges

**Reports Interface**:
- Filter panel: Date ranges, animal types, properties
- Export options: PDF, CSV, Excel
- Preview panel with print-friendly styling

---

## Data Ingestion UI

**Import Wizard**:
- Step 1: File upload (CSV/Excel) with drag-drop zone
- Step 2: Column mapping interface with preview
- Step 3: Validation results with error highlighting
- Step 4: Confirmation summary before import
- Progress indicator throughout process

---

## Interaction Patterns

- **Hover states**: Subtle background color shift (5-10% opacity change)
- **Loading**: Skeleton screens for tables, spinner for actions
- **Empty states**: Helpful illustrations with clear CTAs
- **Confirmations**: Always confirm destructive actions (archive, delete)
- **Autosave**: Indicator for form autosave status

---

## Accessibility & Responsive

- Tables scroll horizontally on mobile with sticky first column
- Touch targets minimum 44px for mobile
- All form inputs and buttons maintain consistent styling in dark mode
- High contrast ratios: 4.5:1 for body text, 3:1 for large text
- Keyboard navigation throughout with visible focus indicators
- Screen reader labels for all interactive elements