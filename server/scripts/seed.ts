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
  analyticsEvents,
  notifications,
} from "@shared/schema";
import bcrypt from "bcryptjs";
import { logger } from "../utils/logger";

async function seed() {
  try {
    logger.info("Starting database seed...");

    const hashedPassword = await bcrypt.hash("password123", 10);

    const testUsers = await db
      .insert(users)
      .values([
        {
          email: "admin@crisisconnect.com",
          password: hashedPassword,
          name: "Admin User",
          role: "admin",
          phoneNumber: "+1-555-0001",
          emailVerified: new Date(),
        },
        {
          email: "john.citizen@example.com",
          password: hashedPassword,
          name: "John Citizen",
          role: "citizen",
          phoneNumber: "+1-555-0002",
          emailVerified: new Date(),
        },
        {
          email: "sarah.volunteer@example.com",
          password: hashedPassword,
          name: "Sarah Volunteer",
          role: "volunteer",
          phoneNumber: "+1-555-0003",
          emailVerified: new Date(),
        },
        {
          email: "relief.ngo@example.com",
          password: hashedPassword,
          name: "Relief NGO Coordinator",
          role: "ngo",
          phoneNumber: "+1-555-0004",
          emailVerified: new Date(),
        },
        {
          email: "gov.official@example.com",
          password: hashedPassword,
          name: "Government Official",
          role: "government",
          phoneNumber: "+1-555-0005",
          emailVerified: new Date(),
        },
        {
          email: "mike.reporter@example.com",
          password: hashedPassword,
          name: "Mike Reporter",
          role: "citizen",
          phoneNumber: "+1-555-0006",
          emailVerified: new Date(),
        },
        {
          email: "lisa.helper@example.com",
          password: hashedPassword,
          name: "Lisa Helper",
          role: "volunteer",
          phoneNumber: "+1-555-0007",
          emailVerified: new Date(),
        },
      ])
      .returning();

    logger.info(`Created ${testUsers.length} users`);

    const testReports = await db
      .insert(disasterReports)
      .values([
        {
          title: "Major Fire Outbreak at Downtown Mall",
          description: "Large fire reported at Central Plaza Mall. Multiple floors affected. Fire department on scene but need backup.",
          type: "fire",
          severity: "critical",
          status: "responding",
          location: "Central Plaza Mall, Downtown",
          latitude: "40.7589",
          longitude: "-73.9851",
          userId: testUsers[1].id,
          verificationCount: 5,
          upvotes: 12,
          downvotes: 0,
          consensusScore: 95,
          aiValidationScore: 92,
          confirmedBy: testUsers[0].id,
          confirmedAt: new Date(),
        },
        {
          title: "Flash Flood Warning - River Street Area",
          description: "Heavy rainfall causing flash floods along River Street. Water level rising rapidly. Several cars stranded.",
          type: "flood",
          severity: "high",
          status: "verified",
          location: "River Street, East District",
          latitude: "40.7614",
          longitude: "-73.9776",
          userId: testUsers[5].id,
          verificationCount: 8,
          upvotes: 15,
          downvotes: 1,
          consensusScore: 88,
          aiValidationScore: 85,
          confirmedBy: testUsers[4].id,
          confirmedAt: new Date(),
        },
        {
          title: "Multi-Vehicle Accident on Highway 101",
          description: "Serious accident involving 5 vehicles on northbound Highway 101 near exit 23. Medical assistance needed urgently.",
          type: "road_accident",
          severity: "high",
          status: "responding",
          location: "Highway 101, Exit 23",
          latitude: "40.7489",
          longitude: "-73.9680",
          userId: testUsers[2].id,
          verificationCount: 3,
          upvotes: 8,
          downvotes: 0,
          consensusScore: 100,
          assignedTo: testUsers[4].id,
          assignedAt: new Date(),
        },
        {
          title: "Building Collapse - Construction Site",
          description: "Partial building collapse at the new construction site on Oak Avenue. Workers may be trapped. Emergency services requested.",
          type: "building_collapse",
          severity: "critical",
          status: "verified",
          location: "Oak Avenue Construction Site",
          latitude: "40.7520",
          longitude: "-73.9790",
          userId: testUsers[6].id,
          verificationCount: 6,
          upvotes: 18,
          downvotes: 0,
          consensusScore: 100,
          confirmedBy: testUsers[0].id,
          confirmedAt: new Date(),
        },
        {
          title: "Gas Leak Reported in Residential Area",
          description: "Strong gas smell reported by multiple residents in Maple Street neighborhood. Area being evacuated.",
          type: "gas_leak",
          severity: "high",
          status: "responding",
          location: "Maple Street, Residential Zone",
          latitude: "40.7450",
          longitude: "-73.9820",
          userId: testUsers[1].id,
          verificationCount: 4,
          upvotes: 10,
          downvotes: 0,
          consensusScore: 92,
        },
        {
          title: "Severe Storm Damage - Elm Park",
          description: "Severe storm caused widespread damage in Elm Park. Trees down, power lines damaged, multiple homes affected.",
          type: "storm",
          severity: "medium",
          status: "verified",
          location: "Elm Park",
          latitude: "40.7380",
          longitude: "-73.9900",
          userId: testUsers[2].id,
          verificationCount: 7,
          upvotes: 14,
          downvotes: 2,
          consensusScore: 78,
        },
        {
          title: "Earthquake Tremors Felt",
          description: "Mild earthquake tremors felt across the city. No major damage reported yet, but monitoring situation.",
          type: "earthquake",
          severity: "low",
          status: "reported",
          location: "City Center",
          latitude: "40.7580",
          longitude: "-73.9855",
          userId: testUsers[5].id,
          verificationCount: 2,
          upvotes: 5,
          downvotes: 3,
          consensusScore: 45,
        },
        {
          title: "Power Outage - North District",
          description: "Widespread power outage affecting North District. Approximately 5000 homes without electricity.",
          type: "power_outage",
          severity: "medium",
          status: "verified",
          location: "North District",
          latitude: "40.7680",
          longitude: "-73.9750",
          userId: testUsers[6].id,
          verificationCount: 9,
          upvotes: 20,
          downvotes: 1,
          consensusScore: 90,
        },
      ])
      .returning();

    logger.info(`Created ${testReports.length} disaster reports`);

    const testSOSAlerts = await db
      .insert(sosAlerts)
      .values([
        {
          userId: testUsers[1].id,
          emergencyType: "fire",
          severity: "critical",
          status: "active",
          location: "Pine Street Apartment, Unit 405",
          latitude: "40.7555",
          longitude: "-73.9820",
          description: "Trapped in apartment, smoke filling rooms. Need immediate help!",
          contactNumber: testUsers[1].phoneNumber!,
        },
        {
          userId: testUsers[5].id,
          emergencyType: "flood",
          severity: "high",
          status: "responding",
          location: "Bridge Road, Near River",
          latitude: "40.7600",
          longitude: "-73.9800",
          description: "Vehicle stuck in rising water. Need rescue.",
          contactNumber: testUsers[5].phoneNumber!,
          respondedBy: testUsers[2].id,
          respondedAt: new Date(),
        },
      ])
      .returning();

    logger.info(`Created ${testSOSAlerts.length} SOS alerts`);

    const testResourceRequests = await db
      .insert(resourceRequests)
      .values([
        {
          resourceType: "water",
          quantity: 200,
          urgency: "critical",
          status: "pending",
          description: "Bottled water urgently needed for fire victims at emergency shelter",
          location: "Community Center Shelter",
          latitude: "40.7560",
          longitude: "-73.9830",
          contactInfo: "Contact: Sarah at shelter desk",
          userId: testUsers[2].id,
          disasterReportId: testReports[0].id,
        },
        {
          resourceType: "medical",
          quantity: 50,
          urgency: "critical",
          status: "in_progress",
          description: "First aid kits and medical supplies for accident victims",
          location: "Highway 101, Emergency Camp",
          latitude: "40.7489",
          longitude: "-73.9680",
          contactInfo: "Call emergency coordinator",
          userId: testUsers[4].id,
          disasterReportId: testReports[2].id,
        },
        {
          resourceType: "food",
          quantity: 100,
          urgency: "high",
          status: "pending",
          description: "Ready-to-eat meals for displaced families",
          location: "Temporary Shelter, Oak Avenue",
          latitude: "40.7520",
          longitude: "-73.9790",
          contactInfo: "Relief coordinator on-site",
          userId: testUsers[3].id,
          disasterReportId: testReports[3].id,
        },
        {
          resourceType: "blankets",
          quantity: 75,
          urgency: "medium",
          status: "pending",
          description: "Blankets needed for evacuated residents",
          location: "Maple Street Community Hall",
          latitude: "40.7450",
          longitude: "-73.9820",
          contactInfo: "Community hall reception",
          userId: testUsers[6].id,
        },
        {
          resourceType: "shelter",
          quantity: 30,
          urgency: "high",
          status: "pending",
          description: "Temporary shelter needed for storm-affected families",
          location: "Elm Park Relief Center",
          latitude: "40.7380",
          longitude: "-73.9900",
          contactInfo: "NGO coordinator",
          userId: testUsers[3].id,
        },
      ])
      .returning();

    logger.info(`Created ${testResourceRequests.length} resource requests`);

    const testAidOffers = await db
      .insert(aidOffers)
      .values([
        {
          resourceType: "water",
          quantity: 100,
          status: "available",
          description: "500ml bottled water, sealed and ready for distribution",
          location: "West Side Warehouse",
          latitude: "40.7400",
          longitude: "-73.9950",
          contactInfo: "Warehouse manager: +1-555-1234",
          userId: testUsers[2].id,
        },
        {
          resourceType: "food",
          quantity: 150,
          status: "available",
          description: "Pre-packaged meals with long shelf life",
          location: "Food Bank Center",
          latitude: "40.7500",
          longitude: "-73.9700",
          contactInfo: "Food bank: +1-555-5678",
          userId: testUsers[3].id,
        },
        {
          resourceType: "blankets",
          quantity: 200,
          status: "available",
          description: "New thermal blankets, individually wrapped",
          location: "Donation Center, Main Street",
          latitude: "40.7550",
          longitude: "-73.9880",
          contactInfo: "Center desk: +1-555-9012",
          userId: testUsers[6].id,
        },
        {
          resourceType: "medical",
          quantity: 30,
          status: "committed",
          description: "Comprehensive first aid kits",
          location: "Medical Supply Depot",
          latitude: "40.7490",
          longitude: "-73.9680",
          contactInfo: "Depot coordinator",
          userId: testUsers[2].id,
          matchedRequestId: testResourceRequests[1].id,
        },
        {
          resourceType: "clothing",
          quantity: 100,
          status: "available",
          description: "Assorted clothing for all ages and sizes",
          location: "Clothing Drive Center",
          latitude: "40.7420",
          longitude: "-73.9860",
          contactInfo: "Drive organizer: +1-555-3456",
          userId: testUsers[6].id,
        },
      ])
      .returning();

    logger.info(`Created ${testAidOffers.length} aid offers`);

    const testInventoryItems = await db
      .insert(inventoryItems)
      .values([
        {
          name: "Emergency Water Supply",
          itemType: "water",
          quantity: 5000,
          unit: "bottles",
          location: "Central Warehouse",
          latitude: "40.7530",
          longitude: "-73.9840",
          minimumThreshold: 1000,
          description: "500ml bottled water for emergency distribution",
          managedBy: testUsers[3].id,
        },
        {
          name: "MRE Meals",
          itemType: "food",
          quantity: 3000,
          unit: "meals",
          location: "Central Warehouse",
          latitude: "40.7530",
          longitude: "-73.9840",
          minimumThreshold: 500,
          description: "Ready-to-eat military-style meals",
          managedBy: testUsers[3].id,
        },
        {
          name: "Trauma Kits",
          itemType: "medical_supplies",
          quantity: 150,
          unit: "kits",
          location: "Medical Storage Facility",
          latitude: "40.7580",
          longitude: "-73.9760",
          minimumThreshold: 30,
          description: "Complete trauma response kits",
          managedBy: testUsers[4].id,
        },
        {
          name: "Emergency Shelter Tents",
          itemType: "shelter",
          quantity: 200,
          unit: "tents",
          location: "Equipment Depot",
          latitude: "40.7470",
          longitude: "-73.9910",
          minimumThreshold: 50,
          description: "4-person emergency tents with ground sheets",
          managedBy: testUsers[3].id,
        },
        {
          name: "Thermal Blankets",
          itemType: "blankets",
          quantity: 800,
          unit: "blankets",
          location: "Central Warehouse",
          latitude: "40.7530",
          longitude: "-73.9840",
          minimumThreshold: 200,
          description: "Mylar emergency thermal blankets",
          managedBy: testUsers[3].id,
        },
        {
          name: "Portable Generators",
          itemType: "equipment",
          quantity: 25,
          unit: "units",
          location: "Equipment Depot",
          latitude: "40.7470",
          longitude: "-73.9910",
          minimumThreshold: 5,
          description: "5kW portable diesel generators",
          managedBy: testUsers[4].id,
        },
      ])
      .returning();

    logger.info(`Created ${testInventoryItems.length} inventory items`);

    await db.insert(verifications).values([
      { reportId: testReports[0].id, userId: testUsers[2].id },
      { reportId: testReports[0].id, userId: testUsers[3].id },
      { reportId: testReports[0].id, userId: testUsers[4].id },
      { reportId: testReports[1].id, userId: testUsers[1].id },
      { reportId: testReports[1].id, userId: testUsers[2].id },
      { reportId: testReports[1].id, userId: testUsers[6].id },
      { reportId: testReports[3].id, userId: testUsers[2].id },
      { reportId: testReports[3].id, userId: testUsers[3].id },
    ]);

    logger.info("Created verifications");

    await db.insert(reportVotes).values([
      { reportId: testReports[0].id, userId: testUsers[2].id, voteType: "upvote" },
      { reportId: testReports[0].id, userId: testUsers[3].id, voteType: "upvote" },
      { reportId: testReports[0].id, userId: testUsers[6].id, voteType: "upvote" },
      { reportId: testReports[1].id, userId: testUsers[1].id, voteType: "upvote" },
      { reportId: testReports[1].id, userId: testUsers[2].id, voteType: "upvote" },
      { reportId: testReports[2].id, userId: testUsers[3].id, voteType: "upvote" },
    ]);

    logger.info("Created report votes");

    await db.insert(userReputation).values([
      {
        userId: testUsers[1].id,
        trustScore: 75,
        totalReports: 3,
        verifiedReports: 2,
        falseReports: 0,
        verificationsGiven: 5,
        upvotesReceived: 15,
        downvotesReceived: 1,
      },
      {
        userId: testUsers[2].id,
        trustScore: 92,
        totalReports: 5,
        verifiedReports: 5,
        falseReports: 0,
        verificationsGiven: 8,
        upvotesReceived: 28,
        downvotesReceived: 0,
        resourcesProvided: 3,
        resourcesFulfilled: 2,
      },
      {
        userId: testUsers[5].id,
        trustScore: 68,
        totalReports: 2,
        verifiedReports: 1,
        falseReports: 0,
        verificationsGiven: 2,
        upvotesReceived: 8,
        downvotesReceived: 2,
      },
    ]);

    logger.info("Created user reputation records");

    await db.insert(notifications).values([
      {
        userId: testUsers[1].id,
        type: "disaster_nearby",
        priority: "high",
        title: "New Disaster Nearby",
        message: "Flash flood reported 0.5 miles from your location",
        actionUrl: `/disasters/${testReports[1].id}`,
        relatedEntityId: testReports[1].id,
        relatedEntityType: "disaster_report",
      },
      {
        userId: testUsers[2].id,
        type: "resource_request",
        priority: "critical",
        title: "Urgent Resource Request",
        message: "Critical water shortage at Community Center Shelter",
        actionUrl: `/resources/requests/${testResourceRequests[0].id}`,
        relatedEntityId: testResourceRequests[0].id,
        relatedEntityType: "resource_request",
      },
      {
        userId: testUsers[3].id,
        type: "aid_matched",
        priority: "medium",
        title: "Aid Request Matched",
        message: "Your medical supplies have been matched with an urgent request",
        actionUrl: `/resources/offers/${testAidOffers[3].id}`,
        relatedEntityId: testAidOffers[3].id,
        relatedEntityType: "aid_offer",
        isRead: true,
        readAt: new Date(),
      },
      {
        userId: testUsers[0].id,
        type: "sos_alert",
        priority: "critical",
        title: "SOS Alert",
        message: "Emergency SOS activated at Pine Street Apartment",
        actionUrl: `/sos/${testSOSAlerts[0].id}`,
        relatedEntityId: testSOSAlerts[0].id,
        relatedEntityType: "sos_alert",
      },
    ]);

    logger.info("Created notifications");

    await db.insert(analyticsEvents).values([
      {
        eventType: "report_submitted",
        userId: testUsers[1].id,
        relatedEntityId: testReports[0].id,
        relatedEntityType: "disaster_report",
        location: "Central Plaza Mall, Downtown",
        latitude: "40.7589",
        longitude: "-73.9851",
      },
      {
        eventType: "report_verified",
        userId: testUsers[0].id,
        relatedEntityId: testReports[0].id,
        relatedEntityType: "disaster_report",
        location: "Central Plaza Mall, Downtown",
        latitude: "40.7589",
        longitude: "-73.9851",
        responseTime: 300,
      },
      {
        eventType: "resource_requested",
        userId: testUsers[2].id,
        relatedEntityId: testResourceRequests[0].id,
        relatedEntityType: "resource_request",
        location: "Community Center Shelter",
        latitude: "40.7560",
        longitude: "-73.9830",
      },
      {
        eventType: "aid_offered",
        userId: testUsers[2].id,
        relatedEntityId: testAidOffers[0].id,
        relatedEntityType: "aid_offer",
        location: "West Side Warehouse",
        latitude: "40.7400",
        longitude: "-73.9950",
      },
    ]);

    logger.info("Created analytics events");

    logger.info("✅ Database seeded successfully!");
    logger.info("\n📊 Summary:");
    logger.info(`  - ${testUsers.length} users created`);
    logger.info(`  - ${testReports.length} disaster reports`);
    logger.info(`  - ${testSOSAlerts.length} SOS alerts`);
    logger.info(`  - ${testResourceRequests.length} resource requests`);
    logger.info(`  - ${testAidOffers.length} aid offers`);
    logger.info(`  - ${testInventoryItems.length} inventory items`);
    logger.info("\n🔑 Test Credentials:");
    logger.info("  Email: admin@crisisconnect.com");
    logger.info("  Email: john.citizen@example.com");
    logger.info("  Email: sarah.volunteer@example.com");
    logger.info("  Password (all users): password123");

  } catch (error) {
    logger.error("Error seeding database:", error as Error);
    throw error;
  }
}

seed()
  .then(() => {
    console.log("Seed completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  });
