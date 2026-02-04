import { NextRequest, NextResponse } from "next/server";
import { createUser, emailExists } from "@/lib/user";
import { z } from "zod";

const signupSchema = z.object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    name: z.string().min(1, "Name is required"),
});

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const result = signupSchema.safeParse(body);

        if (!result.success) {
            return NextResponse.json(
                { error: result.error.errors[0].message },
                { status: 400 }
            );
        }

        const { email, password, name } = result.data;

        // Check if email already exists
        const exists = await emailExists(email);
        if (exists) {
            return NextResponse.json(
                { error: "An account with this email already exists" },
                { status: 409 }
            );
        }

        // Create the user
        const user = await createUser(email, password, name);

        return NextResponse.json(
            {
                message: "Account created successfully",
                user: { id: user.id, email: user.email, name: user.name }
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("Signup error:", error);
        return NextResponse.json(
            { error: "Failed to create account" },
            { status: 500 }
        );
    }
}
