const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// ════════════════════════════════════════════════
const BOT_TOKEN = process.env.BOT_TOKEN;
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

// ── Daily access code generator ───────────────────────────────
function getTodaysCode() {
  const today = new Date().toISOString().slice(0, 10);
  let hash = 0;
  for (let i = 0; i < today.length; i++) {
    hash = (hash * 31 + today.charCodeAt(i)) % 10000;
  }
  return String(hash).padStart(4, "0");
}

// ── Endpoint the Mini App calls to check if a code is correct ──
app.post("/check-code", (req, res) => {
  const { code } = req.body;
  const todaysCode = getTodaysCode();
  if (code === todaysCode) {
    res.json({ valid: true });
  } else {
    res.json({ valid: false });
  }
});

// ── Webhook — handles all incoming Telegram messages ─────────
app.post("/webhook", async (req, res) => {
  try {
    const update = req.body;
    const message = update.message;
    if (!message) return res.json({ ok: true });

    const chatId = message.chat.id;
    const text = message.text || "";
    const firstName = message.from?.first_name || "there";

    if (update.message?.web_app_data) {
      const orderText = update.message.web_app_data.data;
      const firstName = update.message.from?.first_name || "A customer";
      const handle = update.message.from?.username ? `@${update.message.from.username}` : "no username";
      const userId = update.message.from?.id;
      await sendOrderToOwner(
        `🛍️ <b>New Order!</b>\n👤 <b>${firstName}</b> (${handle})\n\n${orderText}`,
        userId,
        handle
      );
      await sendTelegramMessage(chatId,
        `✅ <b>Bestellung erhalten!</b>\n\nDanke ${firstName}! Wir haben deine Bestellung erhalten und melden uns in Kürze. 🙏`
      );
      return res.json({ ok: true });
    }

    if (text === "/start") {
      await sendWithShopButton(
        chatId,
        `👋 <b>Willkommen bei Blocktheke, ${firstName}!</b>\n\n` +
        `🥦 Frisches Gemüse in Top-Qualität – direkt zu dir.\n\n` +
        `Stöbere in aller Ruhe durch unser Sortiment und stelle dir deine Bestellung zusammen. Schnell, einfach, frisch. 🌿\n\n` +
        `🔑 <b>So bekommst du Zugang:</b>\nSchreibe <b>/code</b> und wir senden dir den heutigen Zugangscode.\n\n` +
        `👇 Tippe unten, um den Shop zu öffnen:`,
        "🛍️ Shop öffnen"
      );
    } else if (text === "/menu") {
      await sendWithShopButton(
        chatId,
        `🍔 <b>Unser Menü ist bereit!</b>\n\nTippe unten, um alles zu sehen, was wir anbieten:`,
        "🛍️ Menü ansehen"
      );
    } else if (text === "/code") {
      if (String(chatId) === String(YOUR_CHAT_ID)) {
        await sendTelegramMessage(chatId,
          `🔑 <b>Heutiger Zugangscode:</b>\n\n<code>${getTodaysCode()}</code>\n\nTeile diesen Code mit Kunden, denen du heute Zugang zum Shop gewähren möchtest.`
        );
      } else {
        // Send message with button to contact owner directly
        const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: `🔒 <b>Zugang erforderlich</b>\n\nDieser Shop ist privat. Um den heutigen Zugangscode zu erhalten, kontaktiere den Shopinhaber direkt!`,
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [[
                { text: "💬 Shopinhaber kontaktieren", url: "https://t.me/Standonbu51ness?text=Hallo!%20Ich%20möchte%20gerne%20auf%20Blocktheke%20zugreifen.%20Kann%20ich%20den%20heutigen%20Code%20bekommen%3F%20🛍️" }
              ]]
            }
          })
        });
      }
    } else if (text === "/contact") {
      await sendTelegramMessage(
        chatId,
        `📞 <b>Kontakt</b>\n\nHast du eine Frage oder brauchst du Hilfe bei deiner Bestellung?\nSchreib uns einfach eine Nachricht und wir melden uns so schnell wie möglich! 🙏`
      );
    } else {
      await sendWithShopButton(
        chatId,
        `😊 Hey ${firstName}! Verwende diese Befehle:\n\n` +
        `/start — Willkommen & Shop öffnen\n` +
        `/menu — Unser Menü ansehen\n` +
        `/code — Heutigen Zugangscode erhalten\n` +
        `/contact — Kontakt aufnehmen\n\n` +
        `Oder tippe einfach auf den Button unten:`,
        "🛍️ Shop öffnen"
      );
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("Webhook error:", err);
    res.status(500).json({ error: "Webhook failed" });
  }
});

// ── /order endpoint ───────────────────────────────────────────
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
    await sendOrderToOwner(ownerMsg, user.id, user.handle);
    if (order.user?.id && order.user.id !== "N/A") {
      await sendWithShopButton(
        order.user.id,
        `✅ <b>Bestellung erhalten!</b>\n\nDanke ${user.name || ""}! Wir haben deine Bestellung erhalten und melden uns in Kürze! 🙏`,
        "🛍️ Nochmal bestellen"
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
  res.send("✅ Shop-Bot läuft!");
});

// ── Start server ──────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Bot-Backend läuft auf Port ${PORT}`);
});
