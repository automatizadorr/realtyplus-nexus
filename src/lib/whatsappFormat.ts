// Parse WhatsApp-like format: *bold* _italic_ ~strike~ `code`
import React from "react";

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function formatWhatsappToHtml(text: string): string {
  let html = escapeHtml(text);
  html = html.replace(/(^|\s)\*(\S(?:.*?\S)?)\*(?=\s|$|[.,!?])/g, "$1<strong>$2</strong>");
  html = html.replace(/(^|\s)_(\S(?:.*?\S)?)_(?=\s|$|[.,!?])/g, "$1<em>$2</em>");
  html = html.replace(/(^|\s)~(\S(?:.*?\S)?)~(?=\s|$|[.,!?])/g, "$1<s>$2</s>");
  html = html.replace(/`([^`]+)`/g, "<code class='px-1 rounded bg-black/10'>$1</code>");
  return html;
}

export function FormattedText({ text, highlight }: { text: string; highlight?: string }) {
  let html = formatWhatsappToHtml(text);
  if (highlight && highlight.trim()) {
    const safe = highlight.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    html = html.replace(
      new RegExp(`(${safe})`, "gi"),
      "<mark class='bg-yellow-300 text-black rounded px-0.5'>$1</mark>"
    );
  }
  return React.createElement("span", {
    className: "whitespace-pre-wrap leading-relaxed",
    dangerouslySetInnerHTML: { __html: html },
  });
}
