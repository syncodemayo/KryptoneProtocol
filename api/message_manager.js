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
  async createOrGetConversation(buyerAddress, sellerAddress) {
    try {
      // Verify seller is actually a Seller
      if (!this.db.isSeller(sellerAddress)) {
        throw new Error('Recipient must be a registered Seller');
      }

      const conversationId = this.generateConversationId(buyerAddress, sellerAddress);
      
      // Check if conversation exists
      let conversation = this.db.getConversation(conversationId);
      
      if (!conversation) {
        // Create new conversation
        conversation = this.db.createConversation(conversationId, buyerAddress, sellerAddress);
      }

      return conversation;
    } catch (error) {
      logger.error({
        message: 'Error creating/getting conversation',
        buyerAddress,
        sellerAddress,
        error: error.message,
      });
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
    
    return address === buyer || address === seller;
  }

  /**
   * Send a message
   */
  async sendMessage(senderAddress, recipientAddress, messageText, isEncrypted = false, encryptedMessage = null, encryptionMetadata = null) {
    try {
      // Determine buyer and seller
      const isSenderSeller = this.db.isSeller(senderAddress);
      const buyerAddress = isSenderSeller ? recipientAddress : senderAddress;
      const sellerAddress = isSenderSeller ? senderAddress : recipientAddress;

      // Create or get conversation
      const conversation = await this.createOrGetConversation(buyerAddress, sellerAddress);

      // Save message
      const message = this.db.saveMessage({
        conversationId: conversation.conversation_id,
        senderAddress,
        recipientAddress,
        messageText: isEncrypted ? '' : messageText, // Empty if encrypted
        encryptedMessage,
        encryptionMetadata,
        isEncrypted,
      });

      // Update conversation last message time
      this.db.updateConversationLastMessage(conversation.conversation_id);

      logger.info({
        message: 'Message sent',
        conversationId: conversation.conversation_id,
        senderAddress,
        recipientAddress,
        isEncrypted,
      });

      return {
        ...message,
        conversationId: conversation.conversation_id,
      };
    } catch (error) {
      logger.error({
        message: 'Error sending message',
        senderAddress,
        recipientAddress,
        error: error.message,
      });
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
