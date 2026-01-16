import { Shield, Twitter, Github, Linkedin, Mail } from 'lucide-react';

export function Footer() {
  return (
    <footer className="relative w-full border-t border-white/10 bg-[#020817] overflow-hidden pt-20 pb-10">
       {/* Background Elements */}
       <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[1px] bg-gradient-to-r from-transparent via-primary/50 to-transparent"></div>
       <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="container mx-auto px-4 md:px-6 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12 mb-16">
          {/* Brand */}
          <div className="col-span-1 md:col-span-6 space-y-6">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 border border-primary/20">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <span className="text-xl font-bold text-white">Kryptone Protocol</span>
            </div>
            <p className="text-muted-foreground leading-relaxed max-w-md">
              The next generation of secure, private, and trustless marketplace for real-world goods. 
              Built on Solana for institutional-grade speed and security with zero-knowledge privacy.
            </p>
            
            <div className="flex items-center gap-4 pt-2">
                <SocialLink icon={<Twitter className="w-4 h-4" />} href="#" />
                <SocialLink icon={<Github className="w-4 h-4" />} href="#" />
                <SocialLink icon={<Linkedin className="w-4 h-4" />} href="#" />
                <SocialLink icon={<Mail className="w-4 h-4" />} href="#" />
            </div>
          </div>

          {/* Links */}
          <div className="col-span-1 md:col-span-3">
            <h3 className="font-semibold text-white mb-6">Platform</h3>
            <ul className="space-y-4 text-sm text-muted-foreground">
              <li><FooterLink href="#">Features</FooterLink></li>
              <li><FooterLink href="#">Security</FooterLink></li>
              <li><FooterLink href="#">Roadmap</FooterLink></li>
              <li><FooterLink href="#">Pricing</FooterLink></li>
            </ul>
          </div>

          <div className="col-span-1 md:col-span-3">
            <h3 className="font-semibold text-white mb-6">Company</h3>
            <ul className="space-y-4 text-sm text-muted-foreground">
              <li><FooterLink href="#">About Us</FooterLink></li>
              <li><FooterLink href="#">Careers</FooterLink></li>
              <li><FooterLink href="#">Blog</FooterLink></li>
              <li><FooterLink href="#">Contact</FooterLink></li>
            </ul>
          </div>


        </div>

        <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground/60">
            © {new Date().getFullYear()} Kryptone Protocol Inc. All rights reserved.
          </p>
          <div className="flex items-center gap-6 text-xs text-muted-foreground/60">
            <FooterLink href="#">Privacy Policy</FooterLink>
            <FooterLink href="#">Terms of Service</FooterLink>
            <FooterLink href="#">Cookie Settings</FooterLink>
          </div>
        </div>
      </div>
    </footer>
  );
}

function SocialLink({ icon, href }: { icon: React.ReactNode; href: string }) {
    return (
        <a href={href} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 border border-white/5 text-muted-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/20 transition-all duration-300">
            {icon}
        </a>
    )
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
    return (
        <a href={href} className="hover:text-primary transition-colors">
            {children}
        </a>
    )
}
