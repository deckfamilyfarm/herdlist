# Branch Strategy Guide

This guide explains how to create and manage separate branches for frontend and backend development.

## Repository Structure

The main repository is a monorepo containing both frontend and backend code:

```
main (full stack)
├── client/          # Frontend code
├── server/          # Backend code
├── shared/          # Shared types and schemas
└── ...
```

## Creating Separate Branches

### Option 1: Subtree Split (Recommended for Clean Separation)

This creates completely independent branches with only the relevant code.

#### Create Frontend Branch

```bash
# Create a branch with only client/ directory contents
git subtree split --prefix=client -b frontend

# Push to remote
git push origin frontend
```

#### Create Backend Branch

```bash
# Create a branch with only server/ directory contents
git subtree split --prefix=server -b backend

# Push to remote
git push origin backend
```

**Note**: The `shared/` directory needs to be handled separately. You can either:

1. Include it in both branches manually
2. Keep it in the main branch and import via npm package
3. Duplicate it in both branches (copy `shared/schema.ts` to each)

#### Create Shared Types Branch (Optional)

```bash
# Create a branch with shared types
git subtree split --prefix=shared -b shared-types
git push origin shared-types
```

### Option 2: Filter-Branch (For Historical Separation)

This preserves git history for each component.

```bash
# Create frontend branch with history
git clone https://github.com/yourusername/herdlist.git herdlist-frontend
cd herdlist-frontend
git filter-branch --subdirectory-filter client -- --all
git remote add frontend https://github.com/yourusername/herdlist-frontend.git
git push -u frontend main

# Create backend branch with history
cd ..
git clone https://github.com/yourusername/herdlist.git herdlist-backend
cd herdlist-backend
git filter-branch --subdirectory-filter server -- --all
git remote add backend https://github.com/yourusername/herdlist-backend.git
git push -u backend main
```

### Option 3: Manual Branch Creation (Simple Approach)

Create branches that still reference the full repo but with clear separation:

```bash
# Create and checkout frontend branch
git checkout -b frontend-only
# Commit a README explaining this is frontend-focused
echo "# Frontend Only Branch" > BRANCH_README.md
git add BRANCH_README.md
git commit -m "Frontend branch marker"
git push origin frontend-only

# Back to main and create backend branch
git checkout main
git checkout -b backend-only
echo "# Backend Only Branch" > BRANCH_README.md
git add BRANCH_README.md
git commit -m "Backend branch marker"
git push origin backend-only
```

## Development Workflows

### Workflow 1: Separate Repositories

**Best for**: Large teams, independent deployment schedules

```bash
# Frontend repo
git clone https://github.com/yourusername/herdlist-frontend.git
cd herdlist-frontend
npm install
npm run dev

# Backend repo (separate terminal)
git clone https://github.com/yourusername/herdlist-backend.git
cd herdlist-backend
npm install
npm start
```

### Workflow 2: Single Repo, Multiple Branches

**Best for**: Small teams, coordinated releases

```bash
# Full stack development (main branch)
git clone https://github.com/yourusername/herdlist.git
git checkout main
npm install
npm run dev

# Frontend-only development
git checkout frontend-only
cd client
npm install
npm run dev

# Backend-only development
git checkout backend-only
cd server
npm install
npm start
```

### Workflow 3: Monorepo with Workspaces

**Best for**: Shared dependencies, coordinated versioning

Keep the monorepo structure but use npm workspaces:

Update `package.json`:

```json
{
  "name": "herdlist",
  "workspaces": [
    "client",
    "server",
    "shared"
  ]
}
```

Then:

```bash
npm install                    # Installs all workspace dependencies
npm run dev --workspace=client # Run client only
npm run start --workspace=server # Run server only
```

## Handling Shared Code

### Option 1: Duplicate in Both Branches

Copy `shared/schema.ts` to both frontend and backend branches:

```bash
# In frontend branch
mkdir src/types
cp ../shared/schema.ts src/types/

# In backend branch
mkdir types
cp ../shared/schema.ts types/
```

### Option 2: Publish as npm Package

Create a separate package for shared types:

```bash
# In shared/ directory
npm init -y
# Update package.json name to @yourorg/herdlist-types
npm publish

# Then install in both frontend and backend
npm install @yourorg/herdlist-types
```

### Option 3: Git Submodules

Keep shared code in a submodule:

```bash
# Create shared types repo
git clone https://github.com/yourusername/herdlist.git herdlist-shared
cd herdlist-shared
git filter-branch --subdirectory-filter shared -- --all
git remote add shared https://github.com/yourusername/herdlist-shared.git
git push -u shared main

# Add as submodule in frontend
cd herdlist-frontend
git submodule add https://github.com/yourusername/herdlist-shared.git shared

# Add as submodule in backend
cd herdlist-backend
git submodule add https://github.com/yourusername/herdlist-shared.git shared
```

## Deployment Strategies by Branch Type

### Separate Repositories (frontend + backend)

**Frontend Deploy:**
```bash
# Netlify
netlify deploy --dir=dist/public --prod

# Vercel
vercel --prod

# AWS S3
aws s3 sync dist/public s3://your-bucket --delete
```

**Backend Deploy:**
```bash
# PM2 on VPS
pm2 start dist/index.js --name herdlist

# Docker
docker build -t herdlist-backend .
docker run -p 5000:5000 herdlist-backend

# AWS Elastic Beanstalk
eb deploy
```

### Monorepo (single repo)

```bash
# Build both
npm run build

# Deploy frontend to Netlify
netlify deploy --dir=dist/public --prod

# Deploy backend to VPS
scp -r dist/ server/  user@yourserver:/var/www/herdlist/
ssh user@yourserver "pm2 restart herdlist"
```

## Continuous Integration Examples

### GitHub Actions - Separate Repos

**Frontend (.github/workflows/frontend.yml):**
```yaml
name: Frontend CI/CD
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run build
      - uses: netlify/actions/cli@master
        with:
          args: deploy --prod
        env:
          NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
```

**Backend (.github/workflows/backend.yml):**
```yaml
name: Backend CI/CD
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run build
      - name: Deploy to VPS
        uses: appleboy/scp-action@master
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SSH_KEY }}
          source: "dist/"
          target: "/var/www/herdlist"
```

### GitHub Actions - Monorepo

```yaml
name: Monorepo CI/CD
on:
  push:
    branches: [main]
jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run build
      
      # Deploy frontend
      - name: Deploy Frontend
        uses: netlify/actions/cli@master
        with:
          args: deploy --dir=dist/public --prod
        env:
          NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
      
      # Deploy backend
      - name: Deploy Backend
        uses: appleboy/scp-action@master
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SSH_KEY }}
          source: "dist/index.js,server/"
          target: "/var/www/herdlist"
```

## Merging Changes Between Branches

### From Main to Feature Branches

```bash
# Update frontend branch with main changes
git checkout frontend
git merge main
# Resolve conflicts, keeping only client/ changes

# Update backend branch with main changes
git checkout backend
git merge main
# Resolve conflicts, keeping only server/ changes
```

### From Feature Branches to Main

```bash
# Merge frontend changes to main
git checkout main
git merge frontend --no-commit
# Review changes, ensure only client/ affected
git commit -m "Merge frontend updates"

# Merge backend changes to main
git checkout main
git merge backend --no-commit
# Review changes, ensure only server/ affected
git commit -m "Merge backend updates"
```

## Best Practices

1. **Choose One Strategy**: Pick one approach and stick with it for consistency
2. **Document Your Choice**: Add a section to README explaining your branch structure
3. **Automate Deployment**: Use CI/CD to deploy from specific branches
4. **Version Coordination**: Keep frontend and backend version numbers in sync
5. **API Compatibility**: Maintain backward compatibility when updating APIs
6. **Shared Types**: Keep shared types in sync across branches
7. **Testing**: Test integration between frontend and backend regularly

## Recommended Approach

For this project, we recommend:

**For small teams (1-3 developers):**
- Keep monorepo structure (main branch)
- Use GitHub Actions to deploy both together
- Simplest to maintain, easiest coordination

**For medium teams (4-10 developers):**
- Use Option 3 (manual branches) with clear branch markers
- Deploy frontend and backend independently
- Balance between simplicity and separation

**For large teams (10+ developers):**
- Use Option 1 (subtree split) with separate repositories
- Publish shared types as npm package
- Full independence for each team

## Migration Checklist

When setting up separate branches:

- [ ] Decide on branch strategy (subtree, filter-branch, or manual)
- [ ] Create branches according to chosen strategy
- [ ] Update package.json in each branch as needed
- [ ] Handle shared code (duplicate, npm package, or submodule)
- [ ] Update CI/CD pipelines
- [ ] Update README in each branch explaining structure
- [ ] Test deployment from each branch independently
- [ ] Document merging strategy for team
- [ ] Set up branch protection rules on GitHub

## Support

For questions about branch strategy, see:
- README.md - General project overview
- DEPLOYMENT_MYSQL.md - Deployment instructions
- This file - Branch management
