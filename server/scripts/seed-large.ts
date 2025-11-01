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
  chatRooms,
  chatRoomMembers,
  messages,
  disasterPredictions,
  notificationPreferences,
} from "@shared/schema";
import bcrypt from "bcryptjs";
import { logger } from "../utils/logger";

const userNames = [
  "John Smith", "Sarah Johnson", "Michael Brown", "Emily Davis", "James Wilson",
  "Jessica Moore", "David Taylor", "Ashley Anderson", "Christopher Thomas", "Amanda Jackson",
  "Matthew White", "Melissa Harris", "Andrew Martin", "Stephanie Thompson", "Joshua Garcia",
  "Jennifer Martinez", "Daniel Robinson", "Elizabeth Clark", "Joseph Rodriguez", "Michelle Lewis",
  "Ryan Walker", "Laura Hall", "Brandon Allen", "Nicole Young", "Benjamin Hernandez",
  "Samantha King", "Kevin Wright", "Rebecca Lopez", "Jonathan Hill", "Kimberly Scott",
  "William Green", "Lisa Adams", "Nicholas Baker", "Angela Gonzalez", "Tyler Nelson",
  "Rachel Carter", "Justin Mitchell", "Maria Perez", "Eric Roberts", "Christina Turner",
  "Brian Phillips", "Lauren Campbell", "Jason Parker", "Heather Evans", "Jacob Edwards",
  "Melissa Collins", "Aaron Stewart", "Amy Sanchez", "Patrick Morris", "Brittany Rogers",
  "Adam Reed", "Kelly Cook", "Zachary Morgan", "Danielle Bell", "Nathan Murphy",
  "Crystal Bailey", "Richard Rivera", "Shannon Cooper", "Jordan Richardson", "Tiffany Cox",
  "Kyle Howard", "Vanessa Ward", "Timothy Torres", "Diana Peterson", "Sean Gray",
  "Monica Ramirez", "Austin James", "Kristen Watson", "Marcus Brooks", "Cynthia Kelly",
  "Jordan Sanders", "Amber Price", "Derek Bennett", "Natalie Wood", "Travis Barnes",
  "Courtney Ross", "Gregory Henderson", "Alexis Coleman", "Keith Jenkins", "Victoria Perry",
  "Evan Powell", "Destiny Long", "Cameron Patterson", "Jasmine Hughes", "Lucas Flores",
  "Miranda Washington", "Bradley Butler", "Cassandra Simmons", "Dalton Foster", "Gabrielle Gonzales",
  "Blake Bryant", "Kayla Alexander", "Cole Russell", "Savannah Griffin", "Garrett Hayes",
  "Mackenzie Diaz", "Clayton Myers", "Maya Ford", "Jared Hamilton", "Paige Graham",
  "Carson Sullivan", "Isabel Wallace", "Wyatt Reynolds", "Sophia West", "Hunter Cole",
];

const cities = [
  { name: "New York", lat: 40.7128, lon: -74.0060 },
  { name: "Los Angeles", lat: 34.0522, lon: -118.2437 },
  { name: "Chicago", lat: 41.8781, lon: -87.6298 },
  { name: "Houston", lat: 29.7604, lon: -95.3698 },
  { name: "Phoenix", lat: 33.4484, lon: -112.0740 },
  { name: "Philadelphia", lat: 39.9526, lon: -75.1652 },
  { name: "San Antonio", lat: 29.4241, lon: -98.4936 },
  { name: "San Diego", lat: 32.7157, lon: -117.1611 },
  { name: "Dallas", lat: 32.7767, lon: -96.7970 },
  { name: "San Jose", lat: 37.3382, lon: -121.8863 },
];

const disasterTypes = ["fire", "flood", "earthquake", "storm", "road_accident", "epidemic", "landslide", "gas_leak", "building_collapse", "chemical_spill", "power_outage", "water_contamination"];
const severities = ["low", "medium", "high", "critical"];
const statuses = ["reported", "verified", "responding", "resolved"];
const urgencies = ["low", "medium", "high", "critical"];
const resourceTypes = ["food", "water", "shelter", "medical", "clothing", "blankets"];
const requestStatuses = ["pending", "in_progress", "fulfilled", "cancelled"];

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomNumber(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDate(daysAgo: number): Date {
  const now = new Date();
  const past = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
  const random = new Date(past.getTime() + Math.random() * (now.getTime() - past.getTime()));
  return random;
}

function addRandomOffset(base: number, maxOffset: number): number {
  return base + (Math.random() - 0.5) * 2 * maxOffset;
}

async function seed() {
  try {
    logger.info("🌱 Starting large database seed...");
    
    const hashedPassword = await bcrypt.hash("password123", 10);

    logger.info("Creating users...");
    const userRoles: Array<"citizen" | "volunteer" | "ngo" | "admin" | "government"> = ["citizen", "volunteer", "ngo", "admin", "government"];
    const usersList = [];

    usersList.push({
      email: "admin@crisisconnect.com",
      password: hashedPassword,
      name: "System Admin",
      role: "admin",
      phoneNumber: "+1-555-0001",
      emailVerified: new Date(),
    });

    for (let i = 0; i < 99; i++) {
      const role = i < 70 ? "citizen" : i < 85 ? "volunteer" : i < 92 ? "ngo" : i < 97 ? "government" : "admin";
      usersList.push({
        email: `user${i + 1}@example.com`,
        password: hashedPassword,
        name: userNames[i] || `User ${i + 1}`,
        role: role,
        phoneNumber: `+1-555-${String(i + 100).padStart(4, "0")}`,
        emailVerified: Math.random() > 0.2 ? randomDate(30) : undefined,
      });
    }

    const testUsers = await db.insert(users).values(usersList).returning();
    logger.info(`✅ Created ${testUsers.length} users`);

    logger.info("Creating disaster reports...");
    const reportsList = [];
    const disasterTitles: Record<string, string[]> = {
      fire: ["Major Fire Outbreak at", "Building Fire at", "Wildfire Spreading Near", "Vehicle Fire on", "Warehouse Fire at"],
      flood: ["Flash Flood Warning in", "Severe Flooding at", "River Overflow near", "Urban Flooding in", "Coastal Flooding at"],
      earthquake: ["Earthquake Tremors Felt in", "Seismic Activity Detected near", "Major Earthquake hits", "Aftershocks Reported in", "Ground Shaking in"],
      storm: ["Severe Storm Damage in", "Tornado Warning for", "Hurricane Approaching", "Thunderstorm Damage at", "Hailstorm Reported in"],
      road_accident: ["Multi-Vehicle Accident on", "Serious Collision at", "Traffic Accident near", "Pedestrian Accident on", "Highway Pileup at"],
      epidemic: ["Disease Outbreak in", "Viral Infection Spreading in", "Health Alert for", "Epidemic Warning in", "Mass Illness Reported in"],
      landslide: ["Landslide Blocks Road at", "Mudslide Danger in", "Slope Failure near", "Rockslide on", "Hill Collapse at"],
      gas_leak: ["Gas Leak Reported at", "Natural Gas Emergency in", "Chemical Gas Release at", "Gas Odor Detected in", "Pipeline Leak near"],
      building_collapse: ["Building Collapse at", "Structural Failure in", "Construction Site Collapse at", "Apartment Building Damaged in", "Commercial Building Collapse at"],
      chemical_spill: ["Chemical Spill on", "Hazardous Material Leak at", "Industrial Spill near", "Toxic Substance Release in", "Environmental Hazard at"],
      power_outage: ["Widespread Power Outage in", "Electrical Grid Failure in", "Blackout Affecting", "Power Lines Down in", "Transformer Explosion at"],
      water_contamination: ["Water Contamination Alert for", "Unsafe Drinking Water in", "Water Supply Issue at", "Pollution Detected in", "Waterborne Illness Risk in"],
    };

    for (let i = 0; i < 250; i++) {
      const type = randomElement(disasterTypes);
      const severity = randomElement(severities);
      const status = randomElement(statuses);
      const city = randomElement(cities);
      const lat = addRandomOffset(city.lat, 0.1);
      const lon = addRandomOffset(city.lon, 0.1);
      const createdAt = randomDate(60);
      
      reportsList.push({
        title: `${randomElement(disasterTitles[type])} ${city.name} District ${randomNumber(1, 20)}`,
        description: `Detailed report of ${type} incident. ${severity === "critical" ? "URGENT: Immediate response required." : ""} Multiple ${randomNumber(5, 50)} people affected. Emergency services ${status === "responding" ? "are on scene" : status === "resolved" ? "have handled the situation" : status === "verified" ? "have been notified" : "needed"}.`,
        type: type as any,
        severity: severity as any,
        status: status as any,
        location: `${city.name}, District ${randomNumber(1, 20)}, Street ${randomNumber(1, 100)}`,
        latitude: String(lat),
        longitude: String(lon),
        userId: randomElement(testUsers).id,
        verificationCount: randomNumber(0, 15),
        upvotes: randomNumber(0, 50),
        downvotes: randomNumber(0, 10),
        consensusScore: randomNumber(40, 100),
        aiValidationScore: Math.random() > 0.3 ? randomNumber(60, 98) : undefined,
        confirmedBy: Math.random() > 0.5 ? randomElement(testUsers.filter(u => u.role === "admin" || u.role === "government")).id : undefined,
        confirmedAt: Math.random() > 0.5 ? createdAt : undefined,
        assignedTo: status === "responding" && Math.random() > 0.4 ? randomElement(testUsers.filter(u => u.role === "government" || u.role === "ngo")).id : undefined,
        assignedAt: status === "responding" && Math.random() > 0.4 ? createdAt : undefined,
        createdAt,
        updatedAt: createdAt,
      });
    }

    const testReports = await db.insert(disasterReports).values(reportsList).returning();
    logger.info(`✅ Created ${testReports.length} disaster reports`);

    logger.info("Creating SOS alerts...");
    const sosAlertsList = [];
    for (let i = 0; i < 60; i++) {
      const user = randomElement(testUsers);
      const city = randomElement(cities);
      const sosStatus = randomElement(["active", "responding", "resolved", "cancelled"]);
      const createdAt = randomDate(30);
      
      sosAlertsList.push({
        userId: user.id,
        emergencyType: randomElement(disasterTypes) as any,
        severity: randomElement(severities) as any,
        status: sosStatus as any,
        location: `${city.name}, ${randomElement(["Apartment", "House", "Street", "Building"])} ${randomNumber(1, 500)}`,
        latitude: String(addRandomOffset(city.lat, 0.05)),
        longitude: String(addRandomOffset(city.lon, 0.05)),
        description: `Emergency assistance needed urgently. ${randomElement(["Trapped", "Injured", "In danger", "Need help", "Medical emergency"])}!`,
        contactNumber: user.phoneNumber!,
        respondedBy: sosStatus !== "active" ? randomElement(testUsers.filter(u => u.role === "volunteer" || u.role === "government")).id : undefined,
        respondedAt: sosStatus !== "active" ? createdAt : undefined,
        resolvedAt: sosStatus === "resolved" ? new Date(createdAt.getTime() + randomNumber(10, 120) * 60000) : undefined,
        createdAt,
        updatedAt: createdAt,
      });
    }

    const testSOSAlerts = await db.insert(sosAlerts).values(sosAlertsList).returning();
    logger.info(`✅ Created ${testSOSAlerts.length} SOS alerts`);

    logger.info("Creating resource requests...");
    const resourceRequestsList = [];
    for (let i = 0; i < 150; i++) {
      const resourceType = randomElement(resourceTypes);
      const city = randomElement(cities);
      const urgency = randomElement(urgencies);
      const status = randomElement(requestStatuses);
      const createdAt = randomDate(45);
      
      resourceRequestsList.push({
        resourceType: resourceType as any,
        quantity: randomNumber(10, 500),
        urgency: urgency as any,
        status: status as any,
        description: `${urgency === "critical" ? "URGENT: " : ""}Need ${resourceType} for ${randomNumber(10, 200)} affected individuals. ${randomElement(["Immediate delivery required", "As soon as possible", "Within 24 hours", "Ongoing need"])}`,
        location: `${city.name}, ${randomElement(["Community Center", "Emergency Shelter", "Relief Camp", "Evacuation Center", "Field Hospital"])}`,
        latitude: String(addRandomOffset(city.lat, 0.05)),
        longitude: String(addRandomOffset(city.lon, 0.05)),
        contactInfo: `Contact: ${randomNumber(100, 999)}-${randomNumber(1000, 9999)}`,
        userId: randomElement(testUsers).id,
        disasterReportId: Math.random() > 0.3 ? randomElement(testReports).id : undefined,
        fulfilledBy: status === "fulfilled" ? randomElement(testUsers.filter(u => u.role === "volunteer" || u.role === "ngo")).id : undefined,
        fulfilledAt: status === "fulfilled" ? new Date(createdAt.getTime() + randomNumber(60, 600) * 60000) : undefined,
        createdAt,
        updatedAt: createdAt,
      });
    }

    const testResourceRequests = await db.insert(resourceRequests).values(resourceRequestsList).returning();
    logger.info(`✅ Created ${testResourceRequests.length} resource requests`);

    logger.info("Creating aid offers...");
    const aidOffersList = [];
    const aidStatuses = ["available", "committed", "delivered", "cancelled"];
    for (let i = 0; i < 180; i++) {
      const resourceType = randomElement(resourceTypes);
      const city = randomElement(cities);
      const status = randomElement(aidStatuses);
      const createdAt = randomDate(40);
      
      aidOffersList.push({
        resourceType: resourceType as any,
        quantity: randomNumber(20, 1000),
        status: status as any,
        description: `${resourceType.charAt(0).toUpperCase() + resourceType.slice(1)} available for distribution. ${randomElement(["High quality", "Emergency grade", "Ready for immediate use", "Packaged and sealed"])}`,
        location: `${city.name}, ${randomElement(["Warehouse", "Donation Center", "Community Hub", "NGO Office", "Distribution Point"])} ${randomNumber(1, 50)}`,
        latitude: String(addRandomOffset(city.lat, 0.05)),
        longitude: String(addRandomOffset(city.lon, 0.05)),
        contactInfo: `Call: +1-555-${randomNumber(1000, 9999)}`,
        userId: randomElement(testUsers.filter(u => u.role === "volunteer" || u.role === "ngo")).id,
        matchedRequestId: status === "committed" || status === "delivered" ? randomElement(testResourceRequests).id : undefined,
        deliveredAt: status === "delivered" ? new Date(createdAt.getTime() + randomNumber(120, 1000) * 60000) : undefined,
        createdAt,
        updatedAt: createdAt,
      });
    }

    const testAidOffers = await db.insert(aidOffers).values(aidOffersList).returning();
    logger.info(`✅ Created ${testAidOffers.length} aid offers`);

    logger.info("Creating inventory items...");
    const inventoryItemsList = [];
    const inventoryTypes = ["shelter", "food", "water", "medical_supplies", "clothing", "blankets", "equipment"];
    const inventoryNames: Record<string, string[]> = {
      shelter: ["Emergency Tents", "Portable Shelters", "Temporary Housing Units", "Relief Tents"],
      food: ["MRE Meals", "Canned Food", "Dry Rations", "Emergency Food Kits", "Ready-to-Eat Meals"],
      water: ["Bottled Water", "Water Purification Tablets", "Emergency Water Supply", "Water Containers"],
      medical_supplies: ["First Aid Kits", "Trauma Kits", "Medical Equipment", "Surgical Supplies", "Medication Packs"],
      clothing: ["Winter Clothing", "Emergency Clothing", "Protective Gear", "Assorted Garments"],
      blankets: ["Thermal Blankets", "Emergency Blankets", "Sleeping Bags", "Wool Blankets"],
      equipment: ["Generators", "Communication Radios", "Search Equipment", "Rescue Tools", "Flashlights"],
    };

    for (let i = 0; i < 100; i++) {
      const itemType = randomElement(inventoryTypes);
      const city = randomElement(cities);
      
      inventoryItemsList.push({
        name: randomElement(inventoryNames[itemType]),
        itemType: itemType as any,
        quantity: randomNumber(50, 5000),
        unit: randomElement(["units", "pieces", "bottles", "kits", "boxes", "packs"]),
        location: `${city.name}, ${randomElement(["Central Warehouse", "Storage Facility", "Distribution Center", "Emergency Depot"])}`,
        latitude: String(addRandomOffset(city.lat, 0.05)),
        longitude: String(addRandomOffset(city.lon, 0.05)),
        expiryDate: Math.random() > 0.6 ? new Date(Date.now() + randomNumber(30, 365) * 24 * 60 * 60 * 1000) : undefined,
        minimumThreshold: randomNumber(10, 200),
        description: `${itemType} for emergency response and disaster relief operations`,
        managedBy: randomElement(testUsers.filter(u => u.role === "ngo" || u.role === "government")).id,
        createdAt: randomDate(90),
        updatedAt: randomDate(30),
      });
    }

    const testInventoryItems = await db.insert(inventoryItems).values(inventoryItemsList).returning();
    logger.info(`✅ Created ${testInventoryItems.length} inventory items`);

    logger.info("Creating verifications...");
    const verificationsList = [];
    for (let i = 0; i < 500; i++) {
      const report = randomElement(testReports);
      const user = randomElement(testUsers);
      
      try {
        verificationsList.push({
          reportId: report.id,
          userId: user.id,
          createdAt: randomDate(60),
        });
      } catch (e) {
      }
    }

    await db.insert(verifications).values(verificationsList).onConflictDoNothing();
    logger.info(`✅ Created verifications`);

    logger.info("Creating report votes...");
    const votesList = [];
    for (let i = 0; i < 800; i++) {
      const report = randomElement(testReports);
      const user = randomElement(testUsers);
      
      try {
        votesList.push({
          reportId: report.id,
          userId: user.id,
          voteType: Math.random() > 0.3 ? "upvote" : "downvote" as any,
          createdAt: randomDate(60),
          updatedAt: randomDate(60),
        });
      } catch (e) {
      }
    }

    await db.insert(reportVotes).values(votesList).onConflictDoNothing();
    logger.info(`✅ Created report votes`);

    logger.info("Creating user reputation records...");
    const reputationList = [];
    for (const user of testUsers) {
      const userReports = testReports.filter(r => r.userId === user.id);
      const trustScore = randomNumber(30, 100);
      
      reputationList.push({
        userId: user.id,
        trustScore,
        totalReports: userReports.length,
        verifiedReports: Math.floor(userReports.length * (trustScore / 100)),
        falseReports: randomNumber(0, Math.floor(userReports.length * 0.1)),
        verificationsGiven: randomNumber(0, 30),
        upvotesReceived: randomNumber(0, 100),
        downvotesReceived: randomNumber(0, 20),
        resourcesProvided: user.role === "volunteer" || user.role === "ngo" ? randomNumber(0, 50) : 0,
        resourcesFulfilled: user.role === "volunteer" || user.role === "ngo" ? randomNumber(0, 30) : 0,
        responseTimeAvg: randomNumber(300, 3600),
        lastUpdated: randomDate(7),
      });
    }

    await db.insert(userReputation).values(reputationList).onConflictDoNothing();
    logger.info(`✅ Created user reputation records`);

    logger.info("Creating notifications...");
    const notificationsList = [];
    const notificationTypes = ["disaster_nearby", "disaster_verified", "disaster_resolved", "sos_alert", "resource_request", "resource_fulfilled", "aid_matched", "report_assigned", "report_confirmed", "low_inventory", "system_alert"];
    
    for (let i = 0; i < 400; i++) {
      const type = randomElement(notificationTypes);
      const priority = randomElement(["low", "medium", "high", "critical"]);
      const createdAt = randomDate(30);
      const isRead = Math.random() > 0.4;
      
      notificationsList.push({
        userId: randomElement(testUsers).id,
        type: type as any,
        priority: priority as any,
        title: `${type.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}`,
        message: `Notification message for ${type}. ${priority === "critical" ? "Immediate action required!" : "Please review when possible."}`,
        actionUrl: `/notifications/${randomNumber(1, 1000)}`,
        relatedEntityId: randomNumber(1, 100).toString(),
        relatedEntityType: randomElement(["disaster_report", "resource_request", "aid_offer", "sos_alert"]),
        isRead,
        readAt: isRead ? new Date(createdAt.getTime() + randomNumber(60, 1440) * 60000) : undefined,
        createdAt,
      });
    }

    await db.insert(notifications).values(notificationsList);
    logger.info(`✅ Created ${notificationsList.length} notifications`);

    logger.info("Creating analytics events...");
    const eventsList = [];
    const eventTypes = ["report_submitted", "report_verified", "report_resolved", "resource_requested", "resource_fulfilled", "aid_offered", "aid_delivered", "user_registered"];
    
    for (let i = 0; i < 600; i++) {
      const eventType = randomElement(eventTypes);
      const city = randomElement(cities);
      
      eventsList.push({
        eventType: eventType as any,
        userId: randomElement(testUsers).id,
        relatedEntityId: randomNumber(1, 500).toString(),
        relatedEntityType: randomElement(["disaster_report", "resource_request", "aid_offer", "user"]),
        location: `${city.name}, District ${randomNumber(1, 20)}`,
        latitude: String(addRandomOffset(city.lat, 0.1)),
        longitude: String(addRandomOffset(city.lon, 0.1)),
        responseTime: Math.random() > 0.5 ? randomNumber(60, 3600) : undefined,
        createdAt: randomDate(90),
      });
    }

    await db.insert(analyticsEvents).values(eventsList);
    logger.info(`✅ Created ${eventsList.length} analytics events`);

    logger.info("Creating disaster predictions...");
    const predictionsList = [];
    const riskLevels = ["very_low", "low", "medium", "high", "very_high"];
    
    for (let i = 0; i < 30; i++) {
      const city = randomElement(cities);
      const disasterType = randomElement(["flood", "earthquake", "storm", "fire", "landslide"]);
      const validFrom = new Date(Date.now() + randomNumber(-7, 7) * 24 * 60 * 60 * 1000);
      const validUntil = new Date(validFrom.getTime() + randomNumber(24, 168) * 60 * 60 * 1000);
      
      predictionsList.push({
        disasterType: disasterType as any,
        predictedArea: `${city.name} Metropolitan Area`,
        latitude: String(city.lat),
        longitude: String(city.lon),
        radius: randomNumber(5, 50),
        riskLevel: randomElement(riskLevels) as any,
        confidence: randomNumber(60, 95),
        weatherData: { temperature: randomNumber(50, 100), humidity: randomNumber(30, 90), windSpeed: randomNumber(5, 60) },
        validFrom,
        validUntil,
        affectedPopulation: randomNumber(1000, 500000),
        modelVersion: "2.0",
        createdAt: randomDate(15),
      });
    }

    await db.insert(disasterPredictions).values(predictionsList);
    logger.info(`✅ Created ${predictionsList.length} disaster predictions`);

    logger.info("Creating chat rooms and messages...");
    const chatRoomsList = [];
    for (let i = 0; i < 50; i++) {
      const type = randomElement(["direct", "group", "report"]);
      
      chatRoomsList.push({
        name: type === "group" ? `${randomElement(["Emergency", "Response", "Coordination", "Relief"])} Team ${i + 1}` : type === "report" ? `Report Discussion ${i + 1}` : undefined,
        type: type as any,
        relatedReportId: type === "report" ? randomElement(testReports).id : undefined,
        relatedSOSId: Math.random() > 0.8 ? randomElement(testSOSAlerts).id : undefined,
        createdBy: randomElement(testUsers).id,
        createdAt: randomDate(60),
        updatedAt: randomDate(30),
      });
    }

    const testChatRooms = await db.insert(chatRooms).values(chatRoomsList).returning();
    logger.info(`✅ Created ${testChatRooms.length} chat rooms`);

    const membersList = [];
    for (const room of testChatRooms) {
      const numMembers = randomNumber(2, 8);
      const members = new Set<string>();
      members.add(room.createdBy);
      
      while (members.size < numMembers) {
        members.add(randomElement(testUsers).id);
      }
      
      for (const userId of Array.from(members)) {
        membersList.push({
          chatRoomId: room.id,
          userId,
          role: userId === room.createdBy ? "admin" : "member",
          joinedAt: randomDate(60),
          lastReadAt: Math.random() > 0.3 ? randomDate(10) : undefined,
        });
      }
    }

    await db.insert(chatRoomMembers).values(membersList);
    logger.info(`✅ Created ${membersList.length} chat room members`);

    const messagesList = [];
    for (let i = 0; i < 500; i++) {
      const room = randomElement(testChatRooms);
      const messageType = randomElement(["text", "system", "location"]);
      
      messagesList.push({
        chatRoomId: room.id,
        senderId: messageType !== "system" ? randomElement(testUsers).id : undefined,
        content: messageType === "text" 
          ? randomElement([
              "We need more volunteers here",
              "The situation is under control",
              "Requesting additional supplies",
              "Medical team is on the way",
              "Area has been evacuated",
              "Update: situation improving",
              "Need backup immediately",
              "Coordinating with local authorities",
            ])
          : messageType === "location"
          ? "Shared location coordinates"
          : `${randomElement(["User joined", "User left", "Room created", "Settings updated"])}`,
        messageType: messageType as any,
        metadata: messageType === "location" ? { lat: randomElement(cities).lat, lon: randomElement(cities).lon } : undefined,
        isEncrypted: false,
        createdAt: randomDate(45),
      });
    }

    await db.insert(messages).values(messagesList);
    logger.info(`✅ Created ${messagesList.length} messages`);

    logger.info("✅ Large database seed completed successfully!");
    logger.info("\n📊 Summary:");
    logger.info(`  - ${testUsers.length} users`);
    logger.info(`  - ${testReports.length} disaster reports`);
    logger.info(`  - ${testSOSAlerts.length} SOS alerts`);
    logger.info(`  - ${testResourceRequests.length} resource requests`);
    logger.info(`  - ${testAidOffers.length} aid offers`);
    logger.info(`  - ${testInventoryItems.length} inventory items`);
    logger.info(`  - ${verificationsList.length} verifications`);
    logger.info(`  - ${votesList.length} report votes`);
    logger.info(`  - ${reputationList.length} user reputation records`);
    logger.info(`  - ${notificationsList.length} notifications`);
    logger.info(`  - ${eventsList.length} analytics events`);
    logger.info(`  - ${predictionsList.length} disaster predictions`);
    logger.info(`  - ${testChatRooms.length} chat rooms`);
    logger.info(`  - ${membersList.length} chat room members`);
    logger.info(`  - ${messagesList.length} messages`);
    logger.info("\n🔑 Test Credentials:");
    logger.info("  Email: admin@crisisconnect.com");
    logger.info("  Email: user1@example.com through user99@example.com");
    logger.info("  Password (all users): password123");

  } catch (error) {
    logger.error("Error seeding database:", error as Error);
    throw error;
  }
}

seed()
  .then(() => {
    console.log("✅ Seed completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  });
