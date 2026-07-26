import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { cn } from '@/lib/utils';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Workforce Management Platform',
  description: 'Multi-tenant workforce management and payroll system',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="bg-background">
      <body className={cn(inter.className, 'bg-background text-foreground')}>
        {children}
      </body>
    </html>
  );
}
