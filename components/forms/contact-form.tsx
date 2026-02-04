"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

type InquiryTypeOption = { value: string; label: string };

export function ContactForm({ inquiryTypes }: { inquiryTypes: InquiryTypeOption[] }) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    inquiryType: "",
    message: "",
  });

  const updateField =
    (key: keyof typeof form) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm((prev) => ({ ...prev, [key]: event.target.value }));
    };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/marketing/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || null,
          inquiryType: form.inquiryType,
          message: form.message.trim(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || "Unable to send message.");
      }

      toast({
        title: "Message sent",
        description: "Thanks — our team will reach out soon.",
      });

      setForm({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        inquiryType: "",
        message: "",
      });
    } catch (error) {
      toast({
        title: "Send failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="contact-firstName">First Name *</Label>
          <Input
            id="contact-firstName"
            placeholder="John"
            required
            value={form.firstName}
            onChange={updateField("firstName")}
            disabled={submitting}
            autoComplete="given-name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contact-lastName">Last Name *</Label>
          <Input
            id="contact-lastName"
            placeholder="Smith"
            required
            value={form.lastName}
            onChange={updateField("lastName")}
            disabled={submitting}
            autoComplete="family-name"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="contact-email">Email *</Label>
        <Input
          id="contact-email"
          type="email"
          placeholder="john@example.com"
          required
          value={form.email}
          onChange={updateField("email")}
          disabled={submitting}
          autoComplete="email"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="contact-phone">Phone</Label>
        <Input
          id="contact-phone"
          type="tel"
          placeholder="(555) 123-4567"
          value={form.phone}
          onChange={updateField("phone")}
          disabled={submitting}
          autoComplete="tel"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="contact-inquiryType">Inquiry Type *</Label>
        <select
          id="contact-inquiryType"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          required
          value={form.inquiryType}
          onChange={updateField("inquiryType")}
          disabled={submitting}
        >
          <option value="">Select an option</option>
          {inquiryTypes.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="contact-message">Message *</Label>
        <Textarea
          id="contact-message"
          placeholder="How can we help you?"
          rows={5}
          required
          value={form.message}
          onChange={updateField("message")}
          disabled={submitting}
        />
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={submitting}>
        {submitting ? "Sending..." : "Send Message"}
      </Button>

      <p className="text-xs text-center text-muted-foreground">
        We typically respond within 1 business day. Your information is kept confidential.
      </p>
    </form>
  );
}

