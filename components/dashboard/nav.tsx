'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Menu, LogOut, User } from 'lucide-react';
import { signOut, getCurrentUser } from '@/lib/actions/auth';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useEffect } from 'react';

export function DashboardNav() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    getCurrentUser().then(setUser);
  }, []);

  async function handleSignOut() {
    await signOut();
  }

  return (
    <nav className="border-b border-hairline bg-canvas sticky top-0 z-40 shadow-stripi-sm">
      <div className="flex items-center justify-between h-16 px-lg md:px-xl">
        <div className="flex items-center gap-lg">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-sm hover:bg-canvas-soft rounded-sm transition-colors"
          >
            <Menu className="h-5 w-5 text-ink" />
          </button>
          <Link href="/dashboard" className="text-heading-md font-light text-ink">
            Workforce
          </Link>
        </div>

        <div className="flex items-center gap-sm">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-md text-ink">
                <User className="h-4 w-4" />
                <span className="hidden sm:inline text-body-md">{user?.email}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleSignOut} className="gap-md cursor-pointer text-ink">
                <LogOut className="h-4 w-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </nav>
  );
}
