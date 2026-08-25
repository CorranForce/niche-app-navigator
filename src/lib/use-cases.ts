export type UseCase = {
  slug: string;
  painType: string;
  title: string;
  tagline: string;
  description: string;
  signals: string[];
  appShapes: { name: string; blurb: string }[];
  niches: string[];
  workflow: string[];
};

export const USE_CASES: UseCase[] = [
  {
    slug: "scheduling-and-no-shows",
    painType: "Scheduling & no-shows",
    title: "Scheduling and no-show pain points",
    tagline: "Empty slots, phone-tag booking and last-minute cancellations.",
    description:
      "Appointment-driven businesses lose revenue every time a slot goes unfilled. The pain shows up as manual rebooking, no reminder system, and no way to backfill a cancellation quickly.",
    signals: [
      "Bookings still taken by phone or DM",
      "No automated reminder before the appointment",
      "Cancellations leave dead slots nobody fills",
      "Staff manually reshuffle a paper or spreadsheet calendar",
    ],
    appShapes: [
      { name: "Reminder + confirm loop", blurb: "SMS/email confirmations with one-tap reschedule." },
      { name: "Waitlist backfill", blurb: "Auto-offer a freed slot to the next person in line." },
      { name: "Deposit-gated booking", blurb: "Small card hold that collapses no-show rates." },
    ],
    niches: ["Independent dental clinics", "Boutique fitness studios", "Mobile dog groomers"],
    workflow: [
      "Enter the niche and pick the audience size.",
      "Read the ranked pain points and confirm scheduling tops the list.",
      "Take the top app concept and its 72-hour feature split.",
      "Ship the reminder loop first, add waitlist backfill in week two.",
    ],
  },
  {
    slug: "manual-admin-and-paperwork",
    painType: "Manual admin & paperwork",
    title: "Manual admin and paperwork pain points",
    tagline: "Hours lost to forms, re-typing and copy-paste between tools.",
    description:
      "Small operators run on paper, PDFs and spreadsheets. Each job is re-typed two or three times, which is slow, error-prone, and the first thing a narrow tool can remove.",
    signals: [
      "The same data entered into two or more systems",
      "Intake still happens on printed forms",
      "Staff export CSVs to reconcile by hand",
      "Compliance records kept in a shared drive",
    ],
    appShapes: [
      { name: "Digital intake", blurb: "Mobile form that writes straight into the job record." },
      { name: "One-click handoff", blurb: "Push a finished job into accounting without re-typing." },
      { name: "Template library", blurb: "Reusable job/document templates with autofill." },
    ],
    niches: ["Small-town law firms", "Local moving companies", "Auto detailing shops"],
    workflow: [
      "Generate a report for the niche.",
      "Look for pains tagged as repeated data entry.",
      "Pick the concept with the lowest build complexity.",
      "Build intake first — it produces the data every later feature needs.",
    ],
  },
  {
    slug: "lead-follow-up",
    painType: "Lead follow-up",
    title: "Lead follow-up pain points",
    tagline: "Enquiries that go cold because nobody replied fast enough.",
    description:
      "Most small businesses win or lose a job in the first hour. Leads arrive across forms, DMs and voicemail with no single queue, so follow-up is inconsistent and unmeasured.",
    signals: [
      "Leads land in three or more inboxes",
      "No record of who followed up or when",
      "First reply takes more than a day",
      "No nurture after the first unanswered message",
    ],
    appShapes: [
      { name: "Unified lead inbox", blurb: "Every channel into one queue with owner and status." },
      { name: "Auto first reply", blurb: "Instant acknowledgement plus a qualifying question." },
      { name: "Follow-up cadence", blurb: "Scheduled nudges until the lead answers or closes." },
    ],
    niches: ["Freelance wedding photographers", "Boutique travel agents", "Local moving companies"],
    workflow: [
      "Run the niche through the finder.",
      "Check which channels the pain-point signals mention.",
      "Choose the concept whose target user is the owner, not staff.",
      "Ship the unified inbox and auto reply inside the first release.",
    ],
  },
  {
    slug: "quoting-and-estimates",
    painType: "Quoting & estimates",
    title: "Quoting and estimate pain points",
    tagline: "Slow, inconsistent quotes built from scratch every time.",
    description:
      "Quote-driven trades rebuild pricing by hand on each job. It is slow, margins drift, and the customer waits days for a number a tool could produce in minutes.",
    signals: [
      "Quotes written in a document from memory",
      "Pricing varies between staff for the same job",
      "Days between site visit and sent quote",
      "No visibility into which quotes converted",
    ],
    appShapes: [
      { name: "Quote builder", blurb: "Line-item catalogue with margin rules and instant PDF." },
      { name: "On-site estimator", blurb: "Mobile flow that sends the quote before leaving." },
      { name: "Quote analytics", blurb: "Win rate by job type, price band and staff member." },
    ],
    niches: ["Auto detailing shops", "Local moving companies", "Food truck operators"],
    workflow: [
      "Generate the report with a moderate budget level.",
      "Confirm quoting appears with high severity.",
      "Take the tier table — quote volume is the natural limit to price on.",
      "Ship the catalogue and PDF first; analytics later.",
    ],
  },
  {
    slug: "invoicing-and-payments",
    painType: "Invoicing & payments",
    title: "Invoicing and payment pain points",
    tagline: "Late invoices, chasing payment, and cash flow guesswork.",
    description:
      "Getting paid is the pain owners feel most sharply. Invoices go out late, chasing is manual, and nobody knows this week's real cash position.",
    signals: [
      "Invoices raised days after the job is done",
      "Chasing overdue payment by personal text",
      "No card payment option on the invoice",
      "Cash position tracked in a spreadsheet",
    ],
    appShapes: [
      { name: "Job-to-invoice", blurb: "Completed job auto-drafts and sends the invoice." },
      { name: "Dunning automation", blurb: "Polite scheduled reminders until paid." },
      { name: "Cash view", blurb: "Simple expected-in dashboard for the next 30 days." },
    ],
    niches: ["Indie ceramics sellers", "Music teachers", "Small-town law firms"],
    workflow: [
      "Enter the niche and generate the report.",
      "Compare the payment pain against the admin pain by severity.",
      "Use the feature breakdown to scope invoice send for release one.",
      "Add reminders and cash view after real invoices exist.",
    ],
  },
  {
    slug: "client-communication",
    painType: "Client communication",
    title: "Client communication pain points",
    tagline: "Status questions, scattered threads and repeated updates.",
    description:
      "Clients ask 'where are we?' because there is no shared status. Owners answer the same question across text, email and calls instead of publishing progress once.",
    signals: [
      "Same status update repeated to each client",
      "Threads spread over SMS, email and social DMs",
      "No shared place for files or approvals",
      "Approvals stall with no reminder",
    ],
    appShapes: [
      { name: "Client status page", blurb: "One link per job showing stage, files and next step." },
      { name: "Approval requests", blurb: "Ask, remind, and record the sign-off." },
      { name: "Broadcast updates", blurb: "One update posted to every active client." },
    ],
    niches: ["Freelance wedding photographers", "Small-town law firms", "Boutique travel agents"],
    workflow: [
      "Generate a report for a service niche.",
      "Look for pains framed as repeated questions.",
      "Pick the concept whose value is visible to the end client.",
      "Ship the status page first — it removes most inbound messages.",
    ],
  },
];

export function getUseCase(slug: string) {
  return USE_CASES.find((u) => u.slug === slug);
}
