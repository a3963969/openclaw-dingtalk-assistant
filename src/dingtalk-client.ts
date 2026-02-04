/**
 * DingTalk Open Platform Developer Assistant API Client
 *
 * API flow captured from https://open.dingtalk.com :
 *   1. POST /api/open/coding/conversation           → create conversation
 *   2. GET  /api/open/sse/coding/completions (SSE)   → stream answer
 *   3. GET  /api/open/coding/conversation/:id        → fetch history
 *   4. GET  /api/open/coding/followup/recommend      → recommended questions
 */

export interface DingTalkConfig {
  baseUrl: string;
  sseBaseUrl: string;
}

export interface ConversationResult {
  conversationId: string;
  query: string;
  status: number;
  createdAt: string;
  dialog: DialogEntry[];
}

export interface DialogEntry {
  question: string;
  questionId: string;
  answer: {
    answerId: string;
    answer: string;
    messageType: string;
    extInfo: string;
  };
  createTime: string;
}

export interface SSEMessage {
  data: string;
  type: string;
  inDialog?: boolean;
}

const DEFAULT_CONFIG: DingTalkConfig = {
  baseUrl: "https://open.dingtalk.com",
  sseBaseUrl: "https://open.dingtalk.com",
};

export class DingTalkAssistantClient {
  private config: DingTalkConfig;

  constructor(config?: Partial<DingTalkConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Step 1: Create a new conversation session.
   * The API requires the initial query to be provided at creation time.
   */
  async createConversation(query: string): Promise<string> {
    const resp = await fetch(
      `${this.config.baseUrl}/api/open/coding/conversation`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      }
    );

    if (!resp.ok) {
      throw new Error(
        `Failed to create conversation: ${resp.status} ${resp.statusText}`
      );
    }

    const json = await resp.json();
    if (!json.success) {
      throw new Error(
        `API error creating conversation: ${JSON.stringify(json)}`
      );
    }

    return json.result.conversationId;
  }

  /**
   * Step 2: Send a question and collect the full SSE streamed answer.
   */
  async ask(conversationId: string, query: string): Promise<string> {
    const url = new URL(
      "/api/open/sse/coding/completions",
      this.config.sseBaseUrl
    );
    url.searchParams.set("conversationId", conversationId);
    url.searchParams.set("query", query);

    const resp = await fetch(url.toString(), {
      headers: { Accept: "text/event-stream" },
    });

    if (!resp.ok) {
      throw new Error(`SSE request failed: ${resp.status} ${resp.statusText}`);
    }

    const text = await resp.text();
    return this.parseSSEResponse(text);
  }

  /**
   * Step 3: Get conversation history.
   */
  async getHistory(conversationId: string): Promise<ConversationResult> {
    const resp = await fetch(
      `${this.config.baseUrl}/api/open/coding/conversation/${conversationId}`,
      { headers: { "Content-Type": "application/json" } }
    );

    if (!resp.ok) {
      throw new Error(
        `Failed to get history: ${resp.status} ${resp.statusText}`
      );
    }

    const json = await resp.json();
    if (!json.success) {
      throw new Error(`API error getting history: ${JSON.stringify(json)}`);
    }

    return json.result as ConversationResult;
  }

  /**
   * Step 4: Get recommended follow-up questions for a documentation page.
   */
  async getRecommendedQuestions(
    askPageUrl: string,
    scene: string = "ai_doc_recommend"
  ): Promise<string[]> {
    const url = new URL(
      "/api/open/coding/followup/recommend",
      this.config.baseUrl
    );
    url.searchParams.set("scene", scene);
    url.searchParams.set("askPageUrl", askPageUrl);

    const resp = await fetch(url.toString());
    if (!resp.ok) {
      return [];
    }

    const json = await resp.json();
    return json.result ?? [];
  }

  /**
   * Convenience: create a conversation, ask a question, return the answer.
   */
  async query(question: string): Promise<{
    conversationId: string;
    answer: string;
    followUpQuestions: string[];
  }> {
    const conversationId = await this.createConversation(question);
    const answer = await this.ask(conversationId, question);

    // Extract follow-up questions from the SSE stream if present
    const followUpQuestions = this.extractFollowUps(answer);

    return {
      conversationId,
      answer: this.cleanAnswer(answer),
      followUpQuestions,
    };
  }

  /**
   * Continue an existing conversation with a follow-up question.
   */
  async followUp(
    conversationId: string,
    question: string
  ): Promise<{
    answer: string;
    followUpQuestions: string[];
  }> {
    const answer = await this.ask(conversationId, question);
    const followUpQuestions = this.extractFollowUps(answer);

    return {
      answer: this.cleanAnswer(answer),
      followUpQuestions,
    };
  }

  // ---------- internal helpers ----------

  private parseSSEResponse(raw: string): string {
    const lines = raw.split("\n");
    const chunks: string[] = [];

    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload) continue;

      try {
        const msg: SSEMessage = JSON.parse(payload);
        if (msg.data) {
          chunks.push(msg.data);
        }
      } catch {
        // non-JSON data line, append as-is
        chunks.push(payload);
      }
    }

    return chunks.join("");
  }

  private extractFollowUps(fullText: string): string[] {
    // Follow-up questions are sent as the last SSE chunk in JSON array format
    const match = fullText.match(/\["\u5982\u4f55.*?"\]|\["[^"]+?"(?:,"[^"]+?")*\]$/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return [];
      }
    }
    return [];
  }

  private cleanAnswer(fullText: string): string {
    // Remove trailing follow-up JSON array if present
    return fullText
      .replace(/\["[^"]+?"(?:,"[^"]+?")*\]$/, "")
      .trim();
  }
}
