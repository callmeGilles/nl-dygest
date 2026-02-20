import { getGmailClient } from "./gmail";

interface ParsedNewsletter {
  gmailId: string;
  sender: string;
  subject: string;
  snippet: string;
  receivedAt: string;
  rawHtml: string;
}

function getHeader(headers: Array<{ name: string; value: string }>, name: string): string {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || "";
}

function extractHtmlBody(payload: any): string {
  if (payload.mimeType === "text/html" && payload.body?.data) {
    return Buffer.from(payload.body.data, "base64url").toString("utf-8");
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      const html = extractHtmlBody(part);
      if (html) return html;
    }
  }
  return "";
}

export function parseGmailMessage(message: any): ParsedNewsletter {
  const headers = message.payload.headers || [];
  const dateStr = getHeader(headers, "Date");

  return {
    gmailId: message.id,
    sender: getHeader(headers, "From"),
    subject: getHeader(headers, "Subject"),
    snippet: message.snippet || "",
    receivedAt: dateStr ? new Date(dateStr).toISOString() : new Date().toISOString(),
    rawHtml: extractHtmlBody(message.payload),
  };
}

export async function fetchNewsletters(
  label: string,
  maxResults = 20,
  accessToken: string,
  refreshToken?: string | null
): Promise<ParsedNewsletter[]> {
  const gmail = getGmailClient(accessToken, refreshToken);

  // Find label ID
  const labels = await gmail.users.labels.list({ userId: "me" });
  const targetLabel = labels.data.labels?.find(
    (l) => l.name?.toLowerCase() === label.toLowerCase()
  );

  if (!targetLabel?.id) {
    throw new Error(`Label "${label}" not found in Gmail`);
  }

  // Fetch message IDs
  const response = await gmail.users.messages.list({
    userId: "me",
    labelIds: [targetLabel.id],
    q: "is:unread",
    maxResults,
  });

  if (!response.data.messages?.length) {
    return [];
  }

  // Fetch full messages
  const messages = await Promise.all(
    response.data.messages.map((msg) =>
      gmail.users.messages.get({
        userId: "me",
        id: msg.id!,
        format: "full",
      })
    )
  );

  return messages.map((m) => parseGmailMessage(m.data));
}


export async function markAsRead(gmailId: string, accessToken: string, refreshToken?: string | null) {
  const gmail = getGmailClient(accessToken, refreshToken);
  await gmail.users.messages.modify({
    userId: "me",
    id: gmailId,
    requestBody: { removeLabelIds: ["UNREAD"] },
  });
}

export async function addLabel(gmailId: string, labelName: string, accessToken: string, refreshToken?: string | null) {
  const gmail = getGmailClient(accessToken, refreshToken);

  // Ensure label exists, create if not
  const labels = await gmail.users.labels.list({ userId: "me" });
  let label = labels.data.labels?.find((l) => l.name === labelName);

  if (!label) {
    const created = await gmail.users.labels.create({
      userId: "me",
      requestBody: { name: labelName },
    });
    label = created.data;
  }

  await gmail.users.messages.modify({
    userId: "me",
    id: gmailId,
    requestBody: { addLabelIds: [label.id!] },
  });
}
