const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// ════════════════════════════════════════════════
const BOT_TOKEN = process.env.BOT_TOKEN;
const YOUR_CHAT_ID = "8551836923";
const SHOP_URL = "https://my-shop-bot.vercel.app";

// ── Kontakt- & Social-Links (hier später anpassen) ──
const CONTACT_URL   = "https://t.me/mi1lord9";
const INSTAGRAM_URL = "https://www.instagram.com/plakzzy";
const SIGNAL_URL    = "https://signal.me/#eu/iv1BpOKjaVrggSDgYIcz0IgeK0AKiw0NSBmtb73uNGYcL1DPrW5L35GeC02okV-x";
const THREEMA_URL   = "https://threema.id/BV3UYVAP"; // Threema-Link
const SNAPCHAT_URL  = "https://www.snapchat.com/add/technique.ml?share_id=fJFm7J3vEEs&locale=en-US";
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

// ── Willkommens-Menü nach /start (Text + Buttons) ─────────────
async function sendWelcomeMenu(chatId) {
  // Reihe 1: Shop öffnen (großer Web-App-Button)
  const inline_keyboard = [
    [{ text: "🛒 Shop öffnen", web_app: { url: SHOP_URL } }],
  ];

  // Reihe 2: Kontakt (Telegram)
  inline_keyboard.push([{ text: "💬 Kontakt", url: CONTACT_URL }]);

  // Reihe 3: Zugangscode anfragen (löst dieselbe /code-Logik aus)
  inline_keyboard.push([{ text: "🔑 Zugangscode (/code)", callback_data: "get_code" }]);

  // Reihe 4: Instagram + Signal nebeneinander
  inline_keyboard.push([
    { text: "📸 Instagram", url: INSTAGRAM_URL },
    { text: "🔵 Signal", url: SIGNAL_URL },
  ]);

  // Reihe 5: Threema + Snapchat nebeneinander
  const row5 = [];
  if (THREEMA_URL && THREEMA_URL.trim() !== "") {
    row5.push({ text: "🔒 Threema", url: THREEMA_URL });
  }
  if (SNAPCHAT_URL && SNAPCHAT_URL.trim() !== "") {
    row5.push({ text: "👻 Snapchat", url: SNAPCHAT_URL });
  }
  if (row5.length) inline_keyboard.push(row5);

  const text =
    `✨ <b>Willkommen bei Blocktheke</b>\n` +
    `<i>Est. 2021 — Zuverlässiger Service &amp; Qualität</i>\n\n` +
    `Ein Team, dem zufriedene Kunden über alles gehen.\n\n` +
    `✅ Preisleistung &amp; hohe Qualität\n` +
    `⚡ Schnelle &amp; diskrete Abwicklung\n` +
    `🤝 Ehrlicher, zuverlässiger Service\n\n` +
    `🔑 <b>Zugang:</b> clicke /code\n\n` +
    `👇 Wähle unten eine Option:`;

  const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      reply_markup: { inline_keyboard }
    }),
  });
  return res.json();
}

// ── /code-Logik (von Befehl UND Button genutzt) ───────────────
async function handleCodeRequest(chatId) {
  if (String(chatId) === String(YOUR_CHAT_ID)) {
    await sendTelegramMessage(chatId,
      `🔑 <b>Heutiger Zugangscode:</b>\n\n<code>${getTodaysCode()}</code>\n\nTeile diesen Code mit Kunden, denen du heute Zugang zum Shop gewähren möchtest.`
    );
  } else {
    // Kunde: Nachricht mit Button, um den Zugangscode anzufragen
    const anfrageText = "Hallo! Ich möchte gerne auf Blocktheke zugreifen. Kann ich den heutigen Code bekommen? 🛒";
    const kontaktHandle = CONTACT_URL.replace("https://t.me/", "");
    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: `🔒 <b>Zugangscode erforderlich!</b>\n\nShop ist privat. Um den heutigen Zugangscode zu erhalten, kontaktiere uns direkt!`,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔑 Zugangscode anfragen", url: `https://t.me/${kontaktHandle}?text=${encodeURIComponent(anfrageText)}` }],
            [{ text: "⬅️ Zurück", callback_data: "back_to_menu" }]
          ]
        }
      })
    });
  }
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

    // ── Button-Klick (callback_query) verarbeiten ──
    if (update.callback_query) {
      const cq = update.callback_query;
      const cbChatId = cq.message?.chat?.id;
      const data = cq.data;
      // Ladeanimation am Button beenden
      await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callback_query_id: cq.id }),
      });
      if (data === "get_code" && cbChatId) {
        await handleCodeRequest(cbChatId);
      } else if (data === "back_to_menu" && cbChatId) {
        await sendWelcomeMenu(cbChatId);
      }
      return res.json({ ok: true });
    }

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
      await sendWelcomeMenu(chatId);
    } else if (text === "/menu") {
      await sendWithShopButton(
        chatId,
        `🛒 <b>Bereit zum Stöbern?</b>\n\nTippe unten, um den Shop zu öffnen:`,
        "🛒 Shop öffnen"
      );
    } else if (text === "/code") {
      await handleCodeRequest(chatId);
    } else if (text === "/contact") {
      await sendTelegramMessage(
        chatId,
        `📞 <b>Kontakt</b>\n\nHast du eine Frage oder brauchst du Hilfe bei deiner Bestellung?\nSchreib uns einfach und wir melden uns so schnell wie möglich! 🙏`
      );
    } else {
      // Bei jeder anderen Nachricht: das Willkommens-Menü zeigen
      await sendWelcomeMenu(chatId);
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
        "🛒 Nochmal bestellen"
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
