import { db, generateId } from "@/lib/turso";
import bcrypt from "bcryptjs";

export type User = {
    id: string;
    email: string;
    name: string;
    created_at: string;
    updated_at: string;
};

type UserWithPassword = User & {
    password_hash: string;
};

export async function getUserWithPasswordById(id: string): Promise<UserWithPassword | null> {
    const result = await db.execute({
        sql: "SELECT * FROM users WHERE id = ?",
        args: [id],
    });

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
        id: row.id as string,
        email: row.email as string,
        name: row.name as string,
        password_hash: row.password_hash as string,
        created_at: row.created_at as string,
        updated_at: row.updated_at as string,
    };
}

export async function getUserByEmail(email: string): Promise<UserWithPassword | null> {
    const result = await db.execute({
        sql: "SELECT * FROM users WHERE email = ?",
        args: [email.toLowerCase()],
    });

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
        id: row.id as string,
        email: row.email as string,
        name: row.name as string,
        password_hash: row.password_hash as string,
        created_at: row.created_at as string,
        updated_at: row.updated_at as string,
    };
}

export async function getUserById(id: string): Promise<User | null> {
    const result = await db.execute({
        sql: "SELECT id, email, name, created_at, updated_at FROM users WHERE id = ?",
        args: [id],
    });

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
        id: row.id as string,
        email: row.email as string,
        name: row.name as string,
        created_at: row.created_at as string,
        updated_at: row.updated_at as string,
    };
}

export async function createUser(
    email: string,
    password: string,
    name: string
): Promise<User> {
    const id = generateId();
    const password_hash = await bcrypt.hash(password, 12);
    const now = new Date().toISOString();

    await db.execute({
        sql: `INSERT INTO users (id, email, password_hash, name, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?)`,
        args: [id, email.toLowerCase(), password_hash, name, now, now],
    });

    return {
        id,
        email: email.toLowerCase(),
        name,
        created_at: now,
        updated_at: now,
    };
}

export async function verifyPassword(email: string, password: string): Promise<User | null> {
    const user = await getUserByEmail(email);
    if (!user) return null;

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return null;

    // Return user without password_hash
    const { password_hash: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
}

export async function emailExists(email: string): Promise<boolean> {
    const result = await db.execute({
        sql: "SELECT 1 FROM users WHERE email = ?",
        args: [email.toLowerCase()],
    });
    return result.rows.length > 0;
}

export async function updateUser(
    userId: string,
    updates: Partial<Pick<User, "email" | "name">>
): Promise<User> {
    const existing = await getUserById(userId);
    if (!existing) {
        throw new Error("User not found");
    }

    const nextEmail = updates.email ? updates.email.toLowerCase() : existing.email;
    const nextName = updates.name ?? existing.name;

    if (updates.email && nextEmail !== existing.email) {
        const emailCheck = await db.execute({
            sql: "SELECT 1 FROM users WHERE email = ? AND id != ?",
            args: [nextEmail, userId],
        });
        if (emailCheck.rows.length > 0) {
            throw new Error("An account with this email already exists");
        }
    }

    const now = new Date().toISOString();
    await db.execute({
        sql: "UPDATE users SET email = ?, name = ?, updated_at = ? WHERE id = ?",
        args: [nextEmail, nextName, now, userId],
    });

    const updated = await getUserById(userId);
    if (!updated) {
        throw new Error("Failed to update user");
    }
    return updated;
}

export async function updateUserPassword(userId: string, newPassword: string): Promise<void> {
    const password_hash = await bcrypt.hash(newPassword, 12);
    const now = new Date().toISOString();

    await db.execute({
        sql: "UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?",
        args: [password_hash, now, userId],
    });
}
