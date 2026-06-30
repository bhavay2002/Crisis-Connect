import { useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface ObjectUploaderProps {
  maxNumberOfFiles?: number;
  maxFileSize?: number;
  allowedFileTypes?: string[];
  onGetUploadParameters: () => Promise<{
    method: "PUT";
    url: string;
  }>;
  onComplete?: (result: { successful: Array<{ name: string; uploadURL: string }> }) => void;
  buttonClassName?: string;
  buttonVariant?: "default" | "outline" | "secondary" | "ghost" | "destructive";
  children: ReactNode;
}

export function ObjectUploader({
  maxNumberOfFiles = 5,
  maxFileSize = 10485760,
  allowedFileTypes,
  onGetUploadParameters,
  onComplete,
  buttonClassName,
  buttonVariant = "outline",
  children,
}: ObjectUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const acceptAttr = allowedFileTypes?.join(",");

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files).slice(0, maxNumberOfFiles);
    const successful: Array<{ name: string; uploadURL: string }> = [];

    for (const file of fileArray) {
      if (maxFileSize && file.size > maxFileSize) {
        continue;
      }
      try {
        const { url } = await onGetUploadParameters();
        await fetch(url, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type },
        });
        successful.push({ name: file.name, uploadURL: url });
      } catch {
        // skip failed uploads silently
      }
    }

    onComplete?.({ successful });
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={acceptAttr}
        multiple={maxNumberOfFiles > 1}
        className="hidden"
        data-testid="input-file-upload"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <Button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={buttonClassName}
        variant={buttonVariant}
        data-testid="button-upload"
      >
        {children}
      </Button>
    </div>
  );
}
