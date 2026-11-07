### Installation

```bash
git clone <your-repository-url>
cd fashion-store
cp .env.example .env 
npm install
```

### Set for BETTER_AUTH_SECRET

```bash
# openssl
openssl rand -base64 32

# No openssl (for example Windows without WSL)? Use Node.js instead:
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Running the App

```bash
# PostgreSQL + Mailpit
npm run db:up                   

# create the tables
npm run db:deploy 

# roles, permissions, settings, sample products
npm run db:seed

# http://localhost:3000
npm run dev 
```

### Type Checking

```bash
npm run typecheck
npm run lint
```