import { ShieldCheck, Lock, Zap, ChevronRight, Globe, Key } from 'lucide-react';
import { ConnectButton } from '@/components/ui/connect-button';

export function LandingPage() {
  return (
    <div className="flex flex-col gap-0 pb-20 overflow-hidden">
      {/* Hero Section */}
      <section className="relative pt-32 pb-40 overflow-hidden">
        <div className="container mx-auto px-4 md:px-6 relative z-30">
          <div className="max-w-5xl mx-auto text-center space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium animate-in fade-in slide-in-from-bottom-4 duration-700 backdrop-blur-md">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              Now Live on Solana Mainnet Beta
            </div>
            
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight text-white animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-100">
              Anonymous Privacy Escrow <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary via-blue-400 to-indigo-500 animate-gradient-x">for Digital Products</span>
            </h1>

            <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200">
              The first anonymous privacy-focused escrow service for digital products on Solana.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300">
              <div className="relative z-50">
                  <ConnectButton className="!h-16 !px-12 !text-lg !rounded-full !bg-gradient-to-r !from-primary !to-blue-600 hover:!opacity-90 !shadow-[0_0_30px_-5px_var(--primary)]" />
              </div>
            </div>
          </div>
        </div>
        
        {/* Background Decorative Elements */}
        {/* <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[600px] bg-primary/10 rounded-full blur-[120px] opacity-40 z-0 pointer-events-none animate-pulse duration-[5s]" /> */}
      </section>

      {/* Attribution Badge */}
      <section className="container mx-auto px-4 md:px-6 -mt-6 relative z-20 flex justify-center">
        <a 
          href="https://x.com/radrdotfun" 
          target="_blank" 
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white/5 backdrop-blur-xl border border-white/10 text-muted-foreground text-sm font-medium hover:bg-white/10 transition-colors cursor-pointer"
        >
          <span>Built using</span>
          <span className="text-white font-semibold flex items-center gap-1">
            RADR's shadowpay
          </span>
        </a>
      </section>


      {/* Features Grid */}
      <section id="features" className="container mx-auto px-4 md:px-6 py-32 scroll-mt-24">
        <div className="text-center mb-20 space-y-4">
            <h2 className="text-3xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60">Built for the Privacy-First Era</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">Architecture that prioritizes user sovereignty without compromising performance.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <FeatureCard 
            icon={<ShieldCheck className="w-8 h-8 text-primary" />}
            title="Institutional Security"
            description="Multi-signature vaults and rigorous audits ensure your assets are protected against all vectors."
          />
          <FeatureCard 
            icon={<Lock className="w-8 h-8 text-pink-500" />}
            title="Zero-Knowledge Privacy"
            description="Utilizing zk-SNARKs to obfuscate transaction details while maintaining on-chain verifiability."
            variant="pink"
          />
          <FeatureCard 
            icon={<Zap className="w-8 h-8 text-yellow-500" />}
            title="Solana Speed"
            description="Leveraging Solana's high throughput for sub-second confirmations and sub-cent fees."
            variant="yellow"
          />
          <FeatureCard 
            icon={<Globe className="w-8 h-8 text-green-500" />}
            title="Global Compliance"
            description="Optional compliance layers for authorized institutions dealing with regulated assets."
            variant="green"
          />
           <FeatureCard 
            icon={<Key className="w-8 h-8 text-purple-500" />}
            title="Non-Custodial"
            description="You retain full control of your private keys. We never hold your funds."
            variant="purple"
          />
           <FeatureCard 
            icon={<ChevronRight className="w-8 h-8 text-orange-500" />}
            title="Developer SDK"
            description="Integrate privacy escrow into your own dApps with our comprehensive TypeScript SDK."
            variant="orange"
          />
        </div>
      </section>

      {/* CTA Section */}
      <section id="join" className="container mx-auto px-4 md:px-6 pb-20 scroll-mt-32">
        <div className="relative p-12 md:p-32 text-center group">
          {/* Background Container with clipping */}
          <div className="absolute inset-0 rounded-[2.5rem] overflow-hidden border border-white/10 bg-gradient-to-br from-primary/10 via-[#020817] to-blue-600/10">
              <div className="absolute inset-0 bg-grid-white/[0.03] [mask-image:linear-gradient(0deg,transparent,black)] pointer-events-none" />
              <div className="absolute inset-0 bg-primary/20 blur-[100px] opacity-0 group-hover:opacity-30 transition-opacity duration-1000" />
          </div>
          
          <div className="relative z-10 space-y-8">
            <h2 className="text-4xl md:text-6xl font-bold tracking-tight text-white">Start buying & selling with confidence.</h2>
            <p className="text-muted-foreground text-xl max-w-2xl mx-auto">
              Join the fastest growing secure marketplace on Solana and experience true commerce sovereignty.
            </p>
            <div className="pt-8 flex justify-center relative z-50">
                <ConnectButton className="!h-16 !px-12 !text-lg !rounded-full !bg-white !text-black hover:!bg-white/90 !font-bold !shadow-2xl !shadow-white/10" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}



function FeatureCard({ icon, title, description, variant = 'primary' }: { icon: React.ReactNode; title: string; description: string, variant?: string }) {
    const colorClasses = {
        primary: 'group-hover:bg-primary/5 group-hover:border-primary/20',
        pink: 'group-hover:bg-pink-500/5 group-hover:border-pink-500/20',
        yellow: 'group-hover:bg-yellow-500/5 group-hover:border-yellow-500/20',
        green: 'group-hover:bg-green-500/5 group-hover:border-green-500/20',
        purple: 'group-hover:bg-purple-500/5 group-hover:border-purple-500/20',
        orange: 'group-hover:bg-orange-500/5 group-hover:border-orange-500/20',
    }

  return (
    <div className={`group p-8 rounded-3xl border border-white/5 bg-white/[0.02] backdrop-blur-sm transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl ${colorClasses[variant as keyof typeof colorClasses]}`}>
      <div className="mb-6 inline-flex p-4 rounded-2xl bg-white/5 border border-white/5 group-hover:scale-110 transition-transform duration-500">
        {icon}
      </div>
      <h3 className="text-xl font-bold mb-4 text-white group-hover:text-white transition-colors">{title}</h3>
      <p className="text-muted-foreground leading-relaxed">
        {description}
      </p>
    </div>
  );
}
