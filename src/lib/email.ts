import { Resend } from "resend";
import { formatCurrency } from "./format";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const FROM = process.env.EMAIL_FROM ?? "SplitMate <noreply@splitmate.co.in>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://splitmate.co.in";

function emailWrapper(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
          <!-- Logo -->
          <tr>
            <td style="padding-bottom:24px;">
              <span style="font-size:20px;font-weight:700;color:#111827;">
                <span style="color:#4f46e5;">&#9679;</span> SplitMate
              </span>
            </td>
          </tr>
          <!-- Card -->
          <tr>
            <td style="background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;padding:28px 28px 24px;">
              ${body}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding-top:20px;text-align:center;font-size:12px;color:#9ca3af;">
              You received this because you are a member of a SplitMate room.<br/>
              <a href="${APP_URL}" style="color:#6b7280;">splitmate.co.in</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function btn(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;margin-top:20px;padding:10px 22px;background:#4f46e5;color:#ffffff;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;">${label}</a>`;
}

export async function sendExpenseAddedEmails(params: {
  roomId: string;
  roomName: string;
  expenseTitle: string;
  totalAmount: number;
  payerName: string;
  recipients: Array<{ email: string; name: string; shareAmount: number }>;
}): Promise<void> {
  if (!resend) return;

  const { roomId, roomName, expenseTitle, totalAmount, payerName, recipients } = params;

  await Promise.allSettled(
    recipients.map(({ email, name, shareAmount }) => {
      const greeting = name ? `Hi ${name.split(" ")[0]},` : "Hi,";
      const body = `
        <p style="margin:0 0 4px;font-size:18px;font-weight:700;color:#111827;">New expense in ${roomName}</p>
        <p style="margin:0 0 20px;font-size:14px;color:#6b7280;">${payerName} added a new expense</p>

        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;border-radius:8px;padding:16px;margin-bottom:4px;">
          <tr>
            <td style="font-size:15px;font-weight:600;color:#111827;">${expenseTitle}</td>
            <td align="right" style="font-size:18px;font-weight:700;color:#111827;">${formatCurrency(totalAmount)}</td>
          </tr>
          <tr>
            <td style="padding-top:8px;font-size:13px;color:#6b7280;">Paid by ${payerName}</td>
            <td align="right" style="padding-top:8px;font-size:13px;font-weight:600;color:#dc2626;">Your share: ${formatCurrency(shareAmount)}</td>
          </tr>
        </table>

        <p style="margin:16px 0 0;font-size:13px;color:#6b7280;">${greeting} Open SplitMate to view the full split details.</p>
        ${btn(`${APP_URL}/rooms/${roomId}`, "View Expense")}
      `;

      return resend!.emails.send({
        from: FROM,
        to: email,
        subject: `[${roomName}] ${payerName} added: ${expenseTitle} — ${formatCurrency(totalAmount)}`,
        html: emailWrapper(`New expense in ${roomName}`, body),
      });
    })
  );
}

export async function sendSettlementEmail(params: {
  roomId: string;
  roomName: string;
  payerName: string;
  amount: number;
  payeeEmail: string;
  payeeName: string;
  note?: string | null;
}): Promise<void> {
  if (!resend) return;

  const { roomId, roomName, payerName, amount, payeeEmail, payeeName, note } = params;
  const greeting = payeeName ? `Hi ${payeeName.split(" ")[0]},` : "Hi,";

  const body = `
    <p style="margin:0 0 4px;font-size:18px;font-weight:700;color:#111827;">You received a payment</p>
    <p style="margin:0 0 20px;font-size:14px;color:#6b7280;">${payerName} recorded a payment to you in ${roomName}</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;">
      <tr>
        <td style="font-size:14px;color:#166534;">Amount received</td>
        <td align="right" style="font-size:22px;font-weight:700;color:#15803d;">${formatCurrency(amount)}</td>
      </tr>
      <tr>
        <td style="padding-top:6px;font-size:13px;color:#6b7280;">From</td>
        <td align="right" style="padding-top:6px;font-size:13px;font-weight:600;color:#111827;">${payerName}</td>
      </tr>
      ${note ? `<tr><td style="padding-top:6px;font-size:13px;color:#6b7280;">Note</td><td align="right" style="padding-top:6px;font-size:13px;color:#374151;">${note}</td></tr>` : ""}
    </table>

    <p style="margin:16px 0 0;font-size:13px;color:#6b7280;">${greeting} Open SplitMate to check your updated balances.</p>
    ${btn(`${APP_URL}/rooms/${roomId}`, "View Room")}
  `;

  await resend.emails.send({
    from: FROM,
    to: payeeEmail,
    subject: `[${roomName}] ${payerName} sent you ${formatCurrency(amount)}`,
    html: emailWrapper("Payment received", body),
  });
}
