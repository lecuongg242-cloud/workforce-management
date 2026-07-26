'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { signUp } from '@/lib/actions/auth';

export default function SignUpPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await signUp(formData);

    if (!result.success) {
      setError(result.error || 'Failed to sign up');
      setLoading(false);
      return;
    }

    router.push('/auth/sign-up-success');
  }

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-lg">
      <Card className="w-full max-w-md border-hairline">
        <CardHeader>
          <CardTitle className="text-heading-lg">Create Account</CardTitle>
          <CardDescription className="text-body-md text-ink-mute">Join our workforce management platform</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-lg">
            {error && (
              <div className="text-body-md text-ruby bg-red-50 p-md rounded-sm border border-ruby/20">
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-lg">
              <div className="flex flex-col gap-sm">
                <label className="text-body-md font-medium text-ink">First Name</label>
                <Input
                  type="text"
                  placeholder="John"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  required
                />
              </div>
              <div className="flex flex-col gap-sm">
                <label className="text-body-md font-medium text-ink">Last Name</label>
                <Input
                  type="text"
                  placeholder="Doe"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-sm">
              <label className="text-body-md font-medium text-ink">Email</label>
              <Input
                type="email"
                placeholder="john@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>

            <div className="flex flex-col gap-sm">
              <label className="text-body-md font-medium text-ink">Password</label>
              <Input
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Creating Account...' : 'Sign Up'}
            </Button>

            <p className="text-center text-body-md text-ink-mute">
              Already have an account?{' '}
              <Link href="/auth/login" className="text-primary font-medium hover:text-primary-deep transition-colors">
                Sign In
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
