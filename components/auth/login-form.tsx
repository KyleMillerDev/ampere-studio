"use client"

import { useCallback, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { signIn, confirmSignIn } from "aws-amplify/auth"
import { HugeiconsIcon } from "@hugeicons/react"
import { SparklesIcon } from "@hugeicons/core-free-icons"

import { isAuthConfigured } from "@/lib/auth/amplify-config"

import { DotPattern } from "@/components/ui/dot-pattern"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { cn } from "@/lib/utils"

type LoginStep = "credentials" | "new-password" | "mfa-selection" | "mfa-code"

type MfaType = "SMS" | "TOTP"

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === "string") return error
  return "Something went wrong. Please try again."
}

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextPath = searchParams.get("next") || "/dashboard"

  const [step, setStep] = useState<LoginStep>("credentials")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [mfaCode, setMfaCode] = useState("")
  const [mfaOptions, setMfaOptions] = useState<MfaType[]>([])
  const [activeMfaType, setActiveMfaType] = useState<MfaType | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const finishSignIn = useCallback(() => {
    router.push(nextPath)
    router.refresh()
  }, [router, nextPath])

  const handleNextStep = useCallback(
    async (signInStep: string, allowedMFATypes?: string[]) => {
      switch (signInStep) {
        case "CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED":
          setStep("new-password")
          break
        case "CONTINUE_SIGN_IN_WITH_MFA_SELECTION":
          setMfaOptions((allowedMFATypes as MfaType[]) ?? [])
          setStep("mfa-selection")
          break
        case "CONFIRM_SIGN_IN_WITH_TOTP_CODE":
          setActiveMfaType("TOTP")
          setStep("mfa-code")
          break
        case "CONFIRM_SIGN_IN_WITH_SMS_CODE":
          setActiveMfaType("SMS")
          setStep("mfa-code")
          break
        case "DONE":
          finishSignIn()
          break
        default:
          setError(`Unhandled sign-in step: ${signInStep}`)
      }
    },
    [finishSignIn]
  )

  async function handleCredentialsSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { nextStep } = await signIn({
        username: email.trim().toLowerCase(),
        password,
      })
      await handleNextStep(
        nextStep.signInStep,
        "allowedMFATypes" in nextStep
          ? (nextStep.allowedMFATypes as string[])
          : undefined
      )
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  async function handleNewPasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }
    if (newPassword.length < 12) {
      setError("Password must be at least 12 characters.")
      return
    }

    setLoading(true)
    try {
      const { nextStep } = await confirmSignIn({
        challengeResponse: newPassword,
      })
      await handleNextStep(
        nextStep.signInStep,
        "allowedMFATypes" in nextStep
          ? (nextStep.allowedMFATypes as string[])
          : undefined
      )
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  async function handleMfaSelection(type: MfaType) {
    setError(null)
    setLoading(true)
    try {
      const { nextStep } = await confirmSignIn({ challengeResponse: type })
      setActiveMfaType(type)
      await handleNextStep(nextStep.signInStep)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  async function handleMfaCodeSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { nextStep } = await confirmSignIn({
        challengeResponse: mfaCode.trim(),
      })
      await handleNextStep(nextStep.signInStep)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-12">
      <DotPattern
        className={cn(
          "mask-[radial-gradient(ellipse_at_center,white,transparent)] opacity-40"
        )}
      />
      <Card className="relative z-10 w-full max-w-md">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <HugeiconsIcon icon={SparklesIcon} className="size-6" />
          </div>
          <CardTitle className="text-xl">Ampere Studio</CardTitle>
          <CardDescription>
            {step === "credentials" &&
              "Sign in with the email and temporary password from your invite."}
            {step === "new-password" &&
              "Set a new password to finish activating your account."}
            {step === "mfa-selection" &&
              "Choose how you want to verify your identity."}
            {step === "mfa-code" &&
              (activeMfaType === "SMS"
                ? "Enter the code sent to your phone."
                : "Enter the code from your authenticator app.")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isAuthConfigured ? (
            <Alert>
              <AlertDescription>
                Cognito is not configured yet. Run{" "}
                <code className="text-xs">node scripts/setup-cognito.mjs</code>{" "}
                and add the printed values to{" "}
                <code className="text-xs">.env.local</code>.
              </AlertDescription>
            </Alert>
          ) : null}

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {step === "credentials" ? (
            <form onSubmit={handleCredentialsSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={loading || !isAuthConfigured}
              >
                {loading ? "Signing in..." : "Sign in"}
              </Button>
            </form>
          ) : null}

          {step === "new-password" ? (
            <form onSubmit={handleNewPasswordSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  At least 12 characters with uppercase, lowercase, number, and
                  symbol.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Saving..." : "Set password and continue"}
              </Button>
            </form>
          ) : null}

          {step === "mfa-selection" ? (
            <div className="space-y-3">
              {mfaOptions.includes("TOTP") ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={loading}
                  onClick={() => handleMfaSelection("TOTP")}
                >
                  Authenticator app
                </Button>
              ) : null}
              {mfaOptions.includes("SMS") ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={loading}
                  onClick={() => handleMfaSelection("SMS")}
                >
                  Text message (SMS)
                </Button>
              ) : null}
            </div>
          ) : null}

          {step === "mfa-code" ? (
            <form onSubmit={handleMfaCodeSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="mfa-code">Verification code</Label>
                <Input
                  id="mfa-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  placeholder="123456"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Verifying..." : "Verify"}
              </Button>
            </form>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
