import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Send, ShieldCheck, DollarSign } from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: string;
  content: string;
  timestamp: number;
}

export function ChatPage() {
  const { id } = useParams(); // Wallet address of the other party
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');

  // Determine chat ID (normally sorted addresses to create a unique room ID)
  // For this mock, we just store by "chat_myAddr_otherAddr"
  
  useEffect(() => {
    // Load fake initial messages
    setMessages([
      { id: '1', sender: 'other', content: 'Hello! I am interested in selling SOL.', timestamp: Date.now() - 100000 },
      { id: '2', sender: 'me', content: 'Hi, what is your rate?', timestamp: Date.now() - 50000 },
    ]);
  }, []);

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;
    
    const msg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'me',
      content: newMessage,
      timestamp: Date.now(),
    };

    setMessages([...messages, msg]);
    setNewMessage('');
    
    // Mock reply
    setTimeout(() => {
        const reply: ChatMessage = {
            id: (Date.now() + 1).toString(),
            sender: 'other',
            content: 'I can do market rate + 2%.',
            timestamp: Date.now(),
        };
        setMessages(prev => [...prev, reply]);
    }, 1500);
  };

  const handleStartTrade = () => {
      // Logic to start escow trade
      console.log('Starting trade with', id);
      // Could open a modal or redirect to a trade creation flow
      // For now, just logging
  };

  return (
    <div className="container mx-auto px-4 py-8 h-[calc(100vh-100px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 bg-white/5 p-4 rounded-xl border border-white/10 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="text-white hover:bg-white/10">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              Chat with <span className="font-mono bg-blue-500/20 px-2 py-0.5 rounded text-blue-400 text-base">{id?.slice(0, 6)}...{id?.slice(-4)}</span>
            </h2>
            <div className="flex items-center gap-1 text-xs text-green-400">
              <span className="relative flex h-2 w-2 mr-1">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              Online • Verified Seller
            </div>
          </div>
        </div>
        
        <Button onClick={handleStartTrade} className="bg-green-600 hover:bg-green-700 text-white gap-2 shadow-lg shadow-green-900/20">
          <ShieldCheck className="w-4 h-4" />
          Start Secure Trade
        </Button>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex gap-6 overflow-hidden">
        {/* Chat Window */}
        <div className="flex-1 flex flex-col bg-[#020817]/50 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-sm">
            <ScrollArea className="flex-1 p-6">
                <div className="space-y-4">
                    {messages.map((msg) => (
                        <div key={msg.id} className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[70%] rounded-2xl px-4 py-3 ${
                                msg.sender === 'me' 
                                ? 'bg-primary text-white rounded-br-none' 
                                : 'bg-white/10 text-white rounded-bl-none'
                            }`}>
                                <p className="text-sm">{msg.content}</p>
                                <span className="text-[10px] opacity-50 mt-1 block text-right">
                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </ScrollArea>
            
            <div className="p-4 bg-white/5 border-t border-white/10">
                <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}>
                    <Input 
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type your message..." 
                        className="bg-[#020817] border-white/10 text-white focus:border-primary"
                    />
                    <Button type="submit" size="icon" className="bg-primary hover:bg-primary/90 text-white">
                        <Send className="w-5 h-5" />
                    </Button>
                </form>
            </div>
        </div>

        {/* Trade Details Sidebar (Optional/Responsive) */}
        <div className="hidden lg:block w-80 bg-white/5 border border-white/10 rounded-2xl p-6 h-fit">
            <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-green-400" />
                Active Trade
            </h3>
            <div className="text-sm text-center py-10 text-muted-foreground border-2 border-dashed border-white/10 rounded-xl">
                No active trade yet.
                <br />
                <Button variant="link" onClick={handleStartTrade} className="text-blue-400">Initiate one now</Button>
            </div>
        </div>
      </div>
    </div>
  );
}
