/**
 * Demo seed — 20 named users + rich supporting data for testing every feature.
 *
 * Run with:  npx tsx server/scripts/seed-demo.ts
 *
 * All accounts use password: Test1234!
 *
 * Roles covered:
 *   admin       – Emma Rodriguez, James Chen
 *   government  – Priya Sharma, Marcus Williams
 *   ngo         – Sofia Petrov, Ahmed Hassan, Lin Wei
 *   volunteer   – Carlos Mendez, Aisha Johnson, Dmitri Volkov, Fatima Al-Rashid
 *   citizen     – Tom Baker, Maria Santos, Kevin Park, Rachel Green,
 *                 Yuki Tanaka, Daniel Osei, Anna Kowalski, Michael Torres, Layla Ibrahim
 */

import { db } from "../db/db";
import {
  users,
  disasterReports,
  resourceRequests,
  aidOffers,
  inventoryItems,
  sosAlerts,
  verifications,
  reportVotes,
  userReputation,
  notifications,
  analyticsEvents,
  notificationPreferences,
  disasterPredictions,
} from "@shared/schema";
import bcrypt from "bcryptjs";

const PASSWORD = "Test1234!";

async function main() {
  console.log("🌱 Starting demo seed with 20 users…");

  const hash = await bcrypt.hash(PASSWORD, 10);
  const now = new Date();
  const ago = (days: number) => new Date(now.getTime() - days * 86_400_000);

  // ─── 1. USERS ────────────────────────────────────────────────────────────────

  const userData = [
    // Admins
    { email: "emma.admin@crisisconnect.com",   name: "Emma Rodriguez",    role: "admin",      phoneNumber: "+1-555-1001" },
    { email: "james.admin@crisisconnect.com",  name: "James Chen",        role: "admin",      phoneNumber: "+1-555-1002" },
    // Government
    { email: "priya.gov@crisisconnect.com",    name: "Priya Sharma",      role: "government", phoneNumber: "+1-555-2001" },
    { email: "marcus.gov@crisisconnect.com",   name: "Marcus Williams",   role: "government", phoneNumber: "+1-555-2002" },
    // NGO
    { email: "sofia.ngo@crisisconnect.com",    name: "Sofia Petrov",      role: "ngo",        phoneNumber: "+1-555-3001" },
    { email: "ahmed.ngo@crisisconnect.com",    name: "Ahmed Hassan",      role: "ngo",        phoneNumber: "+1-555-3002" },
    { email: "lin.ngo@crisisconnect.com",      name: "Lin Wei",           role: "ngo",        phoneNumber: "+1-555-3003" },
    // Volunteers
    { email: "carlos.vol@crisisconnect.com",   name: "Carlos Mendez",     role: "volunteer",  phoneNumber: "+1-555-4001" },
    { email: "aisha.vol@crisisconnect.com",    name: "Aisha Johnson",     role: "volunteer",  phoneNumber: "+1-555-4002" },
    { email: "dmitri.vol@crisisconnect.com",   name: "Dmitri Volkov",     role: "volunteer",  phoneNumber: "+1-555-4003" },
    { email: "fatima.vol@crisisconnect.com",   name: "Fatima Al-Rashid",  role: "volunteer",  phoneNumber: "+1-555-4004" },
    // Citizens
    { email: "tom.citizen@crisisconnect.com",     name: "Tom Baker",       role: "citizen", phoneNumber: "+1-555-5001" },
    { email: "maria.citizen@crisisconnect.com",   name: "Maria Santos",    role: "citizen", phoneNumber: "+1-555-5002" },
    { email: "kevin.citizen@crisisconnect.com",   name: "Kevin Park",      role: "citizen", phoneNumber: "+1-555-5003" },
    { email: "rachel.citizen@crisisconnect.com",  name: "Rachel Green",    role: "citizen", phoneNumber: "+1-555-5004" },
    { email: "yuki.citizen@crisisconnect.com",    name: "Yuki Tanaka",     role: "citizen", phoneNumber: "+1-555-5005" },
    { email: "daniel.citizen@crisisconnect.com",  name: "Daniel Osei",     role: "citizen", phoneNumber: "+1-555-5006" },
    { email: "anna.citizen@crisisconnect.com",    name: "Anna Kowalski",   role: "citizen", phoneNumber: "+1-555-5007" },
    { email: "michael.citizen@crisisconnect.com", name: "Michael Torres",  role: "citizen", phoneNumber: "+1-555-5008" },
    { email: "layla.citizen@crisisconnect.com",   name: "Layla Ibrahim",   role: "citizen", phoneNumber: "+1-555-5009" },
  ] as const;

  const inserted = await db
    .insert(users)
    .values(
      userData.map((u) => ({
        ...u,
        password: hash,
        emailVerified: now,
      }))
    )
    .onConflictDoNothing()
    .returning();

  if (inserted.length === 0) {
    console.log("⚠️  Users already exist — skipping insert (onConflictDoNothing). Delete them first to re-seed.");
  }

  // Re-fetch all 20 users so IDs are always available even when rows already existed.
  const { eq, inArray } = await import("drizzle-orm");
  const allUsers = await db
    .select()
    .from(users)
    .where(inArray(users.email, userData.map((u) => u.email)));

  const byRole = (role: string) => allUsers.filter((u) => u.role === role);
  const admins   = byRole("admin");
  const govs     = byRole("government");
  const ngos     = byRole("ngo");
  const vols     = byRole("volunteer");
  const citizens = byRole("citizen");

  const [emma, james]             = admins;
  const [priya, marcus]           = govs;
  const [sofia, ahmed, lin]       = ngos;
  const [carlos, aisha, dmitri, fatima] = vols;
  const [tom, maria, kevin, rachel, yuki, daniel, anna, michael, layla] = citizens;

  console.log(`✅ Users ready (${allUsers.length})`);

  // ─── 2. DISASTER REPORTS ─────────────────────────────────────────────────────

  const reports = await db
    .insert(disasterReports)
    .values([
      {
        title: "Major Apartment Fire — Oakwood Complex",
        description: "Fire broke out on the 5th floor of Oakwood Apartments. Smoke visible three blocks away. 40+ residents evacuated. Fire department on-scene but requesting backup.",
        type: "fire", severity: "critical", status: "responding",
        location: "Oakwood Apartments, 221 North Pine Street",
        latitude: "40.7589", longitude: "-73.9851",
        userId: tom.id,
        verificationCount: 8, upvotes: 22, downvotes: 1, consensusScore: 96,
        aiValidationScore: 94,
        confirmedBy: emma.id, confirmedAt: ago(1),
        assignedTo: priya.id, assignedAt: ago(1),
        adminNotes: "Fire department unit 7 dispatched. NGO shelter opened.",
        priorityScore: 98,
        createdAt: ago(2), updatedAt: ago(1),
      },
      {
        title: "Flash Flood — River Street District",
        description: "Heavy overnight rainfall causing rapid flash flooding along River Street. Multiple vehicles stranded. Water level still rising. Evacuation ordered for blocks 10–18.",
        type: "flood", severity: "high", status: "verified",
        location: "River Street, East District",
        latitude: "40.7614", longitude: "-73.9776",
        userId: maria.id,
        verificationCount: 6, upvotes: 18, downvotes: 0, consensusScore: 91,
        aiValidationScore: 88,
        confirmedBy: james.id, confirmedAt: ago(3),
        priorityScore: 85,
        createdAt: ago(4), updatedAt: ago(3),
      },
      {
        title: "Gas Leak — Maple Street Residential Block",
        description: "Strong gas odour reported by 12 residents. Suspected pipeline breach near Junction 4. Area is being evacuated. Gas company en route.",
        type: "gas_leak", severity: "high", status: "responding",
        location: "Maple Street, Block 4, Residential Zone",
        latitude: "40.7450", longitude: "-73.9820",
        userId: kevin.id,
        verificationCount: 5, upvotes: 14, downvotes: 0, consensusScore: 93,
        aiValidationScore: 90,
        assignedTo: marcus.id, assignedAt: ago(0),
        priorityScore: 88,
        createdAt: ago(1), updatedAt: ago(0),
      },
      {
        title: "Multi-Vehicle Crash — Highway 101 Exit 23",
        description: "Serious pile-up involving 6 vehicles on northbound Highway 101 near exit 23. Three people with injuries confirmed. Medical assistance urgently needed.",
        type: "road_accident", severity: "high", status: "responding",
        location: "Highway 101, Northbound, Exit 23",
        latitude: "40.7489", longitude: "-73.9680",
        userId: rachel.id,
        verificationCount: 3, upvotes: 9, downvotes: 0, consensusScore: 100,
        aiValidationScore: 95,
        assignedTo: priya.id, assignedAt: ago(0),
        priorityScore: 91,
        createdAt: ago(0), updatedAt: ago(0),
      },
      {
        title: "Building Collapse — Oak Avenue Construction Site",
        description: "Partial structural collapse at the Oak Avenue high-rise construction site. Three workers unaccounted for. Heavy machinery and rescue teams requested immediately.",
        type: "building_collapse", severity: "critical", status: "verified",
        location: "Oak Avenue Construction Site, Block 9",
        latitude: "40.7520", longitude: "-73.9790",
        userId: yuki.id,
        verificationCount: 7, upvotes: 20, downvotes: 0, consensusScore: 100,
        aiValidationScore: 97,
        confirmedBy: emma.id, confirmedAt: ago(2),
        priorityScore: 99,
        createdAt: ago(3), updatedAt: ago(2),
      },
      {
        title: "Storm Damage — Elm Park Neighbourhood",
        description: "Severe storm brought down 14 trees and damaged 8 homes in Elm Park. Power lines on ground level. Multiple households displaced.",
        type: "storm", severity: "medium", status: "verified",
        location: "Elm Park, West Side",
        latitude: "40.7380", longitude: "-73.9900",
        userId: daniel.id,
        verificationCount: 9, upvotes: 16, downvotes: 2, consensusScore: 80,
        aiValidationScore: 82,
        confirmedBy: james.id, confirmedAt: ago(5),
        priorityScore: 70,
        createdAt: ago(6), updatedAt: ago(5),
      },
      {
        title: "Power Outage — North District (5000 homes)",
        description: "Widespread blackout affecting entire North District after transformer explosion. Estimated restoration time 6–8 hours. Critical facilities on backup power.",
        type: "power_outage", severity: "medium", status: "verified",
        location: "North District — Transformer Station 3",
        latitude: "40.7680", longitude: "-73.9750",
        userId: anna.id,
        verificationCount: 11, upvotes: 24, downvotes: 1, consensusScore: 92,
        aiValidationScore: 89,
        confirmedBy: emma.id, confirmedAt: ago(1),
        priorityScore: 75,
        createdAt: ago(2), updatedAt: ago(1),
      },
      {
        title: "Earthquake Tremors — City Centre",
        description: "Mild seismic tremors felt across the downtown area for approximately 15 seconds. No structural damage confirmed yet. Monitoring ongoing.",
        type: "earthquake", severity: "low", status: "reported",
        location: "City Centre, Downtown",
        latitude: "40.7580", longitude: "-73.9855",
        userId: michael.id,
        verificationCount: 2, upvotes: 6, downvotes: 4, consensusScore: 45,
        aiValidationScore: 65,
        priorityScore: 35,
        createdAt: ago(0), updatedAt: ago(0),
      },
      {
        title: "Water Contamination Alert — South Reservoir",
        description: "Unusual chemical readings detected in the South Reservoir supply. Residents advised to use bottled water until further notice. Health department investigating.",
        type: "water_contamination", severity: "high", status: "verified",
        location: "South Reservoir, Water Treatment Plant B",
        latitude: "40.7300", longitude: "-73.9950",
        userId: layla.id,
        verificationCount: 4, upvotes: 13, downvotes: 0, consensusScore: 89,
        aiValidationScore: 87,
        confirmedBy: james.id, confirmedAt: ago(1),
        priorityScore: 82,
        createdAt: ago(2), updatedAt: ago(1),
      },
      {
        title: "Chemical Spill — Industrial Zone East",
        description: "Hazardous material leak at the Chemco plant. Toxic fumes reported. 500m exclusion zone established. HAZMAT team responding.",
        type: "chemical_spill", severity: "critical", status: "responding",
        location: "Chemco Industrial Plant, East Zone",
        latitude: "40.7200", longitude: "-73.9600",
        userId: tom.id,
        verificationCount: 6, upvotes: 17, downvotes: 0, consensusScore: 95,
        aiValidationScore: 93,
        assignedTo: marcus.id, assignedAt: ago(0),
        priorityScore: 96,
        createdAt: ago(1), updatedAt: ago(0),
      },
      {
        title: "Wildfire Spreading — Hillside Reserve",
        description: "Fast-moving wildfire detected in Hillside Nature Reserve. Wind speed accelerating spread. Three hiking trails closed. Aerial water drops underway.",
        type: "fire", severity: "high", status: "responding",
        location: "Hillside Nature Reserve, North Trail",
        latitude: "40.7900", longitude: "-73.9400",
        userId: maria.id,
        verificationCount: 5, upvotes: 15, downvotes: 0, consensusScore: 90,
        aiValidationScore: 91,
        confirmedBy: emma.id, confirmedAt: ago(0),
        assignedTo: priya.id, assignedAt: ago(0),
        priorityScore: 87,
        createdAt: ago(1), updatedAt: ago(0),
      },
      {
        title: "Epidemic Alert — Gastrointestinal Outbreak",
        description: "35 reported cases of acute gastroenteritis in the Central School District area over 48 hours. Health officials suspect contaminated food supply. Testing underway.",
        type: "epidemic", severity: "medium", status: "verified",
        location: "Central School District, Sector 5",
        latitude: "40.7650", longitude: "-73.9800",
        userId: kevin.id,
        verificationCount: 3, upvotes: 11, downvotes: 1, consensusScore: 78,
        aiValidationScore: 75,
        confirmedBy: james.id, confirmedAt: ago(2),
        priorityScore: 68,
        createdAt: ago(4), updatedAt: ago(2),
      },
    ])
    .onConflictDoNothing()
    .returning();

  console.log(`✅ Disaster reports: ${reports.length}`);

  const [rFire, rFlood, rGas, rCrash, rCollapse, rStorm, rPower, rQuake, rWater, rChem, rWild, rEpid] = reports;

  // ─── 3. SOS ALERTS ───────────────────────────────────────────────────────────

  const sos = await db
    .insert(sosAlerts)
    .values([
      {
        userId: tom.id,
        emergencyType: "fire", severity: "critical", status: "active",
        location: "Pine Street Apartment, Unit 405",
        latitude: "40.7555", longitude: "-73.9820",
        description: "Trapped on 4th floor. Smoke filling the corridor. Elevator non-functional. Need immediate help!",
        contactNumber: tom.phoneNumber!,
        createdAt: ago(0), updatedAt: ago(0),
      },
      {
        userId: maria.id,
        emergencyType: "flood", severity: "high", status: "responding",
        location: "Bridge Road, Car Stranded in Water",
        latitude: "40.7600", longitude: "-73.9800",
        description: "Vehicle stuck in rising floodwater with two children inside. Please send boat rescue.",
        contactNumber: maria.phoneNumber!,
        respondedBy: carlos.id, respondedAt: ago(0),
        createdAt: ago(0), updatedAt: ago(0),
      },
      {
        userId: yuki.id,
        emergencyType: "road_accident", severity: "high", status: "responding",
        location: "Highway 101 at Exit 23",
        latitude: "40.7490", longitude: "-73.9682",
        description: "Injured passenger, leg trapped in wreckage. Ambulance requested urgently.",
        contactNumber: yuki.phoneNumber!,
        respondedBy: aisha.id, respondedAt: ago(0),
        createdAt: ago(0), updatedAt: ago(0),
      },
      {
        userId: layla.id,
        emergencyType: "other", severity: "critical", status: "resolved",
        location: "456 Elm Street, Apartment 2B",
        latitude: "40.7380", longitude: "-73.9902",
        description: "Elderly neighbour unresponsive. Possible cardiac event. Need paramedics.",
        contactNumber: layla.phoneNumber!,
        respondedBy: dmitri.id, respondedAt: ago(1),
        resolvedAt: ago(1),
        createdAt: ago(1), updatedAt: ago(1),
      },
      {
        userId: daniel.id,
        emergencyType: "building_collapse", severity: "critical", status: "active",
        location: "Oak Avenue Construction Site",
        latitude: "40.7521", longitude: "-73.9791",
        description: "Worker buried under debris. Can hear him calling for help. Heavy lifting equipment needed NOW.",
        contactNumber: daniel.phoneNumber!,
        createdAt: ago(0), updatedAt: ago(0),
      },
      {
        userId: rachel.id,
        emergencyType: "gas_leak", severity: "high", status: "resolved",
        location: "Maple Street, House 14",
        latitude: "40.7451", longitude: "-73.9821",
        description: "Strong gas smell inside house. Family evacuated to front yard. Cannot locate the valve.",
        contactNumber: rachel.phoneNumber!,
        respondedBy: fatima.id, respondedAt: ago(1),
        resolvedAt: ago(1),
        createdAt: ago(1), updatedAt: ago(1),
      },
    ])
    .onConflictDoNothing()
    .returning();

  console.log(`✅ SOS alerts: ${sos.length}`);

  // ─── 4. RESOURCE REQUESTS ────────────────────────────────────────────────────

  const requests = await db
    .insert(resourceRequests)
    .values([
      {
        resourceType: "water", quantity: 500, urgency: "critical", status: "pending",
        description: "500 units of bottled water urgently needed for 200 fire-displaced residents at Community Center shelter.",
        location: "Community Center Emergency Shelter, North Ave",
        latitude: "40.7560", longitude: "-73.9830",
        contactInfo: "Shelter coordinator Carlos: +1-555-4001",
        userId: carlos.id,
        disasterReportId: rFire?.id,
        createdAt: ago(1), updatedAt: ago(1),
      },
      {
        resourceType: "medical", quantity: 80, urgency: "critical", status: "in_progress",
        description: "First aid kits and trauma supplies for highway accident victims. At least 8 people injured.",
        location: "Highway 101 Emergency Triage Camp",
        latitude: "40.7489", longitude: "-73.9680",
        contactInfo: "Medical coordinator Priya: +1-555-2001",
        userId: priya.id,
        disasterReportId: rCrash?.id,
        createdAt: ago(0), updatedAt: ago(0),
      },
      {
        resourceType: "food", quantity: 200, urgency: "high", status: "pending",
        description: "Ready-to-eat meals for 200 storm-displaced families at Elm Park. Three-day supply requested.",
        location: "Elm Park Relief Station, West Entrance",
        latitude: "40.7380", longitude: "-73.9905",
        contactInfo: "NGO coordinator Sofia: +1-555-3001",
        userId: sofia.id,
        disasterReportId: rStorm?.id,
        createdAt: ago(2), updatedAt: ago(2),
      },
      {
        resourceType: "blankets", quantity: 150, urgency: "medium", status: "pending",
        description: "Thermal blankets for evacuated residents at Maple Street Community Hall.",
        location: "Maple Street Community Hall",
        latitude: "40.7452", longitude: "-73.9822",
        contactInfo: "Hall reception: +1-555-3003",
        userId: lin.id,
        disasterReportId: rGas?.id,
        createdAt: ago(1), updatedAt: ago(1),
      },
      {
        resourceType: "shelter", quantity: 50, urgency: "high", status: "pending",
        description: "Temporary shelter tents for collapse site workers and displaced families nearby.",
        location: "Oak Avenue Relief Camp",
        latitude: "40.7522", longitude: "-73.9792",
        contactInfo: "Marcus: +1-555-2002",
        userId: marcus.id,
        disasterReportId: rCollapse?.id,
        createdAt: ago(2), updatedAt: ago(2),
      },
      {
        resourceType: "water", quantity: 1000, urgency: "critical", status: "pending",
        description: "Entire South District on contaminated water advisory. 1000 cases of bottled water needed for distribution.",
        location: "South District Distribution Hub",
        latitude: "40.7305", longitude: "-73.9952",
        contactInfo: "Ahmed: +1-555-3002",
        userId: ahmed.id,
        disasterReportId: rWater?.id,
        createdAt: ago(1), updatedAt: ago(1),
      },
      {
        resourceType: "medical", quantity: 30, urgency: "high", status: "fulfilled",
        description: "Medical supplies needed for gastroenteritis outbreak — rehydration salts, antibiotics.",
        location: "Central School District Medical Post",
        latitude: "40.7651", longitude: "-73.9801",
        contactInfo: "Health officer: +1-555-5001",
        userId: tom.id,
        disasterReportId: rEpid?.id,
        fulfilledBy: aisha.id,
        fulfilledAt: ago(1),
        createdAt: ago(3), updatedAt: ago(1),
      },
      {
        resourceType: "clothing", quantity: 300, urgency: "medium", status: "in_progress",
        description: "Assorted clothing for all ages for the flood-displaced families in East District.",
        location: "East District Evacuation Centre",
        latitude: "40.7615", longitude: "-73.9778",
        contactInfo: "Dmitri: +1-555-4003",
        userId: dmitri.id,
        disasterReportId: rFlood?.id,
        createdAt: ago(3), updatedAt: ago(2),
      },
      {
        resourceType: "food", quantity: 100, urgency: "medium", status: "fulfilled",
        description: "Meals for 100 people at North District shelter during power outage.",
        location: "North District Community Shelter",
        latitude: "40.7682", longitude: "-73.9752",
        contactInfo: "Fatima: +1-555-4004",
        userId: fatima.id,
        disasterReportId: rPower?.id,
        fulfilledBy: sofia.id,
        fulfilledAt: ago(0),
        createdAt: ago(1), updatedAt: ago(0),
      },
      {
        resourceType: "other", quantity: 20, urgency: "low", status: "pending",
        description: "Portable generators needed for medical equipment at North District shelter during extended outage.",
        location: "North District Medical Room",
        latitude: "40.7683", longitude: "-73.9753",
        contactInfo: "James: +1-555-1002",
        userId: james.id,
        disasterReportId: rPower?.id,
        createdAt: ago(1), updatedAt: ago(1),
      },
    ])
    .onConflictDoNothing()
    .returning();

  console.log(`✅ Resource requests: ${requests.length}`);

  // ─── 5. AID OFFERS ───────────────────────────────────────────────────────────

  const offers = await db
    .insert(aidOffers)
    .values([
      {
        resourceType: "water", quantity: 600, status: "available",
        description: "600 × 1.5L sealed water bottles from Red Cross depot. Ready for immediate pickup or delivery.",
        location: "Red Cross West Side Depot, 44 Harbor Road",
        latitude: "40.7400", longitude: "-73.9950",
        contactInfo: "Depot manager: +1-555-4001",
        userId: carlos.id,
        createdAt: ago(1), updatedAt: ago(1),
      },
      {
        resourceType: "food", quantity: 400, status: "available",
        description: "Ready-to-eat packaged meals with 6-month shelf life. Halal & vegetarian options included.",
        location: "City Food Bank, 120 South Main Street",
        latitude: "40.7500", longitude: "-73.9700",
        contactInfo: "Food bank: +1-555-3001",
        userId: sofia.id,
        createdAt: ago(2), updatedAt: ago(2),
      },
      {
        resourceType: "blankets", quantity: 250, status: "available",
        description: "New thermal emergency blankets, individually vacuum-sealed, suitable for all weather.",
        location: "Donation Hub, 88 Main Street",
        latitude: "40.7550", longitude: "-73.9880",
        contactInfo: "Ahmed: +1-555-3002",
        userId: ahmed.id,
        createdAt: ago(3), updatedAt: ago(3),
      },
      {
        resourceType: "medical", quantity: 60, status: "committed",
        description: "Comprehensive trauma first aid kits — bandages, antiseptics, tourniquets, sutures.",
        location: "Medical Supply Depot, Industrial Zone",
        latitude: "40.7490", longitude: "-73.9682",
        contactInfo: "Aisha: +1-555-4002",
        userId: aisha.id,
        matchedRequestId: requests[1]?.id,
        createdAt: ago(0), updatedAt: ago(0),
      },
      {
        resourceType: "clothing", quantity: 200, status: "available",
        description: "Mixed clothing sizes for men, women, and children collected from community drive.",
        location: "Clothing Drive Centre, 12 West Avenue",
        latitude: "40.7420", longitude: "-73.9860",
        contactInfo: "Lin: +1-555-3003",
        userId: lin.id,
        createdAt: ago(4), updatedAt: ago(4),
      },
      {
        resourceType: "shelter", quantity: 35, status: "available",
        description: "4-person emergency tents with full ground sheets and rain covers. Setup time ~20 minutes per tent.",
        location: "Equipment Depot, North Yard",
        latitude: "40.7470", longitude: "-73.9910",
        contactInfo: "Dmitri: +1-555-4003",
        userId: dmitri.id,
        createdAt: ago(2), updatedAt: ago(2),
      },
      {
        resourceType: "water", quantity: 300, status: "delivered",
        description: "Water purification tablets + 300 portable water containers. Delivered to flood zone.",
        location: "East District Flood Relief Point",
        latitude: "40.7615", longitude: "-73.9776",
        contactInfo: "Fatima: +1-555-4004",
        userId: fatima.id,
        matchedRequestId: requests[0]?.id,
        deliveredAt: ago(1),
        createdAt: ago(5), updatedAt: ago(1),
      },
      {
        resourceType: "food", quantity: 150, status: "committed",
        description: "Hot meal catering service — can serve 150 portions per sitting. NGO-run mobile kitchen.",
        location: "NGO Mobile Kitchen, South Parking Lot",
        latitude: "40.7305", longitude: "-73.9950",
        contactInfo: "Sofia: +1-555-3001",
        userId: sofia.id,
        matchedRequestId: requests[8]?.id,
        createdAt: ago(1), updatedAt: ago(0),
      },
      {
        resourceType: "medical", quantity: 40, status: "available",
        description: "ORS rehydration sachets, anti-diarrheal medication packs for epidemic response.",
        location: "Health NGO Office, Central District",
        latitude: "40.7650", longitude: "-73.9803",
        contactInfo: "Ahmed: +1-555-3002",
        userId: ahmed.id,
        createdAt: ago(2), updatedAt: ago(2),
      },
      {
        resourceType: "other", quantity: 10, status: "available",
        description: "10 × 5kW portable diesel generators with full fuel tanks. Available for critical facility use.",
        location: "Government Equipment Yard, Block 3",
        latitude: "40.7683", longitude: "-73.9751",
        contactInfo: "Marcus: +1-555-2002",
        userId: marcus.id,
        createdAt: ago(1), updatedAt: ago(1),
      },
    ])
    .onConflictDoNothing()
    .returning();

  console.log(`✅ Aid offers: ${offers.length}`);

  // ─── 6. INVENTORY ITEMS ──────────────────────────────────────────────────────

  await db
    .insert(inventoryItems)
    .values([
      {
        name: "Emergency Water Supply (500ml)", itemType: "water",
        quantity: 8000, unit: "bottles",
        location: "Central Government Warehouse, Bay A",
        latitude: "40.7530", longitude: "-73.9840",
        minimumThreshold: 2000,
        description: "Sealed bottled water for emergency distribution. Rotated every 12 months.",
        managedBy: marcus.id, createdAt: ago(30), updatedAt: ago(5),
      },
      {
        name: "MRE Ration Packs", itemType: "food",
        quantity: 5000, unit: "meals",
        location: "Central Government Warehouse, Bay B",
        latitude: "40.7530", longitude: "-73.9841",
        minimumThreshold: 1000,
        description: "Military-grade MRE meals with 3-year shelf life.",
        managedBy: marcus.id, createdAt: ago(60), updatedAt: ago(10),
      },
      {
        name: "Trauma Response Kits", itemType: "medical_supplies",
        quantity: 200, unit: "kits",
        location: "Regional Medical Storage Facility",
        latitude: "40.7580", longitude: "-73.9760",
        minimumThreshold: 40,
        description: "Complete trauma kits including tourniquet, hemostatic gauze, splint, and airway tools.",
        managedBy: priya.id, createdAt: ago(45), updatedAt: ago(7),
      },
      {
        name: "4-Person Emergency Tents", itemType: "shelter",
        quantity: 300, unit: "tents",
        location: "Equipment Depot, Lot 5",
        latitude: "40.7470", longitude: "-73.9912",
        minimumThreshold: 60,
        description: "Waterproof 4-person tents with groundsheets. Can be erected by 2 people in 20 minutes.",
        managedBy: sofia.id, createdAt: ago(90), updatedAt: ago(15),
      },
      {
        name: "Thermal Mylar Blankets", itemType: "blankets",
        quantity: 1200, unit: "blankets",
        location: "Central Government Warehouse, Bay C",
        latitude: "40.7531", longitude: "-73.9842",
        minimumThreshold: 300,
        description: "Single-use space blankets — retain 90% body heat.",
        managedBy: lin.id, createdAt: ago(30), updatedAt: ago(3),
      },
      {
        name: "5kW Portable Generators", itemType: "equipment",
        quantity: 30, unit: "units",
        location: "Government Equipment Yard, Hangar 2",
        latitude: "40.7472", longitude: "-73.9913",
        minimumThreshold: 8,
        description: "Diesel generators. Fuel included for 48h operation. For critical facility backup.",
        managedBy: marcus.id, createdAt: ago(120), updatedAt: ago(20),
      },
      {
        name: "Assorted Clothing Packages", itemType: "clothing",
        quantity: 600, unit: "packages",
        location: "NGO Distribution Hub, Warehouse 2",
        latitude: "40.7422", longitude: "-73.9862",
        minimumThreshold: 100,
        description: "Bags of assorted clothing sorted by family size (S/M/L). Includes seasonal items.",
        managedBy: ahmed.id, createdAt: ago(20), updatedAt: ago(2),
      },
      {
        name: "Bottled Water (1.5L)", itemType: "water",
        quantity: 150, unit: "bottles",
        location: "South Reservoir Backup Store",
        latitude: "40.7302", longitude: "-73.9953",
        minimumThreshold: 500,
        description: "CRITICAL: Stock critically low due to contamination response consumption.",
        managedBy: priya.id, createdAt: ago(10), updatedAt: ago(0),
      },
    ])
    .onConflictDoNothing()
    .returning();

  console.log("✅ Inventory items: 8");

  // ─── 7. VERIFICATIONS ────────────────────────────────────────────────────────

  if (reports.length > 0) {
    await db
      .insert(verifications)
      .values([
        { reportId: rFire!.id, userId: carlos.id, createdAt: ago(2) },
        { reportId: rFire!.id, userId: aisha.id, createdAt: ago(2) },
        { reportId: rFire!.id, userId: priya.id, createdAt: ago(1) },
        { reportId: rFire!.id, userId: sofia.id, createdAt: ago(1) },
        { reportId: rFire!.id, userId: kevin.id, createdAt: ago(1) },
        { reportId: rFlood!.id, userId: dmitri.id, createdAt: ago(4) },
        { reportId: rFlood!.id, userId: fatima.id, createdAt: ago(3) },
        { reportId: rFlood!.id, userId: tom.id, createdAt: ago(3) },
        { reportId: rFlood!.id, userId: maria.id, createdAt: ago(3) },
        { reportId: rCollapse!.id, userId: emma.id, createdAt: ago(3) },
        { reportId: rCollapse!.id, userId: marcus.id, createdAt: ago(2) },
        { reportId: rCollapse!.id, userId: ahmed.id, createdAt: ago(2) },
        { reportId: rStorm!.id, userId: lin.id, createdAt: ago(5) },
        { reportId: rStorm!.id, userId: rachel.id, createdAt: ago(5) },
        { reportId: rStorm!.id, userId: yuki.id, createdAt: ago(5) },
        { reportId: rPower!.id, userId: james.id, createdAt: ago(2) },
        { reportId: rPower!.id, userId: priya.id, createdAt: ago(2) },
        { reportId: rWater!.id, userId: ahmed.id, createdAt: ago(1) },
        { reportId: rWater!.id, userId: sofia.id, createdAt: ago(1) },
        { reportId: rCrash!.id, userId: aisha.id, createdAt: ago(0) },
        { reportId: rGas!.id, userId: carlos.id, createdAt: ago(0) },
        { reportId: rGas!.id, userId: fatima.id, createdAt: ago(0) },
        { reportId: rWild!.id, userId: dmitri.id, createdAt: ago(0) },
        { reportId: rEpid!.id, userId: lin.id, createdAt: ago(3) },
      ])
      .onConflictDoNothing();

    console.log("✅ Verifications inserted");

    // ─── 8. REPORT VOTES ─────────────────────────────────────────────────────

    await db
      .insert(reportVotes)
      .values([
        { reportId: rFire!.id, userId: carlos.id, voteType: "upvote" },
        { reportId: rFire!.id, userId: aisha.id, voteType: "upvote" },
        { reportId: rFire!.id, userId: sofia.id, voteType: "upvote" },
        { reportId: rFire!.id, userId: maria.id, voteType: "upvote" },
        { reportId: rFire!.id, userId: priya.id, voteType: "upvote" },
        { reportId: rFlood!.id, userId: tom.id, voteType: "upvote" },
        { reportId: rFlood!.id, userId: maria.id, voteType: "upvote" },
        { reportId: rFlood!.id, userId: kevin.id, voteType: "upvote" },
        { reportId: rFlood!.id, userId: layla.id, voteType: "downvote" },
        { reportId: rCollapse!.id, userId: daniel.id, voteType: "upvote" },
        { reportId: rCollapse!.id, userId: anna.id, voteType: "upvote" },
        { reportId: rStorm!.id, userId: rachel.id, voteType: "upvote" },
        { reportId: rStorm!.id, userId: yuki.id, voteType: "upvote" },
        { reportId: rStorm!.id, userId: michael.id, voteType: "downvote" },
        { reportId: rPower!.id, userId: anna.id, voteType: "upvote" },
        { reportId: rPower!.id, userId: james.id, voteType: "upvote" },
        { reportId: rWater!.id, userId: layla.id, voteType: "upvote" },
        { reportId: rWater!.id, userId: ahmed.id, voteType: "upvote" },
        { reportId: rChem!.id, userId: tom.id, voteType: "upvote" },
        { reportId: rQuake!.id, userId: michael.id, voteType: "upvote" },
        { reportId: rQuake!.id, userId: anna.id, voteType: "downvote" },
        { reportId: rEpid!.id, userId: kevin.id, voteType: "upvote" },
      ])
      .onConflictDoNothing();

    console.log("✅ Report votes inserted");
  }

  // ─── 9. USER REPUTATION ──────────────────────────────────────────────────────

  await db
    .insert(userReputation)
    .values([
      { userId: emma.id,    trustScore: 100, totalReports: 0,  verifiedReports: 0,  falseReports: 0, verificationsGiven: 30, upvotesReceived: 60, downvotesReceived: 0,  resourcesProvided: 15, resourcesFulfilled: 14, responseTimeAvg: 180 },
      { userId: james.id,   trustScore: 98,  totalReports: 0,  verifiedReports: 0,  falseReports: 0, verificationsGiven: 22, upvotesReceived: 48, downvotesReceived: 0,  resourcesProvided: 10, resourcesFulfilled: 9,  responseTimeAvg: 240 },
      { userId: priya.id,   trustScore: 95,  totalReports: 2,  verifiedReports: 2,  falseReports: 0, verificationsGiven: 18, upvotesReceived: 35, downvotesReceived: 1,  resourcesProvided: 12, resourcesFulfilled: 11, responseTimeAvg: 300 },
      { userId: marcus.id,  trustScore: 94,  totalReports: 1,  verifiedReports: 1,  falseReports: 0, verificationsGiven: 14, upvotesReceived: 28, downvotesReceived: 0,  resourcesProvided: 8,  resourcesFulfilled: 7,  responseTimeAvg: 360 },
      { userId: sofia.id,   trustScore: 96,  totalReports: 1,  verifiedReports: 1,  falseReports: 0, verificationsGiven: 25, upvotesReceived: 55, downvotesReceived: 0,  resourcesProvided: 30, resourcesFulfilled: 28, responseTimeAvg: 200 },
      { userId: ahmed.id,   trustScore: 93,  totalReports: 0,  verifiedReports: 0,  falseReports: 0, verificationsGiven: 20, upvotesReceived: 42, downvotesReceived: 0,  resourcesProvided: 22, resourcesFulfilled: 20, responseTimeAvg: 280 },
      { userId: lin.id,     trustScore: 91,  totalReports: 0,  verifiedReports: 0,  falseReports: 0, verificationsGiven: 16, upvotesReceived: 30, downvotesReceived: 1,  resourcesProvided: 18, resourcesFulfilled: 15, responseTimeAvg: 320 },
      { userId: carlos.id,  trustScore: 88,  totalReports: 0,  verifiedReports: 0,  falseReports: 0, verificationsGiven: 12, upvotesReceived: 25, downvotesReceived: 0,  resourcesProvided: 14, resourcesFulfilled: 12, responseTimeAvg: 400 },
      { userId: aisha.id,   trustScore: 87,  totalReports: 0,  verifiedReports: 0,  falseReports: 0, verificationsGiven: 10, upvotesReceived: 22, downvotesReceived: 0,  resourcesProvided: 10, resourcesFulfilled: 9,  responseTimeAvg: 450 },
      { userId: dmitri.id,  trustScore: 85,  totalReports: 0,  verifiedReports: 0,  falseReports: 0, verificationsGiven: 8,  upvotesReceived: 18, downvotesReceived: 1,  resourcesProvided: 7,  resourcesFulfilled: 6,  responseTimeAvg: 500 },
      { userId: fatima.id,  trustScore: 84,  totalReports: 0,  verifiedReports: 0,  falseReports: 0, verificationsGiven: 9,  upvotesReceived: 20, downvotesReceived: 0,  resourcesProvided: 9,  resourcesFulfilled: 8,  responseTimeAvg: 480 },
      { userId: tom.id,     trustScore: 72,  totalReports: 3,  verifiedReports: 2,  falseReports: 0, verificationsGiven: 4,  upvotesReceived: 14, downvotesReceived: 1,  resourcesProvided: 0,  resourcesFulfilled: 0 },
      { userId: maria.id,   trustScore: 70,  totalReports: 2,  verifiedReports: 2,  falseReports: 0, verificationsGiven: 3,  upvotesReceived: 12, downvotesReceived: 0,  resourcesProvided: 0,  resourcesFulfilled: 0 },
      { userId: kevin.id,   trustScore: 68,  totalReports: 2,  verifiedReports: 1,  falseReports: 0, verificationsGiven: 2,  upvotesReceived: 10, downvotesReceived: 0,  resourcesProvided: 0,  resourcesFulfilled: 0 },
      { userId: rachel.id,  trustScore: 65,  totalReports: 1,  verifiedReports: 1,  falseReports: 0, verificationsGiven: 2,  upvotesReceived: 8,  downvotesReceived: 1,  resourcesProvided: 0,  resourcesFulfilled: 0 },
      { userId: yuki.id,    trustScore: 63,  totalReports: 1,  verifiedReports: 1,  falseReports: 0, verificationsGiven: 1,  upvotesReceived: 7,  downvotesReceived: 0,  resourcesProvided: 0,  resourcesFulfilled: 0 },
      { userId: daniel.id,  trustScore: 60,  totalReports: 1,  verifiedReports: 1,  falseReports: 0, verificationsGiven: 1,  upvotesReceived: 6,  downvotesReceived: 0,  resourcesProvided: 0,  resourcesFulfilled: 0 },
      { userId: anna.id,    trustScore: 58,  totalReports: 1,  verifiedReports: 0,  falseReports: 0, verificationsGiven: 0,  upvotesReceived: 5,  downvotesReceived: 2,  resourcesProvided: 0,  resourcesFulfilled: 0 },
      { userId: michael.id, trustScore: 55,  totalReports: 1,  verifiedReports: 0,  falseReports: 0, verificationsGiven: 0,  upvotesReceived: 4,  downvotesReceived: 2,  resourcesProvided: 0,  resourcesFulfilled: 0 },
      { userId: layla.id,   trustScore: 62,  totalReports: 1,  verifiedReports: 1,  falseReports: 0, verificationsGiven: 1,  upvotesReceived: 7,  downvotesReceived: 1,  resourcesProvided: 0,  resourcesFulfilled: 0 },
    ])
    .onConflictDoNothing();

  console.log("✅ User reputation records inserted");

  // ─── 10. NOTIFICATIONS ───────────────────────────────────────────────────────

  await db
    .insert(notifications)
    .values([
      {
        userId: emma.id, type: "sos_alert", priority: "critical",
        title: "Active SOS: Fire — Pine Street Apt",
        message: "Tom Baker has triggered an SOS at Pine Street Apartment, Unit 405. Trapped by fire smoke.",
        actionUrl: `/sos/${sos[0]?.id}`,
        relatedEntityId: sos[0]?.id, relatedEntityType: "sos_alert",
      },
      {
        userId: james.id, type: "sos_alert", priority: "critical",
        title: "Active SOS: Building Collapse — Oak Avenue",
        message: "Daniel Osei reports a worker buried at Oak Avenue Construction Site.",
        actionUrl: `/sos/${sos[4]?.id}`,
        relatedEntityId: sos[4]?.id, relatedEntityType: "sos_alert",
      },
      {
        userId: carlos.id, type: "resource_request", priority: "critical",
        title: "Urgent Water Request — Community Centre Shelter",
        message: "500 units of bottled water needed immediately for fire-displaced residents.",
        actionUrl: `/resource-requests/${requests[0]?.id}`,
        relatedEntityId: requests[0]?.id, relatedEntityType: "resource_request",
      },
      {
        userId: aisha.id, type: "aid_matched", priority: "high",
        title: "Your Medical Kits Matched",
        message: "Your 60-unit medical kit offer has been matched with the Highway 101 emergency triage request.",
        actionUrl: `/aid-offers/${offers[3]?.id}`,
        relatedEntityId: offers[3]?.id, relatedEntityType: "aid_offer",
        isRead: true, readAt: ago(0),
      },
      {
        userId: tom.id, type: "disaster_nearby", priority: "high",
        title: "New Disaster 0.3mi Away",
        message: "Flash flood reported on River Street, East District — 0.3 miles from your location.",
        actionUrl: `/reports/${rFlood?.id}`,
        relatedEntityId: rFlood?.id, relatedEntityType: "disaster_report",
      },
      {
        userId: maria.id, type: "disaster_verified", priority: "medium",
        title: "Your Report Verified",
        message: "Your flash flood report for River Street has been officially verified.",
        actionUrl: `/reports/${rFlood?.id}`,
        relatedEntityId: rFlood?.id, relatedEntityType: "disaster_report",
        isRead: true, readAt: ago(2),
      },
      {
        userId: sofia.id, type: "report_assigned", priority: "high",
        title: "NGO Assigned to Storm Relief",
        message: "Your organisation has been assigned to coordinate relief at Elm Park storm shelter.",
        actionUrl: `/reports/${rStorm?.id}`,
        relatedEntityId: rStorm?.id, relatedEntityType: "disaster_report",
      },
      {
        userId: priya.id, type: "low_inventory", priority: "high",
        title: "Critical Stock: Bottled Water (South Reservoir)",
        message: "Bottled water at South Reservoir Backup Store is at 150 units — below threshold of 500.",
        actionUrl: "/resource-management",
        relatedEntityType: "inventory_item",
      },
      {
        userId: kevin.id, type: "disaster_nearby", priority: "critical",
        title: "Gas Leak Emergency Nearby",
        message: "Gas leak confirmed on Maple Street Block 4. Evacuation in progress 0.1 miles from you.",
        actionUrl: `/reports/${rGas?.id}`,
        relatedEntityId: rGas?.id, relatedEntityType: "disaster_report",
      },
      {
        userId: layla.id, type: "disaster_verified", priority: "medium",
        title: "Water Contamination Alert Active",
        message: "The water contamination report for South Reservoir has been verified. Use bottled water only.",
        actionUrl: `/reports/${rWater?.id}`,
        relatedEntityId: rWater?.id, relatedEntityType: "disaster_report",
        isRead: true, readAt: ago(1),
      },
      {
        userId: ahmed.id, type: "resource_fulfilled", priority: "medium",
        title: "Epidemic Medical Request Fulfilled",
        message: "The medical supplies for the gastroenteritis outbreak have been fulfilled by Aisha Johnson.",
        actionUrl: `/resource-requests/${requests[6]?.id}`,
        relatedEntityId: requests[6]?.id, relatedEntityType: "resource_request",
        isRead: true, readAt: ago(0),
      },
      {
        userId: marcus.id, type: "report_confirmed", priority: "high",
        title: "Chemical Spill Confirmed",
        message: "The chemical spill at Chemco Industrial Plant has been escalated. HAZMAT team dispatched.",
        actionUrl: `/reports/${rChem?.id}`,
        relatedEntityId: rChem?.id, relatedEntityType: "disaster_report",
      },
    ])
    .onConflictDoNothing();

  console.log("✅ Notifications inserted");

  // ─── 11. NOTIFICATION PREFERENCES ───────────────────────────────────────────

  await db
    .insert(notificationPreferences)
    .values(
      allUsers.map((u) => ({
        userId: u.id,
        notificationRadius: u.role === "admin" || u.role === "government" ? 100 : 50,
      }))
    )
    .onConflictDoNothing();

  console.log("✅ Notification preferences inserted");

  // ─── 12. ANALYTICS EVENTS ────────────────────────────────────────────────────

  const analyticsData = reports.flatMap((r, i) => [
    {
      eventType: "report_submitted" as const,
      userId: r.userId,
      relatedEntityId: r.id, relatedEntityType: "disaster_report",
      location: r.location, latitude: r.latitude!, longitude: r.longitude!,
      createdAt: ago(i),
    },
    ...(r.confirmedBy ? [{
      eventType: "report_verified" as const,
      userId: r.confirmedBy,
      relatedEntityId: r.id, relatedEntityType: "disaster_report",
      location: r.location, latitude: r.latitude!, longitude: r.longitude!,
      responseTime: 900 + i * 120,
      createdAt: ago(Math.max(0, i - 1)),
    }] : []),
  ]);

  requests.forEach((rq) => {
    analyticsData.push({
      eventType: "resource_requested" as const,
      userId: rq.userId,
      relatedEntityId: rq.id, relatedEntityType: "resource_request",
      location: rq.location, latitude: rq.latitude!, longitude: rq.longitude!,
      createdAt: rq.createdAt as Date,
    } as any);
    if (rq.fulfilledBy) {
      analyticsData.push({
        eventType: "resource_fulfilled" as const,
        userId: rq.fulfilledBy,
        relatedEntityId: rq.id, relatedEntityType: "resource_request",
        location: rq.location, latitude: rq.latitude!, longitude: rq.longitude!,
        responseTime: 1800,
        createdAt: rq.fulfilledAt as Date,
      } as any);
    }
  });

  offers.forEach((o) => {
    analyticsData.push({
      eventType: "aid_offered" as const,
      userId: o.userId,
      relatedEntityId: o.id, relatedEntityType: "aid_offer",
      location: o.location, latitude: o.latitude!, longitude: o.longitude!,
      createdAt: o.createdAt as Date,
    } as any);
    if (o.deliveredAt) {
      analyticsData.push({
        eventType: "aid_delivered" as const,
        userId: o.userId,
        relatedEntityId: o.id, relatedEntityType: "aid_offer",
        location: o.location, latitude: o.latitude!, longitude: o.longitude!,
        responseTime: 3600,
        createdAt: o.deliveredAt as Date,
      } as any);
    }
  });

  await db.insert(analyticsEvents).values(analyticsData).onConflictDoNothing();
  console.log(`✅ Analytics events: ${analyticsData.length}`);

  // ─── 13. DISASTER PREDICTIONS ────────────────────────────────────────────────

  await db
    .insert(disasterPredictions)
    .values([
      {
        disasterType: "flood",
        predictedArea: "East River District",
        latitude: "40.7614", longitude: "-73.9776",
        radius: 5, riskLevel: "high", confidence: 82,
        weatherData: { temperature: 58, humidity: 92, windSpeed: 18, rainfall: 45 },
        validFrom: new Date(now.getTime() - 86_400_000),
        validUntil: new Date(now.getTime() + 86_400_000 * 2),
        affectedPopulation: 42000, modelVersion: "2.1",
        createdAt: ago(2),
      },
      {
        disasterType: "fire",
        predictedArea: "Hillside Nature Reserve",
        latitude: "40.7900", longitude: "-73.9400",
        radius: 8, riskLevel: "very_high", confidence: 91,
        weatherData: { temperature: 87, humidity: 18, windSpeed: 35 },
        validFrom: now,
        validUntil: new Date(now.getTime() + 86_400_000 * 3),
        affectedPopulation: 15000, modelVersion: "2.1",
        createdAt: ago(1),
      },
      {
        disasterType: "earthquake",
        predictedArea: "City Centre — Downtown Grid",
        latitude: "40.7580", longitude: "-73.9855",
        radius: 12, riskLevel: "medium", confidence: 67,
        seismicData: { magnitude: 3.2, depth: 8, faultLine: "North Fault Segment" },
        validFrom: ago(7),
        validUntil: new Date(now.getTime() + 86_400_000 * 14),
        affectedPopulation: 280000, modelVersion: "2.0",
        createdAt: ago(8),
      },
      {
        disasterType: "storm",
        predictedArea: "North-West Suburbs",
        latitude: "40.7800", longitude: "-74.0100",
        radius: 20, riskLevel: "high", confidence: 78,
        weatherData: { temperature: 65, humidity: 88, windSpeed: 55, pressure: 985 },
        validFrom: new Date(now.getTime() + 86_400_000),
        validUntil: new Date(now.getTime() + 86_400_000 * 4),
        affectedPopulation: 95000, modelVersion: "2.1",
        createdAt: ago(1),
      },
    ])
    .onConflictDoNothing();

  console.log("✅ Disaster predictions: 4");

  // ─── DONE ─────────────────────────────────────────────────────────────────────

  console.log("\n🎉 Demo seed complete!\n");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🔑  All accounts use password:  Test1234!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("\n👑  ADMINS");
  console.log("   emma.admin@crisisconnect.com   (Emma Rodriguez)");
  console.log("   james.admin@crisisconnect.com  (James Chen)");
  console.log("\n🏛️   GOVERNMENT");
  console.log("   priya.gov@crisisconnect.com    (Priya Sharma)");
  console.log("   marcus.gov@crisisconnect.com   (Marcus Williams)");
  console.log("\n🏢  NGO");
  console.log("   sofia.ngo@crisisconnect.com    (Sofia Petrov)");
  console.log("   ahmed.ngo@crisisconnect.com    (Ahmed Hassan)");
  console.log("   lin.ngo@crisisconnect.com      (Lin Wei)");
  console.log("\n🙋  VOLUNTEERS");
  console.log("   carlos.vol@crisisconnect.com   (Carlos Mendez)");
  console.log("   aisha.vol@crisisconnect.com    (Aisha Johnson)");
  console.log("   dmitri.vol@crisisconnect.com   (Dmitri Volkov)");
  console.log("   fatima.vol@crisisconnect.com   (Fatima Al-Rashid)");
  console.log("\n👤  CITIZENS");
  console.log("   tom.citizen@crisisconnect.com     (Tom Baker)");
  console.log("   maria.citizen@crisisconnect.com   (Maria Santos)");
  console.log("   kevin.citizen@crisisconnect.com   (Kevin Park)");
  console.log("   rachel.citizen@crisisconnect.com  (Rachel Green)");
  console.log("   yuki.citizen@crisisconnect.com    (Yuki Tanaka)");
  console.log("   daniel.citizen@crisisconnect.com  (Daniel Osei)");
  console.log("   anna.citizen@crisisconnect.com    (Anna Kowalski)");
  console.log("   michael.citizen@crisisconnect.com (Michael Torres)");
  console.log("   layla.citizen@crisisconnect.com   (Layla Ibrahim)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  });
