import express from 'express';
import dotenv from 'dotenv';
import { PublicKey } from '@solana/web3.js';
import jwt from 'jsonwebtoken';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import cors from 'cors';
import DatabaseManager from './db_manager.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 5001;

// Initialize database
const db = new DatabaseManager();

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

    res.json({
      success: true,
      message,
      solanaAddress,
      timestamp,
      nonce,
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

// ===== AUTHENTICATION MIDDLEWARE =====

app.use(async (req, res, next) => {
  // List of public endpoints that don't require authentication
  const publicEndpoints = [
    '/api/health',
    '/api/auth/message',
    '/api/auth/login',
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
    const wallet = db.getWallet(req.solanaAddress);
    
    // Build ShadowPay data object
    const shadowPay = {
      registered: wallet?.registeredWithShadowPay || false,
    };

    if (shadowPay.registered) {
      shadowPay.userType = wallet?.userType || null;
      shadowPay.commitment = wallet?.commitment || null;
      shadowPay.root = wallet?.root || null;

      // Add Seller-specific fields (excluding secret_key for security)
      if (wallet?.userType === 'Seller') {
        shadowPay.api_key = wallet?.apiKey || null;
        shadowPay.treasury_wallet = wallet?.treasuryWallet || null;
        shadowPay.public_key = wallet?.publicKey || null;
        // Note: secret_key is stored but never returned in API responses
      }
    }
    
    res.json({
      success: true,
      solanaAddress: req.solanaAddress,
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

    // Validate userType
    if (userType !== 'Buyer' && userType !== 'Seller') {
      return res.status(400).json({
        error: 'Invalid userType. Must be either "Buyer" or "Seller".',
      });
    }

    // Check if user is already registered
    if (db.isRegisteredWithShadowPay(solanaAddress)) {
      return res.status(400).json({
        error: 'User is already registered with ShadowPay.',
      });
    }

    // Call ShadowPay API
    try {
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
        userType: userType,
        commitment: shadowPayData.commitment,
        root: shadowPayData.root,
      };

      // Seller-specific API calls
      if (userType === 'Seller') {
        try {
          // Call keys/new API for Seller
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
              error: 'Failed to generate API keys for Seller. Please try again.',
            });
          }

          const keysData = await keysResponse.json();

          // Validate keys response structure
          if (!keysData.api_key || !keysData.treasury_wallet) {
            console.error('Invalid keys/new response:', keysData);
            return res.status(500).json({
              error: 'Invalid response from ShadowPay keys service.',
            });
          }

          registrationData.apiKey = keysData.api_key;
          registrationData.treasuryWallet = keysData.treasury_wallet;

          // Call keygen API for Seller
          const keygenResponse = await fetch(
            'https://shadow.radr.fun/shadowpay/api/privacy/keygen',
            {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
              },
            }
          );

          if (!keygenResponse.ok) {
            const errorText = await keygenResponse.text();
            console.error('ShadowPay keygen API error:', errorText);
            return res.status(500).json({
              error: 'Failed to generate privacy keys for Seller. Please try again.',
            });
          }

          const keygenData = await keygenResponse.json();

          // Validate keygen response structure
          if (!keygenData.public_key || !keygenData.secret_key) {
            console.error('Invalid keygen response:', keygenData);
            return res.status(500).json({
              error: 'Invalid response from ShadowPay keygen service.',
            });
          }

          registrationData.publicKey = keygenData.public_key;
          registrationData.secretKey = keygenData.secret_key;
        } catch (sellerApiError) {
          console.error('Error calling Seller-specific ShadowPay APIs:', sellerApiError);
          return res.status(500).json({
            error: 'Failed to complete Seller registration. Please try again later.',
          });
        }
      }

      // Update database with ShadowPay registration data
      const updateSuccess = db.updateShadowPayRegistration(solanaAddress, registrationData);

      if (!updateSuccess) {
        console.error('Failed to update database with ShadowPay registration');
        return res.status(500).json({
          error: 'Registration successful but failed to save data. Please contact support.',
        });
      }

      // Build response
      const response = {
        success: true,
        registered: true,
        commitment: shadowPayData.commitment,
        root: shadowPayData.root,
        userType: userType,
        message: 'Successfully registered with ShadowPay',
      };

      // Add Seller-specific fields to response
      if (userType === 'Seller') {
        response.api_key = registrationData.apiKey;
        response.treasury_wallet = registrationData.treasuryWallet;
        response.public_key = registrationData.publicKey;
        // Note: secret_key is NOT included in response for security
      }

      res.json(response);
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

// Start server
app.listen(port, () => {
  console.log(`🔐 PrivacyEscrow API running on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
