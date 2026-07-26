import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function SettingsPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-foreground/60">Manage organization settings</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Organization Settings</CardTitle>
          <CardDescription>
            Settings for your organization will be available here
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-foreground/60">
            Coming soon: Add members, manage roles, configure departments, and more.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
