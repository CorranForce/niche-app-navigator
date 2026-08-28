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
  ogImage: string;
  caseStudies: CaseStudy[];
};

export type CaseStudy = {
  niche: string;
  headline: string;
  challenge: string;
  build: string;
  result: string;
  quote: string;
  author: string;
  role: string;
  rating: number;
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
      {
        name: "Reminder + confirm loop",
        blurb: "SMS/email confirmations with one-tap reschedule.",
      },
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
    ogImage: "/og-uc-scheduling-and-no-shows.jpg",
    caseStudies: [
      {
        niche: "Independent dental clinic, 2 chairs",
        headline: "Cut no-shows from 22% to 6% in six weeks",
        challenge:
          "Front desk booked everything by phone and wrote it into a paper day sheet. Roughly one in five patients simply didn't turn up, and freed slots stayed empty because nobody had time to ring the waitlist.",
        build:
          "A reminder-and-confirm loop: SMS 48 hours and 3 hours out with one-tap confirm or reschedule, plus a waitlist queue that auto-offers a cancelled slot to the next three patients.",
        result:
          "No-show rate fell from 22% to 6% and about 11 previously dead slots per month were backfilled \u2014 roughly $3,400 of recovered chair time.",
        quote:
          "The report told us to ship reminders first and waitlist second. That order was right \u2014 reminders alone paid for the build in a month.",
        author: "Practice manager",
        role: "Independent dental clinic",
        rating: 5,
      },
      {
        niche: "Boutique fitness studio, 4 instructors",
        headline: "Deposit-gated booking ended the Saturday scramble",
        challenge:
          "Peak classes filled on Instagram DMs, then a third of bookers dropped out overnight and the class ran half-empty while a waitlist existed.",
        build:
          "Deposit-gated booking with a small card hold released on attendance, and an automatic waitlist promotion 12 hours before class.",
        result:
          "Average class fill rose from 62% to 89%, and DM booking traffic dropped to near zero within three weeks.",
        quote:
          "I thought a deposit would scare people off. It filtered exactly the people who never showed.",
        author: "Studio owner",
        role: "Boutique fitness studio",
        rating: 5,
      },
      {
        niche: "Mobile dog groomer, solo operator",
        headline: "Route-aware slots removed two hours of daily phone-tag",
        challenge:
          "Every booking needed a call to check whether the van could get across town in time, so quoting a slot took three messages.",
        build:
          "A booking page that only offers slots compatible with that day's existing route, with automated confirmation and day-before reminder.",
        result:
          "Booking admin dropped from about two hours a day to fifteen minutes, and one extra appointment per day now fits in the route.",
        quote:
          "It solved the scheduling problem and the driving problem at once. I didn't expect one small app to do both.",
        author: "Owner-operator",
        role: "Mobile dog grooming",
        rating: 4,
      },
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
      {
        name: "One-click handoff",
        blurb: "Push a finished job into accounting without re-typing.",
      },
      { name: "Template library", blurb: "Reusable job/document templates with autofill." },
    ],
    niches: ["Small-town law firms", "Local moving companies", "Auto detailing shops"],
    workflow: [
      "Generate a report for the niche.",
      "Look for pains tagged as repeated data entry.",
      "Pick the concept with the lowest build complexity.",
      "Build intake first — it produces the data every later feature needs.",
    ],
    ogImage: "/og-uc-manual-admin-and-paperwork.jpg",
    caseStudies: [
      {
        niche: "Small-town law firm, 3 attorneys",
        headline: "Digital intake removed 9 hours of re-typing a week",
        challenge:
          "New client details were captured on a printed form, typed into the case system, then typed again into the billing spreadsheet.",
        build:
          "A mobile intake form that writes straight into the case record, plus a one-click push of the finished matter into accounting.",
        result:
          "About 9 hours of paralegal re-typing removed per week and intake errors dropped to near zero because data is entered once.",
        quote:
          "The build order in the report was the useful part: intake first, because everything downstream needs that data clean.",
        author: "Managing partner",
        role: "Small-town law firm",
        rating: 5,
      },
      {
        niche: "Local moving company, 6 crew",
        headline: "Job templates cut paperwork per move from 40 to 8 minutes",
        challenge:
          "Every move produced an inventory sheet, a damage waiver and a signed completion form, all on paper and all re-keyed on Monday.",
        build:
          "A template library with autofill and on-site signature capture, syncing each completed job to the office instantly.",
        result:
          "Paperwork time per move fell from ~40 minutes to ~8, and disputed damage claims dropped because photos attach to the record.",
        quote: "We stopped losing forms in truck cabs. That alone was worth it.",
        author: "Operations lead",
        role: "Local moving company",
        rating: 4,
      },
      {
        niche: "Auto detailing shop, 2 bays",
        headline: "One-click handoff to accounting killed the Sunday admin block",
        challenge:
          "The owner spent most of Sunday copying job sheets into the accounting tool and reconciling card payouts by hand.",
        build:
          "Job records that generate the accounting entry on completion, with a weekly reconciliation view.",
        result: "Sunday admin went from four hours to about twenty minutes of review.",
        quote: "I got my weekend back. Same tools, just no re-typing between them.",
        author: "Owner",
        role: "Auto detailing shop",
        rating: 5,
      },
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
    ogImage: "/og-uc-lead-follow-up.jpg",
    caseStudies: [
      {
        niche: "Freelance wedding photographer",
        headline: "Instant first reply doubled booked consultations",
        challenge:
          "Enquiries arrived via website form, Instagram and voicemail. Replies often took two days, by which point couples had booked elsewhere.",
        build:
          "A unified lead inbox with an instant acknowledgement plus one qualifying question, then a three-step nudge cadence.",
        result:
          "Median first-reply time went from 31 hours to under 5 minutes, and booked consultations roughly doubled over a season.",
        quote:
          "Speed was the whole game and I couldn't see it until every channel was in one list.",
        author: "Photographer",
        role: "Freelance wedding photography",
        rating: 5,
      },
      {
        niche: "Boutique travel agency, 4 agents",
        headline: "Owner-visible queue ended the silent lead leak",
        challenge:
          "Nobody knew which agent owned which enquiry, so some leads got three replies and others got none.",
        build:
          "A shared queue with explicit owner and status, plus an unanswered-after-24h escalation to the owner.",
        result:
          "Unanswered enquiries fell from an estimated 18% to under 2%, with a measurable lift in quotes sent per week.",
        quote: "The escalation rule was the small thing that changed behaviour.",
        author: "Agency owner",
        role: "Boutique travel agency",
        rating: 4,
      },
      {
        niche: "Local moving company",
        headline: "A follow-up cadence recovered 14% of cold quotes",
        challenge:
          "Quotes were sent once and never chased; anyone who didn't reply was silently written off.",
        build:
          "A scheduled cadence of three polite nudges tied to quote status, stopping automatically on reply or booking.",
        result: "About 14% of previously cold quotes converted, with no extra staff time.",
        quote: "It's just the follow-up we always meant to do and never did.",
        author: "Owner",
        role: "Local moving company",
        rating: 5,
      },
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
    ogImage: "/og-uc-quoting-and-estimates.jpg",
    caseStudies: [
      {
        niche: "Auto detailing shop",
        headline: "On-site estimator sends the quote before leaving the driveway",
        challenge:
          "Quotes were written up back at the shop from memory, arriving two days later with inconsistent pricing.",
        build: "A mobile estimator with a line-item catalogue, margin rules and instant PDF send.",
        result:
          "Quote turnaround dropped from ~2 days to under 10 minutes and win rate rose from 34% to 51%.",
        quote: "Same-day used to be our best case. Now it's before I pull off the drive.",
        author: "Owner",
        role: "Auto detailing shop",
        rating: 5,
      },
      {
        niche: "Local moving company",
        headline: "Margin rules ended $200 swings on identical jobs",
        challenge:
          "Different staff quoted the same two-bedroom move up to $200 apart, and nobody could explain why.",
        build:
          "A quote builder where volume, distance and access drive price from a shared catalogue with locked margin floors.",
        result:
          "Price variance on comparable jobs fell under 5%, and average gross margin rose 6 points.",
        quote: "We stopped negotiating against ourselves.",
        author: "General manager",
        role: "Local moving company",
        rating: 4,
      },
      {
        niche: "Food truck operator, event catering",
        headline: "Quote analytics revealed which events were never worth bidding",
        challenge:
          "Event quotes went out constantly with no record of what converted or at what margin.",
        build: "Quote tracking with win rate by event type, price band and lead source.",
        result:
          "Two whole event categories were dropped, and time freed went into the two that converted at 60%+.",
        quote: "Knowing what not to quote for was worth more than quoting faster.",
        author: "Owner",
        role: "Food truck catering",
        rating: 5,
      },
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
    ogImage: "/og-uc-invoicing-and-payments.jpg",
    caseStudies: [
      {
        niche: "Music teacher, 40 weekly students",
        headline: "Auto-invoicing cut unpaid lessons from 12% to 1%",
        challenge:
          "Invoices were raised manually at month end and chased by personal text, with no card option.",
        build:
          "Job-to-invoice automation that bills on lesson completion, with card payment on the invoice and scheduled reminders.",
        result:
          "Unpaid lessons fell from 12% to about 1% and average days-to-payment dropped from 26 to 4.",
        quote:
          "I stopped being the person who texts people about money. The system does it politely.",
        author: "Instructor",
        role: "Private music tuition",
        rating: 5,
      },
      {
        niche: "Indie ceramics seller",
        headline: "Cash view replaced the guesswork spreadsheet",
        challenge:
          "Wholesale orders paid on varying terms and the owner had no idea what was actually landing in the next 30 days.",
        build: "An expected-in dashboard reading from invoice status, with a simple overdue split.",
        result:
          "Kiln and materials purchases moved onto a planned cycle; two overdrafts in the prior year became none.",
        quote: "I finally stopped ordering clay on a hunch.",
        author: "Founder",
        role: "Independent ceramics studio",
        rating: 4,
      },
      {
        niche: "Small-town law firm",
        headline: "Dunning automation recovered $18k of aged receivables",
        challenge:
          "Overdue matters sat untouched because chasing clients felt awkward and nobody owned it.",
        build:
          "A scheduled dunning ladder with escalating but professional wording, pausing automatically on partial payment.",
        result:
          "About $18,000 of receivables over 60 days old was collected in the first quarter after launch.",
        quote: "Taking the awkwardness out of chasing was the actual feature.",
        author: "Managing partner",
        role: "Small-town law firm",
        rating: 5,
      },
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
    ogImage: "/og-uc-client-communication.jpg",
    caseStudies: [
      {
        niche: "Freelance wedding photographer",
        headline: "A client status page removed 70% of inbound messages",
        challenge:
          "Couples asked the same 'where are my photos?' question weekly across text, email and Instagram.",
        build:
          "One status link per booking showing stage, gallery links and next step, updated once by the photographer.",
        result:
          "Inbound status messages dropped roughly 70% and delivery-related complaints stopped entirely.",
        quote: "I post the update once and everyone sees it. Obvious in hindsight.",
        author: "Photographer",
        role: "Freelance wedding photography",
        rating: 5,
      },
      {
        niche: "Small-town law firm",
        headline: "Approval requests cut sign-off delays from 9 days to 2",
        challenge:
          "Documents sat awaiting client sign-off with no reminder and no record of who was blocking.",
        build:
          "Structured approval requests with automatic reminders and a logged, timestamped sign-off.",
        result: "Median approval time fell from 9 days to 2, and matters closed measurably faster.",
        quote: "The reminder is doing the job an assistant used to do badly.",
        author: "Attorney",
        role: "Small-town law firm",
        rating: 4,
      },
      {
        niche: "Boutique travel agency",
        headline: "Broadcast updates handled a disruption day without meltdown",
        challenge:
          "When a carrier cancelled, agents phoned every affected traveller individually and still missed some.",
        build:
          "Broadcast updates posted once to every active client, with per-client acknowledgement tracking.",
        result:
          "A day that previously took the whole team was handled in under an hour, with a full record of who was informed.",
        quote: "During the strike week this thing earned a year of subscription.",
        author: "Agency owner",
        role: "Boutique travel agency",
        rating: 5,
      },
    ],
  },
];

export function getUseCase(slug: string) {
  return USE_CASES.find((u) => u.slug === slug);
}

/**
 * Bare-bones prompt a visitor can paste straight into a coding LLM
 * (Lovable, Cursor, Claude, etc.) to scaffold the microSaaS for this pain type.
 */
export function buildStarterPrompt(u: UseCase): string {
  return [
    `Build a minimal web app (MVP, shippable in 72 hours) that solves this problem:`,
    ``,
    `Problem: ${u.painType} — ${u.description}`,
    ``,
    `Target users: ${u.niches.join("; ")}.`,
    ``,
    `Core features (build in this order):`,
    ...u.appShapes.map((a, i) => `${i + 1}. ${a.name} — ${a.blurb}`),
    ``,
    `Scope rules:`,
    `- Web app only, mobile-responsive, no native apps.`,
    `- Feature 1 must work end-to-end before starting feature 2.`,
    `- Use simple email/password auth only; no social logins.`,
    `- No payments, teams, or integrations in the MVP.`,
    `- Seed the app with realistic demo data so it is testable immediately.`,
    ``,
    `Done means: a user can sign up, complete the core workflow (${u.workflow[0].replace(/\.$/, "").toLowerCase()}), and see the result without touching support.`,
  ].join("\n");
}
