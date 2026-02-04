"use client";

import { useEffect, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  User,
  Mail,
  Lock,
  Bell,
  Shield,
  AlertTriangle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type SettingsResponse = {
  user: { id: string; name: string; email: string };
  profile: { phone: string | null; location: string | null };
  preferences: { emailNotifications: boolean; bidAlerts: boolean; marketingEmails: boolean };
};

export default function SettingsPage() {
  const { data: session, update } = useSession();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);

  const [name, setName] = useState(session?.user?.name ?? "");
  const [email, setEmail] = useState(session?.user?.email ?? "");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [emailNotifications, setEmailNotifications] = useState(true);
  const [bidAlerts, setBidAlerts] = useState(true);
  const [marketingEmails, setMarketingEmails] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/account/settings");
        const data = (await res.json()) as SettingsResponse & { error?: string };
        if (!res.ok) {
          throw new Error(data.error || "Failed to load settings");
        }

        setName(data.user.name ?? "");
        setEmail(data.user.email ?? "");
        setPhone(data.profile.phone ?? "");
        setLocation(data.profile.location ?? "");

        setEmailNotifications(Boolean(data.preferences.emailNotifications));
        setBidAlerts(Boolean(data.preferences.bidAlerts));
        setMarketingEmails(Boolean(data.preferences.marketingEmails));
      } catch (err) {
        toast({
          title: "Unable to load settings",
          description: err instanceof Error ? err.message : "Please try again.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      const res = await fetch("/api/account/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
          location: location.trim() || null,
        }),
      });
      const data = (await res.json()) as SettingsResponse & { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Failed to save profile");
      }

      await update({ user: { name: data.user.name, email: data.user.email } });

      toast({
        title: "Profile updated",
        description: "Your changes have been saved.",
      });
    } catch (err) {
      toast({
        title: "Failed to save profile",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSavePreferences = async () => {
    setSavingPrefs(true);
    try {
      const res = await fetch("/api/account/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preferences: {
            emailNotifications,
            bidAlerts,
            marketingEmails,
          },
        }),
      });
      const data = (await res.json()) as SettingsResponse & { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Failed to save preferences");
      }
      toast({
        title: "Preferences updated",
        description: "Notification preferences saved.",
      });
    } catch (err) {
      toast({
        title: "Failed to save preferences",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSavingPrefs(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!currentPassword || !newPassword) {
      toast({
        title: "Missing fields",
        description: "Enter your current password and a new password.",
        variant: "destructive",
      });
      return;
    }
    if (newPassword.length < 8) {
      toast({
        title: "Password too short",
        description: "New password must be at least 8 characters.",
        variant: "destructive",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({
        title: "Passwords do not match",
        description: "Please confirm your new password.",
        variant: "destructive",
      });
      return;
    }

    setSavingPassword(true);
    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Failed to update password");
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      toast({
        title: "Password updated",
        description: "Your password has been changed.",
      });
    } catch (err) {
      toast({
        title: "Failed to update password",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSavingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm(
      "Delete your account? This action is permanent and cannot be undone."
    );
    if (!confirmed) return;

    try {
      const res = await fetch("/api/account/delete", { method: "POST" });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete account");
      }

      await signOut({ callbackUrl: "/", redirect: true });
    } catch (err) {
      toast({
        title: "Failed to delete account",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const disabled = loading || savingProfile || savingPassword || savingPrefs;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Settings</h2>
        <p className="text-muted-foreground mt-1">
          Manage your account settings and preferences
        </p>
      </div>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <User className="h-5 w-5" />
            Profile Information
          </CardTitle>
          <CardDescription>Update your personal details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                disabled={disabled}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                disabled={disabled}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 000-0000"
                disabled={disabled}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="City, State"
                disabled={disabled}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSaveProfile} disabled={disabled}>
              {savingProfile ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Lock className="h-5 w-5" />
            Password
          </CardTitle>
          <CardDescription>Change your password</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-password">Current Password</Label>
            <Input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
              disabled={disabled}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                disabled={disabled}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                disabled={disabled}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleUpdatePassword} disabled={disabled}>
              {savingPassword ? "Updating…" : "Update Password"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bell className="h-5 w-5" />
            Notifications
          </CardTitle>
          <CardDescription>Manage your notification preferences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="pref-email-notifications">Email Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Receive updates about your account activity
              </p>
            </div>
            <Switch
              id="pref-email-notifications"
              checked={emailNotifications}
              onCheckedChange={setEmailNotifications}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="pref-bid-alerts">Bid Alerts</Label>
              <p className="text-sm text-muted-foreground">
                Get notified when you're outbid or an auction is ending
              </p>
            </div>
            <Switch
              id="pref-bid-alerts"
              checked={bidAlerts}
              onCheckedChange={setBidAlerts}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="pref-marketing-emails">Marketing Emails</Label>
              <p className="text-sm text-muted-foreground">
                Receive news about upcoming auctions and special events
              </p>
            </div>
            <Switch
              id="pref-marketing-emails"
              checked={marketingEmails}
              onCheckedChange={setMarketingEmails}
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSavePreferences} disabled={disabled}>
              {savingPrefs ? "Saving…" : "Save Preferences"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="h-5 w-5" />
            Security
          </CardTitle>
          <CardDescription>Keep your account secure</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
            <div>
              <p className="font-medium">Two-Factor Authentication</p>
              <p className="text-sm text-muted-foreground">
                Add an extra layer of security to your account
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() =>
                toast({
                  title: "Coming soon",
                  description: "Two-factor authentication isn’t available yet.",
                })
              }
            >
              Enable
            </Button>
          </div>
          <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
            <div>
              <p className="font-medium">Active Sessions</p>
              <p className="text-sm text-muted-foreground">
                Manage devices where you're logged in
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() =>
                toast({
                  title: "Coming soon",
                  description: "Session management isn’t available yet.",
                })
              }
            >
              View
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Danger Zone
          </CardTitle>
          <CardDescription>Irreversible actions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 bg-destructive/5 rounded-lg border border-destructive/20">
            <div>
              <p className="font-medium">Delete Account</p>
              <p className="text-sm text-muted-foreground">
                Permanently delete your account and all data
              </p>
            </div>
            <Button variant="destructive" onClick={handleDeleteAccount}>
              Delete Account
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
