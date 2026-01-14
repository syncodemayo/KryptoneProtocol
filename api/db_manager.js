import Database from 'better-sqlite3';
import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';
import { mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_DB_PATH = dirname(__dirname) + '/data/wallets.db';

class DatabaseManager {
  constructor(dbPath = DEFAULT_DB_PATH) {
    this.dbPath = dbPath;
    // Ensure directory exists synchronously before database initialization
    this.ensureDirectory();
    this.initializeEncryption();
    this.initializeDatabase();
  }

  ensureDirectory() {
    const dir = dirname(this.dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  initializeEncryption() {
    if (!process.env.ENCRYPTION_KEY_JS) {
      throw new Error('ENCRYPTION_KEY_JS environment variable is required');
    }

    try {
      // Convert hex string to buffer
      this.encryptionKey = Buffer.from(process.env.ENCRYPTION_KEY_JS, 'hex');

      // Validate key length
      if (this.encryptionKey.length !== 32) {
        throw new Error('ENCRYPTION_KEY_JS must be a 64-character hex string (32 bytes)');
      }
    } catch (error) {
      throw new Error(`Invalid ENCRYPTION_KEY_JS: ${error.message}`);
    }

    // Generate a new IV for each encryption operation
    this.getNewIV = () => randomBytes(16);
  }

  initializeDatabase() {
    this.db = new Database(this.dbPath, { timeout: 7000 });

    // Create wallets table with Solana address and ShadowPay registration data
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS wallets (
        user_id INTEGER PRIMARY KEY,
        solana_address TEXT UNIQUE NOT NULL,
        encrypted_data TEXT NOT NULL,
        user_type TEXT,
        commitment TEXT,
        root TEXT,
        registered_with_shadowpay INTEGER DEFAULT 0,
        api_key TEXT,
        treasury_wallet TEXT,
        public_key TEXT,
        secret_key TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Prepare statements
    this.stmtStoreWallet = this.db.prepare(`
      INSERT INTO wallets (solana_address, encrypted_data)
      VALUES (?, ?)
      ON CONFLICT(solana_address) DO UPDATE SET
        encrypted_data = excluded.encrypted_data,
        updated_at = CURRENT_TIMESTAMP
    `);

    this.stmtGetWallet = this.db.prepare(
      'SELECT encrypted_data, user_type, commitment, root, registered_with_shadowpay, api_key, treasury_wallet, public_key, secret_key FROM wallets WHERE solana_address = ?'
    );

    this.stmtWalletExists = this.db.prepare('SELECT 1 FROM wallets WHERE solana_address = ?');

    this.stmtUpdateShadowPayRegistration = this.db.prepare(`
      UPDATE wallets SET
        user_type = ?,
        commitment = ?,
        root = ?,
        registered_with_shadowpay = 1,
        api_key = COALESCE(?, api_key),
        treasury_wallet = COALESCE(?, treasury_wallet),
        public_key = COALESCE(?, public_key),
        secret_key = COALESCE(?, secret_key),
        updated_at = CURRENT_TIMESTAMP
      WHERE solana_address = ?
    `);

    this.stmtIsRegisteredWithShadowPay = this.db.prepare(
      'SELECT registered_with_shadowpay FROM wallets WHERE solana_address = ?'
    );
  }

  encryptData(data) {
    const iv = this.getNewIV();
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const jsonData = JSON.stringify(data);
    let encryptedData = cipher.update(jsonData, 'utf8', 'hex');
    encryptedData += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    // Store IV and auth tag with the encrypted data
    return JSON.stringify({
      iv: iv.toString('hex'),
      encryptedData,
      authTag: authTag.toString('hex'),
    });
  }

  decryptData(encryptedJson) {
    const { iv, encryptedData, authTag } = JSON.parse(encryptedJson);
    const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey, Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));

    let decryptedData = decipher.update(encryptedData, 'hex', 'utf8');
    decryptedData += decipher.final('utf8');
    return JSON.parse(decryptedData);
  }

  storeWallet(solanaAddress, walletData) {
    try {
      const encryptedData = this.encryptData(walletData);
      this.stmtStoreWallet.run(solanaAddress, encryptedData);
      return true;
    } catch (error) {
      console.error('Error storing wallet:', error);
      return false;
    }
  }

  getWallet(solanaAddress) {
    const result = this.stmtGetWallet.get(solanaAddress);
    if (!result) {
      throw new Error('No wallet found for this user');
    }
    const walletData = this.decryptData(result.encrypted_data);
    
    // Include ShadowPay registration data
    // Note: secret_key is stored but never returned in API responses for security
    return {
      ...walletData,
      userType: result.user_type || null,
      commitment: result.commitment || null,
      root: result.root || null,
      registeredWithShadowPay: result.registered_with_shadowpay === 1,
      apiKey: result.api_key || null,
      treasuryWallet: result.treasury_wallet || null,
      publicKey: result.public_key || null,
      secretKey: result.secret_key || null, // Only for internal use, never in API responses
    };
  }

  walletExists(solanaAddress) {
    const result = this.stmtWalletExists.get(solanaAddress);
    return !!result;
  }

  updateShadowPayRegistration(solanaAddress, registrationData) {
    try {
      const { 
        userType, 
        commitment, 
        root, 
        apiKey, 
        treasuryWallet, 
        publicKey, 
        secretKey 
      } = registrationData;
      
      this.stmtUpdateShadowPayRegistration.run(
        userType,
        commitment,
        root,
        apiKey || null,
        treasuryWallet || null,
        publicKey || null,
        secretKey || null,
        solanaAddress
      );
      return true;
    } catch (error) {
      console.error('Error updating ShadowPay registration:', error);
      return false;
    }
  }

  isRegisteredWithShadowPay(solanaAddress) {
    try {
      const result = this.stmtIsRegisteredWithShadowPay.get(solanaAddress);
      return result ? result.registered_with_shadowpay === 1 : false;
    } catch (error) {
      console.error('Error checking ShadowPay registration:', error);
      return false;
    }
  }
}

export default DatabaseManager;
