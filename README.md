# **botserver**
Telegram bot with Telegraf JS

### DOCUMENTATION
<p>Prior to Posgres, this project was using MySQL-8.0 as the DB service. The decision was made to upload hosting service which uses only postgreSQL. You could find MySQL connection in main.mjs file.</p>

##### MySQL connection

```js
const db = await mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
})
```
> [!NOTE]
> main.mjs file works perfectly fine. So this means two JavaScript file distinguish from each other because of database they use different RDBMS.
