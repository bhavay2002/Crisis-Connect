import type { Express } from "express";
import { storage } from "../db/storage";
import { isAuthenticated } from "../auth/replitAuth";
import { insertInventoryItemSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";

export function registerInventoryRoutes(app: Express) {
  // Get all inventory items (Admin/NGO only)
  app.get("/api/inventory", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user || !["admin", "ngo"].includes(user.role as string)) {
        return res.status(403).json({ message: "Access denied. Admin or NGO role required." });
      }

      const items = await storage.getAllInventoryItems();
      res.json(items);
    } catch (error) {
      console.error("Error fetching inventory items:", error);
      res.status(500).json({ message: "Failed to fetch inventory items" });
    }
  });

  // Get low stock items (Admin/NGO only)
  app.get("/api/inventory/low-stock", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user || !["admin", "ngo"].includes(user.role as string)) {
        return res.status(403).json({ message: "Access denied. Admin or NGO role required." });
      }

      const items = await storage.getLowStockItems();
      res.json(items);
    } catch (error) {
      console.error("Error fetching low stock items:", error);
      res.status(500).json({ message: "Failed to fetch low stock items" });
    }
  });

  // Get specific inventory item (Admin/NGO only)
  app.get("/api/inventory/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user || !["admin", "ngo"].includes(user.role as string)) {
        return res.status(403).json({ message: "Access denied. Admin or NGO role required." });
      }

      const item = await storage.getInventoryItem(req.params.id);
      if (!item) {
        return res.status(404).json({ message: "Inventory item not found" });
      }
      res.json(item);
    } catch (error) {
      console.error("Error fetching inventory item:", error);
      res.status(500).json({ message: "Failed to fetch inventory item" });
    }
  });

  // Create new inventory item (Admin/NGO only)
  app.post("/api/inventory", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user || !["admin", "ngo"].includes(user.role as string)) {
        return res.status(403).json({ message: "Access denied. Admin or NGO role required." });
      }

      const validationResult = insertInventoryItemSchema.safeParse(req.body);
      if (!validationResult.success) {
        const errorMessage = fromZodError(validationResult.error);
        return res.status(400).json({ message: errorMessage.toString() });
      }

      const item = await storage.createInventoryItem({
        ...validationResult.data,
        managedBy: userId,
      });
      res.json(item);
    } catch (error) {
      console.error("Error creating inventory item:", error);
      res.status(500).json({ message: "Failed to create inventory item" });
    }
  });

  // Update inventory quantity (Admin/NGO only)
  app.patch("/api/inventory/:id/quantity", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user || !["admin", "ngo"].includes(user.role as string)) {
        return res.status(403).json({ message: "Access denied. Admin or NGO role required." });
      }

      const { quantity } = req.body;
      if (typeof quantity !== "number") {
        return res.status(400).json({ message: "Invalid quantity" });
      }

      const item = await storage.updateInventoryQuantity(req.params.id, quantity);
      if (!item) {
        return res.status(404).json({ message: "Inventory item not found" });
      }
      res.json(item);
    } catch (error) {
      console.error("Error updating inventory quantity:", error);
      res.status(500).json({ message: "Failed to update inventory quantity" });
    }
  });

  // Delete inventory item (Admin/NGO only)
  app.delete("/api/inventory/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user || !["admin", "ngo"].includes(user.role as string)) {
        return res.status(403).json({ message: "Access denied. Admin or NGO role required." });
      }

      await storage.deleteInventoryItem(req.params.id);
      res.json({ message: "Inventory item deleted successfully" });
    } catch (error) {
      console.error("Error deleting inventory item:", error);
      res.status(500).json({ message: "Failed to delete inventory item" });
    }
  });
}
