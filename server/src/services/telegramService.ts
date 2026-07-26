const TELEGRAM_API_BASE = 'https://api.telegram.org';

async function callTelegram(method: string, payload: object): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;

  try {
    const res = await fetch(`${TELEGRAM_API_BASE}/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error(`Telegram ${method} failed (${res.status}):`, await res.text());
    }
  } catch (err) {
    console.error(`Telegram ${method} error:`, err);
  }
}

export async function sendMessage(chatId: string | number, text: string): Promise<void> {
  await callTelegram('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  });
}

export async function notifyReaderNewSubmission(submission: {
  id: number;
  question: string;
  category?: string | null;
  horoscope?: string | null;
  user: { name?: string | null; email: string | null };
}): Promise<void> {
  const chatId = process.env.TELEGRAM_READER_CHAT_ID;
  if (!chatId) return;

  const portalUrl = process.env.FRONTEND_URL || '';
  const lines: string[] = [
    '🔮 <b>New Reading Request</b>',
    '',
    `👤 <b>From:</b> ${submission.user.name || 'Anonymous'}${submission.user.email ? ` (${submission.user.email})` : ''}`,
  ];
  if (submission.category) lines.push(`🌟 <b>Category:</b> ${submission.category}`);
  if (submission.horoscope) lines.push(`♈ <b>Horoscope:</b> ${submission.horoscope}`);
  lines.push(`❓ <b>Question:</b> ${escapeHtml(submission.question)}`);
  if (portalUrl) lines.push('', `📋 <a href="${portalUrl}/reader">Open Reader Portal →</a>`);

  await sendMessage(chatId, lines.join('\n'));
}

export async function notifyRequesterReadingReady(
  chatId: string,
  question: string,
  mode: 'notify' | 'deliver',
  harmonisedReading?: string | null
): Promise<void> {
  const portalUrl = process.env.FRONTEND_URL || '';

  if (mode === 'notify') {
    const lines = [
      '✨ <b>Your Tarot Reading is Ready!</b>',
      '',
      `Your reading for: <i>"${escapeHtml(question)}"</i> is now ready.`,
    ];
    if (portalUrl) lines.push('', `🔗 <a href="${portalUrl}/my-readings">View Your Reading →</a>`);
    else lines.push('', 'Log in to the portal to view your reading.');
    await sendMessage(chatId, lines.join('\n'));
  } else {
    const lines = [
      '✨ <b>Your Tarot Reading</b>',
      '',
      `<i>"${escapeHtml(question)}"</i>`,
      '',
      harmonisedReading
        ? escapeHtml(harmonisedReading)
        : 'Your reading is ready — log in to the portal to view it.',
    ];
    await sendMessage(chatId, lines.join('\n'));
  }
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
