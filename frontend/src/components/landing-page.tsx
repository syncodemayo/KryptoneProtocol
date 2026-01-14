import { useState, useEffect } from 'react';
import { CreditCard, Shield, Zap, CheckCircle, Lock, Globe, Star, Users, Sparkles, TrendingUp } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { ConnectWallet } from '@/components/connect-wallet';
import { Header } from '@/components/layout/header';
import { TopNav } from '@/components/layout/top-nav';
import { ThemeSwitch } from '@/components/theme-switch';
import { useWallet } from '@/hooks/use-wallet';

export function LandingPage() {
  const { isAuthenticated } = useWallet();
  const [activeCard, setActiveCard] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Use a timeout to avoid synchronous setState in effect
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 0);
    
    const interval = setInterval(() => {
      setActiveCard(prev => (prev + 1) % 3);
    }, 3000);
    
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, []);

  const NAV_LINKS = [
    { title: 'Credit Cards', href: '/cards', disabled: false },
    { title: 'My Account', href: '/my-account', disabled: false },
  ];

  const availableLinks = isAuthenticated ? NAV_LINKS : [];
  const topNavLinks = availableLinks.map(link => ({ ...link, isActive: false }));

  const features = [
    {
      icon: <Shield className="h-6 w-6 text-black" />,
      title: 'Blockchain Security',
      description: 'Military-grade encryption powered by Solana blockchain technology',
      stats: '99.9% Uptime'
    },
    {
      icon: <Zap className="h-6 w-6 text-gray-700" />,
      title: 'Instant Activation',
      description: 'Get your virtual credit card activated in under 2 minutes',
      stats: '<2min Setup'
    },
    {
      icon: <Lock className="h-6 w-6 text-gray-800" />,
      title: 'Privacy First',
      description: 'Zero-knowledge architecture protects your financial privacy',
      stats: '256-bit Encryption'
    },
    {
      icon: <Globe className="h-6 w-6 text-gray-600" />,
      title: 'Global Access',
      description: 'Accepted worldwide with zero geographic restrictions',
      stats: '190+ Countries'
    }
  ];

  const cardTypes = [
    {
      name: '$5 Credit Card',
      limit: '$50',
      price: '5 USDC',
      description: 'Perfect for beginners',
      gradient: 'card-white',
      textColor: 'text-gray-900',
      popular: false,
      features: ['Basic spending limits', 'Standard support', 'Instant activation']
    },
    {
      name: '$10 Credit Card',
      limit: '$100',
      price: '10 USDC',
      description: 'Great for everyday use',
      gradient: 'card-silver',
      textColor: 'text-black',
      popular: true,
      features: ['Higher limits', 'Priority support', 'Advanced analytics']
    },
    {
      name: '$50 Credit Card',
      limit: '$500',
      price: '50 USDC',
      description: 'High limits for professionals',
      gradient: 'card-black',
      textColor: 'text-white',
      popular: false,
      features: ['Maximum limits', '24/7 support', 'Premium features']
    }
  ];

  const stats = [
    { number: '10,000+', label: 'Active Users', icon: <Users className="h-5 w-5" /> },
    { number: '$2M+', label: 'Transactions', icon: <TrendingUp className="h-5 w-5" /> },
    { number: '4.9/5', label: 'User Rating', icon: <Star className="h-5 w-5" /> },
    { number: '99.9%', label: 'Uptime', icon: <Shield className="h-5 w-5" /> },
  ];

  const testimonials = [
    {
      name: "Sarah Chen",
      role: "Digital Nomad",
      content: "MaskedCash revolutionized how I handle payments while traveling. Instant setup and works everywhere!",
      rating: 5
    },
    {
      name: "Marcus Rodriguez",
      role: "Crypto Trader",
      content: "The blockchain security gives me complete peace of mind. Best virtual card service I've used.",
      rating: 5
    },
    {
      name: "Emma Thompson",
      role: "Freelancer",
      content: "Quick SOL payments and immediate activation. Perfect for my business needs!",
      rating: 5
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      <Header>
        <TopNav links={topNavLinks} />
        <div className="ms-auto flex items-center space-x-4">
          <ThemeSwitch />
          <ConnectWallet />
        </div>
      </Header>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24">
          <div className={`text-center transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <div className="flex items-center justify-center mb-6">
              <Badge variant="secondary" className="silver-accent border-gray-300 px-4 py-2 text-sm font-medium">
                <Sparkles className="h-4 w-4 mr-2 text-gray-700" />
                Powered by Solana Blockchain
              </Badge>
            </div>

            <h1 className="text-5xl md:text-7xl font-bold text-gray-900 mb-6 leading-tight">
              <span className="block">The Future of</span>
              <span className="text-black">
                Virtual Payments
              </span>
            </h1>

            <p className="text-xl md:text-2xl text-gray-600 mb-8 max-w-4xl mx-auto leading-relaxed">
              Experience lightning-fast virtual credit cards powered by blockchain technology. 
              <span className="font-semibold text-black"> Pay with USDC, activate instantly, spend globally.</span>
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12 max-w-2xl mx-auto">
              {stats.map((stat, index) => (
                <div key={index} className="text-center p-4 rounded-lg silver-accent backdrop-blur-sm border border-gray-300">
                  <div className="flex items-center justify-center mb-1 text-black">
                    {stat.icon}
                  </div>
                  <div className="text-lg font-bold text-gray-900">{stat.number}</div>
                  <div className="text-sm text-gray-600">{stat.label}</div>
                </div>
              ))}
            </div>

           
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {cardTypes.map((card, index) => (
                <div
                  key={index}
                  className={`relative group cursor-pointer transition-all duration-500 ${activeCard === index ? 'scale-105 z-10' : 'hover:scale-102'}`}
                  onMouseEnter={() => setActiveCard(index)}
                >
                  {card.popular && (
                    <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-20">
                      <Badge className="badge-silver font-semibold px-3 py-1">
                        <Star className="h-3 w-3 mr-1" />
                        Most Popular
                      </Badge>
                    </div>
                  )}
                  
                  <div className={`relative h-64 rounded-2xl ${card.gradient} p-6 ${card.textColor} shadow-2xl transition-all duration-500 group-hover:shadow-3xl`}>
                    <div className="flex flex-col justify-between h-full">
                      <div>
                        <h3 className="text-xl font-bold mb-2">{card.name}</h3>
                        <p className="text-sm opacity-90 mb-4">{card.description}</p>
                        <ul className="text-xs opacity-80 space-y-1">
                          {card.features.map((feature, idx) => (
                            <li key={idx} className="flex items-center gap-1">
                              <CheckCircle className="h-3 w-3" />
                              {feature}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="flex justify-between items-end">
                        <div>
                          <p className="text-sm opacity-75">Credit Limit</p>
                          <p className="text-2xl font-bold">{card.limit}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm opacity-75">Price</p>
                          <p className="text-xl font-bold">{card.price}</p>
                        </div>
                      </div>
                    </div>
                    <div className="absolute top-6 right-6 w-10 h-6 bg-white/20 rounded-md"></div>
                    <div className="absolute top-6 right-6 w-8 h-4 bg-white/30 rounded-sm"></div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent rounded-2xl"></div>
                    <div className="absolute inset-0 opacity-10">
                      <div className="absolute top-4 left-4 w-2 h-2 bg-white rounded-full animate-ping"></div>
                      <div className="absolute top-8 right-8 w-1 h-1 bg-white rounded-full animate-ping" style={{ animationDelay: '1s' }}></div>
                      <div className="absolute bottom-8 left-8 w-1.5 h-1.5 bg-white rounded-full animate-ping" style={{ animationDelay: '2s' }}></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {/* Subtle background decorations for monochrome theme */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gray-50 rounded-full blur-3xl -z-10 opacity-30"></div>
        <div className="absolute top-1/4 right-0 w-[400px] h-[400px] bg-gray-100 rounded-full blur-2xl -z-10 opacity-40"></div>
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-gray-200 rounded-full blur-2xl -z-10 opacity-40"></div>
      </section>

      {/* Features Section */}
      <section className="py-24 silver-accent">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Why Choose <span className="text-black">MaskedCash?</span>
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Experience the next generation of digital payments with industry-leading security and performance
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="group text-center p-8 rounded-2xl bg-white hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 border border-gray-200"
              >
                <div className="w-16 h-16 mx-auto mb-6 rounded-2xl silver-accent shadow-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-black transition-colors">
                  {feature.title}
                </h3>
                <p className="text-gray-600 text-sm mb-4 leading-relaxed">
                  {feature.description}
                </p>
                <div className="inline-flex items-center px-3 py-1 rounded-full silver-accent text-gray-800 text-xs font-semibold">
                  {feature.stats}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">Trusted by Thousands</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              See what our users are saying about their MaskedCash experience
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <div key={index} className="p-8 rounded-2xl silver-accent hover:bg-white shadow-lg border border-gray-200 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300">
                <div className="flex items-center mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 text-gray-800 fill-current" />
                  ))}
                </div>
                <p className="text-gray-600 mb-6 italic leading-relaxed">
                  "{testimonial.content}"
                </p>
                <div>
                  <p className="font-semibold text-gray-900">{testimonial.name}</p>
                  <p className="text-sm text-gray-500">{testimonial.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 silver-accent">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">How It Works</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Get your virtual credit card in just three simple steps
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="text-center group">
              <div className="w-20 h-20 mx-auto mb-8 rounded-full bg-white border-2 border-gray-300 flex items-center justify-center text-black font-bold text-2xl shadow-xl group-hover:scale-110 transition-transform duration-300">
                1
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4 group-hover:text-black transition-colors">
                Connect Wallet
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Connect your Solana wallet and authenticate securely using blockchain technology
              </p>
            </div>
            <div className="text-center group">
              <div className="w-20 h-20 mx-auto mb-8 rounded-full bg-gray-300 flex items-center justify-center text-black font-bold text-2xl shadow-xl group-hover:scale-110 transition-transform duration-300">
                2
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4 group-hover:text-black transition-colors">
                Choose & Pay
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Select your preferred credit card type and pay instantly with USDC cryptocurrency
              </p>
            </div>
            <div className="text-center group">
              <div className="w-20 h-20 mx-auto mb-8 rounded-full bg-black flex items-center justify-center text-white font-bold text-2xl shadow-xl group-hover:scale-110 transition-transform duration-300">
                3
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4 group-hover:text-black transition-colors">
                Start Using
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Your virtual credit card is activated within minutes and ready to use globally
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-black relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <h2 className="text-4xl md:text-6xl font-bold text-white mb-6">
            Ready to <span className="text-gray-200">Transform</span> Your Payments?
          </h2>
          <p className="text-xl md:text-2xl text-gray-300 mb-12 max-w-3xl mx-auto leading-relaxed">
            Join thousands of users who trust MaskedCash for secure, instant virtual credit cards
          </p>
          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center mb-12">
            <ConnectWallet />
            <div className="text-center">
              <p className="text-sm text-gray-400 mb-1">🚀 Setup in under 2 minutes</p>
              <p className="text-sm text-gray-400">✨ No credit checks required</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto text-left">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-white/10 backdrop-blur-sm">
              <CheckCircle className="h-6 w-6 text-gray-300 flex-shrink-0" />
              <span className="text-white">Blockchain secured</span>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-lg bg-white/10 backdrop-blur-sm">
              <CheckCircle className="h-6 w-6 text-gray-300 flex-shrink-0" />
              <span className="text-white">Instant activation</span>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-lg bg-white/10 backdrop-blur-sm">
              <CheckCircle className="h-6 w-6 text-gray-300 flex-shrink-0" />
              <span className="text-white">Global acceptance</span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center">
                <CreditCard className="h-6 w-6 text-white" />
              </div>
              <div>
                <span className="text-xl font-bold text-gray-900">MaskedCash</span>
                <p className="text-sm text-gray-500">The future of virtual payments</p>
              </div>
            </div>
            <div className="flex flex-col md:flex-row items-center gap-6 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-black" />
                <span>Powered by Solana</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-gray-700" />
                <span>Secure & Verified</span>
              </div>
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-gray-800" />
                <span>4.9/5 User Rating</span>
              </div>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-200 text-center text-sm text-gray-500">
            <p>&copy; 2026 MaskedCash. All rights reserved. Built with ❤️ for the crypto community.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}