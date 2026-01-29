export function Footer() {
  return (
    <footer className="w-full border-t border-white/5 bg-[#020817] py-8">
      <div className="container mx-auto px-4 md:px-6">
        <p className="text-center text-xs text-muted-foreground/60">
          © {new Date().getFullYear()} Kryptone Protocol Inc. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
