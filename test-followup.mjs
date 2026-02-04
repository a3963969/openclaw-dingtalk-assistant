/**
 * Test follow-up conversation flow
 */
const BASE_URL = "https://open.dingtalk.com";
const SSE_BASE_URL = "https://open.dingtalk.com";

async function main() {
  // Step 1: Create conversation with initial question
  console.log("=== Follow-up Test ===\n");
  console.log("1. Creating conversation with initial question...");

  const createResp = await fetch(`${BASE_URL}/api/open/coding/conversation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: "钉钉机器人支持哪些消息类型？" }),
  });
  const createJson = await createResp.json();
  const conversationId = createJson.result.conversationId;
  console.log(`   ConversationId: ${conversationId}`);

  // Step 2: Ask initial question via SSE
  console.log("\n2. Getting answer for initial question...");
  const sseUrl1 = `${SSE_BASE_URL}/api/open/sse/coding/completions?conversationId=${conversationId}&query=${encodeURIComponent("钉钉机器人支持哪些消息类型？")}`;
  const sseResp1 = await fetch(sseUrl1, { headers: { Accept: "text/event-stream" } });
  const text1 = await sseResp1.text();
  const answer1 = parseSSE(text1);
  console.log(`   Answer (${answer1.length} chars): ${answer1.substring(0, 150)}...`);

  // Step 3: Follow-up question in same conversation
  console.log("\n3. Follow-up question in same conversation...");
  const sseUrl2 = `${SSE_BASE_URL}/api/open/sse/coding/completions?conversationId=${conversationId}&query=${encodeURIComponent("Markdown类型的消息怎么发送？给一个代码示例")}`;
  const sseResp2 = await fetch(sseUrl2, { headers: { Accept: "text/event-stream" } });
  const text2 = await sseResp2.text();
  const answer2 = parseSSE(text2);
  console.log(`   Answer (${answer2.length} chars): ${answer2.substring(0, 150)}...`);

  // Step 4: Verify history has both Q&A
  console.log("\n4. Verifying history...");
  const histResp = await fetch(`${BASE_URL}/api/open/coding/conversation/${conversationId}`, {
    headers: { "Content-Type": "application/json" },
  });
  const histJson = await histResp.json();
  console.log(`   Dialog count: ${histJson.result.dialog.length}`);
  for (const d of histJson.result.dialog) {
    console.log(`   Q: ${d.question}`);
    console.log(`   A: ${d.answer.answer.substring(0, 80)}...`);
    console.log();
  }

  console.log("=== Follow-up test completed ===");
}

function parseSSE(raw) {
  const chunks = [];
  for (const line of raw.split("\n")) {
    if (!line.startsWith("data:")) continue;
    const payload = line.slice(5).trim();
    if (!payload) continue;
    try {
      const msg = JSON.parse(payload);
      if (msg.data) chunks.push(msg.data);
    } catch { chunks.push(payload); }
  }
  return chunks.join("");
}

main().catch(err => { console.error(err); process.exit(1); });
