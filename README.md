# KryptoneProtocol API

Solana-based authentication and escrow services API.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Copy environment variables:
```bash
cp .env.example .env
```

3. Generate encryption key:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Add the output to `ENCRYPTION_KEY_JS` in `.env`

4. Set a strong JWT secret in `.env`:
```
JWT_SECRET=your-strong-random-secret-here
```

5. Start the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

## API Documentation

See the Postman collection (`PrivacyEscrow.postman_collection.json`) for complete API documentation with example requests and responses.

## Project Structure

```
PrivacyEscrow/
├── api/
│   ├── api.js          # Main Express server
│   └── db_manager.js   # Database manager with encryption
├── data/               # SQLite database (created automatically)
├── package.json        # Dependencies and scripts
├── .env                # Environment variables (not in git)
└── README.md           # This file
```

## Security Notes

- All sensitive wallet data is encrypted using AES-256-GCM
- JWT tokens expire after 24 hours
- Signature verification ensures wallet ownership
- Never commit `.env` file to version control
