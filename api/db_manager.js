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

    // Initialize admin master key for key escrow (lazy initialization)
    this.adminMasterKey = null;
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

    // ===== MESSAGING TABLES =====

    // Create conversations table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id TEXT UNIQUE NOT NULL,
        buyer_address TEXT NOT NULL,
        seller_address TEXT NOT NULL,
        last_message_at TIMESTAMP,
        last_message_text TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (buyer_address) REFERENCES wallets (solana_address),
        FOREIGN KEY (seller_address) REFERENCES wallets (solana_address)
      )
    `);

    // Create messages table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id TEXT NOT NULL,
        sender_address TEXT NOT NULL,
        recipient_address TEXT NOT NULL,
        message_text TEXT NOT NULL,
        encrypted_message TEXT,
        encryption_metadata TEXT,
        is_encrypted INTEGER DEFAULT 0,
        read_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sender_address) REFERENCES wallets (solana_address),
        FOREIGN KEY (recipient_address) REFERENCES wallets (solana_address)
      )
    `);

    // Create trades table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS trades (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trade_id TEXT UNIQUE NOT NULL,
        conversation_id TEXT,
        seller_address TEXT NOT NULL,
        buyer_address TEXT NOT NULL,
        item_name TEXT NOT NULL,
        description TEXT,
        price_sol TEXT NOT NULL,
        price_lamports INTEGER NOT NULL,
        status TEXT NOT NULL,
        deposit_tx_signature TEXT,
        deposit_confirmed_at TIMESTAMP,
        settle_tx_signature TEXT,
        settled_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (seller_address) REFERENCES wallets (solana_address),
        FOREIGN KEY (buyer_address) REFERENCES wallets (solana_address)
      )
    `);

    // Create user_encryption_keys table (for E2EE with key escrow)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS user_encryption_keys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        solana_address TEXT UNIQUE NOT NULL,
        public_key TEXT NOT NULL,
        encrypted_private_key TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (solana_address) REFERENCES wallets (solana_address)
      )
    `);

    // Create admin_access_log table (for audit trail)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS admin_access_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id TEXT NOT NULL,
        admin_address TEXT NOT NULL,
        access_reason TEXT,
        dispute_id TEXT,
        messages_decrypted INTEGER,
        accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes for messaging tables
    try {
      this.db.exec('CREATE INDEX IF NOT EXISTS idx_conversations_buyer ON conversations(buyer_address)');
      this.db.exec('CREATE INDEX IF NOT EXISTS idx_conversations_seller ON conversations(seller_address)');
      this.db.exec('CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id)');
      this.db.exec('CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_address)');
      this.db.exec('CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_address)');
      this.db.exec('CREATE INDEX IF NOT EXISTS idx_trades_buyer ON trades(buyer_address)');
      this.db.exec('CREATE INDEX IF NOT EXISTS idx_trades_seller ON trades(seller_address)');
      this.db.exec('CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status)');
      this.db.exec('CREATE INDEX IF NOT EXISTS idx_admin_access_conversation ON admin_access_log(conversation_id)');
    } catch (_error) {
      console.warn('Indexes already exist or error creating:', _error?.message);
    }
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
    const address = solanaAddress;
    console.log('solanaAddress', solanaAddress)
    const result = this.stmtGetWallet.get(address);
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

  getAllSellers() {
    try {
      console.log('Executing getAllSellers query...');
      const sellers = this.db.prepare("SELECT * FROM wallets WHERE user_type = 'Seller' OR user_type = 'seller'").all();
      
      // Get trade statistics for all sellers
      const tradeStats = this.db.prepare(`
        SELECT 
            seller_address,
            COUNT(*) as total_finalized,
            SUM(CASE WHEN status IN ('RELEASED', 'SUCCESS') THEN 1 ELSE 0 END) as successful
        FROM trades 
        WHERE status IN ('RELEASED', 'SUCCESS', 'CANCELLED', 'REJECTED')
        GROUP BY seller_address
      `).all();

      // Create a map for quick lookup
      const statsMap = {};
      tradeStats.forEach(stat => {
        statsMap[stat.seller_address] = stat;
      });

      console.log(`Found ${sellers.length} sellers to process`);
      
      return sellers.map(result => {
        let walletData = {};
        try {
            walletData = this.decryptData(result.encrypted_data);
        } catch (e) {
            console.warn(`Failed to decrypt data for ${result.solana_address}`);
        }

        const address = result.solana_address;
        const stats = statsMap[address] || { total_finalized: 0, successful: 0 };
        
        let completionRate = null; // Default for new sellers
        if (stats.total_finalized > 0) {
            completionRate = Math.round((stats.successful / stats.total_finalized) * 100);
        }

        return {
            address: result.solana_address,
            name: walletData.name || result.solana_address.slice(0, 4) + '..' + result.solana_address.slice(-4),
            userType: 'Seller',
            reputation: 5, // Keep mock for now
            dealCount: stats.successful || 0,
            completionRate: completionRate,
            verified: true // Keep for legacy, but UI will prefer completionRate
        };
      });
    } catch (error) {
      console.error('Error getting all sellers:', error);
      return [];
    }
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

  // ===== MESSAGING METHODS =====

  // Initialize admin master key for key escrow
  initializeAdminMasterKey() {
    if (!process.env.ADMIN_MASTER_KEY) {
      throw new Error('ADMIN_MASTER_KEY environment variable is required for key escrow');
    }

    try {
      this.adminMasterKey = Buffer.from(process.env.ADMIN_MASTER_KEY, 'hex');
      if (this.adminMasterKey.length !== 32) {
        throw new Error('ADMIN_MASTER_KEY must be a 64-character hex string (32 bytes)');
      }
    } catch (error) {
      throw new Error(`Invalid ADMIN_MASTER_KEY: ${error.message}`);
    }
  }

  // Encrypt private key with admin master key (for escrow)
  encryptPrivateKeyForEscrow(privateKey) {
    if (!this.adminMasterKey) {
      this.initializeAdminMasterKey();
    }
    return this.encryptDataWithKey(privateKey, this.adminMasterKey);
  }

  // Decrypt private key from escrow (admin only)
  decryptPrivateKeyFromEscrow(encryptedPrivateKey) {
    if (!this.adminMasterKey) {
      this.initializeAdminMasterKey();
    }
    return this.decryptDataWithKey(encryptedPrivateKey, this.adminMasterKey);
  }

  // Helper to encrypt with a specific key
  encryptDataWithKey(data, key) {
    const iv = this.getNewIV();
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const jsonData = JSON.stringify(data);
    let encryptedData = cipher.update(jsonData, 'utf8', 'hex');
    encryptedData += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    return JSON.stringify({
      iv: iv.toString('hex'),
      encryptedData,
      authTag: authTag.toString('hex'),
    });
  }

  // Helper to decrypt with a specific key
  decryptDataWithKey(encryptedJson, key) {
    const { iv, encryptedData, authTag } = JSON.parse(encryptedJson);
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));

    let decryptedData = decipher.update(encryptedData, 'hex', 'utf8');
    decryptedData += decipher.final('utf8');
    return JSON.parse(decryptedData);
  }

  // Conversation methods
  createConversation(conversationId, buyerAddress, sellerAddress, lastMessageText = '') {
    try {
      const b = buyerAddress;
      const s = sellerAddress;
      const stmt = this.db.prepare(`
        INSERT INTO conversations (conversation_id, buyer_address, seller_address, last_message_at, last_message_text)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?)
        ON CONFLICT(conversation_id) DO UPDATE SET
          last_message_at = CURRENT_TIMESTAMP,
          last_message_text = excluded.last_message_text
      `);
      stmt.run(conversationId, b, s, lastMessageText);
      return { 
        conversation_id: conversationId, 
        buyer_address: b, 
        seller_address: s, 
        last_message_text: lastMessageText,
        last_message_at: new Date().toISOString() // Approximate or fetch from DB
      };
    } catch (error) {
      console.error('Error creating conversation:', error);
      throw error;
    }
  }

  getConversation(conversationId) {
    try {
      const stmt = this.db.prepare('SELECT * FROM conversations WHERE conversation_id = ?');
      return stmt.get(conversationId) || null;
    } catch (error) {
      console.error('Error getting conversation:', error);
      return null;
    }
  }

  getUserConversations(solanaAddress) {
    try {
      const address = solanaAddress;
      const stmt = this.db.prepare(`
        SELECT * FROM conversations 
        WHERE buyer_address = ? OR seller_address = ?
        ORDER BY last_message_at DESC
      `);
      return stmt.all(address, address);
    } catch (error) {
      console.error('Error getting user conversations:', error);
      return [];
    }
  }

  updateConversationLastMessage(conversationId, lastMessageText = '') {
    try {
      const stmt = this.db.prepare(`
        UPDATE conversations SET 
          last_message_at = CURRENT_TIMESTAMP,
          last_message_text = ?
        WHERE conversation_id = ?
      `);
      stmt.run(lastMessageText, conversationId);
      return true;
    } catch (error) {
      console.error('Error updating conversation:', error);
      return false;
    }
  }

  // Message methods
  saveMessage(messageData) {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO messages (
          conversation_id, sender_address, recipient_address, message_text,
          encrypted_message, encryption_metadata, is_encrypted
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      const info = stmt.run(
        messageData.conversationId,
        messageData.senderAddress,
        messageData.recipientAddress,
        messageData.messageText || '',
        messageData.encryptedMessage || null,
        messageData.encryptionMetadata || null,
        messageData.isEncrypted ? 1 : 0
      );
      return { id: info.lastInsertRowid, ...messageData };
    } catch (error) {
      console.error('Error saving message:', error);
      throw error;
    }
  }

  getMessages(conversationId, limit = 50, offset = 0) {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM messages 
        WHERE conversation_id = ?
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `);
      return stmt.all(conversationId, limit, offset).reverse(); // Reverse to get chronological order
    } catch (error) {
      console.error('Error getting messages:', error);
      return [];
    }
  }

  // ===== TRADE METHODS =====

  createTrade(tradeData) {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO trades (
          trade_id, conversation_id, seller_address, buyer_address,
          item_name, description, price_sol, price_lamports, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        tradeData.tradeId,
        tradeData.conversationId || null,
        tradeData.sellerAddress,
        tradeData.buyerAddress,
        tradeData.itemName,
        tradeData.description || null,
        tradeData.priceSol,
        tradeData.priceLamports,
        tradeData.status
      );
      return this.getTrade(tradeData.tradeId);
    } catch (error) {
      console.error('Error creating trade:', error);
      throw error;
    }
  }

  getTrade(tradeId) {
    try {
      const stmt = this.db.prepare('SELECT * FROM trades WHERE trade_id = ?');
      return stmt.get(tradeId) || null;
    } catch (error) {
      console.error('Error getting trade:', error);
      return null;
    }
  }

  getTradesForUser(solanaAddress) {
    try {
      const address = solanaAddress;
      const stmt = this.db.prepare(`
        SELECT * FROM trades
        WHERE buyer_address = ? OR seller_address = ?
        ORDER BY created_at DESC
      `);
      return stmt.all(address, address);
    } catch (error) {
      console.error('Error getting trades for user:', error);
      return [];
    }
  }

  updateTradeStatus(tradeId, status) {
    try {
      const stmt = this.db.prepare(`
        UPDATE trades SET status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE trade_id = ?
      `);
      stmt.run(status, tradeId);
      return true;
    } catch (error) {
      console.error('Error updating trade status:', error);
      return false;
    }
  }

  updateTradeConversation(tradeId, conversationId) {
    try {
      const stmt = this.db.prepare(`
        UPDATE trades SET conversation_id = ?, updated_at = CURRENT_TIMESTAMP
        WHERE trade_id = ?
      `);
      stmt.run(conversationId, tradeId);
      return true;
    } catch (error) {
      console.error('Error updating trade conversation:', error);
      return false;
    }
  }

  setTradeDepositSignature(tradeId, txSignature) {
    try {
      const stmt = this.db.prepare(`
        UPDATE trades SET deposit_tx_signature = ?, updated_at = CURRENT_TIMESTAMP
        WHERE trade_id = ?
      `);
      stmt.run(txSignature, tradeId);
      return true;
    } catch (error) {
      console.error('Error saving trade deposit signature:', error);
      return false;
    }
  }

  setTradeDepositConfirmed(tradeId) {
    try {
      const stmt = this.db.prepare(`
        UPDATE trades SET status = ?, deposit_confirmed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE trade_id = ?
      `);
      stmt.run('DEPOSIT_CONFIRMED', tradeId);
      return true;
    } catch (error) {
      console.error('Error setting trade deposit confirmed:', error);
      return false;
    }
  }

  setTradeSettled(tradeId, txSignature) {
    try {
      const stmt = this.db.prepare(`
        UPDATE trades SET status = ?, settle_tx_signature = ?, settled_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE trade_id = ?
      `);
      stmt.run('SUCCESS', txSignature, tradeId);
      return true;
    } catch (error) {
      console.error('Error setting trade settled:', error);
      return false;
    }
  }

  markMessageAsRead(messageId, solanaAddress) {
    try {
      const stmt = this.db.prepare(`
        UPDATE messages SET read_at = CURRENT_TIMESTAMP
        WHERE id = ? AND recipient_address = ?
      `);
      stmt.run(messageId, solanaAddress);
      return true;
    } catch (error) {
      console.error('Error marking message as read:', error);
      return false;
    }
  }

  // Encryption key methods
  storeEncryptionKeys(solanaAddress, publicKey, privateKey) {
    try {
      // Encrypt private key with admin master key for escrow
      const encryptedPrivateKey = this.encryptPrivateKeyForEscrow(privateKey);

      const stmt = this.db.prepare(`
        INSERT INTO user_encryption_keys (solana_address, public_key, encrypted_private_key)
        VALUES (?, ?, ?)
        ON CONFLICT(solana_address) DO UPDATE SET
          public_key = excluded.public_key,
          encrypted_private_key = excluded.encrypted_private_key,
          updated_at = CURRENT_TIMESTAMP
      `);
      stmt.run(solanaAddress, publicKey, encryptedPrivateKey);
      return true;
    } catch (error) {
      console.error('Error storing encryption keys:', error);
      throw error;
    }
  }

  getPublicKey(solanaAddress) {
    try {
      const stmt = this.db.prepare('SELECT public_key FROM user_encryption_keys WHERE solana_address = ?');
      const result = stmt.get(solanaAddress);
      return result ? result.public_key : null;
    } catch (error) {
      console.error('Error getting public key:', error);
      return null;
    }
  }

  getEncryptedPrivateKey(solanaAddress) {
    try {
      const stmt = this.db.prepare('SELECT encrypted_private_key FROM user_encryption_keys WHERE solana_address = ?');
      const result = stmt.get(solanaAddress);
      return result ? result.encrypted_private_key : null;
    } catch (error) {
      console.error('Error getting encrypted private key:', error);
      return null;
    }
  }

  // Get decrypted private key for user (for client-side decryption)
  getDecryptedPrivateKey(solanaAddress) {
    try {
      const encrypted = this.getEncryptedPrivateKey(solanaAddress);
      if (!encrypted) return null;
      return this.decryptPrivateKeyFromEscrow(encrypted);
    } catch (error) {
      console.error('Error decrypting private key:', error);
      return null;
    }
  }

  // Admin method to decrypt private key
  decryptPrivateKeyForAdmin(solanaAddress) {
    try {
      const encrypted = this.getEncryptedPrivateKey(solanaAddress);
      if (!encrypted) return null;
      return this.decryptPrivateKeyFromEscrow(encrypted);
    } catch (error) {
      console.error('Error decrypting private key for admin:', error);
      throw error;
    }
  }

  // Admin access logging
  logAdminAccess(accessData) {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO admin_access_log (
          conversation_id, admin_address, access_reason, dispute_id, messages_decrypted
        ) VALUES (?, ?, ?, ?, ?)
      `);
      stmt.run(
        accessData.conversationId,
        accessData.adminAddress,
        accessData.reason || null,
        accessData.disputeId || null,
        accessData.messagesDecrypted || 0
      );
      return true;
    } catch (error) {
      console.error('Error logging admin access:', error);
      return false;
    }
  }

  getAdminAccessLog(conversationId) {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM admin_access_log 
        WHERE conversation_id = ?
        ORDER BY accessed_at DESC
      `);
      return stmt.all(conversationId);
    } catch (error) {
      console.error('Error getting admin access log:', error);
      return [];
    }
  }

  // Check if user is Seller
  isSeller(solanaAddress) {
    try {
      const wallet = this.getWallet(solanaAddress);
      return wallet?.userType === 'Seller';
    } catch {
      return false;
    }
  }
}

export default DatabaseManager;
