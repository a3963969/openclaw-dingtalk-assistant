/**
 * OpenClaw Plugin: DingTalk Developer Assistant
 *
 * Registers agent tools that let OpenClaw query the DingTalk Open Platform
 * AI Developer Assistant for API docs, development guidance, and best
 * practices.
 */

import { DingTalkAssistantClient } from "./dingtalk-client.js";

// Track active conversations per agent session
const sessions = new Map<string, string>();

const plugin = {
  id: "dingtalk-assistant",
  name: "DingTalk Developer Assistant",

  register(api: any) {
    const config = api.config ?? {};
    const client = new DingTalkAssistantClient({
      baseUrl: config.baseUrl,
      sseBaseUrl: config.sseBaseUrl,
    });

    // ── Tool 1: Ask a new question ──────────────────────────────
    api.registerTool({
      name: "dingtalk_ask",
      description:
        "Ask the DingTalk Open Platform Developer Assistant a question about DingTalk APIs, SDKs, development guides, or best practices. Creates a new conversation and returns the answer with suggested follow-up questions.",
      parameters: {
        type: "object",
        properties: {
          question: {
            type: "string",
            description:
              "The question to ask, in Chinese or English. Examples: '如何创建钉钉机器人？', 'How to use the DingTalk OAuth API?'",
          },
        },
        required: ["question"],
      },
      handler: async ({ question }: { question: string }) => {
        try {
          const result = await client.query(question);
          sessions.set("current", result.conversationId);

          return {
            conversationId: result.conversationId,
            answer: result.answer,
            followUpQuestions: result.followUpQuestions,
            hint: "Use dingtalk_followup with the conversationId to ask follow-up questions.",
          };
        } catch (err: any) {
          return { error: err.message };
        }
      },
    });

    // ── Tool 2: Follow-up in existing conversation ──────────────
    api.registerTool({
      name: "dingtalk_followup",
      description:
        "Continue an existing conversation with the DingTalk Developer Assistant. Requires a conversationId from a previous dingtalk_ask call.",
      parameters: {
        type: "object",
        properties: {
          conversationId: {
            type: "string",
            description:
              "The conversation ID returned by a previous dingtalk_ask call. If omitted, uses the most recent conversation.",
          },
          question: {
            type: "string",
            description: "The follow-up question to ask.",
          },
        },
        required: ["question"],
      },
      handler: async ({
        conversationId,
        question,
      }: {
        conversationId?: string;
        question: string;
      }) => {
        const id = conversationId ?? sessions.get("current");
        if (!id) {
          return {
            error:
              "No active conversation. Use dingtalk_ask first to start a conversation.",
          };
        }

        try {
          const result = await client.followUp(id, question);
          return {
            conversationId: id,
            answer: result.answer,
            followUpQuestions: result.followUpQuestions,
          };
        } catch (err: any) {
          return { error: err.message };
        }
      },
    });

    // ── Tool 3: Get conversation history ────────────────────────
    api.registerTool({
      name: "dingtalk_history",
      description:
        "Retrieve the full conversation history from a DingTalk Developer Assistant session.",
      parameters: {
        type: "object",
        properties: {
          conversationId: {
            type: "string",
            description:
              "The conversation ID. If omitted, uses the most recent conversation.",
          },
        },
      },
      handler: async ({
        conversationId,
      }: {
        conversationId?: string;
      }) => {
        const id = conversationId ?? sessions.get("current");
        if (!id) {
          return {
            error:
              "No active conversation. Use dingtalk_ask first to start a conversation.",
          };
        }

        try {
          const history = await client.getHistory(id);
          return {
            conversationId: id,
            dialog: history.dialog.map((d) => ({
              question: d.question,
              answer: d.answer.answer,
              time: d.createTime,
            })),
          };
        } catch (err: any) {
          return { error: err.message };
        }
      },
    });

    // ── Tool 4: Get recommended questions for a doc page ────────
    api.registerTool({
      name: "dingtalk_recommend",
      description:
        "Get AI-recommended questions for a specific DingTalk documentation page URL.",
      parameters: {
        type: "object",
        properties: {
          pageUrl: {
            type: "string",
            description:
              "The DingTalk documentation page URL. Example: https://open.dingtalk.com/document/dingstart/start-overview",
          },
        },
        required: ["pageUrl"],
      },
      handler: async ({ pageUrl }: { pageUrl: string }) => {
        try {
          const questions = await client.getRecommendedQuestions(pageUrl);
          return { recommendedQuestions: questions };
        } catch (err: any) {
          return { error: err.message };
        }
      },
    });

    // ── Auto-reply command: /dingtalk ────────────────────────────
    api.registerCommand({
      name: "dingtalk",
      description:
        "Quick-ask the DingTalk Developer Assistant (e.g. /dingtalk 如何获取access_token)",
      acceptsArgs: true,
      handler: async (ctx: any) => {
        const question = ctx.args?.trim();
        if (!question) {
          return {
            text: "Usage: /dingtalk <your question>\nExample: /dingtalk 如何创建钉钉机器人？",
          };
        }

        try {
          const result = await client.query(question);
          sessions.set("current", result.conversationId);

          let text = result.answer;
          if (result.followUpQuestions.length > 0) {
            text += "\n\n---\n**Suggested follow-ups:**\n";
            result.followUpQuestions.forEach((q, i) => {
              text += `${i + 1}. ${q}\n`;
            });
          }
          return { text };
        } catch (err: any) {
          return { text: `Error: ${err.message}` };
        }
      },
    });

    api.logger?.info("[dingtalk-assistant] Plugin registered successfully");
  },
};

export default function register(api: any) {
  plugin.register(api);
}
