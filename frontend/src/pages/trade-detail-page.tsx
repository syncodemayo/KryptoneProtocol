import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/auth-context';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { VersionedTransaction, Transaction } from '@solana/web3.js';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Package, ShieldCheck, Clock, CheckCircle2, XCircle, AlertCircle, ExternalLink, RefreshCw, Send, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from '@/lib/config';
import { Input } from '@/components/ui/input';
import { useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ShadowPay SDK types
declare global {
  interface Window {
    ShadowPayClient: any;
  }
}

interface Trade {
  tradeId: string;
  itemName: string;
  description: string;
  priceInSol: number;
  status: string;
  sellerAddress: string;
  buyerAddress: string;
  depositTxSignature?: string;
  settleTxSignature?: string;
  createdAt: string;
}

interface ChatMessage {
  id: string;
  sender: string;
  content: string;
  timestamp: number;
}

export function TradeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { sendTransaction } = useWallet();
  const { connection } = useConnection();
  const [trade, setTrade] = useState<Trade | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);
  
  // Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Socket Connection Logic
  useEffect(() => {
    console.log('Socket Effect Triggered. Trade:', !!trade, 'User:', !!user?.address);
    if (!trade || !user?.address) {
        console.warn('Skipping socket connection: Missing Trade or User');
        return;
    }

    // Generate conversation ID based on trade ID to ensure unique chat per trade
    // This satisfies the requirement: "new chat should be initiated" for new trades
    const convId = `trade_${trade.tradeId}`;
    setConversationId(convId);

    const token = localStorage.getItem('shadowpay_token');
    if (!token) {
        console.error('Skipping socket connection: Missing Token');
        return;
    }

    console.log(`Initializing Socket.IO connection to ${API_BASE_URL}`);
    const socket = io(API_BASE_URL, {
      auth: { token },
      transports: ['websocket', 'polling']
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to chat server');
      socket.emit('join_conversation', { conversationId: convId });
      socket.emit('get_history', { conversationId: convId }); // Fetch history
    });

    socket.on('connect_error', (err) => {
        console.error('Socket Connection Error:', err);
        toast.error(`Chat connection error: ${err.message}`);
    });

    // Handle history response
    socket.on('message_history', (data: { conversationId: string, messages: any[] }) => {
        if (data.conversationId === convId) {
            const formattedMessages = data.messages.map(m => ({
                id: m.id?.toString() || Math.random().toString(),
                sender: (m.sender_address || m.senderAddress || '') === user.address ? 'me' : 'other',
                content: m.message_text || m.messageText,
                timestamp: new Date(m.created_at || m.createdAt || Date.now()).getTime()
            }));
            setMessages(formattedMessages);
        }
    });

    socket.on('message_received', (data: { message: any }) => {
        const msg = data.message;
        if (msg.conversationId === convId) {
            setMessages(prev => {
                // If the message ID already exists (real message), ignore
                if (prev.some(m => m.id === msg.id)) return prev;

                const isMe = (msg.senderAddress || msg.sender_address || '') === user.address;
                const newMsg = {
                    id: msg.id?.toString(),
                    sender: isMe ? 'me' : 'other',
                    content: msg.messageText || msg.message_text,
                    timestamp: new Date(msg.createdAt || msg.created_at || Date.now()).getTime()
                };

                // If it's me, try to find and replace the optimistic message
                if (isMe) {
                    const optimisticIndex = prev.findIndex(m => m.sender === 'me' && m.id.startsWith('opt_') && m.content === newMsg.content);
                    if (optimisticIndex !== -1) {
                        const newMessages = [...prev];
                        newMessages[optimisticIndex] = newMsg;
                        return newMessages;
                    }
                }

                return [...prev, newMsg];
            });
        }
    });

    return () => {
      socket.disconnect();
    };
  }, [trade, user?.address]);

  const handleSendMessage = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!newMessage.trim() || !socketRef.current || !conversationId || !user || !trade) return;
    
    const text = newMessage;
    setNewMessage('');

    // Optimistic Update
    const optimisticId = `opt_${Date.now()}`;
    setMessages(prev => [...prev, {
        id: optimisticId,
        sender: 'me',
        content: text,
        timestamp: Date.now()
    }]);

    const userAddress = user.address;
    const buyerAddress = trade.buyerAddress;
    const sellerAddress = trade.sellerAddress;
    
    const otherAddress = userAddress === buyerAddress ? sellerAddress : buyerAddress;

    socketRef.current.emit('send_message', {
        conversationId,
        recipientAddress: otherAddress,
        messageText: text
    });
  };

  useEffect(() => {
    fetchTrade();
    // Auto-refresh for status check if pending deposit confirm
    const interval = setInterval(() => {
        if (trade && (trade.status === 'DEPOSIT_PENDING' || trade.status === 'SETTLE_PENDING')) {
            fetchTrade();
        }
    }, 5000);
    return () => clearInterval(interval);
  }, [id, trade?.status]);

  const fetchTrade = async () => {
    if (!id) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/trades/${id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('shadowpay_token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch trade');
      const data = await response.json();
      setTrade(data.trade);
      
      // Check for verification error
      if (data.paymentStatus?.transactionError) {
          console.error('Transaction Error Detected:', data.paymentStatus.transactionError);
          setVerificationError(data.paymentStatus.transactionError);
          toast.error(`Verification Failed: ${data.paymentStatus.transactionError}`);
      } else {
          setVerificationError(null);
      }
    } catch (error) {
      console.error('Error fetching trade:', error);
      toast.error('Failed to load trade details');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAccept = async () => {
    setIsActionLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/trades/${id}/accept`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('shadowpay_token')}`
        }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to accept trade');
      
      toast.success('Trade accepted. Preparing deposit transaction...');
      
      if (!data.transaction) {
          throw new Error('No transaction returned from backend');
      }

      // Log unsigned transaction (base64 from backend)
      console.log('[Deposit] Unsigned transaction (base64):', data.transaction);

      // Deserialize transaction
      // Use browser-compatible base64 decoding
      const binaryString = atob(data.transaction);
      const txBuffer = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        txBuffer[i] = binaryString.charCodeAt(i);
      }
      
      let transaction;
      try {
          // Try Versioned first (standard for modern apps)
          transaction = VersionedTransaction.deserialize(txBuffer);
      } catch (e) {
          // Fallback to legacy Transaction
          console.warn('Failed to deserialize versioned transaction, trying legacy', e);
          transaction = Transaction.from(txBuffer);
      }

      // Log deserialized unsigned transaction for inspection
      console.log('[Deposit] Unsigned transaction (deserialized):', transaction);
      
      // Sign and Send
      const signature = await sendTransaction(transaction, connection);
      
      // Submit signature to backend immediately; treat tx hash as success
      await handleDepositSignature(signature);

      toast.success('Deposit transaction submitted. Verification may take a moment.');
      fetchTrade();

      // Wait for confirmation in background; do not fail flow on timeout (backend verifies on GET trade)
      try {
        await connection.confirmTransaction(signature, 'confirmed');
      } catch (_confirmError) {
        // Ignore confirmation timeout; tx may still succeed (backend will verify)
      }
    } catch (error: any) {
      console.error('Accept flow error:', error);
      toast.error(error.message || 'Transaction failed');
      fetchTrade();
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDepositSignature = async (sig: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/trades/${id}/deposit-signature`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('shadowpay_token')}`
        },
        body: JSON.stringify({ txSignature: sig })
      });
      if (!response.ok) throw new Error('Failed to submit deposit signature');
      toast.success('Deposit signature submitted! Verifying...');
      fetchTrade();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleSettle = async () => {
    if (!trade || !user?.address || !id) return;
    setIsActionLoading(true);
    try {
      toast.info('Generating ZK proof for private settlement...');

      if (typeof window.ShadowPayClient === 'undefined') {
        throw new Error('ShadowPay SDK not loaded. Please refresh the page.');
      }

      // Initialize ShadowPay client with baseUrl (doc: most up-to-date approach)
      const shadowpay = new window.ShadowPayClient({
        baseUrl: 'https://shadow.radr.fun/shadowpay',
      });
      try {
        await (shadowpay.initialize ? shadowpay.initialize() : shadowpay.init?.());
      } catch (initErr: any) {
        const msg = initErr?.message || String(initErr);
        if (msg.includes('is not valid JSON') || msg.includes('<!doctype'))
          throw new Error('ShadowPay could not load assets (got HTML). In dev, ensure Vite proxy for /shadowpay is used and restart the dev server.');
        throw initErr;
      }

      const payerWallet = typeof user?.address === 'string' ? user.address.trim() : '';
      const payee = typeof trade?.sellerAddress === 'string' ? trade.sellerAddress.trim() : '';
      if (!payerWallet || !payee) {
        throw new Error('Buyer or seller address missing. Refresh and try again.');
      }
      const amountSol = Number(trade.priceInSol);
      const amountLamports = Math.round(amountSol * 1_000_000_000);
      const resourceDesc = `Escrow release for deal ${id}`;

      // SDK expects lamports; use payerWallet/payee (doc) and common aliases so SDK finds expected keys
      let paymentData: unknown;
      const paymentArgs = {
        payerWallet,
        payee,
        amountLamports,
        resource: resourceDesc,
        userWallet: payerWallet,
        merchantWallet: payee,
        recipient: payee,
        amount: amountLamports,
      };
      if (typeof shadowpay.generatePayment === 'function') {
        paymentData = await shadowpay.generatePayment(paymentArgs);
      } else if (typeof shadowpay.generatePaymentProof === 'function') {
        paymentData = await shadowpay.generatePaymentProof(paymentArgs);
      } else {
        throw new Error('ShadowPay SDK: generatePayment or generatePaymentProof not found.');
      }

      // paymentHeader: base64 of proof data (doc: btoa(JSON.stringify(paymentData)))
      const paymentHeader =
        typeof shadowpay.encodePayment === 'function'
          ? shadowpay.encodePayment(paymentData)
          : typeof paymentData === 'object' && paymentData !== null
            ? btoa(JSON.stringify(paymentData))
            : String(paymentData);

      // maxAmountRequired: SOL as string (doc: e.g. "0.05")
      const settleData = {
        paymentHeader,
        resource: resourceDesc,
        paymentRequirements: {
          scheme: 'zkproof',
          network: 'solana-mainnet',
          maxAmountRequired: trade.priceInSol.toString(),
          resource: resourceDesc,
          description: 'Payment release after receiving goods',
          mimeType: 'application/json',
          payTo: trade.sellerAddress,
          maxTimeoutSeconds: 300,
        },
      };

      const response = await fetch(`${API_BASE_URL}/api/trades/${id}/settle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('shadowpay_token')}`
        },
        body: JSON.stringify(settleData)
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Settlement failed');
      }

      toast.success('Trade settled successfully! Funds released privately.');
      fetchTrade();
    } catch (error: any) {
      console.error('Settlement Error:', error);
      toast.error(error.message);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleReject = async () => {
     console.log('Rejecting trade...');
     setIsActionLoading(true);
     setShowRejectConfirm(false);
     
     try {
       const response = await fetch(`${API_BASE_URL}/api/trades/${id}/reject`, {
         method: 'POST',
         headers: {
           'Authorization': `Bearer ${localStorage.getItem('shadowpay_token')}`
         }
       });
       if (!response.ok) throw new Error('Failed to reject trade');
       toast.success('Trade rejected');
       fetchTrade();
     } catch (error: any) {
       toast.error(error.message);
     } finally {
       setIsActionLoading(false);
     }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!trade) {
    return (
      <div className="container mx-auto px-4 py-24 flex flex-col items-center">
        <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold text-white mb-2">Trade Not Found</h1>
        <Button onClick={() => navigate('/trades')} variant="outline">Back to Trades</Button>
      </div>
    );
  }

  const isBuyer = trade.buyerAddress === user?.address;
  const isSeller = trade.sellerAddress === user?.address;

  return (
    <div className="container mx-auto px-4 py-24 min-h-screen">
      <Button 
        onClick={() => navigate('/trades')} 
        variant="ghost" 
        className="mb-8 text-muted-foreground hover:text-black"
      >
        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Trades
      </Button>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-6">
          <Card className="bg-[#0f172a]/40 border-white/10 backdrop-blur-sm shadow-xl">
            <CardHeader>
              <div className="flex justify-between items-start">
                <Badge variant="outline" className="px-3 py-1 bg-white/10 text-white border-primary/20">
                  {trade.status.replace('_', ' ')}
                </Badge>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground uppercase tracking-widest">Amount</p>
                  <p className="text-2xl font-bold text-white tracking-tighter">{trade.priceInSol} SOL</p>
                </div>
              </div>
              <CardTitle className="text-2xl font-bold text-white mb-2 flex items-center gap-3">
                <Package className="w-6 h-6 text-white" />
                {trade.itemName}
              </CardTitle>
              <CardDescription className="text-base text-muted-foreground leading-relaxed">
                {trade.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-6 border-t border-white/5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                  <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2 font-semibold">Seller</p>
                  <p className="text-sm font-mono text-white break-all">{trade.sellerAddress}</p>
                  {isSeller && <Badge className="mt-2 bg-white/20 text-white border-none">You</Badge>}
                </div>
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                  <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2 font-semibold">Buyer</p>
                  <p className="text-sm font-mono text-white break-all">{trade.buyerAddress}</p>
                  {isBuyer && <Badge className="mt-2 bg-white/20 text-white border-none">You</Badge>}
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-white uppercase tracking-widest flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-primary" />
                    Transaction Details
                </h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm py-2 border-b border-white/5">
                    <span className="text-muted-foreground">Trade ID</span>
                    <span className="text-white font-mono">{trade.tradeId}</span>
                  </div>
                  <div className="flex justify-between text-sm py-2 border-b border-white/5">
                    <span className="text-muted-foreground">Created At</span>
                    <span className="text-white">{new Date(trade.createdAt).toLocaleString()}</span>
                  </div>
                  {trade.depositTxSignature && (
                    <div className="flex justify-between text-sm py-2 border-b border-white/5">
                      <span className="text-muted-foreground">Deposit Tx</span>
                      <a 
                        href={`https://explorer.solana.com/tx/${trade.depositTxSignature}`} 
                        target="_blank" 
                        className="text-primary hover:underline flex items-center gap-1 font-mono text-xs"
                      >
                        {trade.depositTxSignature.substring(0, 16)}... <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6 md:sticky md:top-24 self-start">
          <Card className="bg-primary shadow-[0_0_50px_-12px_rgba(59,130,246,0.3)] border-none">
            <CardHeader>
              <CardTitle className="text-white text-lg">Trade Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 text-white">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">{trade.status.replace('_', ' ')}</p>
                  <p className="text-xs text-white/70">Current stage of the trade</p>
                </div>
              </div>

              {['PENDING', 'ACCEPTED'].includes(trade.status) && isBuyer && (
                <div className="pt-4 flex flex-col gap-3">
                  <Button 
                    onClick={handleAccept} 
                    disabled={isActionLoading}
                    className="w-full bg-white text-black hover:bg-white/90 font-bold"
                  >
                    Accept & Deposit
                  </Button>
                  <Button 
                    onClick={() => setShowRejectConfirm(true)} 
                    disabled={isActionLoading}
                    variant="ghost" 
                    className="w-full text-white hover:bg-white/10"
                  >
                    Reject Trade
                  </Button>
                </div>
              )}

              {(trade.status === 'DEPOSIT_CONFIRMED' || trade.status === 'SETTLE_PENDING') && isBuyer && (
                <div className="pt-4">
                  <Button 
                    onClick={handleSettle} 
                    disabled={isActionLoading}
                    className="w-full bg-white text-primary hover:bg-white/90 font-bold"
                  >
                    {trade.status === 'SETTLE_PENDING' ? 'Retry Settle' : 'Settle Privately'}
                  </Button>
                  <p className="text-[10px] text-white/50 text-center mt-4">
                    {trade.status === 'SETTLE_PENDING'
                      ? 'Settlement may still be in progress or failed. You can retry.'
                      : 'Uses ShadowPay ZK protocol to release funds privately.'}
                  </p>
                </div>
              )}

              {trade.status === 'DEPOSIT_PENDING' && isBuyer && (
              <div className="space-y-4">
                {trade.depositTxSignature && !verificationError ? (
                    <div className="flex items-center gap-2 text-yellow-500 bg-yellow-500/10 p-3 rounded-lg border border-yellow-500/20">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-500"></div>
                    <span>Verifying deposit transaction...</span>
                    </div>
                ) : !trade.depositTxSignature ? (
                    <div className="flex items-center gap-2 text-blue-500 bg-blue-500/10 p-3 rounded-lg border border-blue-500/20">
                    <AlertCircle className="w-4 h-4" />
                    <span>Transaction created. Please confirm in your wallet.</span>
                    </div>
                ) : null}
                
                {verificationError && (
                    <div className="text-red-500 bg-red-500/10 p-3 rounded-lg border border-red-500/20 text-sm">
                        <p className="font-bold">Verification Failed</p>
                        <p>{verificationError}</p>
                    </div>
                )}

                <Button 
                  onClick={handleAccept} 
                  disabled={isActionLoading}
                  variant="outline"
                  className="w-full border-yellow-500/50 hover:bg-yellow-500/10"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${isActionLoading ? 'animate-spin' : ''}`} />
                  Retry Deposit
                </Button>
              </div>
            )}

              {trade.status === 'DEPOSIT_PENDING' && isSeller && (
              <div className="space-y-4">
                {trade.depositTxSignature ? (
                    <div className="flex items-center gap-2 text-yellow-500 bg-yellow-500/10 p-3 rounded-lg border border-yellow-500/20">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-500"></div>
                    <span>Deposit submitted. Verifying... (status from server)</span>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 text-blue-500 bg-blue-500/10 p-3 rounded-lg border border-blue-500/20">
                    <AlertCircle className="w-4 h-4" />
                    <span>Waiting for buyer to submit deposit.</span>
                    </div>
                )}
                <p className="text-xs text-white/70 text-center">
                  Status is updated when you refresh or when the page refetches. Backend verifies deposit signature and balance via GET /api/trades/:tradeId.
                </p>
              </div>
            )}

              {trade.status === 'SUCCESS' && (
                  <div className="pt-4 text-center">
                    <CheckCircle2 className="w-12 h-12 text-white mx-auto mb-3" />
                    <p className="font-bold text-white">Trade Completed</p>
                    <p className="text-xs text-white/70 mt-1">Funds have been released to the seller.</p>
                  </div>
              )}

              {trade.status === 'REJECTED' && (
                  <div className="pt-4 text-center text-white">
                    <XCircle className="w-12 h-12 text-white/50 mx-auto mb-3" />
                    <p className="font-bold">Trade Rejected</p>
                  </div>
              )}

              {isSeller && trade.status === 'PENDING' && (
                <p className="text-xs text-white/70 text-center">
                  Waiting for the buyer to accept and fund the trade.
                </p>
              )}
              
              {isSeller && trade.status === 'DEPOSIT_CONFIRMED' && (
                <p className="text-xs text-white/70 text-center">
                  Buyer has deposited funds. Waiting for settlement.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/10 backdrop-blur-md flex flex-col h-[500px] lg:h-[600px]">
            <CardHeader className="pb-3 border-b border-white/5">
              <CardTitle className="text-sm font-semibold uppercase tracking-widest text-white flex items-center justify-between">
                <span className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-primary" />
                    Live Chat
                </span>
                <span className="text-[10px] normal-case bg-green-500/10 text-green-400 px-2 py-0.5 rounded border border-green-500/20">
                    Encrypted & Secure
                </span>
              </CardTitle>
            </CardHeader>
            <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
                {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-50 space-y-2">
                        <MessageSquare className="w-8 h-8" />
                        <p className="text-xs text-center">Start the conversation...<br/>Messages are end-to-end encrypted.</p>
                    </div>
                ) : (
                    messages.map((msg) => (
                        <div key={msg.id} className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                                msg.sender === 'me' 
                                ? 'bg-primary text-white rounded-br-none' 
                                : 'bg-white/10 text-white rounded-bl-none'
                            }`}>
                                <p>{msg.content}</p>
                                <span className="text-[10px] opacity-50 mt-1 block text-right">
                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        </div>
                    ))
                )}
            </div>
            <div className="p-3 border-t border-white/5 bg-black/20">
              {['REJECTED', 'DEPOSIT_CONFIRMED', 'SETTLE_PENDING'].includes(trade.status) ? (
                <div className="text-center text-red-400 text-sm font-medium p-2 bg-red-500/10 rounded">
                    Chat has ended.
                </div>
              ) : (
                <form className="flex gap-2" onSubmit={handleSendMessage}>
                    <Input 
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type a message..." 
                        className="bg-black/50 border-white/10 text-white focus:border-primary text-sm h-9"
                    />
                    <Button type="submit" size="icon" className="h-9 w-9 bg-primary hover:bg-primary/90 text-white shrink-0">
                        <Send className="w-4 h-4" />
                    </Button>
                </form>
              )}
            </div>
          </Card>
        </div>
      </div>

      <Dialog open={showRejectConfirm} onOpenChange={setShowRejectConfirm}>
        <DialogContent className="bg-[#0f172a] border-white/10 text-white sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-white">Reject Trade?</DialogTitle>
            <DialogDescription className="text-white/70">
              Are you sure you want to reject this trade? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:justify-end">
            <Button variant="ghost" onClick={() => setShowRejectConfirm(false)} className="text-white hover:bg-white/10">
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReject}>
              Reject Trade
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
