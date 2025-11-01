import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Package, Plus, Trash2, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { InventoryItem } from "@shared/schema";
import DashboardLayout from "@/components/layout/DashboardLayout";

export default function ResourceManagement() {
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<string>("all");

  const { data: inventory = [], isLoading } = useQuery<InventoryItem[]>({
    queryKey: ["/api/inventory"],
  });

  const { data: lowStockItems = [] } = useQuery<InventoryItem[]>({
    queryKey: ["/api/inventory/low-stock"],
  });

  const { data: resourceRequests = [] } = useQuery<Array<{
    id: string;
    resourceType: string;
    quantity: number;
    status: string;
  }>>({
    queryKey: ["/api/resource-requests"],
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/api/inventory/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/low-stock"] });
      toast({
        title: "Success",
        description: "Inventory item deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete inventory item",
        variant: "destructive",
      });
    },
  });

  const filteredInventory = selectedType === "all" 
    ? inventory 
    : inventory.filter(item => item.itemType === selectedType);

  const demandPrediction = resourceRequests
    .filter((r) => r.status === "pending")
    .reduce((acc: Record<string, number>, r) => {
      acc[r.resourceType] = (acc[r.resourceType] || 0) + r.quantity;
      return acc;
    }, {});

  const getStockStatus = (item: InventoryItem) => {
    if (item.quantity <= (item.minimumThreshold || 10)) {
      return { label: "Low Stock", variant: "destructive" as const, icon: AlertTriangle };
    }
    if (item.quantity <= (item.minimumThreshold || 10) * 2) {
      return { label: "Medium", variant: "default" as const, icon: TrendingDown };
    }
    return { label: "Healthy", variant: "default" as const, icon: TrendingUp };
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-page-title">Resource Management</h1>
            <p className="text-muted-foreground">Manage your organization's inventory and resources</p>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-inventory">
                <Plus className="mr-2 h-4 w-4" />
                Add Item
              </Button>
            </DialogTrigger>
            <DialogContent>
              <AddInventoryForm onSuccess={() => setIsAddDialogOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card data-testid="card-total-items">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Items</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-items">{inventory.length}</div>
              <p className="text-xs text-muted-foreground">Across all categories</p>
            </CardContent>
          </Card>

          <Card data-testid="card-low-stock">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Low Stock Alerts</CardTitle>
              <AlertCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive" data-testid="text-low-stock-count">
                {lowStockItems.length}
              </div>
              <p className="text-xs text-muted-foreground">Items need restocking</p>
            </CardContent>
          </Card>

          <Card data-testid="card-pending-requests">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Requests</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-pending-requests">
                {resourceRequests.filter((r) => r.status === "pending").length}
              </div>
              <p className="text-xs text-muted-foreground">Resource requests</p>
            </CardContent>
          </Card>
        </div>

        {lowStockItems.length > 0 && (
          <Card className="border-destructive" data-testid="card-alerts">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Low Stock Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {lowStockItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-2 border rounded-lg" data-testid={`alert-item-${item.id}`}>
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-muted-foreground">{item.location}</p>
                    </div>
                    <Badge variant="destructive">
                      {item.quantity} {item.unit} remaining
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {Object.keys(demandPrediction).length > 0 && (
          <Card data-testid="card-demand-prediction">
            <CardHeader>
              <CardTitle>Demand Prediction</CardTitle>
              <CardDescription>Based on pending resource requests</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                {Object.entries(demandPrediction).map(([type, quantity]) => (
                  <div key={type} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`demand-${type}`}>
                    <span className="capitalize font-medium">{type.replace("_", " ")}</span>
                    <Badge>{quantity} units needed</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card data-testid="card-inventory-table">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Inventory Items</CardTitle>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger className="w-[180px]" data-testid="select-filter-type">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="shelter">Shelter</SelectItem>
                  <SelectItem value="food">Food</SelectItem>
                  <SelectItem value="water">Water</SelectItem>
                  <SelectItem value="medical_supplies">Medical Supplies</SelectItem>
                  <SelectItem value="clothing">Clothing</SelectItem>
                  <SelectItem value="blankets">Blankets</SelectItem>
                  <SelectItem value="equipment">Equipment</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">Loading inventory...</div>
            ) : filteredInventory.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No inventory items found. Add your first item to get started.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInventory.map((item) => {
                    const status = getStockStatus(item);
                    const StatusIcon = status.icon;
                    return (
                      <TableRow key={item.id} data-testid={`row-inventory-${item.id}`}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell className="capitalize">{item.itemType.replace("_", " ")}</TableCell>
                        <TableCell>
                          {item.quantity} {item.unit}
                        </TableCell>
                        <TableCell>{item.location}</TableCell>
                        <TableCell>
                          <Badge variant={status.variant} className="gap-1">
                            <StatusIcon className="h-3 w-3" />
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteItemMutation.mutate(item.id)}
                            data-testid={`button-delete-${item.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

function AddInventoryForm({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: "",
    itemType: "food",
    quantity: 0,
    unit: "",
    location: "",
    minimumThreshold: 10,
    description: "",
  });

  const addItemMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("/api/inventory", { method: "POST", body: JSON.stringify(data) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/low-stock"] });
      toast({
        title: "Success",
        description: "Inventory item added successfully",
      });
      onSuccess();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add inventory item",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addItemMutation.mutate(formData);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Add Inventory Item</DialogTitle>
        <DialogDescription>Add a new item to your organization's inventory</DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Item Name</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            data-testid="input-item-name"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="itemType">Type</Label>
          <Select
            value={formData.itemType}
            onValueChange={(value) => setFormData({ ...formData, itemType: value })}
          >
            <SelectTrigger data-testid="select-item-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="shelter">Shelter</SelectItem>
              <SelectItem value="food">Food</SelectItem>
              <SelectItem value="water">Water</SelectItem>
              <SelectItem value="medical_supplies">Medical Supplies</SelectItem>
              <SelectItem value="clothing">Clothing</SelectItem>
              <SelectItem value="blankets">Blankets</SelectItem>
              <SelectItem value="equipment">Equipment</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity</Label>
            <Input
              id="quantity"
              type="number"
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) })}
              required
              data-testid="input-quantity"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="unit">Unit</Label>
            <Input
              id="unit"
              value={formData.unit}
              onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              placeholder="e.g., kg, liters, units"
              required
              data-testid="input-unit"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="location">Location</Label>
          <Input
            id="location"
            value={formData.location}
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            required
            data-testid="input-location"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="minimumThreshold">Minimum Threshold</Label>
          <Input
            id="minimumThreshold"
            type="number"
            value={formData.minimumThreshold}
            onChange={(e) => setFormData({ ...formData, minimumThreshold: parseInt(e.target.value) })}
            data-testid="input-threshold"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description (Optional)</Label>
          <Input
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            data-testid="input-description"
          />
        </div>

        <Button type="submit" className="w-full" disabled={addItemMutation.isPending} data-testid="button-submit-inventory">
          {addItemMutation.isPending ? "Adding..." : "Add Item"}
        </Button>
      </form>
    </>
  );
}
