import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { MessageSquare, Clock, ChevronRight } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { toast } from 'sonner';
import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from '@/lib/config';

interface Conversation {
  conversationId: string;
  buyerAddress: string;
  sellerAddress: string;
  lastMessageAt: string;
  lastMessageText: string;
}

export function ConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    fetchConversations();

    const token = localStorage.getItem('shadowpay_token');
    if (!token) return;

    const socket = io(API_BASE_URL, {
      auth: { token },
      transports: ['websocket', 'polling']
    });

    socket.on('message_received', () => {
        fetchConversations();
    });

    socket.on('message_sent', () => {
        fetchConversations();
    });

    return () => {
        socket.disconnect();
    };
  }, []);

  const fetchConversations = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/conversations`, {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('shadowpay_token')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setConversations(data.conversations);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
      toast.error('Failed to load conversations');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-24 min-h-screen">
      <div className="flex items-center justify-between mb-8">
        <div>
            <h1 className="text-3xl font-bold text-white mb-2">My Conversations</h1>
            <p className="text-muted-foreground">Secure, encrypted messages with your trading partners.</p>
        </div>
      </div>

      <div className="grid gap-4">
        {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading conversations...</div>
        ) : conversations.length === 0 ? (
            <Card className="bg-white/5 border-white/10">
                <CardContent className="flex flex-col items-center justify-center py-12">
                    <MessageSquare className="w-12 h-12 text-muted-foreground mb-4" />
                    <p className="text-white text-lg font-medium">No conversations yet</p>
                    <p className="text-muted-foreground text-sm">Start a trade to begin chatting.</p>
                </CardContent>
            </Card>
        ) : (
            conversations.map((conv) => {
                const otherAddress = user?.type === 'seller' ? conv.buyerAddress : conv.sellerAddress;
                return (
                    <Card 
                        key={conv.conversationId} 
                        className="bg-[#0f172a]/40 border-white/10 hover:bg-white/10 transition-colors cursor-pointer group"
                        onClick={() => {
                            if (conv.conversationId.startsWith('trade_')) {
                                const tradeId = conv.conversationId.replace('trade_', '');
                                navigate(`/trades/${tradeId}`);
                            } else {
                                navigate(`/chat/${otherAddress}`);
                            }
                        }}
                    >
                        <CardContent className="p-6 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white">
                                    <MessageSquare className="w-5 h-5" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-white font-mono font-medium truncate">
                                        {otherAddress.substring(0, 6)}...{otherAddress.substring(otherAddress.length - 4)}
                                    </p>
                                    <p className="text-sm text-muted-foreground mt-1 line-clamp-1 break-all">
                                        {conv.lastMessageText || 'No messages yet'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                {conv.lastMessageAt && (
                                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {new Date(conv.lastMessageAt).toLocaleDateString()}
                                    </div>
                                )}
                                <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                            </div>
                        </CardContent>
                    </Card>
                );
            })
        )}
      </div>
    </div>
  );
}
