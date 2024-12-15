"use client";
import { Button, Card, Flex, Text } from "@radix-ui/themes";
import { UploadIcon, FileIcon } from "@radix-ui/react-icons";
import { Document } from "@/lib/documentService";
import { useRef } from "react";

interface UploadButtonProps {
  uploading: boolean;
  uploaded: boolean;
  documents: Document[];
  isGeneratingState: boolean;
  onUpload: React.ChangeEventHandler<HTMLInputElement>;
  onStartSession: React.MouseEventHandler<HTMLButtonElement>;
}

export const UploadButton = ({
  uploading,
  uploaded,
  documents,
  isGeneratingState,
  onUpload,
  onStartSession,
}: UploadButtonProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  if (uploading) {
    return (
      <Card
        style={{
          width: "100%",
          maxWidth: "600px",
          padding: "var(--space-4)",
        }}
      >
        <Flex direction="column" justify="center" align="center" gap="3">
          <Text size="3" weight="regular">
            Uploading...
          </Text>
        </Flex>
      </Card>
    );
  }

  if (uploaded) {
    return (
      <Card
        style={{
          width: "100%",
          maxWidth: "600px",
          padding: "var(--space-4)",
        }}
      >
        <Flex direction="column" justify="center" align="center" gap="3">
          <FileIcon width="24" height="24" />
          <Text size="2" weight="light">
            {documents?.at(-1)?.title}
          </Text>
          <Button
            disabled={isGeneratingState}
            onClick={onStartSession}
            size="2"
            variant="solid"
          >
            {isGeneratingState ? "Processing..." : "Start Processing"}
          </Button>
        </Flex>
      </Card>
    );
  }

  return (
    <Card
      style={{
        width: "100%",
        maxWidth: "600px",
        padding: "var(--space-4)",
      }}
    >
      <Flex direction="column" justify="center" align="center" gap="3">
        <input
          ref={fileInputRef}
          type="file"
          onChange={onUpload}
          style={{ display: "none" }}
          accept=".pdf,application/pdf"
        />
        <Button
          size="3"
          variant="solid"
          style={{ width: "100%" }}
          onClick={handleClick}
        >
          <UploadIcon width="16" height="16" />
          Upload PDF
        </Button>
      </Flex>
    </Card>
  );
};
