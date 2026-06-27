import { Response } from "express";
import { logger } from "../../utils/logger";
import { randomUUID } from "crypto";
import {
  ObjectAclPolicy,
  ObjectPermission,
  StorageFile,
  canAccessObject,
  getObjectAclPolicy,
  setObjectAclPolicy,
} from "../../middleware/objectAcl";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export class ObjectStorageService {
  constructor() {}

  getPublicObjectSearchPaths(): Array<string> {
    const pathsStr = process.env.PUBLIC_OBJECT_SEARCH_PATHS || "";
    const paths = Array.from(
      new Set(
        pathsStr
          .split(",")
          .map((path) => path.trim())
          .filter((path) => path.length > 0)
      )
    );
    if (paths.length === 0) {
      logger.warn(
        "PUBLIC_OBJECT_SEARCH_PATHS not set. Object storage is disabled. " +
          "Create a bucket in 'Object Storage' tool and set PUBLIC_OBJECT_SEARCH_PATHS env var."
      );
      return [];
    }
    return paths;
  }

  getPrivateObjectDir(): string {
    const dir = process.env.PRIVATE_OBJECT_DIR || "";
    if (!dir) {
      logger.warn(
        "PRIVATE_OBJECT_DIR not set. Object storage is disabled. " +
          "Create a bucket in 'Object Storage' tool and set PRIVATE_OBJECT_DIR env var."
      );
      return "";
    }
    return dir;
  }

  async searchPublicObject(filePath: string): Promise<StorageFile | null> {
    for (const searchPath of this.getPublicObjectSearchPaths()) {
      const fullPath = `${searchPath}/${filePath}`;
      try {
        const exists = await this.objectExists(fullPath);
        if (exists) {
          return { name: fullPath, metadata: {} };
        }
      } catch {
        continue;
      }
    }
    return null;
  }

  async downloadObject(file: StorageFile, res: Response, cacheTtlSec: number = 3600) {
    try {
      const aclPolicy = await getObjectAclPolicy(file);
      const isPublic = aclPolicy?.visibility === "public";

      res.set({
        "Cache-Control": `${isPublic ? "public" : "private"}, max-age=${cacheTtlSec}`,
      });

      const signedUrl = await signObjectURL({
        objectName: file.name,
        method: "GET",
        ttlSec: cacheTtlSec,
      });

      res.redirect(signedUrl);
    } catch (error) {
      logger.error("Error downloading file:", error instanceof Error ? error : undefined);
      if (!res.headersSent) {
        res.status(500).json({ error: "Error downloading file" });
      }
    }
  }

  async getObjectEntityUploadURL(): Promise<string | null> {
    const privateObjectDir = this.getPrivateObjectDir();
    if (!privateObjectDir) {
      return null;
    }

    const objectId = randomUUID();
    const objectName = `${privateObjectDir}/uploads/${objectId}`;

    return signObjectURL({
      objectName,
      method: "PUT",
      ttlSec: 900,
    });
  }

  async getObjectEntityFile(objectPath: string): Promise<StorageFile> {
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }

    const parts = objectPath.slice(1).split("/");
    if (parts.length < 2) {
      throw new ObjectNotFoundError();
    }

    const entityId = parts.slice(1).join("/");
    let entityDir = this.getPrivateObjectDir();
    if (!entityDir.endsWith("/")) {
      entityDir = `${entityDir}/`;
    }
    const objectEntityPath = `${entityDir}${entityId}`;

    const exists = await this.objectExists(objectEntityPath);
    if (!exists) {
      throw new ObjectNotFoundError();
    }
    return { name: objectEntityPath, metadata: {} };
  }

  normalizeObjectEntityPath(rawPath: string): string {
    if (!rawPath.startsWith("https://storage.googleapis.com/")) {
      return rawPath;
    }

    const url = new URL(rawPath);
    const rawObjectPath = url.pathname;

    let objectEntityDir = this.getPrivateObjectDir();
    if (!objectEntityDir.endsWith("/")) {
      objectEntityDir = `${objectEntityDir}/`;
    }

    if (!rawObjectPath.startsWith(objectEntityDir)) {
      return rawObjectPath;
    }

    const entityId = rawObjectPath.slice(objectEntityDir.length);
    return `/objects/${entityId}`;
  }

  async trySetObjectEntityAclPolicy(
    rawPath: string,
    aclPolicy: ObjectAclPolicy
  ): Promise<string> {
    const normalizedPath = this.normalizeObjectEntityPath(rawPath);
    if (!normalizedPath.startsWith("/")) {
      return normalizedPath;
    }

    const objectFile = await this.getObjectEntityFile(normalizedPath);
    await setObjectAclPolicy(objectFile, aclPolicy);
    return normalizedPath;
  }

  async canAccessObjectEntity({
    userId,
    objectFile,
    requestedPermission,
  }: {
    userId?: string;
    objectFile: StorageFile;
    requestedPermission?: ObjectPermission;
  }): Promise<boolean> {
    return canAccessObject({
      userId,
      objectFile,
      requestedPermission: requestedPermission ?? ObjectPermission.READ,
    });
  }

  private async objectExists(objectName: string): Promise<boolean> {
    try {
      const signedUrl = await signObjectURL({ objectName, method: "HEAD", ttlSec: 60 });
      const response = await fetch(signedUrl, { method: "HEAD" });
      return response.ok;
    } catch {
      return false;
    }
  }
}

async function signObjectURL({
  objectName,
  method,
  ttlSec,
}: {
  objectName: string;
  method: "GET" | "PUT" | "DELETE" | "HEAD";
  ttlSec: number;
}): Promise<string> {
  const request = {
    object_name: objectName,
    method,
    expires_at: new Date(Date.now() + ttlSec * 1000).toISOString(),
  };
  const response = await fetch(
    `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    }
  );
  if (!response.ok) {
    throw new Error(
      `Failed to sign object URL, errorcode: ${response.status}, ` +
        `make sure you're running on Replit`
    );
  }

  const { signed_url: signedURL } = await response.json();
  return signedURL;
}
