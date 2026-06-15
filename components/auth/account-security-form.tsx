"use client"

import { useCallback, useEffect, useState } from "react"
import {
  fetchMFAPreference,
  setUpTOTP,
  verifyTOTPSetup,
  updateMFAPreference,
  updateUserAttribute,
  confirmUserAttribute,
  sendUserAttributeVerificationCode,
  updatePassword,
  fetchUserAttributes,
} from "aws-amplify/auth"
import { toast } from "sonner"

import { PageHeading } from "@/components/cms/page-heading"
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
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === "string") return error
  return "Something went wrong. Please try again."
}

export function AccountSecurityForm() {
  const [loading, setLoading] = useState(true)
  const [mfaPref, setMfaPref] = useState<
    Awaited<ReturnType<typeof fetchMFAPreference>>
  >({})
  const [email, setEmail] = useState<string | null>(null)
  const [phone, setPhone] = useState<string | null>(null)
  const [phoneVerified, setPhoneVerified] = useState(false)

  const [totpSecret, setTotpSecret] = useState<string | null>(null)
  const [totpUri, setTotpUri] = useState<string | null>(null)
  const [totpCode, setTotpCode] = useState("")

  const [newPhone, setNewPhone] = useState("")
  const [phoneCode, setPhoneCode] = useState("")
  const [phoneStep, setPhoneStep] = useState<"idle" | "verify">("idle")

  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [pref, attrs] = await Promise.all([
        fetchMFAPreference(),
        fetchUserAttributes(),
      ])
      setMfaPref({
        enabled: pref.enabled,
        preferred: pref.preferred,
      })
      setEmail(attrs.email ?? null)
      setPhone(attrs.phone_number ?? null)
      setPhoneVerified(attrs.phone_number_verified === "true")
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function handleStartTotp() {
    setError(null)
    setLoading(true)
    try {
      const details = await setUpTOTP()
      setTotpSecret(details.sharedSecret)
      setTotpUri(details.getSetupUri("Ampere Studio").toString())
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyTotp(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await verifyTOTPSetup({ code: totpCode.trim() })
      await updateMFAPreference({ totp: "PREFERRED" })
      setTotpSecret(null)
      setTotpUri(null)
      setTotpCode("")
      toast.success("Authenticator app enabled.")
      await refresh()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  async function handleDisableTotp() {
    setError(null)
    setLoading(true)
    try {
      await updateMFAPreference({ totp: "DISABLED" })
      toast.success("Authenticator app removed.")
      await refresh()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  async function handleSendPhoneCode(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await updateUserAttribute({
        userAttribute: {
          attributeKey: "phone_number",
          value: newPhone.trim(),
        },
      })
      setPhoneStep("verify")
      toast.success("Verification code sent.")
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirmPhone(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await confirmUserAttribute({
        userAttributeKey: "phone_number",
        confirmationCode: phoneCode.trim(),
      })
      await updateMFAPreference({ sms: "PREFERRED" })
      setPhoneStep("idle")
      setNewPhone("")
      setPhoneCode("")
      toast.success("Phone verified and SMS MFA enabled.")
      await refresh()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  async function handleDisableSms() {
    setError(null)
    setLoading(true)
    try {
      await updateMFAPreference({ sms: "DISABLED" })
      toast.success("SMS MFA disabled.")
      await refresh()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  async function handleResendPhoneCode() {
    setError(null)
    setLoading(true)
    try {
      await sendUserAttributeVerificationCode({
        userAttributeKey: "phone_number",
      })
      toast.success("Verification code resent.")
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.")
      return
    }

    setLoading(true)
    try {
      await updatePassword({
        oldPassword: currentPassword,
        newPassword,
      })
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      toast.success("Password updated.")
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const totpEnabled = mfaPref.enabled?.includes("TOTP")
  const smsEnabled = mfaPref.enabled?.includes("SMS")

  return (
    <div className="space-y-6">
      <PageHeading
        title="Account security"
        description="Manage your password and optional two-factor authentication. MFA is never required, but it adds an extra layer of protection."
      />

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Signed in as {email ?? "..."}</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {phone ? (
            <p>
              Phone: {phone}{" "}
              <Badge variant={phoneVerified ? "default" : "secondary"}>
                {phoneVerified ? "Verified" : "Unverified"}
              </Badge>
            </p>
          ) : (
            <p>No phone number on file.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Authenticator app (TOTP)</CardTitle>
          <CardDescription>
            Use Google Authenticator, Authy, or a similar app. Optional.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {totpEnabled ? (
            <div className="flex flex-wrap items-center gap-3">
              <Badge>Enabled</Badge>
              {mfaPref.preferred === "TOTP" ? (
                <Badge variant="secondary">Preferred</Badge>
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={loading}
                onClick={() => void handleDisableTotp()}
              >
                Remove authenticator
              </Button>
            </div>
          ) : totpSecret ? (
            <form onSubmit={handleVerifyTotp} className="space-y-4">
              {totpUri ? (
                <div className="rounded-md border bg-muted/40 p-4 text-sm">
                  <p className="mb-2 font-medium">Scan this URI in your app:</p>
                  <p className="font-mono text-xs break-all">{totpUri}</p>
                </div>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="totp-code">Verification code</Label>
                <Input
                  id="totp-code"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  placeholder="123456"
                  inputMode="numeric"
                  required
                />
              </div>
              <Button type="submit" disabled={loading}>
                Verify and enable
              </Button>
            </form>
          ) : (
            <Button
              type="button"
              disabled={loading}
              onClick={() => void handleStartTotp()}
            >
              Set up authenticator app
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Text message (SMS)</CardTitle>
          <CardDescription>
            Receive codes by text. New AWS accounts may be in the SNS SMS
            sandbox, so only verified numbers receive messages until production
            access is granted.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {smsEnabled ? (
            <div className="flex flex-wrap items-center gap-3">
              <Badge>Enabled</Badge>
              {mfaPref.preferred === "SMS" ? (
                <Badge variant="secondary">Preferred</Badge>
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={loading}
                onClick={() => void handleDisableSms()}
              >
                Disable SMS MFA
              </Button>
            </div>
          ) : phoneStep === "verify" ? (
            <form onSubmit={handleConfirmPhone} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone-code">Verification code</Label>
                <Input
                  id="phone-code"
                  value={phoneCode}
                  onChange={(e) => setPhoneCode(e.target.value)}
                  placeholder="123456"
                  inputMode="numeric"
                  required
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={loading}>
                  Verify phone and enable SMS
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={loading}
                  onClick={() => void handleResendPhoneCode()}
                >
                  Resend code
                </Button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSendPhoneCode} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone number (E.164)</Label>
                <Input
                  id="phone"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="+15551234567"
                  required
                />
              </div>
              <Button type="submit" disabled={loading}>
                Send verification code
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
          <CardDescription>
            Update your password after your first login.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="max-w-md space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Current password</Label>
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-new-password">Confirm new password</Label>
              <Input
                id="confirm-new-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={loading}>
              Update password
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
