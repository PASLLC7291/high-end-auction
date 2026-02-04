"use client";

import { useMemo, useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const MAX_FILES = 10;
const MAX_FILE_BYTES = 10 * 1024 * 1024;

const categoryOptions = [
  { value: "fine-art", label: "Fine Art" },
  { value: "antiques", label: "Antiques & Decorative Arts" },
  { value: "jewelry", label: "Jewelry" },
  { value: "watches", label: "Watches" },
  { value: "collectibles", label: "Collectibles & Memorabilia" },
  { value: "books", label: "Books & Documents" },
  { value: "other", label: "Other" },
];

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function fileKey(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

export function ValuationForm() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    category: "",
    description: "",
  });

  const totalBytes = useMemo(() => files.reduce((sum, f) => sum + (f.size || 0), 0), [files]);

  const updateField =
    (key: keyof typeof form) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm((prev) => ({ ...prev, [key]: event.target.value }));
    };

  const addFiles = (incoming: File[]) => {
    if (!incoming.length) return;

    const next: File[] = [];
    const rejected: string[] = [];

    for (const file of incoming) {
      if (file.size <= 0) continue;
      if (file.size > MAX_FILE_BYTES) {
        rejected.push(`${file.name} (over 10MB)`);
        continue;
      }
      if (file.type && !file.type.startsWith("image/")) {
        rejected.push(`${file.name} (not an image)`);
        continue;
      }
      next.push(file);
    }

    setFiles((prev) => {
      const seen = new Set<string>();
      const merged = [...prev, ...next].filter((file) => {
        const key = fileKey(file);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      if (merged.length > MAX_FILES) {
        const kept = merged.slice(0, MAX_FILES);
        toast({
          title: "Too many files",
          description: `Only the first ${MAX_FILES} images were kept.`,
          variant: "destructive",
        });
        return kept;
      }

      return merged;
    });

    if (rejected.length) {
      toast({
        title: "Some files were skipped",
        description: rejected.slice(0, 3).join(", ") + (rejected.length > 3 ? "…" : ""),
        variant: "destructive",
      });
    }
  };

  const handleBrowse = () => fileInputRef.current?.click();

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(event.target.files ?? []));
    event.target.value = "";
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    addFiles(Array.from(event.dataTransfer.files ?? []));
  };

  const removeFile = (target: File) => {
    const key = fileKey(target);
    setFiles((prev) => prev.filter((f) => fileKey(f) !== key));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.set("firstName", form.firstName.trim());
      fd.set("lastName", form.lastName.trim());
      fd.set("email", form.email.trim());
      if (form.phone.trim()) fd.set("phone", form.phone.trim());
      fd.set("category", form.category);
      fd.set("description", form.description.trim());
      for (const file of files) {
        fd.append("photos", file, file.name);
      }

      const res = await fetch("/api/marketing/valuation", {
        method: "POST",
        body: fd,
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
        description: "Thanks — our specialists will review your submission.",
      });

      setForm({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        category: "",
        description: "",
      });
      setFiles([]);
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
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="valuation-firstName">First Name *</Label>
          <Input
            id="valuation-firstName"
            placeholder="John"
            required
            value={form.firstName}
            onChange={updateField("firstName")}
            disabled={submitting}
            autoComplete="given-name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="valuation-lastName">Last Name *</Label>
          <Input
            id="valuation-lastName"
            placeholder="Smith"
            required
            value={form.lastName}
            onChange={updateField("lastName")}
            disabled={submitting}
            autoComplete="family-name"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="valuation-email">Email *</Label>
          <Input
            id="valuation-email"
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
          <Label htmlFor="valuation-phone">Phone</Label>
          <Input
            id="valuation-phone"
            type="tel"
            placeholder="(555) 123-4567"
            value={form.phone}
            onChange={updateField("phone")}
            disabled={submitting}
            autoComplete="tel"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="valuation-category">Category *</Label>
        <select
          id="valuation-category"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          required
          value={form.category}
          onChange={updateField("category")}
          disabled={submitting}
        >
          <option value="">Select a category</option>
          {categoryOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="valuation-description">Description *</Label>
        <Textarea
          id="valuation-description"
          placeholder="Please describe your item(s), including artist/maker, approximate age, size, condition, and any known provenance..."
          rows={5}
          required
          value={form.description}
          onChange={updateField("description")}
          disabled={submitting}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="valuation-photos">Photos</Label>

        <div
          className={cn(
            "border-2 border-dashed border-border rounded-lg p-6 text-center transition-colors",
            dragging && "border-primary/60 bg-primary/5"
          )}
          role="button"
          tabIndex={0}
          onClick={handleBrowse}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleBrowse();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          aria-label="Upload photos"
        >
          <Camera className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            Drag and drop images here, or click to browse
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            JPG, PNG up to 10MB each. Include multiple angles.
          </p>

          <input
            ref={fileInputRef}
            id="valuation-photos"
            type="file"
            className="hidden"
            multiple
            accept="image/*"
            onChange={handleFileInputChange}
            disabled={submitting}
          />

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={(e) => {
              e.stopPropagation();
              handleBrowse();
            }}
            disabled={submitting}
          >
            Select Files
          </Button>

          {files.length > 0 && (
            <div className="mt-4 text-left">
              <p className="text-xs text-muted-foreground">
                {files.length} file{files.length === 1 ? "" : "s"} selected •{" "}
                {formatBytes(totalBytes)}
              </p>
              <ul className="mt-2 space-y-2">
                {files.map((file) => (
                  <li
                    key={fileKey(file)}
                    className="flex items-center justify-between rounded-md border border-border/60 bg-background px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatBytes(file.size)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(file);
                      }}
                      aria-label={`Remove ${file.name}`}
                      disabled={submitting}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="pt-4">
        <Button type="submit" size="lg" className="w-full" disabled={submitting}>
          {submitting ? "Submitting..." : "Submit for Valuation"}
        </Button>
        <p className="mt-3 text-xs text-center text-muted-foreground">
          We typically respond within 2-3 business days. Your information is kept confidential.
        </p>
      </div>
    </form>
  );
}

