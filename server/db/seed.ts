import { db } from "./db";
import {
  users,
  disasterReports,
  resourceRequests,
  aidOffers,
  userReputation,
  sosAlerts,
} from "@shared/schema";

async function seed() {
  console.log("🌱 Seeding database...");

  // Create test users
  const testUsers = await db
    .insert(users)
    .values([
      {
        id: "test-admin-1",
        email: "admin@test.com",
        name: "Admin User",
        firstName: "Admin",
        lastName: "User",
        role: "admin",
      },
      {
        id: "test-volunteer-1",
        email: "volunteer@test.com",
        name: "Volunteer Smith",
        firstName: "Volunteer",
        lastName: "Smith",
        role: "volunteer",
      },
      {
        id: "test-citizen-1",
        email: "citizen@test.com",
        name: "Jane Citizen",
        firstName: "Jane",
        lastName: "Citizen",
        role: "citizen",
      },
      {
        id: "test-ngo-1",
        email: "ngo@test.com",
        name: "NGO Representative",
        firstName: "NGO",
        lastName: "Rep",
        role: "ngo",
      },
    ])
    .onConflictDoNothing()
    .returning();

  console.log(`✅ Created ${testUsers.length} test users`);

  // Create test disaster reports
  const testReports = await db
    .insert(disasterReports)
    .values([
      {
        userId: "test-citizen-1",
        type: "flood",
        severity: "high",
        status: "reported",
        location: "Downtown District",
        latitude: "40.7128",
        longitude: "-74.0060",
        description: "Severe flooding on Main Street. Water level rising rapidly. Multiple cars stranded.",
        title: "Flash Flood on Main Street",
        aiValidationScore: 85,
        aiValidationNotes: "Report appears credible based on description and location data",
        verificationCount: 3,
        priorityScore: 85,
      },
      {
        userId: "test-volunteer-1",
        type: "fire",
        severity: "critical",
        status: "responding",
        location: "Oakwood Apartments",
        latitude: "40.7580",
        longitude: "-73.9855",
        description: "Building fire at Oakwood Apartments. Smoke visible from several blocks away.",
        title: "Apartment Building Fire",
        aiValidationScore: 95,
        aiValidationNotes: "High credibility - matches known incident patterns",
        verificationCount: 7,
        confirmedBy: "test-volunteer-1",
        adminNotes: "Fire department dispatched",
        assignedTo: "test-volunteer-1",
        priorityScore: 98,
      },
      {
        userId: "test-citizen-1",
        type: "earthquake",
        severity: "medium",
        status: "verified",
        location: "Central Park Area",
        latitude: "40.7829",
        longitude: "-73.9654",
        description: "Minor earthquake felt in Central Park. Buildings shook for about 10 seconds.",
        title: "Minor Earthquake Tremors",
        aiValidationScore: 72,
        aiValidationNotes: "Plausible report, awaiting additional verification",
        verificationCount: 12,
        confirmedBy: "test-ngo-1",
        priorityScore: 65,
      },
    ])
    .onConflictDoNothing()
    .returning();

  console.log(`✅ Created ${testReports.length} test disaster reports`);

  // Create test resource requests
  const testRequests = await db
    .insert(resourceRequests)
    .values([
      {
        userId: "test-citizen-1",
        resourceType: "food",
        status: "pending",
        urgency: "high",
        quantity: 50,
        description: "Need food supplies for flood victims. Around 50 people displaced.",
        location: "Downtown Shelter",
        latitude: "40.7128",
        longitude: "-74.0060",
      },
      {
        userId: "test-volunteer-1",
        resourceType: "medical",
        status: "in_progress",
        urgency: "critical",
        quantity: 20,
        description: "Medical supplies needed urgently for fire victims. Minor injuries reported.",
        location: "Oakwood Apartments",
        latitude: "40.7580",
        longitude: "-73.9855",
        fulfilledBy: "test-ngo-1",
      },
    ])
    .onConflictDoNothing()
    .returning();

  console.log(`✅ Created ${testRequests.length} test resource requests`);

  // Create test aid offers
  const testOffers = await db
    .insert(aidOffers)
    .values([
      {
        userId: "test-ngo-1",
        resourceType: "water",
        status: "available",
        quantity: 100,
        description: "Clean drinking water bottles available for distribution",
        location: "Red Cross Center",
        latitude: "40.7489",
        longitude: "-73.9680",
      },
      {
        userId: "test-volunteer-1",
        resourceType: "shelter",
        status: "committed",
        quantity: 20,
        description: "Temporary shelter space available at community center",
        location: "Community Center",
        latitude: "40.7614",
        longitude: "-73.9776",
      },
    ])
    .onConflictDoNothing()
    .returning();

  console.log(`✅ Created ${testOffers.length} test aid offers`);

  // Create test SOS alert
  const testSOS = await db
    .insert(sosAlerts)
    .values([
      {
        userId: "test-citizen-1",
        emergencyType: "accident",
        severity: "critical",
        status: "active",
        location: "456 Park Avenue",
        latitude: "40.7589",
        longitude: "-73.9851",
        description: "Person having chest pains, needs immediate medical attention",
        contactNumber: "+1-555-0123",
      },
    ])
    .onConflictDoNothing()
    .returning();

  console.log(`✅ Created ${testSOS.length} test SOS alerts`);

  // Create user reputations
  const testReputations = await db
    .insert(userReputation)
    .values([
      {
        userId: "test-admin-1",
        trustScore: 100,
        totalReports: 15,
        verifiedReports: 14,
        falseReports: 0,
        verificationsGiven: 25,
        upvotesReceived: 50,
        downvotesReceived: 2,
        resourcesProvided: 10,
        resourcesFulfilled: 8,
      },
      {
        userId: "test-volunteer-1",
        trustScore: 85,
        totalReports: 10,
        verifiedReports: 9,
        falseReports: 0,
        verificationsGiven: 20,
        upvotesReceived: 35,
        downvotesReceived: 1,
        resourcesProvided: 15,
        resourcesFulfilled: 12,
      },
      {
        userId: "test-citizen-1",
        trustScore: 70,
        totalReports: 5,
        verifiedReports: 4,
        falseReports: 0,
        verificationsGiven: 8,
        upvotesReceived: 15,
        downvotesReceived: 0,
        resourcesProvided: 3,
        resourcesFulfilled: 2,
      },
      {
        userId: "test-ngo-1",
        trustScore: 95,
        totalReports: 8,
        verifiedReports: 8,
        falseReports: 0,
        verificationsGiven: 30,
        upvotesReceived: 60,
        downvotesReceived: 0,
        resourcesProvided: 25,
        resourcesFulfilled: 23,
      },
    ])
    .onConflictDoNothing()
    .returning();

  console.log(`✅ Created ${testReputations.length} user reputations`);

  console.log("🎉 Database seeding completed!");
  process.exit(0);
}

seed().catch((error) => {
  console.error("❌ Error seeding database:", error);
  process.exit(1);
});
