"use client";

import * as React from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";

import { AppleCard } from "@/components/apple/AppleCard";
import { AppleButton } from "@/components/apple/AppleButton";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";

export default function LoginPage() {
  const router = useRouter();
  const [formError, setFormError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (values: LoginInput) => {
    setFormError(null);
    setIsSubmitting(true);

    const result = await signIn("credentials", {
      email: values.email,
      password: values.password,
      redirect: false,
    });

    setIsSubmitting(false);

    if (!result || result.error) {
      setFormError("Invalid email or password.");
      return;
    }

    router.push("/");
    router.refresh();
  };

  return (
    <div className="relative flex min-h-dvh w-full items-center justify-center overflow-hidden bg-background px-4">
      {/* Soft ambient glow behind the card — the only decorative flourish on
          this page, kept low-opacity so it doesn't compete with the
          gradient-hairline signature element on the card itself. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 size-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/10 blur-3xl dark:bg-accent/15"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 size-[22rem] -translate-x-[65%] -translate-y-[35%] rounded-full bg-gold/10 blur-3xl dark:bg-gold/15"
      />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="relative w-full max-w-sm"
      >
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="rounded-2xl bg-white p-3 shadow-apple-card">
            <Image
              src="/kangna-logo-mark.png"
              alt="Kangna"
              width={348}
              height={159}
              className="h-14 w-auto"
              priority
            />
          </div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
            Kangna CRM
          </h1>
          <p className="text-sm text-muted-foreground">
            Sign in to continue
          </p>
        </div>

        <AppleCard className="relative overflow-hidden">
          <div className="gradient-hairline absolute inset-x-0 top-0 h-[3px]" />
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
            noValidate
          >
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="email"
                className="text-sm font-medium text-foreground"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                className="h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition-shadow duration-150 focus-visible:ring-2 focus-visible:ring-ring/50"
                {...register("email")}
              />
              {errors.email && (
                <p className="text-xs text-danger">{errors.email.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="password"
                className="text-sm font-medium text-foreground"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                className="h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition-shadow duration-150 focus-visible:ring-2 focus-visible:ring-ring/50"
                {...register("password")}
              />
              {errors.password && (
                <p className="text-xs text-danger">
                  {errors.password.message}
                </p>
              )}
            </div>

            {formError && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                role="alert"
                className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger"
              >
                {formError}
              </motion.p>
            )}

            <AppleButton
              type="submit"
              className="mt-2 w-full transition-transform duration-150 active:scale-[0.98]"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Signing in…" : "Sign in"}
            </AppleButton>
          </form>
        </AppleCard>
      </motion.div>
    </div>
  );
}
