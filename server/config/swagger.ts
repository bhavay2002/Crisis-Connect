import swaggerJsdoc from "swagger-jsdoc";
import type { Options } from "swagger-jsdoc";

const options: Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Crisis Connect API",
      version: "1.0.0",
      description: "Real-time disaster management and emergency response coordination API",
      contact: {
        name: "API Support",
        email: "support@crisisconnect.io",
      },
      license: {
        name: "MIT",
        url: "https://opensource.org/licenses/MIT",
      },
    },
    servers: [
      {
        url: "/api/v1",
        description: "Version 1 API",
      },
    ],
    components: {
      securitySchemes: {
        cookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: "connect.sid",
          description: "Session cookie authentication",
        },
      },
      schemas: {
        Error: {
          type: "object",
          required: ["success", "error"],
          properties: {
            success: {
              type: "boolean",
              example: false,
            },
            error: {
              type: "object",
              required: ["message", "statusCode"],
              properties: {
                message: {
                  type: "string",
                  example: "Resource not found",
                },
                code: {
                  type: "string",
                  example: "NOT_FOUND",
                },
                statusCode: {
                  type: "integer",
                  example: 404,
                },
                details: {
                  type: "object",
                },
              },
            },
          },
        },
        PaginationMeta: {
          type: "object",
          properties: {
            page: {
              type: "integer",
              example: 1,
            },
            limit: {
              type: "integer",
              example: 10,
            },
            total: {
              type: "integer",
              example: 100,
            },
            totalPages: {
              type: "integer",
              example: 10,
            },
            hasNext: {
              type: "boolean",
              example: true,
            },
            hasPrev: {
              type: "boolean",
              example: false,
            },
          },
        },
        DisasterReport: {
          type: "object",
          properties: {
            id: {
              type: "string",
              example: "report-123",
            },
            title: {
              type: "string",
              example: "Flooding in Downtown Area",
            },
            description: {
              type: "string",
              example: "Heavy rainfall causing severe flooding",
            },
            type: {
              type: "string",
              enum: ["flood", "earthquake", "fire", "cyclone", "landslide", "other"],
              example: "flood",
            },
            severity: {
              type: "string",
              enum: ["low", "medium", "high", "critical"],
              example: "high",
            },
            status: {
              type: "string",
              enum: ["reported", "verified", "responding", "resolved"],
              example: "reported",
            },
            location: {
              type: "string",
              example: "Downtown District",
            },
            latitude: {
              type: "number",
              example: 28.6139,
            },
            longitude: {
              type: "number",
              example: 77.2090,
            },
            userId: {
              type: "string",
              example: "user-123",
            },
            createdAt: {
              type: "string",
              format: "date-time",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
            },
          },
        },
      },
      parameters: {
        PageParam: {
          name: "page",
          in: "query",
          description: "Page number for pagination",
          required: false,
          schema: {
            type: "integer",
            minimum: 1,
            default: 1,
          },
        },
        LimitParam: {
          name: "limit",
          in: "query",
          description: "Number of items per page (max 100)",
          required: false,
          schema: {
            type: "integer",
            minimum: 1,
            maximum: 100,
            default: 10,
          },
        },
        SortByParam: {
          name: "sortBy",
          in: "query",
          description: "Field to sort by",
          required: false,
          schema: {
            type: "string",
          },
        },
        SortOrderParam: {
          name: "sortOrder",
          in: "query",
          description: "Sort order (ascending or descending)",
          required: false,
          schema: {
            type: "string",
            enum: ["asc", "desc"],
            default: "desc",
          },
        },
      },
      responses: {
        Unauthorized: {
          description: "Unauthorized - Authentication required",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/Error",
              },
            },
          },
        },
        Forbidden: {
          description: "Forbidden - Insufficient permissions",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/Error",
              },
            },
          },
        },
        NotFound: {
          description: "Resource not found",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/Error",
              },
            },
          },
        },
        ValidationError: {
          description: "Validation error",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/Error",
              },
            },
          },
        },
        RateLimitExceeded: {
          description: "Rate limit exceeded",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/Error",
              },
            },
          },
        },
        InternalServerError: {
          description: "Internal server error",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/Error",
              },
            },
          },
        },
      },
    },
    security: [
      {
        cookieAuth: [],
      },
    ],
    tags: [
      {
        name: "Authentication",
        description: "User authentication and authorization endpoints",
      },
      {
        name: "Reports",
        description: "Disaster report management",
      },
      {
        name: "Resources",
        description: "Resource request management",
      },
      {
        name: "Aid",
        description: "Aid offer management",
      },
      {
        name: "SOS",
        description: "Emergency SOS alert system",
      },
      {
        name: "Chat",
        description: "Real-time chat and messaging",
      },
      {
        name: "Analytics",
        description: "Analytics and statistics",
      },
      {
        name: "Inventory",
        description: "Inventory management for NGOs",
      },
    ],
  },
  apis: ["./server/routes/**/*.ts", "./server/routes/*.ts"],
};

export const swaggerSpec = swaggerJsdoc(options);
