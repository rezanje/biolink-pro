import type { Metadata } from "next";
import { LegalLinks } from "@/components/legal/LegalLinks";

export const metadata: Metadata = {
    title: "Login - GenHub",
    description: "Masuk ke akun GenHub Anda",
};

export default function AuthLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <>
            {children}
            <footer className="bg-white px-6 py-6"><LegalLinks /></footer>
        </>
    );
}
