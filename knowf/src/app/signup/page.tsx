"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { debug } from "@/lib/debug";
import { AuthForm } from "@/components/auth/AuthForm";

export default function SignUp() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const router = useRouter();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      debug.log("Attempting signup for email:", email);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        debug.error("Signup error:", error.message);
        setErrorMsg(error.message);
        return;
      }

      debug.log("Signup successful, redirecting to dashboard");
      router.push("/dashboard");
    } catch (err) {
      debug.error("Unexpected error during signup:", err);
      setErrorMsg("An unexpected error occurred. Please try again.");
    }
  };

  return (
    <AuthForm
      mode="signup"
      email={email}
      setEmail={setEmail}
      password={password}
      setPassword={setPassword}
      onSubmit={handleSignUp}
      errorMsg={errorMsg}
    />
  );
}
