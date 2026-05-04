// Build a wa.me URL with prefilled text.
// If `phone` is omitted, opens the universal share sheet (user picks contact).
//
// IMPORTANT: wa.me requires phone numbers in international format (no leading 0,
// no +). Israeli numbers (0501234567) need to be rewritten as 972501234567 or
// the link errors with "This link couldn't be opened".

function normalizeForWhatsApp(rawPhone) {
  let n = (rawPhone || '').replace(/[^\d]/g, '');
  if (!n) return '';
  // Israeli local: starts with 0 and is 9-10 digits → drop 0, prepend 972
  if (n.startsWith('0') && (n.length === 9 || n.length === 10)) {
    n = '972' + n.substring(1);
  }
  // Number already starts with 972 — leave it
  // Other countries (e.g. user typed +1...) — leave it
  return n;
}

export function whatsappUrl(text, phone = '') {
  const cleaned = normalizeForWhatsApp(phone);
  const base = cleaned ? `https://wa.me/${cleaned}` : 'https://wa.me/';
  return `${base}?text=${encodeURIComponent(text)}`;
}

export function shareLinkText(businessName, link) {
  return `📅 ${businessName}\n\nאפשר לקבוע תור בלינק:\n${link}`;
}

export function reminderText(businessName, dateLabel, time) {
  return `⏰ תזכורת — תור ב-${businessName}\nתאריך: ${dateLabel}\nשעה: ${time}\n\nנתראה!`;
}
