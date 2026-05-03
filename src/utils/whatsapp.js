// Build a wa.me URL with prefilled text.
// If `phone` is omitted, opens the universal share sheet (user picks contact).

export function whatsappUrl(text, phone = '') {
  const cleaned = (phone || '').replace(/[^\d]/g, '');
  const base = cleaned ? `https://wa.me/${cleaned}` : 'https://wa.me/';
  return `${base}?text=${encodeURIComponent(text)}`;
}

export function shareLinkText(businessName, link) {
  return `🪒 ${businessName}\n\nאפשר לקבוע תור בלינק:\n${link}`;
}

export function reminderText(businessName, dateLabel, time) {
  return `🪒 תזכורת — תור ב-${businessName}\nתאריך: ${dateLabel}\nשעה: ${time}\n\nנתראה!`;
}
