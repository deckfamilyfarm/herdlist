# Herd Management System

A comprehensive livestock management application for dairy and beef cattle operations. Track breeding records, animal locations, movements, vaccinations, health events, calving history, and slaughter records.

## Features

- 🐄 **Animal Management**: Track individual animals with tag numbers, breeding info, and lineage
- 📍 **Location Tracking**: Manage properties and fields, track animal movements
- 💉 **Health Records**: Vaccination schedules, events, and health monitoring
- 📊 **Reporting**: Dashboard analytics, slaughter reports, breeding data
- 📥 **CSV Import**: Bulk import animals, properties, vaccinations, and more
- 🔐 **Authentication**: Secure email/password login with admin/user roles
- 🌙 **Dark Mode**: Theme toggle for comfortable viewing

## Technology Stack

**Frontend:**
- React 18 with TypeScript
- Vite for build tooling
- TanStack Query for data fetching
- Wouter for routing
- shadcn/ui components (Radix UI + Tailwind CSS)
- Recharts for data visualization

**Backend:**
- Node.js with Express
- TypeScript
- Drizzle ORM
- MySQL 8.0+ database
- Passport.js for authentication
- bcrypt for password hashing

## Quick Start

### Prerequisites

- Node.js 18+ 
- MySQL 8.0+
- npm or yarn

### 1. Clone Repository

```bash
git clone https://github.com/yourusername/herdlist.git
cd herdlist
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Database Setup

Create a MySQL database and import the schema:

```bash
mysql -u root -p
CREATE DATABASE herdlist CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
exit

mysql -u root -p herdlist < database-schema.sql
```

### 4. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your database credentials:

```env
DATABASE_URL=mysql://root:password@localhost:3306/herdlist
SESSION_SECRET=your-random-secret-here
NODE_ENV=development
PORT=5000
```

Generate a secure session secret:

```bash
openssl rand -base64 32
```

### 5. Create Admin User

```bash
node -e "const bcrypt = require('bcrypt'); bcrypt.hash('admin123', 10).then(hash => console.log(hash));"
```

Then insert into database:

```sql
INSERT INTO users (id, email, password_hash, first_name, last_name, is_admin)
VALUES (UUID(), 'admin@example.com', 'YOUR_HASH_HERE', 'Admin', 'User', 'yes');
```

### 6. Start Development Server

```bash
npm run dev
```

Visit `http://localhost:5000` and log in with your admin credentials.

## Project Structure

```
herdlist/
├── client/                 # Frontend React application
│   └── src/
│       ├── components/     # Reusable UI components
│       ├── hooks/          # Custom React hooks
│       ├── lib/            # Utilities and configurations
│       └── pages/          # Page components
├── server/                 # Backend Express application
│   ├── auth.ts            # Authentication setup
│   ├── db.ts              # Database connection
│   ├── routes.ts          # API route definitions
│   ├── storage.ts         # Data access layer
│   └── index.ts           # Server entry point
├── shared/                 # Shared code between frontend/backend
│   └── schema.ts          # Database schema & types
├── migrations-mysql/       # Database migrations
├── database-schema.sql     # MySQL schema for import
└── DEPLOYMENT_MYSQL.md     # Deployment guide
```

## Available Scripts

```bash
# Development
npm run dev              # Start development server with HMR

# Build
npm run build            # Build for production

# Database
npm run db:generate      # Generate migration files
npm run db:migrate       # Run migrations
npm run db:push          # Push schema changes to database
npm run db:studio        # Open Drizzle Studio (database GUI)

# Production
npm start                # Start production server
```

## Default User Accounts

After database setup, create your first admin user (see Quick Start step 5).

**Security**: Change all default passwords immediately after first login.

## Database Schema

The application uses MySQL with the following main tables:

- **animals**: Animal records with breeding and lineage info
- **properties**: Farm properties and lease information
- **fields**: Field locations within properties
- **movements**: Historical animal movement records
- **vaccinations**: Vaccination records and schedules
- **events**: General animal health events
- **calving_records**: Birth records linking dams to calves
- **slaughter_records**: Processing and weight data
- **users**: User accounts and authentication
- **sessions**: Session storage for authentication

See `database-schema.sql` for complete schema definition.

## API Documentation

### Authentication Endpoints

- `POST /api/auth/signup` - Create new user account
- `POST /api/auth/login` - Log in with email/password
- `POST /api/auth/logout` - Log out current session
- `GET /api/auth/user` - Get current user info
- `POST /api/auth/change-password` - Change password
- `POST /api/auth/request-password-reset` - Request password reset
- `POST /api/auth/reset-password` - Reset password with token

### Animal Endpoints

- `GET /api/animals` - List all animals
- `GET /api/animals/:id` - Get animal by ID
- `POST /api/animals` - Create new animal
- `PATCH /api/animals/:id` - Update animal
- `DELETE /api/animals/:id` - Delete animal
- `GET /api/animals/:id/offspring` - Get animal's offspring

### Other Resources

Similar CRUD endpoints available for:
- Properties (`/api/properties`)
- Fields (`/api/fields`)
- Movements (`/api/movements`)
- Vaccinations (`/api/vaccinations`)
- Events (`/api/events`)
- Calving Records (`/api/calving-records`)
- Slaughter Records (`/api/slaughter-records`)

### CSV Import Endpoints

- `POST /api/import/animals` - Import animals from CSV
- `POST /api/import/properties` - Import properties from CSV
- `POST /api/import/fields` - Import fields from CSV
- `POST /api/import/vaccinations` - Import vaccinations from CSV
- `POST /api/import/events` - Import events from CSV
- `POST /api/import/calving-records` - Import calving records from CSV
- `POST /api/import/slaughter-records` - Import slaughter records from CSV

## Deployment

See [DEPLOYMENT_MYSQL.md](./DEPLOYMENT_MYSQL.md) for comprehensive deployment instructions including:

- Production deployment options (VPS, cloud providers)
- MySQL hosting recommendations
- Frontend/backend separation strategies
- SSL/TLS configuration
- Backup and monitoring setup
- Performance optimization tips

## Branch Strategy

### For Separate Frontend/Backend Development

Create independent branches for frontend and backend:

```bash
# Create frontend-only branch
git subtree split --prefix=client -b frontend
git push origin frontend

# Create backend-only branch
git subtree split --prefix=server -b backend
git subtree split --prefix=shared -b backend-shared
git push origin backend
```

Then team members can clone specific branches:

```bash
# Frontend developers
git clone -b frontend https://github.com/yourusername/herdlist.git

# Backend developers
git clone -b backend https://github.com/yourusername/herdlist.git
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | MySQL connection string | Yes |
| `SESSION_SECRET` | Secret for session encryption | Yes |
| `NODE_ENV` | Environment mode (`development`/`production`) | Yes |
| `PORT` | Server port (default: 5000) | No |

## Security Features

- ✅ Password hashing with bcrypt (10 rounds)
- ✅ Session management with MySQL store
- ✅ CSRF protection via sameSite cookies
- ✅ Password reset tokens (hashed, single-use, expires in 1 hour)
- ✅ Admin/user role separation
- ✅ Secure session cookies (httpOnly, secure in production)
- ✅ SQL injection protection via Drizzle ORM

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.

## Support

For deployment assistance, see [DEPLOYMENT_MYSQL.md](./DEPLOYMENT_MYSQL.md).

For bug reports or feature requests, please open an issue on GitHub.

## Changelog

### Version 2.0 (Current)
- ✅ Migrated from PostgreSQL to MySQL
- ✅ Replaced Replit OAuth with email/password authentication
- ✅ Added password reset functionality
- ✅ Enhanced security with token hashing and CSRF protection
- ✅ Portable deployment ready for any hosting provider
- ✅ Comprehensive deployment documentation

### Version 1.0
- Initial release with PostgreSQL and Replit Auth
- Core herd management features
- Dashboard analytics
- CSV import/export functionality
