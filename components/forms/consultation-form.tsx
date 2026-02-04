"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const serviceOptions = [
  { value: "consignment", label: "Consignment" },
  { value: "valuation", label: "Valuations & Appraisals" },
  { value: "private-sales", label: "Private Sales" },
  { value: "collection", label: "Collection Management" },
  { value: "shipping", label: "Shipping & Logistics" },
  { value: "research", label: "Research & Authentication" },
  { value: "other", label: "Other" },
];

export function ConsultationForm() {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    serviceInterest: "",
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
      const res = await fetch("/api/marketing/consultation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim(),
          serviceInterest: form.serviceInterest,
          message: form.message.trim() || null,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || "Unable to submit your request.");
      }

      toast({
        title: "Request submitted",
        description: "Thanks — a specialist will contact you shortly.",
      });

      setForm({
        firstName: "",
        lastName: "",
        email: "",
        serviceInterest: "",
        message: "",
      });
    } catch (error) {
      toast({
        title: "Submission failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="consultation-firstName">First Name *</Label>
          <Input
            id="consultation-firstName"
            placeholder="John"
            required
            value={form.firstName}
            onChange={updateField("firstName")}
            disabled={submitting}
            autoComplete="given-name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="consultation-lastName">Last Name *</Label>
          <Input
            id="consultation-lastName"
            placeholder="Doe"
            required
            value={form.lastName}
            onChange={updateField("lastName")}
            disabled={submitting}
            autoComplete="family-name"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="consultation-email">Email *</Label>
        <Input
          id="consultation-email"
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
        <Label htmlFor="consultation-serviceInterest">Service Interest *</Label>
        <select
          id="consultation-serviceInterest"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          required
          value={form.serviceInterest}
          onChange={updateField("serviceInterest")}
          disabled={submitting}
        >
          <option value="">Select a service...</option>
          {serviceOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="consultation-message">Message</Label>
        <Textarea
          id="consultation-message"
          className="min-h-24"
          placeholder="Tell us about your collection or inquiry..."
          value={form.message}
          onChange={updateField("message")}
          disabled={submitting}
        />
      </div>

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? "Submitting..." : "Submit Request"}
      </Button>
    </form>
  );
}

