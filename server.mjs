import dotenv from "dotenv";
import { Telegraf, Markup } from "telegraf";
import pkg from "pg";

dotenv.config();

const { Pool } = pkg;

// const db = new Client({
//   host: process.env.DB_HOST,
//   port: Number(process.env.DB_PORT),
//   user: process.env.DB_USER,
//   password: process.env.DB_PASS,
//   database: process.env.DB_NAME,
// });
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});


await db.connect();

// PostgreSQL CREATE TABLE syntax
await db.query(`
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT NOT NULL UNIQUE,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    username VARCHAR(255),
    phone_number VARCHAR(50),
    language_code VARCHAR(10),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`);

if (!process.env.BOT_TOKEN) {
  console.error("BOT_TOKEN missing in environment variables!");
  process.exit(1);
}

const bot = new Telegraf(process.env.BOT_TOKEN);

bot.start(async (ctx) => {
  const user = ctx.from;
  const webAppUrl = process.env.BASE_URL;

  const res = await db.query(
    "SELECT * FROM users WHERE telegram_id = $1",
    [user.id]
  );

  if (res.rows.length > 0) {
    await db.query(
      `UPDATE users 
       SET first_name = $1, last_name = $2, username = $3, language_code = $4
       WHERE telegram_id = $5`,
      [
        user.first_name ?? null,
        user.last_name ?? null,
        user.username ?? null,
        user.language_code ?? null,
        user.id,
      ]
    );

    await ctx.reply(
      "You are already registered! Your profile info has been updated.",
      Markup.inlineKeyboard([[Markup.button.webApp("Open Web App", webAppUrl)]])
    );
    return;
  }

  await ctx.reply(
    `Welcome, ${user.first_name || "User"}! Tap below to begin registration.`,
    Markup.inlineKeyboard([[Markup.button.callback("Register", "register_user")]])
  );
});

bot.action("register_user", async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.editMessageText(
    "Do you consent to share your Telegram info for registration?",
    Markup.inlineKeyboard([
      [
        Markup.button.callback("Yes, send my data", "send_data"),
        Markup.button.callback("Cancel", "cancel_register"),
      ],
    ])
  );
});

bot.action("send_data", async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply(
    "Please share your phone number by pressing the button below.",
    Markup.keyboard([
      [Markup.button.contactRequest("Share Phone Number")],
      [Markup.button.text("Cancel")],
    ])
      .resize()
      .oneTime()
  );
});

bot.on("contact", async (ctx) => {
  const user = ctx.from;
  const contact = ctx.message.contact;

  const userData = {
    telegram_id: user.id,
    first_name: user.first_name,
    last_name: user.last_name,
    username: user.username,
    phone_number: contact.phone_number,
    language_code: user.language_code,
  };

  console.log("User data:", userData);
  await ctx.reply("Thank you! Processing your registration...", Markup.removeKeyboard());

  const res = await db.query("SELECT telegram_id FROM users WHERE telegram_id = $1", [user.id]);

  if (res.rows.length === 0) {
    await db.query(
      `INSERT INTO users (telegram_id, first_name, last_name, username, phone_number, language_code)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        user.id,
        user.first_name ?? null,
        user.last_name ?? null,
        user.username ?? null,
        contact.phone_number ?? null,
        user.language_code ?? null,
      ]
    );
    await ctx.reply("You've been successfully registered!");
  } else {
    await ctx.reply("You are already registered!");
  }

  const webAppUrl =
    process.env.BASE_URL +
    new URLSearchParams({
      id: user.id.toString(),
      username: user.username || "",
      first_name: user.first_name || "",
      last_name: user.last_name || "",
      phone: contact.phone_number || "",
    });

  await ctx.reply(
    `Successfully registered!\n\nName: ${user.first_name} ${user.last_name || ""}\nUsername: @${user.username || "N/A"}\nPhone: ${contact.phone_number}\nTelegram ID: ${user.id}`,
    Markup.inlineKeyboard([[Markup.button.webApp("Open Web App", webAppUrl)]])
  );
});

bot.hears("Cancel", async (ctx) => {
  await ctx.reply("Registration canceled.", Markup.removeKeyboard());
});

bot.action("cancel_register", async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.editMessageText("Registration canceled.");
});

bot.catch((err, ctx) => {
  console.error(`Bot error for ${ctx.updateType}:`, err);
});

bot.launch();
console.log("Bot is running...");

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
