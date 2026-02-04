import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
    interface Session {
        user: {
            id: string;
            name?: string | null;
            email?: string | null;
        };
        bidderToken?: string;
    }

    interface User {
        id: string;
        name?: string | null;
        email?: string | null;
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        id: string;
        name?: string | null;
        email?: string | null;
        bidderToken?: string;
        bidderTokenExpiration?: string;
    }
}

