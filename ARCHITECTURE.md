# Herdlist - Code Architecture

## Backend Code Structure

### Server Entry Point (`server/index.ts`)
```typescript
// Main server setup
- Initializes Express app
- Connects to PostgreSQL database
- Sets up Drizzle ORM
- Registers all routes
- Starts server on port 5000
```

### API Routes (`server/routes.ts`)
```typescript
// All your API endpoints:

Authentication:
- GET  /api/auth/user - Get current user
- GET  /api/login - Start OAuth flow
- GET  /api/callback - OAuth callback
- GET  /api/logout - Sign out

Admin:
- GET  /api/admin/users - List all users
- GET  /api/admin/whitelist - List authorized emails
- POST /api/admin/whitelist - Add email to whitelist
- DELETE /api/admin/whitelist/:id - Remove email
- PATCH /api/admin/users/:id - Update user admin status

Animals:
- GET  /api/animals - List all animals
- GET  /api/animals/:id - Get single animal
- POST /api/animals - Create animal
- PATCH /api/animals/:id - Update animal
- DELETE /api/animals/:id - Delete animal

Properties:
- GET  /api/properties - List all properties
- POST /api/properties - Create property
- PATCH /api/properties/:id - Update property
- DELETE /api/properties/:id - Delete property

Fields:
- GET  /api/fields - List all fields
- POST /api/fields - Create field
- PATCH /api/fields/:id - Update field
- DELETE /api/fields/:id - Delete field

Movements:
- GET  /api/movements - List all movements
- GET  /api/movements/animal/:animalId - Get animal's movement history
- POST /api/movements - Create movement
- DELETE /api/movements/:id - Delete movement

Vaccinations:
- GET  /api/vaccinations - List all vaccinations
- GET  /api/vaccinations/animal/:animalId - Get animal's vaccinations
- POST /api/vaccinations - Create vaccination
- PATCH /api/vaccinations/:id - Update vaccination
- DELETE /api/vaccinations/:id - Delete vaccination

Events:
- GET  /api/events - List all events
- GET  /api/events/animal/:animalId - Get animal's events
- POST /api/events - Create event
- PATCH /api/events/:id - Update event
- DELETE /api/events/:id - Delete event

Calving Records:
- GET  /api/calving-records - List all calving records
- GET  /api/calving-records/dam/:damId - Get dam's calving history
- POST /api/calving-records - Create calving record
- DELETE /api/calving-records/:id - Delete calving record

Slaughter Records:
- GET  /api/slaughter-records - List all slaughter records
- POST /api/slaughter-records - Create slaughter record
- DELETE /api/slaughter-records/:id - Delete slaughter record

CSV Import:
- POST /api/import/animals - Bulk import animals
- POST /api/import/properties - Bulk import properties
- POST /api/import/fields - Bulk import fields
- POST /api/import/vaccinations - Bulk import vaccinations
- POST /api/import/events - Bulk import events
- POST /api/import/calving-records - Bulk import calving records
- POST /api/import/slaughter-records - Bulk import slaughter records

Reports:
- GET  /api/reports/herd-composition - Get herd composition stats
- GET  /api/reports/properties-summary - Get properties summary
```

### Database Layer (`server/storage.ts`)
```typescript
// All database operations using Drizzle ORM:

interface IStorage {
  // User Management
  upsertUser(data) - Create/update user
  getUser(id) - Get user by ID
  getAllUsers() - List all users
  updateUserAdminStatus(id, isAdmin) - Set admin flag
  
  // Email Whitelist
  isEmailWhitelisted(email) - Check if email is authorized
  getAllWhitelistedEmails() - List whitelist
  addEmailToWhitelist(email, addedBy) - Add email
  removeEmailFromWhitelist(id) - Remove email
  
  // Animals CRUD
  createAnimal(data) - Create new animal
  getAllAnimals() - List all animals
  getAnimal(id) - Get single animal
  updateAnimal(id, data) - Update animal
  deleteAnimal(id) - Delete animal
  getAnimalByTag(tagNumber) - Find by tag number
  
  // Properties, Fields, Movements, etc.
  // (Similar pattern for all entities)
  
  // CSV Import Helpers
  getAnimalByTagNumber(tag) - Find animal for import
  getPropertyByName(name) - Find property for import
  getFieldByName(name, propertyId) - Find field for import
}
```

### Authentication (`server/replitAuth.ts`)
```typescript
// Replit OpenID Connect with Google Sign-In:

- setupAuth(app) - Configure Passport.js with Replit OAuth
- isAuthenticated - Middleware to require login
- isAdmin - Middleware to require admin access

Flow:
1. User clicks "Sign in with Google"
2. Redirects to Replit OAuth → Google
3. User approves
4. Callback validates email whitelist
5. Creates session in PostgreSQL
6. Redirects to app
```

### Database Schema (`shared/schema.ts`)
```typescript
// All database tables and types:

Tables:
- animals (tag_number, type, sex, organic, herd_name, etc.)
- properties (name, is_leased, lease_dates, etc.)
- fields (name, property_id, capacity, etc.)
- movements (animal_id, field_id, date, etc.)
- vaccinations (animal_id, vaccine, date, due_date, etc.)
- events (animal_id, type, date, notes, etc.)
- calving_records (dam_id, calf_id, date, etc.)
- slaughter_records (animal_id, date, weight, processor, etc.)
- users (id, email, first_name, last_name, is_admin, etc.)
- sessions (sid, sess, expire)
- email_whitelist (id, email, added_by, created_at)

Enums:
- herdNameEnum: "wet" | "nurse" | "finish" | "main" | "grafting" | "yearlings"

Zod Schemas:
- insertAnimalSchema - Validation for creating animals
- csvAnimalSchema - Validation for CSV import
- (Similar for all entities)

TypeScript Types:
- InsertAnimal - Type for creating animals
- Animal - Type for database records
- (Similar for all entities)
```

## Frontend Code Structure

### Main App (`client/src/App.tsx`)
```tsx
// Application shell with routing:

<SidebarProvider>
  <AppSidebar />  // Navigation menu
  <Header>
    <SidebarTrigger />
    <ThemeToggle />
  </Header>
  <main>
    <Routes>
      <Route path="/" component={Animals} />
      <Route path="/properties" component={Properties} />
      <Route path="/fields" component={Fields} />
      <Route path="/movements" component={Movements} />
      <Route path="/health" component={Health} />
      <Route path="/breeding" component={Breeding} />
      <Route path="/slaughter" component={Slaughter} />
      <Route path="/reports" component={Reports} />
      <Route path="/import" component={Import} />
      <Route path="/admin" component={Admin} />
    </Routes>
  </main>
</SidebarProvider>
```

### Page Components (`client/src/pages/`)
```typescript
// Main pages:

Animals.tsx - Main animal list and management
Properties.tsx - Property management
Fields.tsx - Field management  
Movements.tsx - Movement tracking
Health.tsx - Vaccination and event tracking
Breeding.tsx - Calving records
Slaughter.tsx - Slaughter records
Reports.tsx - Herd composition and statistics
Import.tsx - CSV import wizard
Admin.tsx - User and whitelist management
```

### Key Components (`client/src/components/`)
```typescript
// Reusable components:

AnimalFormDialog.tsx - Create/edit animal form
AnimalDetailDialog.tsx - View animal details with tabs
PropertyFormDialog.tsx - Create/edit property form
FieldFormDialog.tsx - Create/edit field form
MovementFormDialog.tsx - Create/edit movement form
VaccinationFormDialog.tsx - Create/edit vaccination form
EventFormDialog.tsx - Create/edit event form
CalvingRecordFormDialog.tsx - Create/edit calving record
SlaughterRecordFormDialog.tsx - Create/edit slaughter record
ImportWizard.tsx - Multi-step CSV import
ThemeProvider.tsx - Dark/light mode
AppSidebar.tsx - Navigation sidebar

UI Components (client/src/components/ui/):
- Shadcn components (Button, Dialog, Form, Select, etc.)
```

### API Client (`client/src/lib/queryClient.ts`)
```typescript
// TanStack Query setup:

queryClient - Global query client with:
  - staleTime: Infinity (aggressive caching)
  - Retry logic
  - Error handling

apiRequest(url, options) - Fetch wrapper for API calls:
  - Handles authentication
  - Adds credentials
  - Parses JSON responses
  - Throws on errors

Usage in components:
- useQuery({ queryKey: ['/api/animals'] }) - Fetch data
- useMutation({ mutationFn: (data) => apiRequest('/api/animals', { method: 'POST', body: data }) })
```

### Styling
```
Tailwind CSS Configuration:
- Custom theme in index.css
- Dark mode support
- Shadcn component styles
- Custom elevation utilities (hover-elevate, active-elevate-2)

Design Tokens:
- Primary: Blue (trust/reliability)
- Success: Green (healthy animals)
- Warning: Amber (alerts/breeding)
- Destructive: Red (errors/deletions)
```

## Data Flow Example

### Creating an Animal:
```
1. User fills form in AnimalFormDialog
2. Form submits via useMutation
3. Frontend: apiRequest('/api/animals', { method: 'POST', body: animalData })
4. Backend: POST /api/animals route receives request
5. Validates with insertAnimalSchema (Zod)
6. Calls storage.createAnimal(validatedData)
7. Drizzle ORM inserts into PostgreSQL
8. Returns created animal
9. Frontend invalidates cache: queryClient.invalidateQueries(['/api/animals'])
10. Animal list automatically refetches and updates
```

### CSV Import Flow:
```
1. User uploads CSV in ImportWizard
2. PapaParse parses CSV to JSON
3. Frontend validates each row with csvAnimalSchema
4. Sends to POST /api/import/animals
5. Backend:
   - Validates again with Zod
   - Looks up related entities (sire/dam by tag)
   - Bulk inserts animals
   - Returns success/error counts
6. Frontend shows results and refreshes data
```

## Key Technologies

### Backend Stack:
- **Node.js 20+** - Runtime
- **Express.js** - Web framework
- **TypeScript** - Type safety
- **Drizzle ORM** - Database queries
- **PostgreSQL** - Database
- **Passport.js** - Authentication
- **Zod** - Schema validation
- **PapaParse** - CSV parsing

### Frontend Stack:
- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Wouter** - Routing
- **TanStack Query** - Server state
- **Shadcn/ui** - Component library
- **Radix UI** - Accessible primitives
- **Tailwind CSS** - Styling
- **Lucide React** - Icons

### Development:
- **tsx** - TypeScript execution
- **esbuild** - Production builds
- **Drizzle Kit** - Database migrations
