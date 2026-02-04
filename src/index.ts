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

function jsonResult(payload: any) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
    details: payload,
  };
}

const plugin = {
  id: "dingtalk-assistant",
  name: "DingTalk Developer Assistant",

  register(api: any) {
    const pluginCfg = api.pluginConfig ?? {};
    const client = new DingTalkAssistantClient({
      ...(pluginCfg.baseUrl ? { baseUrl: pluginCfg.baseUrl } : {}),
      ...(pluginCfg.sseBaseUrl ? { sseBaseUrl: pluginCfg.sseBaseUrl } : {}),
    });

    // ── Tool 1: Ask a new question ──────────────────────────────
    api.registerTool({
      name: "dingtalk_ask",
      description:
        "Ask the DingTalk Open Platform Developer Assistant a question about DingTalk APIs, SDKs, development guides, or best practices. Creates a new conversation and returns the answer with suggested follow-up questions. Use this tool whenever users ask about DingTalk development.",
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
      execute: async (_toolCallId: string, args: any) => {
        api.logger?.info(`[dingtalk_ask] called with args: ${JSON.stringify(args)}`);
        const question =
          typeof args?.question === "string" ? args.question.trim() : "";
        if (!question) {
          api.logger?.error(`[dingtalk_ask] empty question, args type: ${typeof args}`);
          return jsonResult({ error: "question parameter is required", receivedArgs: args });
        }

        try {
          api.logger?.info(`[dingtalk_ask] querying: ${question.substring(0, 50)}...`);
          const result = await client.query(question);
          sessions.set("current", result.conversationId);
          api.logger?.info(`[dingtalk_ask] success, conversationId: ${result.conversationId}, answer length: ${result.answer.length}`);

          return jsonResult({
            conversationId: result.conversationId,
            answer: result.answer,
            followUpQuestions: result.followUpQuestions,
            hint: "Use dingtalk_followup with the conversationId to ask follow-up questions.",
          });
        } catch (err: any) {
          api.logger?.error(`[dingtalk_ask] error: ${err.message}`);
          return jsonResult({ error: err.message });
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
      execute: async (_toolCallId: string, args: any) => {
        const question =
          typeof args.question === "string" ? args.question.trim() : "";
        const conversationId =
          typeof args.conversationId === "string"
            ? args.conversationId.trim()
            : sessions.get("current");

        if (!conversationId) {
          return jsonResult({
            error:
              "No active conversation. Use dingtalk_ask first to start a conversation.",
          });
        }

        try {
          const result = await client.followUp(conversationId, question);
          return jsonResult({
            conversationId,
            answer: result.answer,
            followUpQuestions: result.followUpQuestions,
          });
        } catch (err: any) {
          return jsonResult({ error: err.message });
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
      execute: async (_toolCallId: string, args: any) => {
        const conversationId =
          typeof args.conversationId === "string"
            ? args.conversationId.trim()
            : sessions.get("current");

        if (!conversationId) {
          return jsonResult({
            error:
              "No active conversation. Use dingtalk_ask first to start a conversation.",
          });
        }

        try {
          const history = await client.getHistory(conversationId);
          return jsonResult({
            conversationId,
            dialog: history.dialog.map((d) => ({
              question: d.question,
              answer: d.answer.answer,
              time: d.createTime,
            })),
          });
        } catch (err: any) {
          return jsonResult({ error: err.message });
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
      execute: async (_toolCallId: string, args: any) => {
        const pageUrl =
          typeof args.pageUrl === "string" ? args.pageUrl.trim() : "";
        if (!pageUrl) {
          return jsonResult({ error: "pageUrl parameter is required" });
        }

        try {
          const questions = await client.getRecommendedQuestions(pageUrl);
          return jsonResult({ recommendedQuestions: questions });
        } catch (err: any) {
          return jsonResult({ error: err.message });
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
            result.followUpQuestions.forEach((q: string, i: number) => {
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
