'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { createTenant } from '@/lib/actions/tenant';
import { generateSlug } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

export function CreateTenantDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const result = await createTenant({
      name: formData.name,
      slug: formData.slug || generateSlug(formData.name),
      description: formData.description,
    });

    if (result.success) {
      setOpen(false);
      setFormData({ name: '', slug: '', description: '' });
      router.refresh();
    }

    setLoading(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-md flex items-center">
          <Plus className="h-4 w-4" />
          Create Organization
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-heading-lg">Create Organization</DialogTitle>
          <DialogDescription className="text-body-md">
            Create a new organization to manage your employees
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-lg">
          <div className="flex flex-col gap-sm">
            <label className="text-body-md font-medium text-ink">Organization Name</label>
            <Input
              placeholder="Acme Corporation"
              value={formData.name}
              onChange={(e) => {
                setFormData({
                  ...formData,
                  name: e.target.value,
                  slug: generateSlug(e.target.value),
                });
              }}
              required
            />
          </div>

          <div className="flex flex-col gap-sm">
            <label className="text-body-md font-medium text-ink">Slug</label>
            <Input
              placeholder="acme-corporation"
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
            />
            <p className="text-caption text-ink-mute">
              URL-friendly unique identifier
            </p>
          </div>

          <div className="flex flex-col gap-sm">
            <label className="text-body-md font-medium text-ink">Description (Optional)</label>
            <Input
              placeholder="Brief description of your organization"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading || !formData.name}>
            {loading ? 'Creating...' : 'Create Organization'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
