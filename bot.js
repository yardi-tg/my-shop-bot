const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// ════════════════════════════════════════════════
const BOT_TOKEN = process.env.BOT_TOKEN;
const YOUR_CHAT_ID = "8504029528";
const SHOP_URL = "https://my-shop-bot.vercel.app";

// ── Kontakt- & Social-Links (hier später anpassen) ──
const CONTACT_URL   = "https://t.me/mi1lord9";
const INSTAGRAM_URL = "https://www.instagram.com/plakzzy";
const SIGNAL_URL    = "https://signal.me/#eu/iv1BpOKjaVrggSDgYIcz0IgeK0AKiw0NSBmtb73uNGYcL1DPrW5L35GeC02okV-x";
const THREEMA_URL   = "https://threema.id/HWK3R33X"; // Threema-Link
const SNAPCHAT_URL  = "https://www.snapchat.com/add/technique.ml?share_id=fJFm7J3vEEs&locale=en-US";

// ── Warteraum: Beitrittsanfragen automatisch annehmen ─────────
// (leer lassen = für ALLE Gruppen aktiv, in denen der Bot Admin ist.
//  Optional die Warteraum-Chat-ID eintragen, um es nur dort zu machen.)
const WAITING_ROOM_CHAT_ID = ""; // z.B. "-1001234567890" — leer = überall

// Warteraum-Kanal + Hauptkanal (für den /wartezimmer-Post)
const WAITING_ROOM_POST_ID = "-1003955096282";          // Kanal, in den gepostet wird
const MAIN_CHANNEL_URL = "https://t.me/+xTzxPx24HoBjMDJk"; // Button-Ziel (Hauptkanal)
const MAIN_CHANNEL_ID = "-1004383770209";   // Chat-ID des Hauptkanals
const BOT_USERNAME = "Arbeiter5_bot";                      // für den Shop-Button im Hauptkanal-Post
// Liste der heute akzeptierten Personen (für "/code" Übersicht)
let approvedToday = [];
let approvedDay = new Date().toISOString().slice(0, 10);

// ── Dauerhafter Speicher: bekannte Nutzer + Sterne ────────────
// Telegram erlaubt Bots NICHT, Mitgliederlisten abzurufen. Deshalb merkt sich
// der Bot jeden, der ihm schreibt oder dem Warteraum beitritt — samt Sternestand.
// Gespeichert in EINER angepinnten Nachricht im Besitzer-Chat (überlebt Neustarts).
// Oben die lesbare Übersicht, unten die Rohdaten zum Wiedereinlesen.
let knownUsers = [];        // [{ id, handle, name, stars }]
let dbMessageId = null;     // ID der angepinnten Speicher-Nachricht
let dbLoaded = false;
let lastBackupDay = null;   // Datum der letzten täglichen Sicherung
const DB_MARKER = "⭐ BLOCKTHEKE-SPEICHER (nicht löschen)";
const DB_SEP = "─────────────";
const STARS_GOAL = 10;      // Sterne bis zum Gratis-Raucher

// Baut die angepinnte Nachricht: schöne Übersicht + Rohdaten darunter
function usersToText() {
  const withStars = knownUsers.filter(u => (u.stars || 0) > 0);
  const full = withStars.filter(u => (u.stars || 0) >= STARS_GOAL);
  const close = withStars.filter(u => (u.stars || 0) >= 6 && (u.stars || 0) < STARS_GOAL);
  const going = withStars.filter(u => (u.stars || 0) < 6);
  const now = new Date().toLocaleString("de-CH", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  let view = `${DB_MARKER}\nStand ${now}  #bk:${lastBackupDay || "-"}\n`;
  if (withStars.length === 0) {
    view += `\nNoch keine Sterne vergeben.\n`;
  } else {
    const line = u => `${u.handle} — ${u.stars || 0}/${STARS_GOAL}`;
    if (full.length)  view += `\n🎉 VOLL (${full.length})\n` + full.map(line).join("\n") + "\n";
    if (close.length) view += `\nKURZ DAVOR\n` + close.map(line).join("\n") + "\n";
    if (going.length) view += `\nUNTERWEGS\n` + going.map(line).join("\n") + "\n";
  }
  view += `\nErfasst: ${knownUsers.length} Personen\n${DB_SEP}\n`;
  view += knownUsers.map(u => `${u.id}|${u.handle}|${u.name}|${u.stars || 0}`).join("\n");
  return view;
}

// Liest die Rohdaten unterhalb der Trennlinie wieder ein
function textToUsers(text) {
  if (!text || !text.startsWith(DB_MARKER)) return null;
  const idx = text.indexOf(DB_SEP);
  if (idx === -1) return null;
  const rows = text.slice(idx + DB_SEP.length).split("\n").filter(l => l.trim());
  const out = [];
  for (const line of rows) {
    const parts = line.split("|");
    if (parts.length < 3) continue;
    const id = parts[0].trim();
    if (!/^\d+$/.test(id)) continue;          // keine gültige ID -> überspringen
    const stars = parseInt(parts[parts.length - 1], 10);
    const hasStars = !isNaN(stars) && parts.length >= 4;
    out.push({
      id,
      handle: parts[1] || "kein Username",
      name: (hasStars ? parts.slice(2, -1) : parts.slice(2)).join("|") || "Unbekannt",
      stars: hasStars ? stars : 0,
    });
  }
  return out.length ? out : null;
}

async function dbLoad() {
  if (dbLoaded) return;
  dbLoaded = true;
  try {
    const r = await fetch(`${TELEGRAM_API}/getChat?chat_id=${YOUR_CHAT_ID}`);
    const j = await r.json();
    const pinned = j?.result?.pinned_message;
    const parsed = pinned ? textToUsers(pinned.text) : null;
    if (parsed) {
      knownUsers = parsed;
      dbMessageId = pinned.message_id;
      const bk = (pinned.text.match(/#bk:(\d{4}-\d{2}-\d{2})/) || [])[1];
      if (bk) lastBackupDay = bk;   // überlebt Server-Neustarts
    }
  } catch (e) { console.error("dbLoad:", e.message); }
}

async function dbSave() {
  try {
    if (usersToText().length > 4000) {
      console.warn("Speicher fast voll — älteste Einträge werden verworfen");
      knownUsers = knownUsers.slice(-100);
    }
    if (dbMessageId) {
      const r = await fetch(`${TELEGRAM_API}/editMessageText`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: YOUR_CHAT_ID, message_id: dbMessageId, text: usersToText() }),
      });
      const j = await r.json();
      if (j.ok) return;
      // "message is not modified" ist kein Fehler — Nachricht existiert weiter
      if (j.description && j.description.includes("not modified")) return;
      dbMessageId = null; // Nachricht weg -> neu anlegen
    }
    const r2 = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: YOUR_CHAT_ID, text: usersToText(), disable_notification: true }),
    });
    const j2 = await r2.json();
    if (j2.ok && j2.result) {
      dbMessageId = j2.result.message_id;
      await fetch(`${TELEGRAM_API}/pinChatMessage`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: YOUR_CHAT_ID, message_id: dbMessageId, disable_notification: true }),
      });
    }
  } catch (e) { console.error("dbSave:", e.message); }
}

// Sucht eine Person per @handle oder ID unter den bekannten Nutzern
function findUser(query) {
  const q = String(query).trim().replace(/^@/, "").toLowerCase();
  return knownUsers.find(u =>
    String(u.id) === q || String(u.handle).replace(/^@/, "").toLowerCase() === q
  ) || null;
}

// ── Dialogzustand für /sterne (Schritt für Schritt) ───────────
// Läuft nur im Besitzer-Chat. Verfällt nach 10 Minuten und bei Neustart.
let starDialog = null;   // { step: "wer"|"wieviel", target, since }
let restoreWaiting = false;   // wartet auf zurückgeschickte Sicherung
const DIALOG_TIMEOUT = 10 * 60 * 1000;

function dialogAlive() {
  if (!starDialog) return false;
  if (Date.now() - starDialog.since > DIALOG_TIMEOUT) { starDialog = null; return false; }
  return true;
}

// Schreibt dem Kunden. Gibt zurück, ob die Nachricht ankam.
async function notifyCustomer(user, text) {
  try {
    const r = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: user.id, text, parse_mode: "HTML" }),
    });
    const j = await r.json();
    return !!j.ok;
  } catch (e) { return false; }
}

// Vergibt Sterne, benachrichtigt den Kunden, meldet dir das Ergebnis zurück
async function giveStars(user, amount) {
  const before = user.stars || 0;
  const after = before + amount;
  let reached = false;

  if (after >= STARS_GOAL) {
    reached = true;
    user.stars = 0;                       // nach dem Glückwunsch wieder bei 0
  } else {
    user.stars = Math.max(0, after);
  }
  await dbSave();

  const kundeText = reached
    ? `🎉 <b>Deine Karte ist voll!</b>\n\n` +
      `<b>${STARS_GOAL} von ${STARS_GOAL}</b> — dein nächster Raucher geht <b>aufs Haus</b>. 🔥\n\n` +
      `Melde dich einfach bei deiner nächsten Bestellung.\n👉 @mi1lord9`
    : `⭐ <b>Du hast ${amount} Stern${amount === 1 ? "" : "e"} bekommen!</b>\n\n` +
      `Dein Stand: <b>${user.stars} von ${STARS_GOAL}</b>\n` +
      `Noch <b>${STARS_GOAL - user.stars} Stern${STARS_GOAL - user.stars === 1 ? "" : "e"}</b>, dann geht der nächste Raucher aufs Haus. 🔥\n\n` +
      `Fragen? 👉 @mi1lord9`;

  const delivered = await notifyCustomer(user, kundeText);

  let report = reached
    ? `🎉 <b>${user.handle} hat die Karte voll!</b>\n` +
      `${user.name} · Zähler steht wieder auf <b>0</b>\n`
    : `✅ <b>${amount} Stern${amount === 1 ? "" : "e"} an ${user.handle}</b>\n` +
      `${user.name} · Stand: <b>${user.stars} von ${STARS_GOAL}</b>\n`;
  report += delivered
    ? `📬 Nachricht zugestellt`
    : `⚠️ <b>Nachricht NICHT zustellbar</b> — ${user.handle} hat den Bot nie gestartet oder blockiert. Bitte selbst informieren.`;
  return report;
}

function rememberUser(u) {
  const found = knownUsers.find(x => String(x.id) === String(u.id));
  if (found) {
    // Namen/Handle auffrischen, Sterne behalten
    if (u.handle && u.handle !== "kein Username") found.handle = u.handle;
    if (u.name && u.name !== "Unbekannt") found.name = u.name;
    return false;
  }
  knownUsers.push({ ...u, stars: u.stars || 0 });
  return true;
}
// Prüft für EINEN bekannten Nutzer, ob er im angegebenen Kanal ist
async function isInChat(chatId, userId) {
  try {
    const r = await fetch(`${TELEGRAM_API}/getChatMember?chat_id=${chatId}&user_id=${userId}`);
    const j = await r.json();
    if (!j.ok) return false;
    const st = j.result?.status;
    return ["creator", "administrator", "member", "restricted"].includes(st);
  } catch (e) { return false; }
}
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

  // Reihe 4: Signal + Threema nebeneinander
  const row4 = [
    { text: "🔵 Signal", url: SIGNAL_URL },
  ];
  if (THREEMA_URL && THREEMA_URL.trim() !== "") {
    row4.push({ text: "🔒 Threema", url: THREEMA_URL });
  }
  inline_keyboard.push(row4);

  // Reihe 5: Instagram + Snapchat nebeneinander
  const row5 = [
    { text: "📸 Instagram", url: INSTAGRAM_URL },
  ];
  if (SNAPCHAT_URL && SNAPCHAT_URL.trim() !== "") {
    row5.push({ text: "👻 Snapchat", url: SNAPCHAT_URL });
  }
  inline_keyboard.push(row5);

  const text =
    `✨ <b>Willkommen bei Blocktheke</b>\n` +
    `<i>Est. 2021 — Zuverlässiger Service &amp; Qualität</i>\n\n` +
    `Ein Team, dem zufriedene Kunden über alles gehen.\n\n` +
    `✅ Preisleistung &amp; hohe Qualität\n` +
    `⚡ Schnelle &amp; diskrete Abwicklung\n` +
    `🤝 Ehrlicher, zuverlässiger Service\n\n` +
    `🔒 <b>Zugangscode erforderlich</b>\n` +
    `Der Shop ist privat — ohne heutigen Zugangscode kommst du nicht rein. ` +
    `Tippe auf <b>🔑 Zugangscode</b> oder schreibe /code, um ihn anzufragen.\n\n` +
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

// ── Beitrittsanfrage annehmen + Admin privat benachrichtigen ──
async function handleJoinRequest(joinReq) {
  const chat = joinReq?.chat;
  const user = joinReq?.from;
  if (!chat?.id || !user?.id) return;   // unvollständiges Update -> ignorieren
  const chatId = chat.id;
  const userId = user.id;

  // Falls ein bestimmter Warteraum gesetzt ist: nur dort reagieren
  if (WAITING_ROOM_CHAT_ID && String(chatId) !== String(WAITING_ROOM_CHAT_ID)) {
    return;
  }

  // 1) Anfrage automatisch genehmigen
  try {
    await fetch(`${TELEGRAM_API}/approveChatJoinRequest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, user_id: userId }),
    });
  } catch (e) {
    console.error("approveChatJoinRequest error:", e);
  }

  // 2) Für die /code-Übersicht merken (täglich zurücksetzen)
  const today = new Date().toISOString().slice(0, 10);
  if (today !== approvedDay) { approvedDay = today; approvedToday = []; }
  const handle = user.username ? `@${user.username}` : "kein Username";
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ") || "Unbekannt";
  approvedToday.push({ handle, name, userId });

  // dauerhaft merken (für den /fehlen-Befehl)
  await dbLoad();
  if (rememberUser({ id: userId, handle, name })) await dbSave();

  // 3) Admin privat benachrichtigen
  const adminMsg =
    `✅ <b>Anfrage akzeptiert</b>\n` +
    `👤 ${handle} / ${name}\n` +
    `🆔 User-ID: <code>${userId}</code>`;
  try {
    await sendTelegramMessage(YOUR_CHAT_ID, adminMsg);
  } catch (e) {
    console.error("admin notify error:", e);
  }
}

// ── Dauerhaften "Shop öffnen"-Button unten links setzen ───────
async function setShopMenuButton() {
  try {
    await fetch(`${TELEGRAM_API}/setChatMenuButton`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        menu_button: {
          type: "web_app",
          text: "Shop öffnen",
          web_app: { url: SHOP_URL }
        }
      }),
    });
    console.log("✅ Shop-Menü-Button gesetzt");
  } catch (e) {
    console.error("Menu button error:", e);
  }
}

// ── Daily access code generator ───────────────────────────────
function getTodaysCode() {
  // Echter, unvorhersehbarer Tagescode: Datum + geheimer Schlüssel durch einen
  // Hash gejagt. Bleibt den ganzen Tag gleich, springt aber täglich völlig zufällig
  // (nicht mehr +1 pro Tag wie vorher). Nur wer den SECRET kennt, kann ihn berechnen.
  const SECRET = "bL0ckThEkE_9x!Qr7";  // geheim — nicht weitergeben
  const today = new Date().toISOString().slice(0, 10);
  const input = today + "|" + SECRET;
  // FNV-1a-ähnlicher Hash über den ganzen String für gute Streuung
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  // zweite Runde für mehr Durchmischung
  h ^= h >>> 15; h = (h * 0x2c1b3c6d) >>> 0;
  h ^= h >>> 12; h = (h * 0x297a2d39) >>> 0;
  h ^= h >>> 15;
  return String(((h % 10000) + 10000) % 10000).padStart(4, "0");
}

// ── Endpoint the Mini App calls to check if a code is correct ──
const PERMA_CODE = "0009"; // Dauerhafter Master-Code — funktioniert immer, zusätzlich zum Tagescode
app.post("/check-code", (req, res) => {
  const { code } = req.body;
  const todaysCode = getTodaysCode();
  if (code === todaysCode || code === PERMA_CODE) {
    res.json({ valid: true });
  } else {
    res.json({ valid: false });
  }
});

// ── Webhook — handles all incoming Telegram messages ─────────
app.post("/webhook", async (req, res) => {
  try {
    const update = req.body;

    // ── Beitrittsanfrage im Warteraum (automatisch annehmen) ──
    if (update.chat_join_request) {
      await handleJoinRequest(update.chat_join_request);
      return res.json({ ok: true });
    }

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
        // Die Nachricht zurückziehen (löschen), statt eine neue zu senden
        const msgId = cq.message?.message_id;
        if (msgId) {
          await fetch(`${TELEGRAM_API}/deleteMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: cbChatId, message_id: msgId }),
          });
        }
      }
      return res.json({ ok: true });
    }

    const message = update.message;
    if (!message) return res.json({ ok: true });

    // Manche Update-Typen haben kein chat-Objekt — sauber aussteigen statt Fehler werfen
    const chatId = message.chat?.id;
    if (!chatId) return res.json({ ok: true });

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

    // ── Zurückgeschickte Sicherung einlesen (nur Besitzer) ──
    if (String(chatId) === String(YOUR_CHAT_ID) && text && text.startsWith(DB_MARKER)) {
      const parsed = textToUsers(text);
      if (!parsed) {
        await sendTelegramMessage(chatId,
          `⚠️ <b>Konnte die Sicherung nicht lesen.</b>\n\n` +
          `Der Datenteil unter der Trennlinie fehlt oder wurde verändert. ` +
          `Bitte eine unveränderte Sicherung schicken.`
        );
        restoreWaiting = false;
        return res.json({ ok: true });
      }
      knownUsers = parsed;
      dbMessageId = null;          // neu senden + anpinnen erzwingen
      dbLoaded = true;
      restoreWaiting = false;
      await dbSave();
      const mitSternen = knownUsers.filter(u => (u.stars || 0) > 0).length;
      await sendTelegramMessage(chatId,
        `♻️ <b>Speicher wiederhergestellt</b>\n\n` +
        `${knownUsers.length} Personen eingelesen, davon <b>${mitSternen}</b> mit Sternen.\n` +
        `Die neue Übersicht ist angepinnt.`
      );
      return res.json({ ok: true });
    }

    // ── Laufender /sterne-Dialog (nur Besitzer) ──
    if (String(chatId) === String(YOUR_CHAT_ID) && dialogAlive() && text && !text.startsWith("/")) {
      await dbLoad();
      if (starDialog.step === "wer") {
        const user = findUser(text);
        if (!user) {
          await sendTelegramMessage(chatId,
            `❓ <b>${text}</b> kenne ich nicht.\n\n` +
            `Ich kenne nur Leute, die mir schon geschrieben haben oder dem Warteraum beigetreten sind. ` +
            `Versuche es mit der User-ID, oder tippe /abbrechen.`
          );
          return res.json({ ok: true });
        }
        starDialog.target = user;
        starDialog.step = "wieviel";
        starDialog.since = Date.now();
        await sendTelegramMessage(chatId,
          `👤 <b>${user.handle}</b> (${user.name})\n` +
          `Aktueller Stand: <b>${user.stars || 0} von ${STARS_GOAL}</b>\n\n` +
          `Wie viele Sterne soll er bekommen?`
        );
        return res.json({ ok: true });
      }
      if (starDialog.step === "wieviel") {
        const amount = parseInt(text.trim(), 10);
        if (isNaN(amount) || amount === 0) {
          await sendTelegramMessage(chatId, `❓ Bitte eine Zahl schicken (z.B. <code>2</code>), oder /abbrechen.`);
          return res.json({ ok: true });
        }
        const user = starDialog.target;
        const current = user.stars || 0;
        if (current + amount > STARS_GOAL) {
          await sendTelegramMessage(chatId,
            `⚠️ <b>Geht nicht</b> — ${user.handle} hat <b>${current}</b>, mit ${amount} wären es ${current + amount}.\n` +
            `Maximal möglich: <b>${STARS_GOAL - current}</b>\n\n` +
            `Schick die richtige Zahl, oder /abbrechen.`
          );
          return res.json({ ok: true });
        }
        starDialog = null;
        const report = await giveStars(user, amount);
        await sendTelegramMessage(chatId, report);
        return res.json({ ok: true });
      }
    }

    if (text === "/start") {
      setShopMenuButton(); // Button sicherheitshalber (neu) setzen
      await sendWelcomeMenu(chatId);
    } else if (text === "/menu") {
      await sendWithShopButton(
        chatId,
        `🛒 <b>Bereit zum Stöbern?</b>\n\nTippe unten, um den Shop zu öffnen:`,
        "🛒 Shop öffnen"
      );
    } else if (text === "/code") {
      await handleCodeRequest(chatId);
    } else if (text === "/heute") {
      // Nur für den Besitzer — andere bekommen die normale Standard-Antwort
      if (String(chatId) === String(YOUR_CHAT_ID)) {
        const today = new Date().toISOString().slice(0, 10);
        if (today !== approvedDay) { approvedDay = today; approvedToday = []; }
        if (approvedToday.length > 0) {
          const liste = approvedToday
            .map((p, i) => `${i + 1}. ${p.handle} / ${p.name} — <code>${p.userId}</code>`)
            .join("\n");
          await sendTelegramMessage(chatId,
            `👥 <b>Beigetreten seit letztem Neustart (${approvedToday.length}):</b>\n\n${liste}\n\n` +
            `<i>Hinweis: Diese Liste wird bei einem Server-Neustart geleert. Die Einzel-Benachrichtigungen bekommst du unabhängig davon immer.</i>`
          );
        } else {
          await sendTelegramMessage(chatId,
            `👥 <i>Seit dem letzten Neustart wurde noch niemand neu angenommen.</i>`
          );
        }
      } else {
        // Kein Besitzer: so tun als wäre es ein unbekannter Befehl -> Standardmenü
        await sendWelcomeMenu(chatId);
      }
    } else if (text === "/wartezimmer") {
      // Nur der Besitzer darf die Warteraum-Nachricht posten
      if (String(chatId) === String(YOUR_CHAT_ID)) {
        const wzText =
          `✨ <b>Willkommen im Wartezimmer von Blocktheke</b> 🇨🇭 ✨\n\n` +
          `Schön, dass du da bist! 🙌\n\n` +
          `Dieser Kanal ist deine Eintrittskarte. Von hier aus gelangst du in unseren Hauptkanal — und bleibst immer verbunden, egal was passiert.\n\n` +
          `📌 <b>Wofür ist das Wartezimmer da?</b>\n` +
          `- Es ist dein sicherer Ankerpunkt\n` +
          `- Sollte der Hauptkanal jemals verschwinden 😉, bekommst du hier sofort den neuen Link\n` +
          `- So verlierst du uns nie aus den Augen\n\n` +
          `👇 Tippe unten auf den Button, um direkt in den Hauptkanal zu gelangen:`;
        const postRes = await fetch(`${TELEGRAM_API}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: WAITING_ROOM_POST_ID,
            text: wzText,
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [[
                { text: "➡️ Zum Hauptkanal", url: MAIN_CHANNEL_URL }
              ]]
            }
          })
        });
        const result = await postRes.json();
        if (result.ok) {
          await sendTelegramMessage(chatId,
            `✅ Wartezimmer-Nachricht wurde gepostet!\n\n<i>Tipp: Gehe in den Warteraum, halte die Nachricht gedrückt und wähle „Anpinnen“, damit sie ganz oben bleibt.</i>`
          );
        } else {
          await sendTelegramMessage(chatId,
            `⚠️ Konnte nicht posten. Grund: ${result.description || "unbekannt"}\n\nStelle sicher, dass der Bot Admin im Warteraum ist und dort posten darf.`
          );
        }
      } else {
        await sendWelcomeMenu(chatId);
      }
    } else if (text === "/hauptkanal") {
      // Nur der Besitzer darf die Hauptkanal-Nachricht posten
      if (String(chatId) === String(YOUR_CHAT_ID)) {
        if (!MAIN_CHANNEL_ID || MAIN_CHANNEL_ID.trim() === "") {
          await sendTelegramMessage(chatId,
            `⚠️ <b>Hauptkanal-ID fehlt</b>\n\nTrage in der bot.js bei <code>MAIN_CHANNEL_ID</code> die Chat-ID deines Hauptkanals ein (z.B. "-1001234567890").\n\nSo findest du sie: eine Nachricht aus dem Hauptkanal an @getidsbot weiterleiten.`
          );
          return res.json({ ok: true });
        }
        const hkText =
          `🛒 <b>Unser aktuelles Sortiment</b>\n\n` +
          `🧙‍♂️🌲 <b>Wizard Trees</b> — OG Exotics\n` +
          `🇺🇸 USA Import\n\n` +
          `💨🖊️ <b>THC Vapes</b> — Whole Melt\n` +
          `(20 Flavours)\n` +
          `🇺🇸 USA Import\n\n` +
          `🥶❄️ <b>Fresh Frozen</b> — Hash Burger\n` +
          `💎 Secret Farm\n\n` +
          `2️⃣⚡ <b>Double Static</b> — Forbidden Fruit\n` +
          `💎 Secret Farm\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━\n\n` +
          `📌 <b>Aktueller Shop-Bot</b>\n\n` +
          `Den Bot, der unsere Mini-App hostet, findest du immer über den Button unten.\n\n` +
          `Bots werden regelmässig gewechselt — schau also hier nach, falls ein alter Link nicht mehr geht.\n\n` +
          `Bei Fragen, Probleme, Fehler oder Verbesserungen? Melde dich direkt bei mir 👉 @mi1lord9\n\n` +
          `📱 Alles Weitere in der Mini-App — Videos, Preise, Varianten. Bestellen geht dort auch direkt.`;
        const postRes = await fetch(`${TELEGRAM_API}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: MAIN_CHANNEL_ID,
            text: hkText,
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [[
                { text: "🛒 Zum Shop", url: `https://t.me/${BOT_USERNAME}` }
              ]]
            }
          })
        });
        const result = await postRes.json();
        if (result.ok) {
          await sendTelegramMessage(chatId,
            `✅ Hauptkanal-Nachricht wurde gepostet!\n\n<i>Tipp: Halte die Nachricht im Kanal gedrückt und wähle „Anpinnen“, damit sie oben bleibt.</i>`
          );
        } else {
          await sendTelegramMessage(chatId,
            `⚠️ Konnte nicht posten. Grund: ${result.description || "unbekannt"}\n\nStelle sicher, dass der Bot Admin im Hauptkanal ist und dort posten darf.`
          );
        }
      } else {
        await sendWelcomeMenu(chatId);
      }
    } else if (text === "/fehlen") {
      // Nur Besitzer: wer ist im Warteraum, aber NICHT im Hauptkanal?
      if (String(chatId) === String(YOUR_CHAT_ID)) {
        await dbLoad();
        if (knownUsers.length === 0) {
          await sendTelegramMessage(chatId,
            `👥 <i>Noch niemand erfasst.</i>\n\nDer Bot merkt sich jeden, der ab jetzt über den Warteraum-Link beitritt. Wer schon vorher drin war, ist Telegram-bedingt nicht abrufbar.`
          );
          return res.json({ ok: true });
        }
        await sendTelegramMessage(chatId, `⏳ Prüfe ${knownUsers.length} Personen...`);
        const missing = [];
        for (const u of knownUsers) {
          const inMain = await isInChat(MAIN_CHANNEL_ID, u.id);
          if (!inMain) missing.push(u);
          await new Promise(r => setTimeout(r, 120)); // Telegram nicht überlasten
        }
        if (missing.length === 0) {
          await sendTelegramMessage(chatId,
            `✅ <b>Alle im Hauptkanal!</b>\n\nVon ${knownUsers.length} erfassten Personen ist niemand mehr nur im Warteraum.`
          );
        } else {
          // in Blöcke aufteilen, damit lange Listen nicht am Zeichenlimit scheitern
          const lines = missing.map((u, i) => `${i + 1}. ${u.handle} / ${u.name}`);
          const header = `⚠️ <b>Im Warteraum, aber NICHT im Hauptkanal (${missing.length} von ${knownUsers.length}):</b>\n\n`;
          let block = header;
          for (const line of lines) {
            if ((block + line).length > 3800) {
              await sendTelegramMessage(chatId, block);
              block = "";
            }
            block += line + "\n";
          }
          if (block.trim()) await sendTelegramMessage(chatId, block);
        }
      } else {
        await sendWelcomeMenu(chatId);
      }
    } else if (text === "/sternestand") {
      // Nur Besitzer: schön aufbereitete Sterne-Übersicht auf Abruf
      if (String(chatId) === String(YOUR_CHAT_ID)) {
        await dbLoad();
        const mit = knownUsers.filter(u => (u.stars || 0) > 0)
                              .sort((a, b) => (b.stars || 0) - (a.stars || 0));
        if (mit.length === 0) {
          await sendTelegramMessage(chatId,
            `⭐ <b>Sterne-Übersicht</b>\n\n<i>Noch niemand hat Sterne.</i>\n\n` +
            `Erfasste Personen: ${knownUsers.length}`
          );
          return res.json({ ok: true });
        }
        const voll  = mit.filter(u => u.stars >= STARS_GOAL);
        const nah   = mit.filter(u => u.stars >= 6 && u.stars < STARS_GOAL);
        const start = mit.filter(u => u.stars < 6);
        // Sterne als Balken: ★ für vergeben, ☆ für offen
        const zeile = u => {
          const s = u.stars || 0;
          const bar = "★".repeat(s) + "☆".repeat(Math.max(0, STARS_GOAL - s));
          const fehlt = STARS_GOAL - s;
          return `${u.handle}\n${bar}  <b>${s}/${STARS_GOAL}</b>` +
                 (fehlt > 0 ? `  <i>(noch ${fehlt})</i>` : ``);
        };
        let out = `⭐ <b>Sterne-Übersicht</b>\n`;
        if (voll.length)  out += `\n🎉 <b>KARTE VOLL (${voll.length})</b>\n` + voll.map(zeile).join("\n\n") + `\n`;
        if (nah.length)   out += `\n🔥 <b>KURZ DAVOR</b>\n` + nah.map(zeile).join("\n\n") + `\n`;
        if (start.length) out += `\n<b>UNTERWEGS</b>\n` + start.map(zeile).join("\n\n") + `\n`;
        out += `\n─────────────\n` +
               `Mit Sternen: <b>${mit.length}</b> · Erfasst gesamt: ${knownUsers.length}`;
        // lange Listen in Blöcke teilen (Telegram-Limit)
        if (out.length <= 3800) {
          await sendTelegramMessage(chatId, out);
        } else {
          let block = "";
          for (const line of out.split("\n")) {
            if ((block + line).length > 3800) { await sendTelegramMessage(chatId, block); block = ""; }
            block += line + "\n";
          }
          if (block.trim()) await sendTelegramMessage(chatId, block);
        }
      } else {
        await sendWelcomeMenu(chatId);
      }
    } else if (text === "/gespeichert") {
      // Nur Besitzer: zeigt, wen der Bot aktuell im Speicher hat
      if (String(chatId) === String(YOUR_CHAT_ID)) {
        await dbLoad();
        if (knownUsers.length === 0) {
          await sendTelegramMessage(chatId, `📭 <i>Speicher ist leer.</i>`);
        } else {
          const lines = knownUsers.map((u, i) => `${i + 1}. ${u.handle} / ${u.name}`);
          let block = `🗂 <b>Gespeichert: ${knownUsers.length} Personen</b>\n\n`;
          for (const l of lines) {
            if ((block + l).length > 3800) { await sendTelegramMessage(chatId, block); block = ""; }
            block += l + "\n";
          }
          if (block.trim()) await sendTelegramMessage(chatId, block);
        }
      } else {
        await sendWelcomeMenu(chatId);
      }
    } else if (text === "/befehle") {
      // Nur Besitzer: Übersicht aller Befehle. Alle anderen sehen nur das
      // normale Menü — so ist nicht erkennbar, dass es diesen Befehl gibt.
      if (String(chatId) === String(YOUR_CHAT_ID)) {
        await sendTelegramMessage(chatId,
          `📋 <b>Deine Befehle</b>\n\n` +
          `⭐ <b>Sterne</b>\n` +
          `/sterne — Sterne vergeben (fragt Schritt für Schritt)\n` +
          `/abbrechen — laufenden Vorgang abbrechen\n` +
          `/sternestand — Übersicht: wer hat wie viele Sterne\n` +
          `/sternesystem — Speicher aus einer Sicherung wiederherstellen\n\n` +
          `🔒 <b>Verwaltung</b>\n` +
          `/code — heutiger Zugangscode\n` +
          `/heute — wer heute im Warteraum angenommen wurde\n` +
          `/fehlen — im Warteraum, aber nicht im Hauptkanal\n` +
          `/gespeichert — wen der Bot im Speicher hat\n` +
          `/wartezimmer — Willkommensnachricht in den Warteraum posten\n` +
          `/hauptkanal — Sortiment in den Hauptkanal posten\n` +
          `/befehle — diese Übersicht\n\n` +
          `👥 <b>Für alle sichtbar</b>\n` +
          `/start — Willkommensmenü\n` +
          `/menu — Shop öffnen\n` +
          `/contact — Kontakt\n\n` +
          `<i>Kunden, die einen deiner privaten Befehle tippen, sehen nur das normale Menü.</i>`
        );
      } else {
        await sendWelcomeMenu(chatId);
      }
    } else if (text === "/sterne") {
      if (String(chatId) === String(YOUR_CHAT_ID)) {
        await dbLoad();
        starDialog = { step: "wer", target: null, since: Date.now() };
        await sendTelegramMessage(chatId,
          `⭐ <b>Sterne vergeben</b>\n\nWer soll die Sterne bekommen?\n` +
          `<i>Schick @Username oder die User-ID. Abbrechen mit /abbrechen.</i>`
        );
      } else {
        await sendWelcomeMenu(chatId);
      }
    } else if (text === "/abbrechen") {
      if (String(chatId) === String(YOUR_CHAT_ID)) {
        if (starDialog) { starDialog = null; await sendTelegramMessage(chatId, `❌ Abgebrochen.`); }
        else await sendTelegramMessage(chatId, `<i>Es läuft gerade nichts.</i>`);
      } else {
        await sendWelcomeMenu(chatId);
      }
    } else if (text === "/sternesystem") {
      if (String(chatId) === String(YOUR_CHAT_ID)) {
        restoreWaiting = true;
        await sendTelegramMessage(chatId,
          `♻️ <b>Speicher wiederherstellen</b>\n\n` +
          `Schick mir jetzt eine der täglichen Sicherungen (die Nachricht, die mit ` +
          `„${DB_MARKER}" beginnt).\n\n` +
          `Ich lese sie ein, schicke sie neu und pinne sie an.\n` +
          `<i>Abbrechen mit /abbrechen.</i>`
        );
      } else {
        await sendWelcomeMenu(chatId);
      }
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
    if (!order || !order.items || order.items.length === 0) {
      return res.status(400).json({ error: "Empty order" });
    }
    const { items, total, currency, note } = order;
    const user = order.user || {};   // fehlende Nutzerdaten dürfen nicht abstürzen
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
// ── Tägliche Sicherung um Mitternacht UTC (mit dem neuen Tagescode) ──
// Der Render-Free-Server schläft ein; deshalb prüfen wir bei jeder Gelegenheit,
// ob der Tag gewechselt hat, und holen die Sicherung notfalls verspätet nach.
async function dailyBackup() {
  try {
    await dbLoad();                       // ZUERST laden — sonst überschreibt
    const today = new Date().toISOString().slice(0, 10);   // dbLoad das Datum wieder
    if (lastBackupDay === today) return;  // heute schon gesichert
    lastBackupDay = today;
    await dbSave();                       // Datum in der Übersicht festhalten

    const mitSternen = knownUsers.filter(u => (u.stars || 0) > 0).length;
    await sendTelegramMessage(YOUR_CHAT_ID,
      `🔑 <b>Heutiger Zugangscode:</b> <code>${getTodaysCode()}</code>\n\n` +
      `<i>Tägliche Sicherung — ${knownUsers.length} Personen, ${mitSternen} mit Sternen. ` +
      `Diese Nachricht aufbewahren: Falls die angepinnte Übersicht verloren geht, ` +
      `mit /sternesystem und der folgenden Nachricht wiederherstellen.</i>`
    );
    // Die Sicherung selbst OHNE HTML senden — Namen könnten < > & enthalten
    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: YOUR_CHAT_ID, text: usersToText(), disable_notification: true }),
    });
  } catch (e) { console.error("dailyBackup:", e.message); }
}
setInterval(dailyBackup, 15 * 60 * 1000);   // alle 15 Min prüfen, ob neuer Tag

app.listen(PORT, () => {
  console.log(`🚀 Bot-Backend läuft auf Port ${PORT}`);
  setShopMenuButton(); // dauerhaften Shop-Button setzen
  setTimeout(dailyBackup, 5000);  // nachholen, falls der Server nachts schlief
});
