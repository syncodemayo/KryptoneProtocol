### ShadowPay User Registration Flow (Current Version)

Since the protocol has evolved, the current onboarding (based on the official API spec) starts with **two key registration steps** for users/wallets to enable privacy features and pool deposits:

1. **Generate an API Key** (Required for authenticated API calls, like deposits).
2. **Register with ShadowID** (This is the core "user registration" – proves wallet ownership and enables anonymous identity for private payments).

After these, you can deposit to the privacy pool.

No traditional account signup; everything is tied to your Solana wallet.

#### Step 1: Generate API Key
- **Endpoint**: `POST https://shadow.radr.fun/shadowpay/v1/keys/new`
- **Purpose**: Creates an API key linked to your wallet for authentication on other endpoints (e.g., deposit/withdraw).
- **Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "wallet_address": "YOUR_SOLANA_WALLET_ADDRESS"  // Base58 string, e.g., "ABC123..."
  }
  ```
- **Example (JavaScript/fetch)**:
  ```javascript
  const response = await fetch('https://shadow.radr.fun/shadowpay/v1/keys/new', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      wallet_address: 'YOUR_WALLET_ADDRESS'
    })
  });
  const data = await response.json();
  console.log('Your API Key:', data.api_key);  // Save this securely!
  ```
- **Success Response**: JSON with your `api_key` (string). Use it in `X-API-Key` header for future calls.
- **Notes**: No signature needed here. Do this first.

#### Step 2: Register with ShadowID (Core User/Wallet Registration)
- **Endpoint**: `POST https://shadow.radr.fun/shadowpay/api/shadowid/auto-register`
- **Purpose**: Registers your wallet anonymously. Proves ownership via a signed message. Generates a "commitment" for ZK proofs (hides your sender identity in payments).
- **This is required for full privacy** (e.g., anonymous payments from the pool).
- **No X-API-Key needed** here (signature proves ownership).
- **Flow to Prepare the Request**:
  1. Create the message to sign: Typically `"ShadowPay Registration..."` or a specific string (exact message may be provided by SDK or docs; common is a fixed phrase including your wallet or timestamp for uniqueness).
  2. Sign the message with your wallet (client-side).
  3. Send the signature + message + wallet.

- **Example in Browser (with Phantom or Solana wallet adapter)**:
  ```javascript
  // Step 1: Connect wallet (assume window.solana is available)
  await window.solana.connect();
  const walletAddress = window.solana.publicKey.toBase58();

  // Step 2: Message to sign (use exact string; confirm via SDK if needed)
  const message = "ShadowPay Registration for anonymous payments";  // Or check client SDK for exact
  const encodedMessage = new TextEncoder().encode(message);

  // Step 3: Sign the message
  const signedMessage = await window.solana.signMessage(encodedMessage, 'utf8');
  const signature = Buffer.from(signedMessage.signature).toString('base64');  // Or base58 if required

  // Step 4: Send registration request
  const response = await fetch('https://shadow.radr.fun/shadowpay/api/shadowid/auto-register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      wallet_address: walletAddress,
      signature: signature,  // Base64 or base58 (test what API expects)
      message: message
    })
  });
  const data = await response.json();
  console.log('ShadowID Registration Success:', data);
  ```
- **Success Response**: Usually confirms registration and may return your ShadowID commitment or status.
- **Notes**:
  - Message must be exact to verify correctly.
  - If using the official client SDK (`shadowpay-client.js`), it handles message generation and signing automatically.
  - This step is **not deprecated** – it's essential in the current pool-based system.

#### Next Steps After Registration
- Use your API key for `POST /api/pool/deposit` (as we discussed before).
- Registration only needs to be done once per wallet.

Test Step 1 first (it's simple, no signing). If you get the API key, proceed to Step 2. Share any responses/errors, and we'll debug! This gets your user fully registered.