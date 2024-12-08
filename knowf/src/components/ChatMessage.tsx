import { useEffect, useState } from "react";
import { debug } from "@/lib/debug";
import { StreamChunk } from "@/lib/streamParser";

export type ToolUseContent = {
  type: "tool_use";
  tool_use_id: string;
  content: string;
};

export type NodeJudgementToolUseCall = {
  id: string;
  name: string;
  type: "tool_use";
  input: {
    node_id: number;
    judgement: string;
  };
};

export type MessageContent =
  | { type: "text"; text: string }
  | { type: "thinking"; content: string }
  | { type: "tool_use"; content: ToolUseContent[]; toolId: string }
  | { type: "tool_result"; content: string; tool_use_id: string };

export interface ChatMessageProps {
  role: "user" | "assistant";
  content: string | MessageContent | (string | MessageContent)[];
  isLatest?: boolean;
}

const renderToolResult = (result: { content: string; tool_use_id: string }) => {
  try {
    const parsedContent = JSON.parse(result.content);
    return (
      <div key={result.tool_use_id} className="tool-result">
        <div className="text-xs text-gray-500">Tool Result:</div>
        <pre className="bg-gray-50 p-2 rounded text-sm overflow-x-auto">
          {JSON.stringify(parsedContent, null, 2)}
        </pre>
      </div>
    );
  } catch {
    return (
      <div key={result.tool_use_id} className="tool-result">
        <div className="text-xs text-gray-500">Tool Result:</div>
        <div className="whitespace-pre-wrap">{result.content}</div>
      </div>
    );
  }
};

const renderThinkingText = (text: string) => {
  const parts = text.split(/(<thinking>|<\/thinking>)/);
  let isThinking = false;

  return (
    <div style={{ whiteSpace: "pre-wrap" }}>
      {parts.map((part, index) => {
        if (part === "<thinking>") {
          isThinking = true;
          return (
            <span key={`tag-${index}`} className="text-red-500">
              &lt;thinking&gt;
            </span>
          );
        }
        if (part === "</thinking>") {
          isThinking = false;
          return (
            <span key={`tag-${index}`} className="text-red-500">
              &lt;/thinking&gt;
            </span>
          );
        }
        return part ? (
          <span
            key={index}
            className={isThinking ? "text-red-500" : ""}
            style={{ whiteSpace: "pre-wrap" }}
          >
            {part}
          </span>
        ) : null;
      })}
    </div>
  );
};

const contentRenderers = {
  text: (content: { text: string }) => renderThinkingText(content.text),
  tool_result: renderToolResult,
  tool_use: (content: { content: string }) => (
    <div className="whitespace-pre-wrap">
      <div className="text-xs text-gray-500">Tool Use:</div>
      {content.content}
    </div>
  ),
  raw: (text: string) => renderThinkingText(text),
};

const renderContentItem = (item: string | MessageContent) => {
  if (typeof item === "string") {
    return contentRenderers.raw(item);
  }

  const renderer = contentRenderers[item.type as keyof typeof contentRenderers];
  if (!renderer) {
    debug.warn(`No renderer for content type: ${item.type}`);
    return (
      <pre className="bg-gray-50 p-2 rounded text-sm overflow-x-auto">
        {JSON.stringify(item, null, 2)}
      </pre>
    );
  }

  return renderer(item as any);
};

export const ChatMessage = ({
  role,
  content,
  isLatest = false,
}: ChatMessageProps) => {
  const [displayContent, setDisplayContent] = useState(content);

  useEffect(() => {
    setDisplayContent(content);
  }, [content]);

  /*debug.log("[ChatMessage] Rendering message:", {
    role,
    content: displayContent,
    isLatest,
  });*/

  if (Array.isArray(displayContent)) {
    return (
      <div className="space-y-2">
        {displayContent.map((item, index) => (
          <div
            key={index}
            className={`p-4 rounded-lg ${
              role === "user"
                ? "bg-blue-100 ml-auto max-w-[80%]"
                : "bg-gray-100 mr-auto max-w-[80%]"
            }`}
          >
            {renderContentItem(item)}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      className={`p-4 rounded-lg mb-2 ${
        role === "user"
          ? "bg-blue-100 ml-auto max-w-[80%]"
          : "bg-gray-100 mr-auto max-w-[80%]"
      }`}
    >
      {renderContentItem(displayContent)}
    </div>
  );
};

export class ChatMessageManager {
  static renderMessage(message: ChatMessageProps) {
    return <ChatMessage {...message} />;
  }

  static updateLatestMessage(
    messages: ChatMessageProps[],
    chunks: StreamChunk[]
  ): ChatMessageProps[] {
    if (messages.length === 0) return messages;

    const newMessages = [...messages];
    const lastMessage = { ...newMessages[newMessages.length - 1] };

    // Convert chunks to text content and handle escaping
    const unescapedContent = chunks
      .map((chunk) => {
        const content = chunk.content
          .replace(/\\n/g, "\n")
          .replace(/\\\\/g, "\\")
          .replace(/\\\n/g, "\n")
          .replace(/\\$/g, "");

        // Don't wrap thinking content in tags - they're already in the content
        return content;
      })
      .join("");

    if (typeof lastMessage.content === "string") {
      lastMessage.content = lastMessage.content + unescapedContent;
    } else if (
      typeof lastMessage.content === "object" &&
      "type" in lastMessage.content &&
      lastMessage.content.type === "text"
    ) {
      lastMessage.content = {
        type: "text",
        text: lastMessage.content.text + unescapedContent,
      };
    } else {
      debug.warn("Unexpected content type:", typeof lastMessage.content);
      return messages;
    }

    return [...newMessages.slice(0, -1), lastMessage];
  }
}
