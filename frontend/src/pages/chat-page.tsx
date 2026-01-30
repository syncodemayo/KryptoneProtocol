import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Send, MessageSquare, ShieldCheck, Loader2 } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from '@/lib/config';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

interface ChatMessage {
  id: string;
  sender: string;
  content: string;
  timestamp: number;
}

export function ChatPage() {
  const { id } = useParams(); // Start chat with this address
  const navigate = useNavigate();
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  
  // New Trade State
  const [showCreateTrade, setShowCreateTrade] = useState(false);
  const [tradeData, setTradeData] = useState({ name: '', price: '', description: '' });
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateTrade = async () => {
    if (isCreating) return;
    if (!tradeData.name || !tradeData.price) {
        toast.error('Item name and price are required');
        return;
    }

    setIsCreating(true);
    try {
        const response = await fetch(`${API_BASE_URL}/api/trades`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('shadowpay_token')}`
            },
            body: JSON.stringify({
                itemName: tradeData.name,
                priceInSol: parseFloat(tradeData.price),
                description: tradeData.description,
                sellerAddress: id // The chat partner is the seller
            })
        });

        const data = await response.json();
        if (response.ok) {
            toast.success('Trade proposal created!');
            setShowCreateTrade(false);
            navigate(`/trades/${data.trade.tradeId}`);
        } else {
            throw new Error(data.error || 'Failed to create trade');
        }
    } catch (error: any) {
        toast.error(error.message);
    } finally {
        setIsCreating(false);
    }
  };
  
  const socketRef = useRef<Socket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (!id || !user?.address) return;

    // Determine conversation ID safely (case-insensitive for room stability)
    const addresses = [user.address.toLowerCase(), id.toLowerCase()].sort();
    const convId = `${addresses[0]}_${addresses[1]}`;
    setConversationId(convId);

    const token = localStorage.getItem('shadowpay_token');
    if (!token) return;

    const socket = io(API_BASE_URL, {
      auth: { token },
      transports: ['websocket', 'polling']
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to chat server');
      setIsConnected(true);
      socket.emit('join_conversation', { conversationId: convId });
      socket.emit('get_history', { conversationId: convId });
    });

    socket.on('message_history', (data: { conversationId: string, messages: any[] }) => {
        if (data.conversationId.toLowerCase() === (convId || '').toLowerCase()) {
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
        if (msg.conversationId.toLowerCase() === (convId || '').toLowerCase()) {
            setMessages(prev => {
                if (prev.some(m => m.id === msg.id)) return prev;
                return [...prev, {
                    id: msg.id?.toString(),
                    sender: (msg.senderAddress || msg.sender_address || '') === user.address ? 'me' : 'other',
                    content: msg.messageText || msg.message_text,
                    timestamp: new Date(msg.createdAt || msg.created_at || Date.now()).getTime()
                }];
            });
        }
    });

    return () => {
      socket.disconnect();
    };
  }, [id, user?.address]);

  const handleSendMessage = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!newMessage.trim() || !socketRef.current || !conversationId) return;

    const text = newMessage;
    setNewMessage('');

    // Optimistic update
    const optimisticId = `opt_${Date.now()}`;
    setMessages(prev => [...prev, {
        id: optimisticId,
        sender: 'me',
        content: text,
        timestamp: Date.now()
    }]);

    socketRef.current.emit('send_message', {
        conversationId,
        recipientAddress: id, // The ID param is the other user's address
        messageText: text
    });
  };

  if (!id) return <div>Invalid Chat</div>;

  return (
    <div className="container mx-auto px-4 py-24 min-h-screen">
      <Button 
        onClick={() => navigate('/conversations')} 
        variant="ghost" 
        className="mb-6 text-muted-foreground hover:bg-white hover:text-black"
      >
        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Conversations
      </Button>

      <Card className="bg-[#0f172a]/40 border-white/10 backdrop-blur-sm shadow-xl h-[calc(100vh-10rem)] md:h-[700px] flex flex-col">
        <CardHeader className="border-b border-white/5 pb-4">
            <div className="flex justify-between items-center">
                <CardTitle className="text-white flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white">
                        <MessageSquare className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-lg font-mono">{id ? `${id.substring(0, 6)}...${id.substring(id.length - 4)}` : ''}</p>
                        <p className="text-xs text-green-400 flex items-center gap-1 font-normal">
                            <ShieldCheck className="w-3 h-3" /> End-to-End Encrypted
                        </p>
                    </div>
                </CardTitle>
                <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            </div>
            
            {user?.type === 'buyer' && (
                <Button 
                    onClick={() => setShowCreateTrade(true)} 
                    className="w-full mt-4 bg-white text-black hover:bg-white/90"
                >
                    <ShieldCheck className="w-4 h-4 mr-2" />
                    Start Trade
                </Button>
            )}
        </CardHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-4" ref={scrollRef}>
            {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-50 space-y-4">
                    <MessageSquare className="w-16 h-16" />
                    <p className="text-lg">No messages start yet.</p>
                </div>
            ) : (
                messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] md:max-w-[70%] rounded-2xl px-3 py-2 md:px-4 md:py-3 text-sm ${
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

        <div className="p-4 border-t border-white/5 bg-black/20">
            <form className="flex gap-4" onSubmit={handleSendMessage}>
                <Input 
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a secure message..." 
                    className="bg-black/50 border-white/10 text-white focus:border-primary"
                />
                <Button type="submit" className="bg-primary hover:bg-primary/90 text-white px-6">
                    <Send className="w-4 h-4" />
                </Button>
            </form>
        </div>
      </Card>

      <Dialog open={showCreateTrade} onOpenChange={setShowCreateTrade}>
        <DialogContent className="bg-[#0f172a] border-white/10 text-white sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-white">Start New Trade</DialogTitle>
            <DialogDescription className="text-white/70">
              Propose a secure trade to start chatting with this seller.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name" className="text-white">Item Name</Label>
              <Input
                id="name"
                value={tradeData.name}
                onChange={(e) => setTradeData(prev => ({ ...prev, name: e.target.value }))}
                className="bg-black/50 border-white/10 text-white"
                placeholder="e.g. Services, Digital Goods"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="price" className="text-white">Price (SOL)</Label>
              <Input
                id="price"
                type="number"
                step="0.000000001"
                value={tradeData.price}
                onChange={(e) => setTradeData(prev => ({ ...prev, price: e.target.value }))}
                className="bg-black/50 border-white/10 text-white"
                placeholder="0.0"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description" className="text-white">Description (Optional)</Label>
              <Textarea
                id="description"
                value={tradeData.description}
                onChange={(e) => setTradeData(prev => ({ ...prev, description: e.target.value }))}
                className="bg-black/50 border-white/10 text-white min-h-[80px]"
                placeholder="Details about the agreement..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCreateTrade(false)} className="text-white hover:bg-white/10">
              Cancel
            </Button>
            <Button onClick={handleCreateTrade} disabled={isCreating} className="bg-primary hover:bg-primary/90 text-white">
              {isCreating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
              ) : (
                  'Start Trade'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
