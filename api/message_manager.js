import DatabaseManager from './db_manager.js';
import logger from './logger.js';

class MessageManager {
  constructor(db) {
    this.db = db;
  }

  /**
   * Generate conversation ID from buyer and seller addresses
   * Format: sorted addresses joined by underscore
   */
  generateConversationId(buyerAddress, sellerAddress) {
    const addresses = [buyerAddress.toLowerCase(), sellerAddress.toLowerCase()].sort();
    return `${addresses[0]}_${addresses[1]}`;
  }

  /**
   * Create or get existing conversation between buyer and seller
   */
  async createOrGetConversation(buyerAddress, sellerAddress, tradeId = null) {
    try {
      const b = buyerAddress.toLowerCase();
      const s = sellerAddress.toLowerCase();
      
      // Verify seller is actually a Seller
      if (!this.db.isSeller(s)) {
        console.error(`[MessageManager] createOrGetConversation failed: ${s} is not a registered Seller`);
        throw new Error('Recipient must be a registered Seller');
      }

      // If tradeId provided, conversation is linked to that trade
      // Otherwise, fall back to generic address-pair chat
      const conversationId = tradeId 
          ? `trade_${tradeId}`
          : this.generateConversationId(b, s);

      console.log(`[MessageManager] Ensuring conversation ${conversationId} between ${b} and ${s} (Trade: ${tradeId || 'None'})`);
      
      // Check if conversation exists
      let conversation = this.db.getConversation(conversationId);
      
      if (!conversation) {
        console.log(`[MessageManager] Conversation ${conversationId} not found, creating new one`);
        // Create new conversation
        conversation = this.db.createConversation(conversationId, b, s);
      }

      return conversation;
    } catch (error) {
      console.error('[MessageManager] Error in createOrGetConversation:', error);
      throw error;
    }
  }

  /**
   * Validate user can access conversation
   */
  canAccessConversation(conversation, solanaAddress) {
    if (!conversation) return false;
    
    const address = solanaAddress.toLowerCase();
    const buyer = conversation.buyer_address?.toLowerCase();
    const seller = conversation.seller_address?.toLowerCase();
    
    const hasAccess = address === buyer || address === seller;
    if (!hasAccess) {
        console.warn(`[MessageManager] Access denied for ${address} to conversation ${conversation.conversation_id}`);
    }
    return hasAccess;
  }

  /**
   * Send a message
   */
  async sendMessage(senderAddress, recipientAddress, messageText, isEncrypted = false, encryptedMessage = null, encryptionMetadata = null, tradeId = null) {
    try {
      const s = senderAddress.toLowerCase();
      const r = recipientAddress.toLowerCase();
      
      // Determine buyer and seller
      const isSenderSeller = this.db.isSeller(s);
      const buyerAddress = isSenderSeller ? r : s;
      const sellerAddress = isSenderSeller ? s : r;

      console.log(`[MessageManager] Sending message from ${s} to ${r} (Buyer: ${buyerAddress}, Seller: ${sellerAddress})`);

      // Create or get conversation
      const conversation = await this.createOrGetConversation(buyerAddress, sellerAddress, tradeId);

      // Save message
      const message = this.db.saveMessage({
        conversationId: conversation.conversation_id,
        senderAddress: s,
        recipientAddress: r,
        messageText: isEncrypted ? '' : messageText, // Empty if encrypted
        encryptedMessage,
        encryptionMetadata,
        isEncrypted,
      });

      // Update conversation last message time and text
      const lastMessageText = isEncrypted ? '🔒 Encrypted Message' : (messageText.slice(0, 50) + (messageText.length > 50 ? '...' : ''));
      this.db.updateConversationLastMessage(conversation.conversation_id, lastMessageText);

      console.log(`[MessageManager] Message saved: ${message.id}, conversation updated`);

      return {
        ...message,
        conversationId: conversation.conversation_id,
      };
    } catch (error) {
      console.error('[MessageManager] Error in sendMessage:', error);
      throw error;
    }
  }

  /**
   * Get message history for a conversation
   */
  getMessageHistory(conversationId, limit = 50, offset = 0) {
    try {
      return this.db.getMessages(conversationId, limit, offset);
    } catch (error) {
      logger.error({
        message: 'Error getting message history',
        conversationId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Mark message as read
   */
  markAsRead(messageId, recipientAddress) {
    try {
      return this.db.markMessageAsRead(messageId, recipientAddress);
    } catch (error) {
      logger.error({
        message: 'Error marking message as read',
        messageId,
        error: error.message,
      });
      return false;
    }
  }
}

export default MessageManager;
