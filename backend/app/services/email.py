import resend
from app.core.config import settings

FROM_ADDRESS = "onboarding@resend.dev"
ADMIN_EMAIL = "afzal@uni.minerva.edu"


def _send(to: str, subject: str, html: str) -> None:
    resend.api_key = settings.RESEND_API_KEY
    resend.Emails.send({
        "from": FROM_ADDRESS,
        "to": [to],
        "subject": subject,
        "html": html,
    })


def send_waitlist_notification(applicant_email: str) -> None:
    """Notify admin that someone joined the waitlist. Includes Approve and Reject buttons."""
    from urllib.parse import quote
    encoded = quote(applicant_email, safe="")
    approve_url = f"{settings.BACKEND_URL}/waitlist/approve/{encoded}"
    reject_url = f"{settings.BACKEND_URL}/waitlist/reject/{encoded}"

    html = f"""
    <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; padding: 40px 32px; color: #1A1A18;">
      <p style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; color: #9c9890; margin-bottom: 32px;">PACK — Waitlist Request</p>
      <h2 style="font-size: 24px; font-weight: 400; margin: 0 0 16px;">New request from</h2>
      <p style="font-size: 18px; font-weight: 400; margin: 0 0 40px; color: #1A1A18;">{applicant_email}</p>
      <div style="display: flex; gap: 12px;">
        <a href="{approve_url}" style="display: inline-block; background: #1A1A18; color: #ffffff; font-family: sans-serif; font-size: 12px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.1em; padding: 12px 28px; text-decoration: none; margin-right: 12px;">Approve</a>
        <a href="{reject_url}" style="display: inline-block; background: #ffffff; color: #1A1A18; font-family: sans-serif; font-size: 12px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.1em; padding: 12px 28px; text-decoration: none; border: 1px solid #1A1A18;">Reject</a>
      </div>
    </div>
    """

    _send(ADMIN_EMAIL, "New PACK waitlist request", html)


def send_invite_email(applicant_email: str, token: str) -> None:
    """Send the user their unique signup link once approved."""
    signup_url = f"{settings.FRONTEND_URL}/register?token={token}"

    html = f"""
    <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; padding: 40px 32px; color: #1A1A18;">
      <p style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; color: #9c9890; margin-bottom: 32px;">PACK</p>
      <h2 style="font-size: 32px; font-weight: 300; font-style: italic; margin: 0 0 16px; line-height: 1.1;">You're in.</h2>
      <p style="font-size: 15px; font-weight: 300; color: #5a5852; line-height: 1.6; margin: 0 0 40px; max-width: 400px;">
        Your invite is ready. Click below to create your account and start packing like you mean it.
      </p>
      <a href="{signup_url}" style="display: inline-block; background: #1A1A18; color: #ffffff; font-family: sans-serif; font-size: 12px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.1em; padding: 14px 32px; text-decoration: none;">Create Your Account</a>
      <p style="font-size: 11px; font-family: sans-serif; color: #9c9890; margin-top: 32px; line-height: 1.6;">
        This link is personal to you and can only be used once.<br>
        If you didn't request this, ignore this email.
      </p>
    </div>
    """

    _send(applicant_email, "You're in — welcome to PACK", html)
