// Client memory engine — pure function that turns the barber's full
// booking history into a single client's CRM card.
//
// Inputs: all bookings (the barber's whole list as already loaded in
// state) + the client's phone (we filter to that client) + today's ISO.
// Output: { visits, revenue, avgCycleDays, lastVisitDate,
//   daysSinceLastVisit, weeksSinceLastVisit, preferredService,
//   cancellations, cancellationRate, totalBookings, isVIP, isRisky }
//
// All computation runs locally — no AI cost, no Firestore extra reads.

export function computeClientMemory(allBookings, clientPhone, todayISO) {
  if (!clientPhone || !Array.isArray(allBookings)) return null;

  const my = allBookings.filter((b) => b.clientPhone === clientPhone);
  if (my.length === 0) return null;

  // Bookings that happened in the past (today included), separated by outcome
  const past = my.filter((b) => (b.date || '') <= todayISO);
  const cancelled = my.filter((b) => b.status === 'cancelled');
  const fulfilled = past.filter((b) =>
    b.status === 'completed' || b.status === 'booked' || b.status === 'inProgress',
  );

  const visits = fulfilled.length;
  const revenue = fulfilled.reduce((s, b) => s + (Number(b.price) || 0), 0);

  // Sorted past visit dates — used for last-visit and avg-cycle math
  const visitDates = fulfilled.map((b) => b.date).filter(Boolean).sort();

  let lastVisitDate = null;
  let daysSinceLastVisit = null;
  let weeksSinceLastVisit = null;
  if (visitDates.length > 0) {
    lastVisitDate = visitDates[visitDates.length - 1];
    daysSinceLastVisit = daysBetween(lastVisitDate, todayISO);
    weeksSinceLastVisit = Math.round(daysSinceLastVisit / 7);
  }

  let avgCycleDays = null;
  if (visitDates.length >= 2) {
    const gaps = [];
    for (let i = 1; i < visitDates.length; i++) {
      gaps.push(daysBetween(visitDates[i - 1], visitDates[i]));
    }
    avgCycleDays = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
  }

  // Mode of service — counts by name
  const serviceCounts = {};
  for (const b of fulfilled) {
    const n = (b.serviceName || '').trim();
    if (!n) continue;
    serviceCounts[n] = (serviceCounts[n] || 0) + 1;
  }
  const preferredService =
    Object.entries(serviceCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '';

  const totalBookings = my.length;
  const cancellationRate = totalBookings > 0 ? cancelled.length / totalBookings : 0;

  // Status flags
  // VIP: at least 5 fulfilled visits AND <25% cancellation rate
  const isVIP = visits >= 5 && cancellationRate < 0.25;
  // Risky: 2+ cancellations OR >25% cancellation rate
  const isRisky = cancelled.length >= 2 || cancellationRate > 0.25;
  // First-time: NO past visits (this might be their first booking)
  const isFirstTime = visits === 0;

  return {
    visits,
    revenue,
    avgCycleDays,
    avgCycleWeeks: avgCycleDays ? Math.round(avgCycleDays / 7) : null,
    lastVisitDate,
    daysSinceLastVisit,
    weeksSinceLastVisit,
    preferredService,
    cancellations: cancelled.length,
    cancellationRate,
    totalBookings,
    isVIP,
    isRisky,
    isFirstTime,
  };
}

function daysBetween(isoA, isoB) {
  if (!isoA || !isoB) return 0;
  const a = parseISO(isoA);
  const b = parseISO(isoB);
  if (!a || !b) return 0;
  return Math.round(Math.abs(b - a) / 86_400_000);
}

function parseISO(s) {
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}
