import express from 'express';
import { createServer } from 'http';
import dotenv from 'dotenv';
import { PublicKey, Connection, SystemProgram, Transaction } from '@solana/web3.js';
import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import cors from 'cors';
import DatabaseManager from './db_manager.js';
import WebSocketServer from './websocket_server.js';
import MessageManager from './message_manager.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const port = process.env.PORT || 5001;

const TRADE_STATUSES = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
  DEPOSIT_PENDING: 'DEPOSIT_PENDING',
  DEPOSIT_CONFIRMED: 'DEPOSIT_CONFIRMED',
  SETTLE_PENDING: 'SETTLE_PENDING',
  SUCCESS: 'SUCCESS',
};

const LAMPORTS_PER_SOL = 1_000_000_000;

// Initialize database
const db = new DatabaseManager();

// Initialize message manager
const messageManager = new MessageManager(db);

// Initialize WebSocket server
const wsServer = new WebSocketServer(httpServer, db);

// Middleware to parse JSON
app.use(express.json());

// Middleware to handle empty JSON bodies gracefully
app.use((req, res, next) => {
  if (req.headers['content-type'] === 'application/json' && req.body === undefined) {
    req.body = {};
  }
  next();
});

// Enable CORS
app.use(cors());

// Helper function to verify Solana signature
function verifySolanaSignature(message, signature, address) {
  try {
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = bs58.decode(signature);
    const publicKey = new PublicKey(address);
    return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKey.toBytes());
  } catch (error) {
    console.error('Error verifying Solana signature:', error);
    return false;
  }
}

function parsePriceInSol(priceInSol) {
  const value = Number.parseFloat(priceInSol);
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }
  return {
    priceSol: value.toString(),
    priceLamports: Math.round(value * LAMPORTS_PER_SOL),
  };
}

// ===== PUBLIC ENDPOINTS =====

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    env: process.env.NODE_ENV || 'development'
  });
});

// Get authentication message for Solana wallet
app.get('/api/auth/message', (req, res) => {
  try {
    const { solanaAddress } = req.query;

    if (!solanaAddress) {
      return res.status(400).json({ 
        error: 'Solana address is required as query parameter' 
      });
    }

    // Validate Solana address format
    try {
      new PublicKey(solanaAddress);
    } catch (_error) {
      return res.status(400).json({ error: 'Invalid Solana address format.' });
    }

    // Generate a unique message for the user to sign
    const timestamp = Date.now();
    const nonce = Math.random().toString(36).substring(2, 15);
    const message = `Welcome to PrivacyEscrow!\n\nSign this message to authenticate.\n\nAddress: ${solanaAddress}\nTimestamp: ${timestamp}\nNonce: ${nonce}`;

    // Store the message temporarily (optional - for verification later)
    // You could store this in a cache/DB with expiration

    // Check if user is already registered in our DB
    const isRegistered = db.walletExists(solanaAddress);

    res.json({
      success: true,
      message,
      solanaAddress,
      timestamp,
      nonce,
      isRegistered,
    });
  } catch (error) {
    console.error('Error generating message:', error);
    res.status(500).json({ error: 'Failed to generate authentication message.' });
  }
});

// Login with Solana wallet signature
app.post('/api/auth/login', async (req, res) => {
  const { solanaAddress, signature, message } = req.body;

  if (!solanaAddress || !signature || !message) {
    return res.status(400).json({ 
      error: 'Solana address, signature, and message are required.' 
    });
  }

  try {
    // Validate Solana address format
    try {
      new PublicKey(solanaAddress);
    } catch (_error) {
      return res.status(400).json({ error: 'Invalid Solana address format.' });
    }

    // Verify signature
    const isValid = verifySolanaSignature(message, signature, solanaAddress);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid signature. Authentication failed.' });
    }

    // Register user if not exists
    if (!db.walletExists(solanaAddress)) {
      // Store minimal user data - just that they've authenticated
      db.storeWallet(solanaAddress, {
        solanaAddress,
        createdAt: new Date().toISOString(),
      });
    }

    // Generate JWT token
    const token = jwt.sign({ solanaAddress }, process.env.JWT_SECRET, { expiresIn: '24h' });

    res.json({ 
      success: true,
      token,
      solanaAddress,
      message: 'Authentication successful',
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error during authentication.' });
  }
});

// Get all sellers
app.get('/api/sellers', async (req, res) => {
  try {
    const sellers = db.getAllSellers();
    res.json({
      success: true,
      sellers,
    });
  } catch (error) {
    console.error('Error fetching sellers:', error);
    res.status(500).json({ error: 'Failed to fetch sellers.' });
  }
});

// ===== AUTHENTICATION MIDDLEWARE =====

app.use(async (req, res, next) => {
  // List of public endpoints that don't require authentication
  const publicEndpoints = [
    '/api/health',
    '/api/auth/message',
    '/api/auth/login',
    '/api/sellers',
  ];

  // Skip authentication for public endpoints
  if (publicEndpoints.some(ep => req.path.startsWith(ep))) {
    return next();
  }

  const authHeader = req.headers['authorization'];
  
  // JWT Token Authentication
  if (authHeader) {
    try {
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const solanaAddress = decoded.solanaAddress;
      
      if (!solanaAddress) {
        return res.status(401).json({ error: 'Invalid token: missing solanaAddress.' });
      }

      req.solanaAddress = solanaAddress;
      req.authMethod = 'jwt';
      return next();
    } catch (error) {
      console.error('Token verification failed:', error);
      return res.status(401).json({ error: 'Invalid or expired token.' });
    }
  }

  // Signature-based authentication as fallback
  const solanaAddress = req.headers['solana-address'];
  const signature = req.headers['solana-signature'];
  const message = req.headers['solana-message'];

  if (solanaAddress && signature && message) {
    try {
      new PublicKey(solanaAddress);
      const isValid = verifySolanaSignature(message, signature, solanaAddress);

      if (!isValid) {
        return res.status(401).json({ error: 'Invalid signature.' });
      }

      req.solanaAddress = solanaAddress;
      req.authMethod = 'signature';

      // Generate and return token for future requests
      const token = jwt.sign({ solanaAddress }, process.env.JWT_SECRET, { expiresIn: '24h' });
      res.setHeader('Authorization', token);

      return next();
    } catch (_error) {
      return res.status(401).json({ error: 'Authentication failed.' });
    }
  }

  return res.status(401).json({ 
    error: 'Authentication required. Please provide a valid JWT token or Solana signature.' 
  });
});

// ===== AUTHENTICATED ENDPOINTS =====

// Get user info
app.get('/api/user/info', async (req, res) => {
  try {
    const solanaAddress = req.solanaAddress;
    const wallet = db.getWallet(solanaAddress);
    
    // Build ShadowPay data object
    const shadowPay = {
      registered: wallet?.registeredWithShadowPay || false,
    };

    if (shadowPay.registered) {
      const ut = wallet?.userType || '';
      shadowPay.userType = ut.charAt(0).toUpperCase() + ut.slice(1).toLowerCase();
      shadowPay.commitment = wallet?.commitment || null;
      shadowPay.root = wallet?.root || null;
      shadowPay.api_key = wallet?.apiKey || null;
    }
    
    res.json({
      success: true,
      solanaAddress,
      createdAt: wallet?.createdAt || null,
      shadowPay,
    });
  } catch (error) {
    console.error('Error getting user info:', error);
    res.status(500).json({ error: 'Failed to get user info.' });
  }
});

// Register with ShadowPay
app.post('/api/user/register-shadowpay', async (req, res) => {
  try {
    const { userType, signature, message } = req.body;
    const solanaAddress = req.solanaAddress;

    // Validate required parameters
    if (!userType || !signature || !message) {
      return res.status(400).json({
        error: 'Missing required fields: userType, signature, and message are required.',
      });
    }

    // Validate userType (case-insensitive)
    const normalizedUserType = userType.charAt(0).toUpperCase() + userType.slice(1).toLowerCase();
    if (normalizedUserType !== 'Buyer' && normalizedUserType !== 'Seller') {
      return res.status(400).json({
        error: 'Invalid userType. Must be either "Buyer" or "Seller".',
      });
    }

    // Check if user is already registered
    if (db.isRegisteredWithShadowPay(solanaAddress)) {
      const wallet = db.getWallet(solanaAddress);
      return res.json({
        success: true,
        message: 'User is already registered with ShadowPay.',
        userType: wallet.userType,
      });
    }

    try {
      // Step 1: Generate API key for all users
      const keysResponse = await fetch(
        'https://shadow.radr.fun/shadowpay/v1/keys/new',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            wallet_address: solanaAddress,
          }),
        }
      );

      if (!keysResponse.ok) {
        const errorText = await keysResponse.text();
        console.error('ShadowPay keys/new API error:', errorText);
        return res.status(500).json({
          error: 'Failed to generate API key. Please try again.',
        });
      }

      const keysData = await keysResponse.json();

      if (!keysData.api_key) {
        console.error('Invalid keys/new response:', keysData);
        return res.status(500).json({
          error: 'Invalid response from ShadowPay keys service.',
        });
      }

      // Step 2: Register with ShadowID
      const shadowPayResponse = await fetch(
        'https://shadow.radr.fun/shadowpay/api/shadowid/auto-register',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            wallet_address: solanaAddress,
            signature: signature,
            message: message,
          }),
        }
      );

      if (!shadowPayResponse.ok) {
        const errorText = await shadowPayResponse.text();
        console.error('ShadowPay API error:', errorText);
        return res.status(500).json({
          error: 'Failed to register with ShadowPay. Please try again.',
        });
      }

      const shadowPayData = await shadowPayResponse.json();

      // Validate response structure
      if (!shadowPayData.registered || !shadowPayData.commitment || !shadowPayData.root) {
        console.error('Invalid ShadowPay response:', shadowPayData);
        return res.status(500).json({
          error: 'Invalid response from ShadowPay service.',
        });
      }

      // Initialize registration data object
      const registrationData = {
        userType: normalizedUserType,
        commitment: shadowPayData.commitment,
        root: shadowPayData.root,
        apiKey: keysData.api_key,
      };

      // Update database with ShadowPay registration data
      const updateSuccess = db.updateShadowPayRegistration(solanaAddress, registrationData);

      if (!updateSuccess) {
        console.error('Failed to update database with ShadowPay registration');
        return res.status(500).json({
          error: 'Registration successful but failed to save data. Please contact support.',
        });
      }

      res.json({
        success: true,
        registered: true,
        commitment: shadowPayData.commitment,
        root: shadowPayData.root,
        userType: normalizedUserType,
        api_key: keysData.api_key,
        message: 'Successfully registered with ShadowPay',
      });
    } catch (fetchError) {
      console.error('Error calling ShadowPay API:', fetchError);
      return res.status(500).json({
        error: 'Failed to connect to ShadowPay service. Please try again later.',
      });
    }
  } catch (error) {
    console.error('Error in ShadowPay registration:', error);
    res.status(500).json({
      error: 'Internal server error during ShadowPay registration.',
    });
  }
});

// ===== MESSAGING REST ENDPOINTS =====

// Get user's conversations
app.get('/api/conversations', async (req, res) => {
  try {
    const solanaAddress = req.solanaAddress;
    console.log(`[API] Fetching conversations for ${solanaAddress}`);
    const conversations = db.getUserConversations(solanaAddress);
    console.log(`[API] Found ${conversations.length} conversations`);
    
    const enrichedConversations = conversations.map(conv => {
      const otherAddress = conv.buyer_address === solanaAddress ? conv.seller_address : conv.buyer_address;
      let otherName = 'Anonymous';
      
      try {
        const otherWallet = db.getWallet(otherAddress);
        otherName = otherWallet.name || otherWallet.userType || (otherAddress.slice(0, 4) + '..' + otherAddress.slice(-4));
      } catch (_e) {
        otherName = otherAddress.slice(0, 4) + '..' + otherAddress.slice(-4);
      }

      return {
        conversationId: conv.conversation_id,
        buyerAddress: conv.buyer_address,
        sellerAddress: conv.seller_address,
        otherParty: {
          address: otherAddress,
          name: otherName,
        },
        lastMessageAt: conv.last_message_at,
        lastMessageText: conv.last_message_text,
        createdAt: conv.created_at,
      };
    });

    res.json({
      success: true,
      conversations: enrichedConversations,
    });
  } catch (error) {
    console.error('Error getting conversations:', error);
    res.status(500).json({ error: 'Failed to get conversations.' });
  }
});

// Create/start conversation with seller
app.post('/api/conversations', async (req, res) => {
  try {
    const { sellerAddress } = req.body;
    const buyerAddress = req.solanaAddress;

    if (!sellerAddress) {
      return res.status(400).json({ error: 'sellerAddress is required.' });
    }

    // Verify seller is a Seller
    if (!db.isSeller(sellerAddress)) {
      return res.status(400).json({ 
        error: 'Recipient must be a registered Seller.',
        code: 'NOT_A_SELLER',
      });
    }

    // Create or get conversation
    const conversation = await messageManager.createOrGetConversation(buyerAddress, sellerAddress);

    res.json({
      success: true,
      conversationId: conversation.conversation_id,
      buyerAddress: conversation.buyer_address,
      sellerAddress: conversation.seller_address,
      createdAt: conversation.created_at,
    });
  } catch (error) {
    console.error('Error creating conversation:', error);
    res.status(500).json({ error: error.message || 'Failed to create conversation.' });
  }
});

// Get conversation details
app.get('/api/conversations/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const conversation = db.getConversation(conversationId);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    // Verify user can access this conversation
    if (!messageManager.canAccessConversation(conversation, req.solanaAddress)) {
      return res.status(403).json({ error: 'Access denied to this conversation.' });
    }

    res.json({
      success: true,
      conversation: {
        conversationId: conversation.conversation_id,
        buyerAddress: conversation.buyer_address,
        sellerAddress: conversation.seller_address,
        lastMessageAt: conversation.last_message_at,
        createdAt: conversation.created_at,
      },
    });
  } catch (error) {
    console.error('Error getting conversation:', error);
    res.status(500).json({ error: 'Failed to get conversation.' });
  }
});

// Get message history
app.get('/api/conversations/:conversationId/messages', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const limit = Number.parseInt(req.query.limit, 10) || 50;
    const offset = Number.parseInt(req.query.offset, 10) || 0;

    // Verify conversation exists
    const conversation = db.getConversation(conversationId);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    // Verify user can access this conversation
    if (!messageManager.canAccessConversation(conversation, req.solanaAddress)) {
      return res.status(403).json({ error: 'Access denied to this conversation.' });
    }

    const messages = messageManager.getMessageHistory(conversationId, limit, offset);

    res.json({
      success: true,
      conversationId,
      messages,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error getting message history:', error);
    res.status(500).json({ error: 'Failed to get message history.' });
  }
});

// ===== TRADE ENDPOINTS =====

// Get all trades for the authenticated user
app.get('/api/trades', async (req, res) => {
  try {
    const trades = db.getTradesForUser(req.solanaAddress);
    
    const formattedTrades = trades.map(t => ({
      tradeId: t.trade_id,
      conversationId: t.conversation_id,
      sellerAddress: t.seller_address,
      buyerAddress: t.buyer_address,
      itemName: t.item_name,
      description: t.description,
      priceInSol: t.price_sol,
      status: t.status,
      createdAt: t.created_at,
    }));

    res.json({
      success: true,
      trades: formattedTrades,
    });
  } catch (error) {
    console.error('Error getting user trades:', error);
    res.status(500).json({ error: 'Failed to get trades.' });
  }
});

// Create a trade (only Sellers can create; Buyers accept or reject)
app.post('/api/trades', async (req, res) => {
  try {
    const { itemName, description, priceInSol, buyerWallet, sellerAddress, conversationId } = req.body;
    const initiatorAddress = req.solanaAddress;

    if (!itemName || !priceInSol || (!buyerWallet && !sellerAddress)) {
      return res.status(400).json({
        error: 'Missing required fields: itemName, priceInSol, and (buyerWallet or sellerAddress).',
      });
    }

    const priceData = parsePriceInSol(priceInSol);
    if (!priceData) {
      return res.status(400).json({ error: 'Invalid priceInSol value.' });
    }

    // Determine roles
    // Determine roles based on provided data
    let finalSellerAddress, finalBuyerAddress;

    if (sellerAddress) {
      // Buyer-initiated flow: only sellers can create trades
      return res.status(403).json({
        error: 'Only sellers can create trades. Buyers can accept or reject trades proposed by the seller.',
      });
    }
    if (buyerWallet) {
      // Initiator is the Seller
      finalSellerAddress = initiatorAddress;
      finalBuyerAddress = buyerWallet;

      if (!db.isSeller(finalSellerAddress)) {
        return res.status(403).json({ error: 'Only registered Sellers can initiate trades as the seller.' });
      }
    } else {
      return res.status(400).json({ error: 'Either sellerAddress or buyerWallet must be provided.' });
    }

    if (!db.walletExists(finalBuyerAddress)) {
      return res.status(400).json({ error: 'Buyer wallet is not registered.' });
    }

    // Generate trade ID first
    const tradeIdUuid = randomUUID();
    const tradeId = `trade_${tradeIdUuid}`;

    // Ensure conversation exists for this trade
    let finalConversationId = conversationId;
    try {
      // Use the newly generated tradeId if no conversationId was provided
      // Use the UUID part (after "trade_") to avoid nested "trade_trade_" IDs
      const conv = await messageManager.createOrGetConversation(finalBuyerAddress, finalSellerAddress, tradeIdUuid);
      finalConversationId = conv.conversation_id;
    } catch (error) {
      console.error('Error ensuring conversation for trade:', error);
      // Fallback to original ID if provided, but continue trade creation
    }

    const trade = db.createTrade({
      tradeId: tradeId,
      conversationId: finalConversationId || null,
      sellerAddress: finalSellerAddress,
      buyerAddress: finalBuyerAddress,
      itemName,
      description: description || null,
      priceSol: priceData.priceSol,
      priceLamports: priceData.priceLamports,
      status: TRADE_STATUSES.PENDING,
    });

    res.json({
      success: true,
      trade: {
        tradeId: trade.trade_id,
        conversationId: trade.conversation_id,
        sellerAddress: trade.seller_address,
        buyerAddress: trade.buyer_address,
        itemName: trade.item_name,
        description: trade.description,
        priceInSol: trade.price_sol,
        status: trade.status,
        createdAt: trade.created_at,
      },
    });
  } catch (error) {
    console.error('Error creating trade:', error);
    res.status(500).json({ error: 'Failed to create trade.' });
  }
});

// Buyer accepts a trade and receives unsigned deposit transaction
app.post('/api/trades/:tradeId/accept', async (req, res) => {
  try {
    const { tradeId } = req.params;
    const buyerAddress = req.solanaAddress;

    const trade = db.getTrade(tradeId);
    if (!trade) {
      return res.status(404).json({ error: 'Trade not found.' });
    }

    if (trade.buyer_address !== buyerAddress) {
      return res.status(403).json({ error: 'Only the buyer can accept this trade.' });
    }

    // Allow retrying if already in DEPOSIT_PENDING (e.g. invalid tx or user retry)
    if (trade.status !== TRADE_STATUSES.PENDING && trade.status !== TRADE_STATUSES.DEPOSIT_PENDING) {
      return res.status(400).json({ error: `Trade is not pending (current: ${trade.status}).` });
    }

    // db.updateTradeStatus(tradeId, TRADE_STATUSES.ACCEPTED); // Status update happens after successful transaction creation verification if needed, or we can leave it as is.
    // Actually, let's keep the logic flow: Update to ACCEPTED -> Create Tx -> Return Tx -> Frontend signs & sends -> Backend verifies
    db.updateTradeStatus(tradeId, TRADE_STATUSES.ACCEPTED);

    // --- LOCAL TRANSACTION CREATION ---
    const treasuryAddress = process.env.TREASURY_WALLET;
    if (!treasuryAddress) {
        throw new Error('Treasury wallet not configured');
    }

    // Connect to Solana (using public RPC for now or configurable)
    // For mainnet-beta, devnet, or localnet based on env? 
    // Defaulting to devnet for testing safety or strict mainnet if prod.
    // Based on user context, looks like `localhost:5173` so maybe devnet.
    // Let's use a standard RPC connection.
    // Connect to Solana
    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
    const connection = new Connection(rpcUrl, 'confirmed');
    
    const { blockhash } = await connection.getLatestBlockhash();
    
    const transaction = new Transaction({
        recentBlockhash: blockhash,
        feePayer: new PublicKey(req.solanaAddress)
    });

    transaction.add(
        SystemProgram.transfer({
            fromPubkey: new PublicKey(req.solanaAddress),
            toPubkey: new PublicKey(treasuryAddress),
            lamports: trade.price_lamports
        })
    );

    // Serialize transaction
    const serializedTransaction = transaction.serialize({
        requireAllSignatures: false,
        verifySignatures: false
    });
    
    // Ensure it's a Buffer before toString('base64')
    const base64Transaction = Buffer.from(serializedTransaction).toString('base64');
    // ----------------------------------

    db.updateTradeStatus(tradeId, TRADE_STATUSES.DEPOSIT_PENDING);

    res.json({
      success: true,
      tradeId: trade.trade_id,
      status: TRADE_STATUSES.DEPOSIT_PENDING,
      transaction: base64Transaction,
    });
  } catch (error) {
    console.error('Error accepting trade:', error);
    res.status(500).json({ error: 'Failed to accept trade. ' + error.message });
  }
});

// Buyer submits deposit transaction signature
app.post('/api/trades/:tradeId/deposit-signature', async (req, res) => {
  try {
    const { tradeId } = req.params;
    const { txSignature } = req.body;
    const buyerAddress = req.solanaAddress;

    if (!txSignature) {
      return res.status(400).json({ error: 'txSignature is required.' });
    }

    const trade = db.getTrade(tradeId);
    if (!trade) {
      return res.status(404).json({ error: 'Trade not found.' });
    }

    if (trade.buyer_address !== buyerAddress) {
      return res.status(403).json({ error: 'Only the buyer can submit a deposit signature.' });
    }

    if (trade.status !== TRADE_STATUSES.DEPOSIT_PENDING) {
      return res.status(400).json({ error: `Trade is not awaiting deposit (current: ${trade.status}).` });
    }

    db.setTradeDepositSignature(tradeId, txSignature);

    res.json({
      success: true,
      tradeId: trade.trade_id,
      status: trade.status,
      depositTxSignature: txSignature,
    });
  } catch (error) {
    console.error('Error saving deposit signature:', error);
    res.status(500).json({ error: 'Failed to save deposit signature.' });
  }
});

// Buyer rejects a trade
app.post('/api/trades/:tradeId/reject', async (req, res) => {
  try {
    const { tradeId } = req.params;
    const buyerAddress = req.solanaAddress;

    const trade = db.getTrade(tradeId);
    if (!trade) {
      return res.status(404).json({ error: 'Trade not found.' });
    }

    if (trade.buyer_address !== buyerAddress) {
      return res.status(403).json({ error: 'Only the buyer can reject this trade.' });
    }

    if (trade.status !== TRADE_STATUSES.PENDING && trade.status !== TRADE_STATUSES.ACCEPTED) {
      return res.status(400).json({ error: `Trade cannot be rejected (current: ${trade.status}).` });
    }

    db.updateTradeStatus(tradeId, TRADE_STATUSES.REJECTED);

    res.json({
      success: true,
      tradeId: trade.trade_id,
      status: TRADE_STATUSES.REJECTED,
    });
  } catch (error) {
    console.error('Error rejecting trade:', error);
    res.status(500).json({ error: 'Failed to reject trade.' });
  }
});

// Get trade status with payment verification
app.get('/api/trades/:tradeId', async (req, res) => {
  try {
    const { tradeId } = req.params;
    const requester = req.solanaAddress;

    const trade = db.getTrade(tradeId);
    if (!trade) {
      return res.status(404).json({ error: 'Trade not found.' });
    }

    const isBuyer = trade.buyer_address === requester;
    const isSeller = trade.seller_address === requester;
    if (!isBuyer && !isSeller) {
      return res.status(403).json({ error: 'Access denied to this trade.' });
    }

    let depositConfirmed = false;
    let signatureConfirmed = null;
    let balanceOk = null;
    let transactionError = null; // Declare transactionError here

    if (trade.deposit_tx_signature) {
      const rpcUrlForVerification = process.env.ALCHEMY_RPC_URL || process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
      if (rpcUrlForVerification) {
        try {
          const connection = new Connection(rpcUrlForVerification, 'confirmed');
          const statusResponse = await connection.getSignatureStatuses([trade.deposit_tx_signature]);
          const statusInfo = statusResponse?.value?.[0];
          
        // Check if confirmed (no error and status is finalized or confirmed)
        if (statusInfo) {
            if (statusInfo.err) {
                transactionError = 'Transaction failed on-chain: ' + JSON.stringify(statusInfo.err);
                console.error(`[TradeVerification] Transaction ${trade.deposit_tx_signature} failed:`, statusInfo.err);
            } else {
                signatureConfirmed = (statusInfo.confirmationStatus === 'confirmed' || statusInfo.confirmationStatus === 'finalized');
            }
        } else {
            console.log(`[TradeVerification] Signature ${trade.deposit_tx_signature} not found on-chain.`);
            // If the transaction is not found and it's been more than 30 seconds since update, assume dropped/expired.
            const lastUpdated = new Date(trade.updated_at).getTime();
            const now = Date.now();
            if (now - lastUpdated > 30000) {
                 // transactionError = 'Transaction not found on-chain (expired or dropped). Please retry.';
                 // User requested to reset to "Transaction created" state instead of showing error.
                 // We do this by clearing the signature from the DB.
                 console.log(`[TradeVerification] Transaction ${trade.deposit_tx_signature} expired. Resetting state.`);
                 transactionError = null; 
                 db.setTradeDepositSignature(trade.trade_id, null);
                 // We also need to make sure the response reflects this immediately
                 trade.deposit_tx_signature = null;
            }
        }
        console.log(`[TradeVerification] Signature Status for ${trade.deposit_tx_signature}:`, statusInfo);
      } catch (error) {
        console.error('Error checking deposit signature status:', error);
      }
  }

      try {
        const balanceResponse = await fetch(
          `https://shadow.radr.fun/shadowpay/api/pool/balance/${trade.buyer_address}`
        );
        if (balanceResponse.ok) {
          const balanceData = await balanceResponse.json();
          const balanceValue = Number.parseFloat(balanceData.balance);
          balanceOk = Number.isFinite(balanceValue) && balanceValue >= Number.parseFloat(trade.price_sol);
        }
      } catch (error) {
        console.error('Error checking ShadowPay balance:', error);
      }

      // Ignore signature confirmation: treat stored tx hash as success (don't wait for on-chain verification)
      depositConfirmed = true;
    }

    if (depositConfirmed && trade.status === TRADE_STATUSES.DEPOSIT_PENDING) {
      db.setTradeDepositConfirmed(trade.trade_id);
    }

    const updatedTrade = db.getTrade(trade.trade_id);

    res.json({
      success: true,
      trade: {
        tradeId: updatedTrade.trade_id,
        conversationId: updatedTrade.conversation_id,
        sellerAddress: updatedTrade.seller_address,
        buyerAddress: updatedTrade.buyer_address,
        itemName: updatedTrade.item_name,
        description: updatedTrade.description,
        priceInSol: updatedTrade.price_sol,
        status: updatedTrade.status,
        depositTxSignature: updatedTrade.deposit_tx_signature,
        depositConfirmedAt: updatedTrade.deposit_confirmed_at,
        settleTxSignature: updatedTrade.settle_tx_signature,
        settledAt: updatedTrade.settled_at,
        createdAt: updatedTrade.created_at,
        updatedAt: updatedTrade.updated_at,
      },
      paymentStatus: {
        signatureConfirmed,
        balanceOk,
        depositConfirmed,
      },
    });
  } catch (error) {
    console.error('Error getting trade status:', error);
    res.status(500).json({ error: 'Failed to fetch trade status.' });
  }
});

// Buyer settles a trade (release payment)
app.post('/api/trades/:tradeId/settle', async (req, res) => {
  try {
    const { tradeId } = req.params;
    const { paymentHeader, paymentRequirements, resource } = req.body;
    const buyerAddress = req.solanaAddress;

    if (!paymentHeader || !paymentRequirements || !resource) {
      return res.status(400).json({
        error: 'paymentHeader, paymentRequirements, and resource are required.',
      });
    }

    const trade = db.getTrade(tradeId);
    if (!trade) {
      return res.status(404).json({ error: 'Trade not found.' });
    }

    if (trade.buyer_address !== buyerAddress) {
      return res.status(403).json({ error: 'Only the buyer can settle this trade.' });
    }

    if (trade.status !== TRADE_STATUSES.DEPOSIT_CONFIRMED) {
      return res.status(400).json({ error: `Trade is not ready to settle (current: ${trade.status}).` });
    }

    const buyerWallet = db.getWallet(buyerAddress);
    if (!buyerWallet?.apiKey) {
      return res.status(400).json({ error: 'Buyer API key is missing. Re-register ShadowPay.' });
    }

    db.updateTradeStatus(tradeId, TRADE_STATUSES.SETTLE_PENDING);

    const settleResponse = await fetch('https://shadow.radr.fun/shadowpay/settle', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': buyerWallet.apiKey,
      },
      body: JSON.stringify({
        x402Version: 1,
        paymentHeader,
        resource,
        paymentRequirements,
      }),
    });

    if (!settleResponse.ok) {
      const errorText = await settleResponse.text();
      console.error('ShadowPay settle API error:', errorText);
      return res.status(500).json({ error: 'Failed to settle trade.' });
    }

    const settleData = await settleResponse.json();
    const txSignature = settleData.txSignature || settleData.signature || null;

    db.setTradeSettled(tradeId, txSignature);

    res.json({
      success: true,
      tradeId: trade.trade_id,
      status: TRADE_STATUSES.SUCCESS,
      txSignature,
      settleResponse: settleData,
    });
  } catch (error) {
    console.error('Error settling trade:', error);
    res.status(500).json({ error: 'Failed to settle trade.' });
  }
});

// ===== ENCRYPTION KEY ENDPOINTS =====

// Store encryption keys (public + encrypted private for escrow)
app.post('/api/user/encryption-key', async (req, res) => {
  try {
    const { publicKey, privateKey } = req.body;
    const solanaAddress = req.solanaAddress;

    if (!publicKey || !privateKey) {
      return res.status(400).json({ 
        error: 'publicKey and privateKey are required.' 
      });
    }

    db.storeEncryptionKeys(solanaAddress, publicKey, privateKey);

    res.json({
      success: true,
      message: 'Encryption keys stored successfully',
    });
  } catch (error) {
    console.error('Error storing encryption keys:', error);
    res.status(500).json({ error: 'Failed to store encryption keys.' });
  }
});

// Get own public key
app.get('/api/user/encryption-key', async (req, res) => {
  try {
    const publicKey = db.getPublicKey(req.solanaAddress);

    res.json({
      success: true,
      publicKey: publicKey || null,
    });
  } catch (error) {
    console.error('Error getting public key:', error);
    res.status(500).json({ error: 'Failed to get public key.' });
  }
});

// Get own decrypted private key (for client-side decryption)
app.get('/api/user/encryption-key/private', async (req, res) => {
  try {
    const privateKey = db.getDecryptedPrivateKey(req.solanaAddress);

    if (!privateKey) {
      return res.status(404).json({ error: 'Encryption keys not found. Please generate keys first.' });
    }

    res.json({
      success: true,
      privateKey,
    });
  } catch (error) {
    console.error('Error getting private key:', error);
    res.status(500).json({ error: 'Failed to get private key.' });
  }
});

// Get public key for a specific user (for sending encrypted messages)
app.get('/api/user/encryption-key/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const publicKey = db.getPublicKey(address);

    res.json({
      success: true,
      address,
      publicKey: publicKey || null,
    });
  } catch (error) {
    console.error('Error getting public key:', error);
    res.status(500).json({ error: 'Failed to get public key.' });
  }
});

// ===== ADMIN AUTHENTICATION MIDDLEWARE =====

// Middleware to check if user is admin
const adminAuthMiddleware = (req, res, next) => {
  const solanaAddress = req.solanaAddress;
  
  // Get list of admin addresses from environment variable
  // Format: comma-separated list of Solana addresses
  const adminAddresses = process.env.ADMIN_ADDRESSES 
    ? process.env.ADMIN_ADDRESSES.split(',').map(addr => addr.trim())
    : [];
  
  if (adminAddresses.length === 0) {
    return res.status(500).json({ 
      error: 'Admin access is not configured. Please set ADMIN_ADDRESSES environment variable.' 
    });
  }
  
  if (!solanaAddress || !adminAddresses.includes(solanaAddress)) {
    return res.status(403).json({ 
      error: 'Access denied. Admin privileges required.' 
    });
  }
  
  next();
};

// ===== ADMIN ENDPOINTS =====

// Decrypt messages for dispute resolution
app.post('/api/admin/conversations/:conversationId/decrypt', adminAuthMiddleware, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { reason, disputeId } = req.body;
    const adminAddress = req.solanaAddress;

    // Get conversation
    const conversation = db.getConversation(conversationId);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    // Get encrypted private keys for both participants
    let buyerPrivateKey, sellerPrivateKey;
    try {
      buyerPrivateKey = db.decryptPrivateKeyForAdmin(conversation.buyer_address);
      sellerPrivateKey = db.decryptPrivateKeyForAdmin(conversation.seller_address);
    } catch (error) {
      // If keys don't exist, that's okay - some messages might not be encrypted
      buyerPrivateKey = null;
      sellerPrivateKey = null;
    }

    // Get all messages
    const messages = db.getMessages(conversationId, 10000, 0);

    // Decrypt messages using tweetnacl
    const decryptedMessages = messages.map(msg => {
      const decrypted = {
        id: msg.id,
        conversationId: msg.conversation_id,
        senderAddress: msg.sender_address,
        recipientAddress: msg.recipient_address,
        createdAt: msg.created_at,
        readAt: msg.read_at,
        isEncrypted: msg.is_encrypted === 1,
      };

      // If message is encrypted, try to decrypt it
      if (msg.is_encrypted === 1 && msg.encrypted_message && msg.encryption_metadata) {
        try {
          const metadata = JSON.parse(msg.encryption_metadata);
          const { encrypted, nonce, senderPublicKey } = metadata;

          // Determine which private key to use based on sender
          let recipientPrivateKey;
          if (msg.sender_address === conversation.buyer_address) {
            // Message from buyer, use seller's private key to decrypt
            recipientPrivateKey = sellerPrivateKey;
          } else {
            // Message from seller, use buyer's private key to decrypt
            recipientPrivateKey = buyerPrivateKey;
          }

          if (recipientPrivateKey && encrypted && nonce && senderPublicKey) {
            try {
              // Decode base64 strings
              const encryptedBytes = Buffer.from(encrypted, 'base64');
              const nonceBytes = Buffer.from(nonce, 'base64');
              const senderPubKeyBytes = Buffer.from(senderPublicKey, 'base64');
              const recipientPrivKeyBytes = Buffer.from(recipientPrivateKey, 'base64');

              // Decrypt using tweetnacl box
              const decryptedBytes = nacl.box.open(
                encryptedBytes,
                nonceBytes,
                senderPubKeyBytes,
                recipientPrivKeyBytes
              );

              if (decryptedBytes) {
                decrypted.messageText = Buffer.from(decryptedBytes).toString('utf8');
                decrypted.decryptionStatus = 'success';
              } else {
                decrypted.decryptionStatus = 'failed';
                decrypted.error = 'Failed to decrypt message';
              }
            } catch (decryptError) {
              decrypted.decryptionStatus = 'error';
              decrypted.error = `Decryption error: ${decryptError.message}`;
            }
          } else {
            decrypted.decryptionStatus = 'skipped';
            decrypted.error = 'Missing decryption keys or metadata';
          }
        } catch (parseError) {
          decrypted.decryptionStatus = 'error';
          decrypted.error = `Failed to parse encryption metadata: ${parseError.message}`;
        }
      } else {
        // Not encrypted, return plaintext
        decrypted.messageText = msg.message_text;
        decrypted.decryptionStatus = 'not_encrypted';
      }

      return decrypted;
    });

    // Count successfully decrypted messages
    const decryptedCount = decryptedMessages.filter(
      msg => msg.decryptionStatus === 'success' || msg.decryptionStatus === 'not_encrypted'
    ).length;

    // Log admin access
    db.logAdminAccess({
      conversationId,
      adminAddress,
      reason: reason || 'dispute_resolution',
      disputeId: disputeId || null,
      messagesDecrypted: decryptedCount,
    });

    res.json({
      success: true,
      conversationId,
      messages: decryptedMessages,
      decryptionSummary: {
        total: messages.length,
        decrypted: decryptedCount,
        failed: decryptedMessages.filter(msg => msg.decryptionStatus === 'failed').length,
        errors: decryptedMessages.filter(msg => msg.decryptionStatus === 'error').length,
      },
    });
  } catch (error) {
    console.error('Error decrypting messages:', error);
    res.status(500).json({ error: 'Failed to decrypt messages.' });
  }
});

// Get admin access log
app.get('/api/admin/conversations/:conversationId/access-log', adminAuthMiddleware, async (req, res) => {
  try {
    const { conversationId } = req.params;

    // Verify conversation exists
    const conversation = db.getConversation(conversationId);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    const accessLog = db.getAdminAccessLog(conversationId);

    res.json({
      success: true,
      conversationId,
      accessLog: accessLog.map(log => ({
        id: log.id,
        adminAddress: log.admin_address,
        accessReason: log.access_reason,
        disputeId: log.dispute_id,
        messagesDecrypted: log.messages_decrypted,
        accessedAt: log.accessed_at,
      })),
    });
  } catch (error) {
    console.error('Error getting access log:', error);
    res.status(500).json({ error: 'Failed to get access log.' });
  }
});

// Start server
httpServer.listen(port, () => {
  console.log(`🔐 PrivacyEscrow API running on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📡 WebSocket server initialized`);
});

export default app;
