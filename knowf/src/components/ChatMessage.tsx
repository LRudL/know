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
  showDebugInfo?: boolean;
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

const renderThinkingText = (text: string, showDebugInfo: boolean) => {
  if (!showDebugInfo) {
    return text.replace(/<thinking>.*?<\/thinking>/gs, "");
  }

  const parts = text.split(/(<thinking>|<\/thinking>)/);
  let isThinking = false;

  return (
    <div style={{ whiteSpace: "pre-wrap" }}>
      {parts.map((part, index) => {
        if (part === "<thinking>") {
          isThinking = true;
          return (
            <span key={`tag-${index}`} className="text-blue-500">
              &lt;thinking&gt;
            </span>
          );
        }
        if (part === "</thinking>") {
          isThinking = false;
          return (
            <span key={`tag-${index}`} className="text-blue-500">
              &lt;/thinking&gt;
            </span>
          );
        }
        return part ? (
          <span
            key={index}
            className={isThinking ? "text-blue-500" : ""}
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
  text: (content: { text: string }, showDebugInfo: boolean) =>
    renderThinkingText(content.text, showDebugInfo),
  tool_result: (
    content: { content: string; tool_use_id: string },
    showDebugInfo: boolean
  ) => (showDebugInfo ? renderToolResult(content) : null),
  tool_use: (content: any, showDebugInfo: boolean) => {
    if (!showDebugInfo) return null;

    return (
      <div className="whitespace-pre-wrap">
        {typeof content === "string"
          ? content
          : JSON.stringify(content, null, 2)}
      </div>
    );
  },
  raw: (text: string, showDebugInfo: boolean) =>
    renderThinkingText(text, showDebugInfo),
};

const renderContentItem = (
  item: string | MessageContent,
  showDebugInfo: boolean
) => {
  if (typeof item === "string") {
    return contentRenderers.raw(item, showDebugInfo);
  }

  const renderer = contentRenderers[item.type as keyof typeof contentRenderers];
  if (!renderer) {
    if (showDebugInfo) {
      debug.warn(`No renderer for content type: ${item.type}`);
      return (
        <pre className="bg-gray-50 p-2 rounded text-sm overflow-x-auto">
          {JSON.stringify(item, null, 2)}
        </pre>
      );
    }
    return null;
  }

  return renderer(item as any, showDebugInfo);
};

export const ChatMessage = ({
  role,
  content,
  isLatest = false,
  showDebugInfo = false,
}: ChatMessageProps) => {
  const [displayContent, setDisplayContent] = useState(content);

  useEffect(() => {
    setDisplayContent(content);
  }, [content]);

  if (Array.isArray(displayContent)) {
    return (
      <div className="space-y-2">
        {displayContent.map((item, index) => {
          const renderedContent = renderContentItem(item, showDebugInfo);
          if (!renderedContent) return null;

          return (
            <div
              key={index}
              className={`p-4 rounded-lg ${
                role === "user"
                  ? "bg-blue-100 ml-auto max-w-[80%]"
                  : "bg-gray-100 mr-auto max-w-[80%]"
              }`}
            >
              {renderedContent}
            </div>
          );
        })}
      </div>
    );
  }

  const renderedContent = renderContentItem(displayContent, showDebugInfo);
  if (!renderedContent) return null;

  return (
    <div
      className={`p-4 rounded-lg mb-2 ${
        role === "user"
          ? "bg-blue-100 ml-auto max-w-[80%]"
          : "bg-gray-100 mr-auto max-w-[80%]"
      }`}
    >
      {renderedContent}
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
