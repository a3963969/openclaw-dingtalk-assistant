/**
 * Standalone test for DingTalk Developer Assistant API
 * Run: node test.mjs
 */

const BASE_URL = "https://open.dingtalk.com";
const SSE_BASE_URL = "https://power.dingtalk.com";

// ── Step 1: Create conversation ─────────────────────────────────
async function createConversation(query) {
  console.log("Step 1: Creating conversation...");
  const resp = await fetch(`${BASE_URL}/api/open/coding/conversation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });

  console.log(`  Status: ${resp.status}`);
  const json = await resp.json();
  console.log(`  Success: ${json.success}`);

  if (!json.success) {
    console.error("  Error:", JSON.stringify(json));
    return null;
  }

  const id = json.result.conversationId;
  console.log(`  ConversationId: ${id}`);
  return id;
}

// ── Step 2: Ask question via SSE ────────────────────────────────
async function askQuestion(conversationId, query) {
  console.log(`\nStep 2: Asking "${query}" ...`);
  const url = `${SSE_BASE_URL}/api/open/sse/coding/completions?conversationId=${conversationId}&query=${encodeURIComponent(query)}`;

  const resp = await fetch(url, {
    headers: { Accept: "text/event-stream" },
  });

  console.log(`  Status: ${resp.status}`);
  console.log(`  Content-Type: ${resp.headers.get("content-type")}`);

  const text = await resp.text();

  // Parse SSE
  const lines = text.split("\n");
  const chunks = [];
  for (const line of lines) {
    if (!line.startsWith("data:")) continue;
    const payload = line.slice(5).trim();
    if (!payload) continue;
    try {
      const msg = JSON.parse(payload);
      if (msg.data) chunks.push(msg.data);
    } catch {
      chunks.push(payload);
    }
  }

  const answer = chunks.join("");
  console.log(`  Answer length: ${answer.length} chars`);
  console.log(`  Answer preview: ${answer.substring(0, 200)}...`);
  return answer;
}

// ── Step 3: Get history ─────────────────────────────────────────
async function getHistory(conversationId) {
  console.log(`\nStep 3: Getting history for ${conversationId}...`);
  const resp = await fetch(
    `${BASE_URL}/api/open/coding/conversation/${conversationId}`,
    { headers: { "Content-Type": "application/json" } }
  );

  console.log(`  Status: ${resp.status}`);
  const json = await resp.json();
  console.log(`  Success: ${json.success}`);

  if (json.success) {
    const dialog = json.result.dialog;
    console.log(`  Dialog count: ${dialog.length}`);
    for (const d of dialog) {
      console.log(`    Q: ${d.question}`);
      console.log(`    A: ${d.answer.answer.substring(0, 80)}...`);
    }
  }
  return json;
}

// ── Step 4: Get recommended questions ───────────────────────────
async function getRecommended(pageUrl) {
  console.log(`\nStep 4: Getting recommended questions for ${pageUrl}...`);
  const url = `${BASE_URL}/api/open/coding/followup/recommend?scene=ai_doc_recommend&askPageUrl=${encodeURIComponent(pageUrl)}`;
  const resp = await fetch(url);
  console.log(`  Status: ${resp.status}`);
  const json = await resp.json();
  console.log(`  Result:`, JSON.stringify(json).substring(0, 300));
  return json;
}

// ── Run all tests ───────────────────────────────────────────────
async function main() {
  console.log("=== DingTalk Developer Assistant API Test ===\n");

  const question = "如何获取钉钉的access_token？";
  const conversationId = await createConversation(question);
  if (!conversationId) {
    console.error("\nFailed to create conversation. Aborting.");
    process.exit(1);
  }

  const answer = await askQuestion(conversationId, question);

  await getHistory(conversationId);

  await getRecommended(
    "https://open.dingtalk.com/document/dingstart/start-overview"
  );

  console.log("\n=== All tests completed ===");
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
