"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { debug } from "@/lib/debug";
import { AuthForm } from "@/components/auth/AuthForm";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      debug.log("Attempting login for email:", email);
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        debug.error("Login error:", error.message);
        setErrorMsg(error.message);
        return;
      }

      debug.log("Login successful, redirecting to dashboard");
      router.push("/dashboard");
    } catch (err) {
      debug.error("Unexpected error during login:", err);
      setErrorMsg("An unexpected error occurred. Please try again.");
    }
  };

  return (
    <AuthForm
      mode="login"
      email={email}
      setEmail={setEmail}
      password={password}
      setPassword={setPassword}
      onSubmit={handleLogin}
      errorMsg={errorMsg}
    />
  );
}
