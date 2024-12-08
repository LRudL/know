export type StreamChunk = {
  type: "text" | "thinking" | "tool_use";
  content: string;
  speakable: boolean;
};

export class StreamParser {
  private buffer: string = "";
  private inThinking: boolean = false;

  parseChunk(chunk: string): StreamChunk[] {
    this.buffer += chunk;
    const chunks: StreamChunk[] = [];

    while (this.buffer.length > 0) {
      const thinkingStartIndex = this.buffer.indexOf("<thinking>");
      const thinkingEndIndex = this.buffer.indexOf("</thinking>");

      if (thinkingStartIndex === -1 && thinkingEndIndex === -1) {
        // No complete tags, keep accumulating
        chunks.push({
          type: this.inThinking ? "thinking" : "text",
          content: this.buffer,
          speakable: !this.inThinking,
        });
        this.buffer = "";
        break;
      }

      if (
        thinkingStartIndex !== -1 &&
        (thinkingStartIndex < thinkingEndIndex || thinkingEndIndex === -1)
      ) {
        // Handle text before <thinking>
        if (thinkingStartIndex > 0) {
          chunks.push({
            type: this.inThinking ? "thinking" : "text",
            content: this.buffer.slice(0, thinkingStartIndex),
            speakable: !this.inThinking,
          });
        }
        this.inThinking = true;
        chunks.push({
          type: "thinking",
          content: "<thinking>",
          speakable: false,
        });
        this.buffer = this.buffer.slice(
          thinkingStartIndex + "<thinking>".length
        );
        continue;
      }

      if (thinkingEndIndex !== -1) {
        // Handle text before </thinking>
        if (thinkingEndIndex > 0) {
          chunks.push({
            type: "thinking",
            content: this.buffer.slice(0, thinkingEndIndex),
            speakable: false,
          });
        }
        this.inThinking = false;
        chunks.push({
          type: "thinking",
          content: "</thinking>",
          speakable: false,
        });
        this.buffer = this.buffer.slice(
          thinkingEndIndex + "</thinking>".length
        );
        continue;
      }
    }

    return chunks;
  }
}
