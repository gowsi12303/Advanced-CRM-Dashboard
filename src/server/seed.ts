import {
  CONTACT_METHODS,
  CUSTOMER_STATUSES,
  type Customer,
  type CustomerNote,
  type CustomerStatus,
} from "@/features/customers/types";

const SEED_CUSTOMER_COUNT = 150;
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_AGE_DAYS = 720;

const FIRST_NAMES = [
  "Aaliyah", "Adrian", "Aiko", "Amara", "Andre", "Anika", "Arjun", "Beatriz",
  "Callum", "Camille", "Chen", "Daniela", "Darius", "Elena", "Emeka", "Farah",
  "Felix", "Gabriela", "Hana", "Hugo", "Imani", "Isaac", "Jasmine", "Jonas",
  "Kavya", "Kenji", "Leila", "Liam", "Lucia", "Malik", "Mei", "Mateo",
  "Nadia", "Noah", "Olivia", "Omar", "Priya", "Rafael", "Sofia", "Tariq",
  "Thandiwe", "Victor", "Wei", "Yara", "Zoe",
];

const LAST_NAMES = [
  "Abdi", "Almeida", "Andersson", "Banerjee", "Bianchi", "Castillo", "Chowdhury",
  "Cohen", "Dubois", "Eze", "Fernandez", "Fischer", "Garcia", "Haddad", "Hughes",
  "Ibrahim", "Ivanov", "Jensen", "Kapoor", "Kim", "Kowalski", "Lindqvist",
  "Martins", "Mbeki", "Nakamura", "Nguyen", "O'Brien", "Okafor", "Patel",
  "Petrov", "Ramirez", "Rossi", "Sato", "Schmidt", "Silva", "Tanaka", "Thompson",
  "Vasquez", "Walker", "Yilmaz", "Zhang",
];

const COMPANIES = [
  { name: "Northwind Logistics", domain: "northwind-logistics.example" },
  { name: "Brightwave Media", domain: "brightwave.example" },
  { name: "Cobalt Health", domain: "cobalthealth.example" },
  { name: "Evergreen Foods", domain: "evergreenfoods.example" },
  { name: "Summit Analytics", domain: "summitanalytics.example" },
  { name: "Harbor & Finch", domain: "harborfinch.example" },
  { name: "Lumen Robotics", domain: "lumenrobotics.example" },
  { name: "Atlas Freight", domain: "atlasfreight.example" },
  { name: "Quartz Financial", domain: "quartzfinancial.example" },
  { name: "Pinecrest Studios", domain: "pinecrest.example" },
  { name: "Meridian Energy", domain: "meridian-energy.example" },
  { name: "Juniper Labs", domain: "juniperlabs.example" },
  { name: "Redwood Retail", domain: "redwoodretail.example" },
  { name: "Solstice Travel", domain: "solsticetravel.example" },
  { name: "Ironbridge Construction", domain: "ironbridge.example" },
  { name: "Vela Software", domain: "vela.example" },
  { name: "Orchard Education", domain: "orchardedu.example" },
  { name: "Tidewater Insurance", domain: "tidewater.example" },
];

const JOB_TITLES = [
  "Head of Operations", "Procurement Manager", "Chief Technology Officer",
  "Marketing Director", "Finance Lead", "Product Manager", "Founder",
  "Customer Success Manager", "IT Administrator", "VP of Sales",
  "Operations Analyst", "Office Manager",
];

const AREA_CODES = ["212", "312", "415", "512", "617", "646", "718", "206"];

// Cumulative weights, aligned with CUSTOMER_STATUSES.
const STATUS_WEIGHTS: Record<CustomerStatus, number> = {
  lead: 0.25,
  prospect: 0.2,
  active: 0.35,
  inactive: 0.12,
  churned: 0.08,
};

const NOTE_BODIES = [
  "Asked for a revised quote covering two additional seats.",
  "Prefers to be contacted in the morning, before 11am.",
  "Demo went well. Wants to loop in their finance team before deciding.",
  "Raised a concern about onboarding time; sent the implementation guide.",
  "Renewal is coming up next quarter. Flag for an account review.",
  "Mentioned they are evaluating a competitor on price.",
  "Introduced by an existing customer. Warm lead.",
  "Requested an invoice copy for the last billing period.",
  "Out of office until the end of the month; follow up afterwards.",
  "Interested in the reporting add-on once the budget is approved.",
];

/** Small deterministic PRNG (mulberry32) so the seed data never changes between runs. */
function createRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z]/g, "");
}

export type SeedData = {
  customers: Customer[];
  notes: CustomerNote[];
};

/**
 * Builds the seed data set. People, companies and relative ages are fixed;
 * timestamps are expressed relative to `anchor` so "last 30 days" style
 * filters keep returning sensible results whenever the server is started.
 */
export function createSeedData(anchor: Date): SeedData {
  const random = createRandom(20240917);
  const pick = <T,>(items: readonly T[]): T =>
    items[Math.floor(random() * items.length)];
  const between = (min: number, max: number) =>
    min + Math.floor(random() * (max - min + 1));

  const pickStatus = (): CustomerStatus => {
    let roll = random();
    for (const status of CUSTOMER_STATUSES) {
      roll -= STATUS_WEIGHTS[status];
      if (roll < 0) return status;
    }
    return "active";
  };

  const anchorMs = anchor.getTime();
  const usedEmails = new Set<string>();
  const rankByStatus = new Map<CustomerStatus, number>();
  const customers: Customer[] = [];
  const notes: CustomerNote[] = [];

  for (let index = 0; index < SEED_CUSTOMER_COUNT; index += 1) {
    const firstName = pick(FIRST_NAMES);
    const lastName = pick(LAST_NAMES);
    const company = pick(COMPANIES);
    const status = pickStatus();

    const localPart = `${slugify(firstName)}.${slugify(lastName)}`;
    let email = `${localPart}@${company.domain}`;
    for (let suffix = 2; usedEmails.has(email); suffix += 1) {
      email = `${localPart}${suffix}@${company.domain}`;
    }
    usedEmails.add(email);

    const phone = `+1 (${pick(AREA_CODES)}) 555-${String(between(0, 9999)).padStart(4, "0")}`;

    // Squaring skews sign-ups towards the recent past, like a growing customer
    // base, so "this month" style filters have something to show.
    const ageInDays = 1 + Math.floor(random() ** 2 * MAX_AGE_DAYS);
    const createdMs = anchorMs - ageInDays * DAY_MS - between(0, DAY_MS - 1);

    // Roughly half of all leads have not been contacted yet.
    const neverContacted = status === "lead" && random() < 0.5;
    const lastContactedMs = neverContacted
      ? null
      : createdMs + Math.floor(random() * (anchorMs - createdMs));

    const rank = (rankByStatus.get(status) ?? 0) + 1000;
    rankByStatus.set(status, rank);

    const id = `cus_${String(index + 1).padStart(4, "0")}`;
    customers.push({
      id,
      name: `${firstName} ${lastName}`,
      email,
      phone,
      company: company.name,
      jobTitle: pick(JOB_TITLES),
      status,
      pipelineRank: rank,
      createdAt: new Date(createdMs).toISOString(),
      updatedAt: new Date(lastContactedMs ?? createdMs).toISOString(),
      lastContactedAt:
        lastContactedMs === null ? null : new Date(lastContactedMs).toISOString(),
      lastContactMethod: lastContactedMs === null ? null : pick(CONTACT_METHODS),
    });

    if (lastContactedMs !== null) {
      const noteCount = between(0, 3);
      for (let n = 0; n < noteCount; n += 1) {
        const noteMs =
          createdMs + Math.floor(random() * (lastContactedMs - createdMs));
        notes.push({
          id: `note_${String(notes.length + 1).padStart(4, "0")}`,
          customerId: id,
          body: pick(NOTE_BODIES),
          createdAt: new Date(noteMs).toISOString(),
        });
      }
    }
  }

  return { customers, notes };
}
