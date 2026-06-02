/**
 * ─────────────────────────────────────────────────────────────
 *  TELEGRAM SHOP BOT — Backend
 *  Receives orders from the Mini App and sends them to you
 * ─────────────────────────────────────────────────────────────
 *
 *  SETUP STEPS:
 *  1. npm install
 *  2. Fill in your BOT_TOKEN and YOUR_CHAT_ID below
 *  3. Deploy to Railway, Render, or any Node host
 *  4. Paste your deployed URL into index.html (BOT_BACKEND_URL)
 *  5. Set your Mini App URL in BotFather with /newapp
 *
 * ─────────────────────────────────────────────────────────────
 */

const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// ════════════════════════════════════════════════
//  ✏️  FILL THESE IN
// ════════════════════════════════════════════════

const BOT_TOKEN = "YOUR_BOT_TOKEN_HERE";
// Get this from @BotFather on Telegram

const YOUR_CHAT_ID = "YOUR_CHAT_ID_HERE";
// To find your chat ID:
//   1. Start your bot
//   2. Send it any message
//   3. Open: https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates
//   4. Look for "chat":{"id": XXXXXXXX}  ← that number is your chat ID

// ════════════════════════════════════════════════

const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// ── Send a message via Telegram Bot API ──────────────────────
async function sendTelegramMessage(chatId, text) {
  const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
    }),
  });
  return res.json();
}

// ── Format order into a readable message ─────────────────────
function formatOrderMessage(order) {
  const { user, items, total, currency, note } = order;

  const itemLines = items
    .map((i) => `  • ${i.qty}x ${i.name}  —  ${currency} ${i.qty * i.price}`)
    .join("\n");

  const noteSection = note ? `\n📝 <b>Note:</b> ${note}` : "";

  return (
    `🛍️ <b>New Order!</b>\n\n` +
    `👤 <b>Customer:</b> ${user.name} (${user.handle})\n` +
    `🆔 <b>Telegram ID:</b> <code>${user.id}</code>\n\n` +
    `<b>Items:</b>\n${itemLines}\n\n` +
    `💰 <b>Total:</b> ${currency} ${total}` +
    noteSection +
    `\n\n⏰ ${new Date().toLocaleString()}`
  );
}

// ── /order endpoint — called by the Mini App ─────────────────
app.post("/order", async (req, res) => {
  try {
    const order = req.body;

    // Basic validation
    if (!order.items || order.items.length === 0) {
      return res.status(400).json({ error: "Empty order" });
    }

    const message = formatOrderMessage(order);

    // Send the order to YOU (the shop owner)
    await sendTelegramMessage(YOUR_CHAT_ID, message);

    // Optional: also send a confirmation to the customer
    if (order.user?.id && order.user.id !== "N/A") {
      await sendTelegramMessage(
        order.user.id,
        `✅ <b>Order received!</b>\n\nThanks ${order.user.name || "there"}, we got your order and will get back to you shortly! 🙏`
      );
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Order error:", err);
    res.status(500).json({ error: "Failed to process order" });
  }
});

// ── Health check ──────────────────────────────────────────────
app.get("/", (req, res) => {
  res.send("✅ Shop bot is running!");
});

// ── Start server ──────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Bot backend running on port ${PORT}`);
});
