import nodemailer from 'nodemailer'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const sentHomeSubject = 'ICF HealthHub - Patient Sent Home Notification'
const passwordResetSubject = 'ICF HealthHub - Password Reset Request'
const icfLogoPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../public/icf logo.png')
const icfLogoCid = 'icf-healthhub-logo'
let smtpTransporter = null

function hasSmtpConfig() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
}

function createTransporter() {
  if (!hasSmtpConfig()) {
    throw new Error('SMTP email settings are incomplete.')
  }

  // Reuse authenticated SMTP connections. Previously each notification and
  // reset request opened a new connection, which added avoidable loading time.
  if (smtpTransporter) return smtpTransporter

  smtpTransporter = nodemailer.createTransport({
    pool: true,
    maxConnections: 2,
    maxMessages: 100,
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: String(process.env.SMTP_PASS).replace(/\s+/g, ''),
    },
  })

  return smtpTransporter
}

function formatEmailError(error) {
  return {
    message: error?.message,
    code: error?.code,
    command: error?.command,
    responseCode: error?.responseCode,
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatTimeWithMeridiem(value) {
  if (!value) return ''

  const timeMatch = String(value).trim().match(/(?:[T ]|^)(\d{1,2}):(\d{2})(?::\d{2})?/)
  if (!timeMatch) return String(value)

  const date = new Date(2000, 0, 1, Number(timeMatch[1]), Number(timeMatch[2]))
  if (Number.isNaN(date.getTime())) return String(value)

  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function buildSentHomeBody({ patientName, patientId, patientIdLabel, sentHomeDate, sentHomeTime }) {
  const safePatientName = escapeHtml(patientName || 'Patient')
  const safePatientId = escapeHtml(patientId || 'N/A')
  const safePatientIdLabel = escapeHtml(patientIdLabel || 'Patient ID')
  const safeSentHomeDate = escapeHtml(sentHomeDate || 'N/A')
  const safeSentHomeTime = escapeHtml(formatTimeWithMeridiem(sentHomeTime) || 'N/A')

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta http-equiv="x-ua-compatible" content="ie=edge">
    <title>${sentHomeSubject}</title>
    <style>
      @media only screen and (max-width: 620px) {
        .email-shell {
          width: 100% !important;
        }

        .email-padding {
          padding: 22px 16px !important;
        }

        .header-cell {
          padding: 24px 20px !important;
        }

        .content-cell {
          padding: 24px 20px !important;
        }

        .info-label,
        .info-value {
          display: block !important;
          width: 100% !important;
          text-align: left !important;
        }

        .info-value {
          padding-top: 4px !important;
        }
      }
    </style>
  </head>
  <body style="margin:0; padding:0; background:#f5f8fc; color:#112c61; font-family:Arial, Helvetica, sans-serif;">
    <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:transparent;">
      Clinic notification: ${safePatientName} has been sent home from the ICF School Clinic.
    </div>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%; background:#f5f8fc;">
      <tr>
        <td class="email-padding" align="center" style="padding:36px 18px;">
          <table role="presentation" class="email-shell" width="600" cellspacing="0" cellpadding="0" border="0" style="width:600px; max-width:600px; border-collapse:separate;">
            <tr>
              <td class="header-cell" style="background:#112c61; padding:30px 32px; border-radius:18px 18px 0 0;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td style="vertical-align:middle;">
                      <div style="font-size:12px; line-height:16px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:#f1bc10;">
                        Clinic Notification
                      </div>
                      <div style="margin-top:8px; font-size:25px; line-height:32px; font-weight:700; color:#ffffff;">
                        ICF HealthHub
                      </div>
                      <div style="margin-top:4px; font-size:14px; line-height:20px; color:#dfe8ff;">
                        School Clinic
                      </div>
                    </td>
                    <td align="right" style="vertical-align:middle;">
                      <img src="cid:${icfLogoCid}" width="64" height="64" alt="ICF logo" style="display:block; width:64px; height:64px; border-radius:16px; background:#ffffff; border:1px solid #dce4f1; object-fit:contain;">
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td class="content-cell" style="background:#ffffff; padding:30px 32px 32px; border-right:1px solid #dce4f1; border-left:1px solid #dce4f1;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td style="border-left:5px solid #d82e2a; padding-left:16px;">
                      <h1 style="margin:0; color:#112c61; font-size:28px; line-height:34px; font-weight:700;">
                        Patient Sent Home
                      </h1>
                      <p style="margin:8px 0 0; color:#526582; font-size:15px; line-height:23px;">
                        A patient clinic visit has been updated by the ICF School Clinic.
                      </p>
                    </td>
                  </tr>
                </table>

                <p style="margin:28px 0 0; color:#112c61; font-size:16px; line-height:25px;">
                  Dear Patient / Parent / Guardian,
                </p>
                <p style="margin:12px 0 0; color:#526582; font-size:15px; line-height:24px;">
                  This is to inform you that <strong style="color:#112c61;">${safePatientName}</strong> has been sent home from the ICF School Clinic.
                </p>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:24px; background:#f8fbff; border:1px solid #dce4f1; border-radius:14px;">
                  <tr>
                    <td style="padding:20px 22px;">
                      <div style="font-size:12px; line-height:16px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:#1d4eb5;">
                        Patient Information
                      </div>

                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:14px;">
                        <tr>
                          <td class="info-label" width="38%" style="padding:10px 0; border-top:1px solid #e1e7f0; color:#7785a0; font-size:13px; line-height:18px;">Patient Name</td>
                          <td class="info-value" width="62%" align="right" style="padding:10px 0; border-top:1px solid #e1e7f0; color:#112c61; font-size:14px; line-height:20px; font-weight:700;">${safePatientName}</td>
                        </tr>
                        <tr>
                          <td class="info-label" width="38%" style="padding:10px 0; border-top:1px solid #e1e7f0; color:#7785a0; font-size:13px; line-height:18px;">${safePatientIdLabel}</td>
                          <td class="info-value" width="62%" align="right" style="padding:10px 0; border-top:1px solid #e1e7f0; color:#112c61; font-size:14px; line-height:20px; font-weight:700;">${safePatientId}</td>
                        </tr>
                        <tr>
                          <td class="info-label" width="38%" style="padding:10px 0; border-top:1px solid #e1e7f0; color:#7785a0; font-size:13px; line-height:18px;">Date</td>
                          <td class="info-value" width="62%" align="right" style="padding:10px 0; border-top:1px solid #e1e7f0; color:#112c61; font-size:14px; line-height:20px; font-weight:700;">${safeSentHomeDate}</td>
                        </tr>
                        <tr>
                          <td class="info-label" width="38%" style="padding:10px 0; border-top:1px solid #e1e7f0; color:#7785a0; font-size:13px; line-height:18px;">Time</td>
                          <td class="info-value" width="62%" align="right" style="padding:10px 0; border-top:1px solid #e1e7f0; color:#112c61; font-size:14px; line-height:20px; font-weight:700;">${safeSentHomeTime}</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:22px; background:#fff6d9; border:1px solid #f1bc10; border-radius:14px;">
                  <tr>
                    <td style="padding:18px 20px;">
                      <div style="font-size:13px; line-height:18px; font-weight:700; color:#ad8100; text-transform:uppercase; letter-spacing:0.06em;">
                        Important Notice
                      </div>
                      <p style="margin:8px 0 0; color:#294366; font-size:14px; line-height:22px;">
                        Please ensure that a parent, guardian, or authorized representative can safely receive the patient and provide any needed follow-up care.
                      </p>
                    </td>
                  </tr>
                </table>

                <p style="margin:24px 0 0; color:#526582; font-size:15px; line-height:24px;">
                  If you have questions or concerns about this clinic notification, please contact the ICF School Clinic for assistance.
                </p>

                <p style="margin:26px 0 0; color:#112c61; font-size:15px; line-height:24px;">
                  Regards,<br>
                  <strong>ICF School Clinic</strong><br>
                  Interworld Colleges Foundation Inc.
                </p>
              </td>
            </tr>

            <tr>
              <td style="background:#eef5fb; padding:18px 28px; border:1px solid #dce4f1; border-top:0; border-radius:0 0 18px 18px; text-align:center;">
                <p style="margin:0; color:#7785a0; font-size:12px; line-height:18px;">
                  This is an automated notification from ICF HealthHub. Please do not reply directly to this email.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

function getClientUrl() {
  return (process.env.CLIENT_URL || process.env.CLIENT_ORIGIN || 'http://localhost:5173').replace(/\/+$/, '')
}

function buildPasswordResetBody({ resetUrl, expiresInMinutes, fullName }) {
  const safeResetUrl = escapeHtml(resetUrl)
  const safeExpires = escapeHtml(`${expiresInMinutes} minutes`)
  const safeName = escapeHtml(fullName || 'Clinic Administrator')

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${passwordResetSubject}</title>
  </head>
  <body style="margin:0; padding:0; background:#f5f8fc; color:#112c61; font-family:Arial, Helvetica, sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f5f8fc;">
      <tr>
        <td align="center" style="padding:36px 18px;">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:600px; max-width:100%; border-collapse:separate;">
            <tr>
              <td style="background:#112c61; padding:30px 32px; border-radius:18px 18px 0 0;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td>
                      <div style="font-size:12px; line-height:16px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:#f1bc10;">Interworld Colleges Foundation Inc.</div>
                      <div style="margin-top:8px; font-size:25px; line-height:32px; font-weight:700; color:#ffffff;">HealthHub</div>
                      <div style="margin-top:4px; font-size:14px; line-height:20px; color:#dfe8ff;">ICF School Clinic</div>
                    </td>
                    <td align="right">
                      <img src="cid:${icfLogoCid}" width="64" height="64" alt="ICF logo" style="display:block; width:64px; height:64px; border-radius:16px; background:#ffffff; border:1px solid #dce4f1; object-fit:contain;">
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="background:#ffffff; padding:30px 32px 34px; border-right:1px solid #dce4f1; border-left:1px solid #dce4f1;">
                <div style="border-left:5px solid #d82e2a; padding-left:16px;">
                  <h1 style="margin:0; color:#112c61; font-size:28px; line-height:34px;">Password Reset Request</h1>
                  <p style="margin:8px 0 0; color:#526582; font-size:15px; line-height:23px;">A password reset was requested for the ICF HealthHub clinic account.</p>
                </div>
                <p style="margin:28px 0 0; color:#112c61; font-size:16px; line-height:25px;">Hello ${safeName},</p>
                <p style="margin:12px 0 0; color:#526582; font-size:15px; line-height:24px;">Use the button below to create a new password. This secure link expires in ${safeExpires} and can only be used once.</p>
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0;">
                  <tr>
                    <td style="border-radius:10px; background:#d82e2a;">
                      <a href="${safeResetUrl}" style="display:inline-block; padding:14px 22px; color:#ffffff; font-size:15px; line-height:20px; font-weight:700; text-decoration:none;">Reset Password</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0; color:#526582; font-size:13px; line-height:21px;">If the button does not work, open this link in your browser:<br><a href="${safeResetUrl}" style="color:#1d4eb5;">${safeResetUrl}</a></p>
                <p style="margin:22px 0 0; color:#526582; font-size:15px; line-height:24px;">If you did not request this reset, you can ignore this email. Your current password was not included or changed.</p>
                <p style="margin:26px 0 0; color:#112c61; font-size:15px; line-height:24px;">Regards,<br><strong>ICF School Clinic</strong><br>Interworld Colleges Foundation Inc.</p>
              </td>
            </tr>
            <tr>
              <td style="background:#eef5fb; padding:18px 28px; border:1px solid #dce4f1; border-top:0; border-radius:0 0 18px 18px; text-align:center;">
                <p style="margin:0; color:#7785a0; font-size:12px; line-height:18px;">This is an automated security email from ICF HealthHub.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

export async function sendSentHomeEmail({ to, patientName, patientId, patientIdLabel, sentHomeDate, sentHomeTime }) {
  const transporter = createTransporter()
  const from = process.env.SMTP_FROM || process.env.SMTP_USER

  return transporter.sendMail({
    from,
    to,
    subject: sentHomeSubject,
    html: buildSentHomeBody({
      patientName,
      patientId,
      patientIdLabel,
      sentHomeDate,
      sentHomeTime,
    }),
    attachments: [
      {
        filename: 'icf-logo.png',
        path: icfLogoPath,
        cid: icfLogoCid,
      },
    ],
  })
}

export async function sendPasswordResetEmail({ to, resetToken, expiresInMinutes, fullName }) {
  const transporter = createTransporter()
  const from = process.env.SMTP_FROM || process.env.SMTP_USER
  const resetUrl = `${getClientUrl()}/?resetToken=${encodeURIComponent(resetToken)}`

  return transporter.sendMail({
    from,
    to,
    subject: passwordResetSubject,
    html: buildPasswordResetBody({ resetUrl, expiresInMinutes, fullName }),
    attachments: [
      {
        filename: 'icf-logo.png',
        path: icfLogoPath,
        cid: icfLogoCid,
      },
    ],
  })
}

export function logEmailError(context, error) {
  console.error(context, formatEmailError(error))
}
