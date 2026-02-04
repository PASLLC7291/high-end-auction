import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { getUserById, updateUser } from "@/lib/user";
import { getUserProfile, upsertUserProfile } from "@/lib/user-profile";
import { getUserPreferences, updateUserPreferences } from "@/lib/user-preferences";

const settingsSchema = z.object({
    name: z.string().min(1).optional(),
    email: z.string().email().optional(),
    phone: z.string().max(50).optional().nullable(),
    location: z.string().max(100).optional().nullable(),
    preferences: z
        .object({
            emailNotifications: z.boolean().optional(),
            bidAlerts: z.boolean().optional(),
            marketingEmails: z.boolean().optional(),
        })
        .optional(),
});

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [user, profile, preferences] = await Promise.all([
        getUserById(session.user.id),
        getUserProfile(session.user.id),
        getUserPreferences(session.user.id),
    ]);

    if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
        user: { id: user.id, name: user.name, email: user.email },
        profile: {
            phone: profile?.phone ?? null,
            location: profile?.location ?? null,
        },
        preferences: {
            emailNotifications: preferences.email_notifications,
            bidAlerts: preferences.bid_alerts,
            marketingEmails: preferences.marketing_emails,
        },
    });
}

export async function PUT(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const parsed = settingsSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.errors[0]?.message || "Invalid payload" }, { status: 400 });
    }

    const updates = parsed.data;

    try {
        const [user, _profile, _preferences] = await Promise.all([
            updates.name || updates.email ? updateUser(session.user.id, { name: updates.name, email: updates.email }) : getUserById(session.user.id),
            updates.phone !== undefined || updates.location !== undefined
                ? upsertUserProfile({ user_id: session.user.id, phone: updates.phone ?? null, location: updates.location ?? null })
                : getUserProfile(session.user.id),
            updates.preferences
                ? updateUserPreferences(session.user.id, {
                    email_notifications: updates.preferences.emailNotifications,
                    bid_alerts: updates.preferences.bidAlerts,
                    marketing_emails: updates.preferences.marketingEmails,
                })
                : getUserPreferences(session.user.id),
        ]);

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        return NextResponse.json({
            user: { id: user.id, name: user.name, email: user.email },
            profile: { phone: _profile?.phone ?? null, location: _profile?.location ?? null },
            preferences: {
                emailNotifications: _preferences.email_notifications,
                bidAlerts: _preferences.bid_alerts,
                marketingEmails: _preferences.marketing_emails,
            },
        });
    } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to update settings" }, { status: 400 });
    }
}

