import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.EMAIL_FROM ?? "FairMate <noreply@thefairmate.com>";

export async function sendVerificationEmail(
  to: string,
  code: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: "Verify your FairMate account",
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
          <h1 style="font-size: 24px; font-weight: 700; color: #1a1a1a; margin-bottom: 8px;">Welcome to FairMate</h1>
          <p style="font-size: 16px; color: #525252; line-height: 1.6; margin-bottom: 32px;">
            Enter this code to verify your email address and activate your account:
          </p>
          <div style="background: #f5f5f5; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 32px;">
            <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #1a1a1a;">${code}</span>
          </div>
          <p style="font-size: 14px; color: #737373; line-height: 1.5;">
            This code expires in 15 minutes. If you didn't create a FairMate account, you can safely ignore this email.
          </p>
        </div>
      `,
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

export function generateVerificationCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * Generate a secure random token for password resets (48 hex chars).
 */
export function generateResetToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: "Reset your FairMate password",
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
          <h1 style="font-size: 24px; font-weight: 700; color: #1a1a1a; margin-bottom: 8px;">Reset your password</h1>
          <p style="font-size: 16px; color: #525252; line-height: 1.6; margin-bottom: 32px;">
            We received a request to reset your FairMate password. Click the button below to choose a new one:
          </p>
          <div style="text-align: center; margin-bottom: 32px;">
            <a href="${resetUrl}" style="display: inline-block; background: #1e40af; color: #ffffff; font-size: 16px; font-weight: 600; padding: 14px 32px; border-radius: 8px; text-decoration: none;">
              Reset password
            </a>
          </div>
          <p style="font-size: 14px; color: #737373; line-height: 1.5;">
            This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email — your password will remain unchanged.
          </p>
          <p style="font-size: 12px; color: #a3a3a3; margin-top: 24px; line-height: 1.5;">
            If the button doesn't work, copy and paste this URL into your browser:<br/>
            <span style="color: #525252; word-break: break-all;">${resetUrl}</span>
          </p>
        </div>
      `,
    });

    console.log("[RESET EMAIL] to:", to, "data:", JSON.stringify(data), "error:", JSON.stringify(error));

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}
