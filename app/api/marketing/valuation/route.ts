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
const DEFAULT_STORAGE = "db";

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

function sha256Hex(data: ArrayBuffer): string {
    return crypto.createHash("sha256").update(Buffer.from(data)).digest("hex");
}

export async function POST(request: NextRequest) {
    const storage = (process.env.LEAD_UPLOAD_STORAGE || DEFAULT_STORAGE).trim().toLowerCase();
    const useFsStorage = storage === "fs";

    const submissionId = generateId();
    const uploadRoot = useFsStorage
        ? (process.env.LEAD_UPLOAD_DIR || path.join(process.cwd(), "db", "uploads", "valuation-requests"))
        : null;
    const submissionDir = uploadRoot ? path.join(uploadRoot, submissionId) : null;

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

        if (useFsStorage && submissionDir) {
            await mkdir(submissionDir, { recursive: true });
        }

        const uploads: Array<{
            id: string;
            original_name: string;
            mime_type: string | null;
            size: number;
            path: string;
            data?: ArrayBuffer;
            sha256?: string;
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
            const id = generateId();

            if (useFsStorage && submissionDir) {
                const storedName = `${crypto.randomUUID()}_${safeName}`;
                const storedPath = path.join(submissionDir, storedName);
                const buffer = Buffer.from(await file.arrayBuffer());
                await writeFile(storedPath, buffer);

                uploads.push({
                    id,
                    original_name: file.name || safeName,
                    mime_type: file.type || null,
                    size: file.size,
                    path: path.relative(process.cwd(), storedPath),
                });
            } else {
                const data = await file.arrayBuffer();
                uploads.push({
                    id,
                    original_name: file.name || safeName,
                    mime_type: file.type || null,
                    size: file.size,
                    path: `db:lead_upload_files:${id}`,
                    data,
                    sha256: sha256Hex(data),
                });
            }
        }

        const payload = {
            ...parsed.data,
            phone: parsed.data.phone || null,
            uploadStorage: useFsStorage ? "fs" : "db",
            uploads: uploads.map((u) => ({
                originalName: u.original_name,
                mimeType: u.mime_type,
                size: u.size,
                path: u.path,
            })),
            userAgent: request.headers.get("user-agent"),
            referer: request.headers.get("referer"),
        };

        const createdAt = new Date().toISOString();
        const tx = await db.transaction("write");
        try {
            await tx.execute({
                sql: "INSERT INTO lead_submissions (id, type, email, payload, created_at) VALUES (?, ?, ?, ?, ?)",
                args: [
                    submissionId,
                    "valuation",
                    parsed.data.email.toLowerCase(),
                    JSON.stringify(payload),
                    createdAt,
                ],
            });

            for (const upload of uploads) {
                await tx.execute({
                    sql: "INSERT INTO lead_uploads (id, submission_id, original_name, mime_type, size, path, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    args: [
                        upload.id,
                        submissionId,
                        upload.original_name,
                        upload.mime_type,
                        upload.size,
                        upload.path,
                        createdAt,
                    ],
                });

                if (!useFsStorage) {
                    await tx.execute({
                        sql: "INSERT INTO lead_upload_files (id, data, sha256, created_at) VALUES (?, ?, ?, ?)",
                        args: [upload.id, upload.data!, upload.sha256 ?? null, createdAt],
                    });
                }
            }

            await tx.commit();
        } catch (error) {
            try {
                await tx.rollback();
            } catch {
                // Ignore rollback errors and surface the original failure.
            }
            throw error;
        } finally {
            tx.close();
        }

        return NextResponse.json({ success: true }, { status: 201 });
    } catch (error) {
        console.error("Valuation request error:", error);
        // Best-effort cleanup of any written files
        if (useFsStorage && submissionDir) {
            await rm(submissionDir, { recursive: true, force: true }).catch(() => {});
        }
        return NextResponse.json(
            { error: "Unable to submit your valuation request right now." },
            { status: 500 }
        );
    }
}
