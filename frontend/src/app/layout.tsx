import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Providers } from './providers';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { MainContent } from '@/components/layout/MainContent';
import { Toaster } from '@/components/ui/Toaster';
import '@/styles/globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'BaseBook DEX - Next-Generation Decentralized Exchange',
  description: 'Trade cryptocurrencies with the best prices and lowest fees on Base blockchain',
  keywords: ['DEX', 'DeFi', 'Base', 'Swap', 'Trading', 'Crypto'],
  authors: [{ name: 'BaseBook Team' }],
  openGraph: {
    title: 'BaseBook DEX',
    description: 'Next-generation decentralized exchange on Base',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'BaseBook DEX',
    description: 'Next-generation decentralized exchange on Base',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.variable}>
        <Providers>
          <div className="relative flex min-h-screen flex-col">
            <Header />
            <main className="flex-1">
              <MainContent>{children}</MainContent>
            </main>
            <Footer />
          </div>
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
