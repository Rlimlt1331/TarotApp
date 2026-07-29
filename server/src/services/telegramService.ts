const TELEGRAM_API_BASE = 'https://api.telegram.org';
const TELEGRAM_MAX_MSG_LEN = 4096;

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

// Splits text into chunks at newline boundaries and sends each chunk.
// Needed for deliver mode: AI readings can exceed Telegram's 4096-char limit.
async function sendLongMessage(chatId: string | number, text: string): Promise<void> {
  let remaining = text.trim();
  while (remaining.length > 0) {
    if (remaining.length <= TELEGRAM_MAX_MSG_LEN) {
      await sendMessage(chatId, remaining);
      break;
    }
    let chunk = remaining.slice(0, TELEGRAM_MAX_MSG_LEN);
    const lastNewline = chunk.lastIndexOf('\n');
    if (lastNewline > TELEGRAM_MAX_MSG_LEN / 2) chunk = remaining.slice(0, lastNewline);
    await sendMessage(chatId, chunk.trimEnd());
    remaining = remaining.slice(chunk.length).trimStart();
  }
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
    // Send header and reading body separately so the body can be split if it
    // exceeds Telegram's 4096-character per-message limit.
    const header = [
      '✨ <b>Your Tarot Reading</b>',
      '',
      `<i>"${escapeHtml(question)}"</i>`,
    ].join('\n');
    await sendMessage(chatId, header);

    if (harmonisedReading) {
      await sendLongMessage(chatId, escapeHtml(harmonisedReading));
    } else {
      const fallback = portalUrl
        ? `🔗 <a href="${portalUrl}/my-readings">View Your Reading →</a>`
        : 'Log in to the portal to view your reading.';
      await sendMessage(chatId, fallback);
    }
  }
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
