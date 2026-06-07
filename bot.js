const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// ════════════════════════════════════════════════
const BOT_TOKEN = "8234528536:AAFRTSt72MH-g1BzROc19dPss9QUdSjwGsM";
const YOUR_CHAT_ID = "8551836923";
const SHOP_URL = "https://my-shop-bot.vercel.app";
// ════════════════════════════════════════════════

const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// ── Send a plain message ──────────────────────────────────────
async function sendTelegramMessage(chatId, text) {
  const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
  return res.json();
}

// ── Send order to owner WITH a Reply to Customer button ───────
async function sendOrderToOwner(text, customerUserId, customerHandle) {
  const inline_keyboard = [];

  // Button to open direct chat with customer
  if (customerHandle && customerHandle !== "No username") {
    inline_keyboard.push([{ text: "💬 Reply to Customer", url: `https://t.me/${customerHandle.replace("@", "")}` }]);
  } else if (customerUserId && customerUserId !== "N/A") {
    inline_keyboard.push([{ text: "💬 Reply to Customer", url: `tg://user?id=${customerUserId}` }]);
  }

  const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: YOUR_CHAT_ID,
      text,
      parse_mode: "HTML",
      reply_markup: { inline_keyboard }
    }),
  });
  return res.json();
}

// ── Send a message with an Open Shop button ───────────────────
async function sendWithShopButton(chatId, text, buttonLabel) {
  const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [[
          { text: buttonLabel, web_app: { url: SHOP_URL } }
        ]]
      }
    }),
  });
  return res.json();
}

// ── Webhook — handles all incoming Telegram messages ─────────
app.post("/webhook", async (req, res) => {
  try {
    const update = req.body;
    const message = update.message;
    if (!message) return res.json({ ok: true });

    const chatId = message.chat.id;
    const text = message.text || "";
    const firstName = message.from?.first_name || "there";

    // Handle order sent via tg.sendData() from Mini App
    if (update.message?.web_app_data) {
      const orderText = update.message.web_app_data.data;
      const firstName = update.message.from?.first_name || "A customer";
      const handle = update.message.from?.username ? `@${update.message.from.username}` : "no username";
      const userId = update.message.from?.id;

      // Forward the order to YOU with a reply button
      await sendOrderToOwner(
        `🛍️ <b>New Order!</b>\n👤 <b>${firstName}</b> (${handle})\n\n${orderText}`,
        userId,
        handle
      );

      // Confirm to the customer
      await sendTelegramMessage(chatId,
        `✅ <b>Order received!</b>\n\nThanks ${firstName}! We got your order and will get back to you shortly. 🙏`
      );
      return res.json({ ok: true });
    }

    if (text === "/start") {
      await sendWithShopButton(
        chatId,
        `👋 <b>Welcome to Yardi's Shop, ${firstName}!</b>\n\n` +
        `🍉 Fresh fruities & tasty bites, ready for you!\n\n` +
        `Browse our menu, pick what you love, and place your order in seconds. 😍\n\n` +
        `👇 Tap below to open the shop:`,
        "🛍️ Open Shop"
      );
    } else if (text === "/menu") {
      await sendWithShopButton(
        chatId,
        `🍔 <b>Our menu is ready!</b>\n\nTap below to browse everything we offer:`,
        "🛍️ View Menu"
      );
    } else if (text === "/contact") {
      await sendTelegramMessage(
        chatId,
        `📞 <b>Contact Us</b>\n\nHave a question or need help with your order?\nJust send us a message and we'll get back to you shortly! 🙏`
      );
    } else {
      await sendWithShopButton(
        chatId,
        `😊 Hey ${firstName}! Use these commands:\n\n` +
        `/start — Welcome & open shop\n` +
        `/menu — Browse our menu\n` +
        `/contact — Get in touch\n\n` +
        `Or just tap the button below:`,
        "🛍️ Open Shop"
      );
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("Webhook error:", err);
    res.status(500).json({ error: "Webhook failed" });
  }
});

// ── /order endpoint — called by the Mini App ─────────────────
app.post("/order", async (req, res) => {
  try {
    const order = req.body;

    if (!order.items || order.items.length === 0) {
      return res.status(400).json({ error: "Empty order" });
    }

    const { user, items, total, currency, note } = order;
    const itemLines = items
      .map((i) => `  • ${i.qty}x ${i.name}  —  ${currency} ${i.qty * i.price}`)
      .join("\n");
    const noteSection = note ? `\n📝 <b>Note:</b> ${note}` : "";

    const ownerMsg =
      `🛍️ <b>New Order!</b>\n\n` +
      `👤 <b>Customer:</b> ${user.name} (${user.handle})\n` +
      `🆔 <b>Telegram ID:</b> <code>${user.id}</code>\n\n` +
      `<b>Items:</b>\n${itemLines}\n\n` +
      `💰 <b>Total:</b> ${currency} ${total}` +
      noteSection +
      `\n\n⏰ ${new Date().toLocaleString()}`;

    // Send order to owner with reply button
    await sendOrderToOwner(ownerMsg, user.id, user.handle);

    // Send confirmation to customer
    if (order.user?.id && order.user.id !== "N/A") {
      await sendWithShopButton(
        order.user.id,
        `✅ <b>Order received!</b>\n\nThanks ${user.name || "there"}, we got your order and will get back to you shortly! 🙏`,
        "🛍️ Order Again"
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
