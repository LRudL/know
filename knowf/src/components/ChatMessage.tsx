import { useEffect, useState } from "react";
import { debug } from "@/lib/debug";

type MessageContent =
  | { type: "text"; text: string }
  | { type: "tool_result"; content: string; tool_use_id: string }
  | { type: "tool_use"; content: string }
  | { type: "thinking"; text: string };

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
    <div className="whitespace-pre-wrap">
      {parts.map((part, index) => {
        if (part === "<thinking>") {
          isThinking = true;
          return null;
        } else if (part === "</thinking>") {
          isThinking = false;
          return null;
        }
        return part ? (
          <span key={index} className={isThinking ? "text-red-500" : ""}>
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
    newContent: string
  ): ChatMessageProps[] {
    if (messages.length === 0) return messages;

    const newMessages = [...messages];
    const lastMessage = { ...newMessages[newMessages.length - 1] };

    if (typeof lastMessage.content === "string") {
      const content = lastMessage.content + newContent;
      const thinkingTagCount = (content.match(/<thinking>/g) || []).length;
      const closingTagCount = (content.match(/<\/thinking>/g) || []).length;

      lastMessage.content = content;

      if (thinkingTagCount > closingTagCount) {
        lastMessage.content += "</thinking>";
      }

      return [...newMessages.slice(0, -1), lastMessage];
    }

    debug.warn("Attempted to update non-string content");
    return messages;
  }
}
