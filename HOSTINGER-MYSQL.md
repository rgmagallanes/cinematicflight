# Cinematic Flight Studio — Hostinger MariaDB setup

## 1. Create the database

In Hostinger hPanel, create a MariaDB database and database user. Keep the database name, username, password, and host available.

Open phpMyAdmin for that database, select the database, choose **SQL**, paste the contents of `database/mysql-schema.sql`, and run it once.

## 2. Configure the private PHP API

Copy `public/api/config.example.php` to `public/api/config.php` and replace every placeholder. Use the database host shown by Hostinger and a long, unique setup token.

`config.php` is ignored by Git. Never commit or publish its database password. The API directory's `.htaccess` prevents web access to configuration files.

## 3. Build and upload

Run `npm run build`. Upload the contents of `dist/client` to the document root for `studio.cinematicflight.com`.

Then upload your completed private `config.php` to the deployed `/api/config.php` path. Vite copies the PHP API, setup page, and protection file into `dist/client/api`, but it does not copy the ignored private configuration.

## 4. Create the first owner

Visit `https://studio.cinematicflight.com/api/setup.html`. Enter the setup token from `config.php`, your email address, and a password of at least 12 characters.

The setup endpoint disables itself after the first owner is created. You may then delete `setup.html` from the server for additional housekeeping.

## 5. Sign in and verify

Open `https://studio.cinematicflight.com`. Sign in, update one test enquiry, refresh the page, and confirm the change remains. The sidebar should say **Cloud protected**.

The PHP API uses same-origin, HTTP-only session cookies, CSRF protection, prepared database statements, password hashing, and owner-scoped queries. The frontend never receives the MariaDB password.
