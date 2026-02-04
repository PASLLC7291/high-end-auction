import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import path from "path";
import { mkdir, rm, writeFile } from "fs/promises";
import { z } from "zod";
import { db, generateId } from "@/lib/turso";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILES = 10;
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB

const schema = z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    email: z.string().email(),
    phone: z.string().optional().nullable(),
    category: z.string().min(1),
    description: z.string().min(1),
});

function toStringValue(value: FormDataEntryValue | null) {
    if (typeof value === "string") return value;
    return null;
}

function sanitizeFilename(name: string) {
    return name
        .replace(/[/\\\\?%*:|"<>]/g, "_")
        .replace(/\s+/g, "_")
        .slice(0, 160);
}

export async function POST(request: NextRequest) {
    const uploadRoot =
        process.env.LEAD_UPLOAD_DIR ||
        path.join(process.cwd(), "db", "uploads", "valuation-requests");

    const submissionId = generateId();
    const submissionDir = path.join(uploadRoot, submissionId);

    try {
        const form = await request.formData();

        const fields = {
            firstName: toStringValue(form.get("firstName")) ?? "",
            lastName: toStringValue(form.get("lastName")) ?? "",
            email: toStringValue(form.get("email")) ?? "",
            phone: toStringValue(form.get("phone")),
            category: toStringValue(form.get("category")) ?? "",
            description: toStringValue(form.get("description")) ?? "",
        };

        const parsed = schema.safeParse(fields);
        if (!parsed.success) {
            return NextResponse.json(
                { error: "Please fill out all required fields." },
                { status: 400 }
            );
        }

        const entries = form.getAll("photos");
        const files = entries.filter(
            (entry): entry is File => entry instanceof File && entry.size > 0
        );

        if (files.length > MAX_FILES) {
            return NextResponse.json(
                { error: `Please upload ${MAX_FILES} files or fewer.` },
                { status: 400 }
            );
        }

        await mkdir(submissionDir, { recursive: true });

        const uploads: Array<{
            id: string;
            original_name: string;
            mime_type: string | null;
            size: number;
            path: string;
        }> = [];

        for (const file of files) {
            if (file.size > MAX_FILE_BYTES) {
                return NextResponse.json(
                    {
                        error: `File "${file.name}" exceeds 10MB. Please upload smaller images.`,
                    },
                    { status: 400 }
                );
            }
            if (file.type && !file.type.startsWith("image/")) {
                return NextResponse.json(
                    { error: `File "${file.name}" must be an image.` },
                    { status: 400 }
                );
            }

            const safeName = sanitizeFilename(file.name || "upload");
            const storedName = `${crypto.randomUUID()}_${safeName}`;
            const storedPath = path.join(submissionDir, storedName);
            const buffer = Buffer.from(await file.arrayBuffer());
            await writeFile(storedPath, buffer);

            uploads.push({
                id: generateId(),
                original_name: file.name || safeName,
                mime_type: file.type || null,
                size: file.size,
                path: path.relative(process.cwd(), storedPath),
            });
        }

        const payload = {
            ...parsed.data,
            phone: parsed.data.phone || null,
            uploads: uploads.map((u) => ({
                originalName: u.original_name,
                mimeType: u.mime_type,
                size: u.size,
                path: u.path,
            })),
            userAgent: request.headers.get("user-agent"),
            referer: request.headers.get("referer"),
        };

        await db.execute({
            sql: "INSERT INTO lead_submissions (id, type, email, payload) VALUES (?, ?, ?, ?)",
            args: [
                submissionId,
                "valuation",
                parsed.data.email.toLowerCase(),
                JSON.stringify(payload),
            ],
        });

        for (const upload of uploads) {
            await db.execute({
                sql: "INSERT INTO lead_uploads (id, submission_id, original_name, mime_type, size, path) VALUES (?, ?, ?, ?, ?, ?)",
                args: [
                    upload.id,
                    submissionId,
                    upload.original_name,
                    upload.mime_type,
                    upload.size,
                    upload.path,
                ],
            });
        }

        return NextResponse.json({ success: true }, { status: 201 });
    } catch (error) {
        console.error("Valuation request error:", error);
        // Best-effort cleanup of any written files
        await rm(submissionDir, { recursive: true, force: true }).catch(() => {});
        return NextResponse.json(
            { error: "Unable to submit your valuation request right now." },
            { status: 500 }
        );
    }
}

