import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import MessageManager from './message_manager.js';
import logger from './logger.js';

class WebSocketServer {
  constructor(httpServer, db) {
    this.io = new Server(httpServer, {
      cors: {
        origin: '*', // Configure appropriately for production
        methods: ['GET', 'POST'],
      },
    });
    this.db = db;
    this.messageManager = new MessageManager(db);
    this.connections = new Map(); // Map<solanaAddress, socket>
    
    this.setupMiddleware();
    this.setupEventHandlers();
  }

  /**
   * Setup authentication middleware
   */
  setupMiddleware() {
    this.io.use((socket, next) => {
      const token = socket.handshake.auth.token || socket.handshake.query.token;
      
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const solanaAddress = decoded.solanaAddress;
        
        if (!solanaAddress) {
          return next(new Error('Authentication error: Invalid token'));
        }

        socket.solanaAddress = solanaAddress;
        next();
      } catch (error) {
        logger.error('WebSocket authentication error:', error);
        next(new Error('Authentication error: Invalid or expired token'));
      }
    });
  }

  /**
   * Setup event handlers
   */
  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      const solanaAddress = socket.solanaAddress;
      
      logger.info({
        message: 'WebSocket client connected',
        solanaAddress,
        socketId: socket.id,
      });

      // Store connection
      this.connections.set(solanaAddress, socket);

      // Join conversation room
      socket.on('join_conversation', async (data) => {
        try {
          const { conversationId } = data;

          if (!conversationId) {
            socket.emit('error', { message: 'conversationId is required' });
            return;
          }

          // Verify user can access this conversation
          let conversation = this.db.getConversation(conversationId);
          if (conversation) {
              if (!this.messageManager.canAccessConversation(conversation, solanaAddress)) {
                socket.emit('error', { message: 'Access denied to this conversation' });
                return;
              }
          } else if (conversationId.startsWith('trade_')) {
              // Dynamic verification for trade-specific chats
              const tradeId = conversationId.replace('trade_', '');
              const trade = this.db.getTrade(`trade_${tradeId}`) || this.db.getTrade(tradeId);
              
              if (!trade) {
                  socket.emit('error', { message: 'Trade not found' });
                  return;
              }

              if (trade.buyer_address !== solanaAddress && trade.seller_address !== solanaAddress) {
                  socket.emit('error', { message: 'Access denied to this trade chat' });
                  return;
              }

              // Create it on the fly
              conversation = await this.messageManager.createOrGetConversation(trade.buyer_address, trade.seller_address, tradeId);
          } else {
              socket.emit('error', { message: 'Conversation not found' });
              return;
          }

          // Join the room
          socket.join(conversationId);
          
          logger.info({
            message: 'User joined conversation',
            solanaAddress,
            conversationId,
          });

          socket.emit('joined_conversation', { conversationId });
        } catch (error) {
          logger.error('Error joining conversation:', error);
          socket.emit('error', { message: 'Failed to join conversation' });
        }
      });

      // Send message
      socket.on('send_message', async (data) => {
        try {
          const { conversationId, recipientAddress, messageText, encryptedMessage, encryptionMetadata } = data;

          if (!conversationId || !recipientAddress) {
            socket.emit('error', { message: 'conversationId and recipientAddress are required' });
            return;
          }

          if (!messageText && !encryptedMessage) {
            socket.emit('error', { message: 'messageText or encryptedMessage is required' });
            return;
          }

          // Determine if conversation exists
          let conversation = this.db.getConversation(conversationId);
          
          // Verify access
          if (conversation) {
              if (!this.messageManager.canAccessConversation(conversation, solanaAddress)) {
                socket.emit('error', { message: 'Access denied to this conversation' });
                return;
              }
          } else if (conversationId.startsWith('trade_')) {
              // Allow sending to trade chats even if not joined yet if access is verified
              const tradeId = conversationId.replace('trade_', '');
              const trade = this.db.getTrade(`trade_${tradeId}`) || this.db.getTrade(tradeId);
              if (trade && (trade.buyer_address === solanaAddress || trade.seller_address === solanaAddress)) {
                  conversation = await this.messageManager.createOrGetConversation(trade.buyer_address, trade.seller_address, tradeId);
              } else {
                  socket.emit('error', { message: 'Access denied or trade not found' });
                  return;
              }
          } else {
              socket.emit('error', { message: 'Conversation not found' });
              return;
          }

          // Send message
          console.log(`[WS] Sending message from ${solanaAddress} to ${recipientAddress} for conversation ${conversationId}`);
          const isEncrypted = !!encryptedMessage;
          const message = await this.messageManager.sendMessage(
            solanaAddress,
            recipientAddress,
            messageText || '',
            isEncrypted,
            encryptedMessage,
            encryptionMetadata,
            data
          );

          console.log(`[WS] Message saved, emitting to room ${conversationId}`);

          // Emit to all participants in the conversation room
          this.io.to(conversationId).emit('message_received', {
            message: {
              id: message.id,
              conversationId: message.conversationId,
              senderAddress: message.senderAddress,
              recipientAddress: message.recipientAddress,
              messageText: message.messageText,
              encryptedMessage: message.encryptedMessage,
              encryptionMetadata: message.encryptionMetadata,
              isEncrypted: message.isEncrypted,
              createdAt: message.createdAt || message.created_at,
            },
          });

          // Confirm to sender
          socket.emit('message_sent', {
            messageId: message.id,
            conversationId: message.conversationId,
          });

          logger.info({
            message: 'Message sent via WebSocket',
            conversationId,
            senderAddress: solanaAddress,
            recipientAddress,
          });
        } catch (error) {
          logger.error('Error sending message:', error);
          socket.emit('error', { message: 'Failed to send message', error: error.message });
        }
      });

      // Mark message as read
      socket.on('mark_read', async (data) => {
        try {
          const { messageId } = data;

          if (!messageId) {
            socket.emit('error', { message: 'messageId is required' });
            return;
          }

          const success = this.messageManager.markAsRead(messageId, solanaAddress);
          
          if (success) {
            socket.emit('message_read', { messageId });
          } else {
            socket.emit('error', { message: 'Failed to mark message as read' });
          }
        } catch (error) {
          logger.error('Error marking message as read:', error);
          socket.emit('error', { message: 'Failed to mark message as read' });
        }
      });

      // Get message history
      socket.on('get_history', async (data) => {
        try {
          const { conversationId, limit = 50, offset = 0 } = data;

          if (!conversationId) {
            socket.emit('error', { message: 'conversationId is required' });
            return;
          }

          // Verify user can access this conversation
          const conversation = this.db.getConversation(conversationId);
          if (!this.messageManager.canAccessConversation(conversation, solanaAddress)) {
            socket.emit('error', { message: 'Access denied to this conversation' });
            return;
          }

          const messages = this.messageManager.getMessageHistory(conversationId, limit, offset);
          
          socket.emit('message_history', {
            conversationId,
            messages,
            limit,
            offset,
          });
        } catch (error) {
          logger.error('Error getting message history:', error);
          socket.emit('error', { message: 'Failed to get message history' });
        }
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        logger.info({
          message: 'WebSocket client disconnected',
          solanaAddress,
          socketId: socket.id,
        });
        this.connections.delete(solanaAddress);
      });
    });
  }

  /**
   * Get IO instance
   */
  getIO() {
    return this.io;
  }

  /**
   * Check if user is connected
   */
  isUserConnected(solanaAddress) {
    return this.connections.has(solanaAddress);
  }
}

export default WebSocketServer;
