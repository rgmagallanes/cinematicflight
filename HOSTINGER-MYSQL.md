# Cinematic Flight Studio — Hostinger MariaDB setup

## 1. Create the database

In Hostinger hPanel, create a MariaDB database and database user. Keep the database name, username, password, and host available.

Open phpMyAdmin for that database, select the database, choose **SQL**, paste the contents of `database/mysql-schema.sql`, and run it once.

If Studio was already installed before client image attachments were added, run `database/mysql-client-images.sql` once instead. It only adds the image table and does not replace existing enquiries.

## 2. Configure the private PHP API

In Hostinger File Manager, create a folder named `cinematic-flight-private` beside `public_html`—the same level where your screenshot showed `public_html` and `hbuilds`.

Copy `public/api/config.example.php` into that private folder, rename it to `config.php`, and replace every placeholder. Use the database host shown by Hostinger and a long, unique setup token. The final server path is:

`cinematic-flight-private/config.php`

This folder is outside the website document root, so a new build cannot overwrite it and visitors cannot request it through the website. Never commit or publish its database password. The API still accepts the older `public_html/api/config.php` location as a migration fallback, but the private location takes priority.

Client images are stored outside `public_html` by default, in `cinematic-flight-storage/client-images` beside the web root. The PHP API checks the signed-in owner before serving an image. If Hostinger requires a different writable location, add an absolute `image_storage_path` in `config.php`; see `config.example.php`.

## 3. Build and upload

Run `npm run build`. Upload the contents of `dist/client` to the document root for `studio.cinematicflight.com`.

Vite copies the PHP API, setup page, and protection file into `dist/client/api`. It does not touch `cinematic-flight-private/config.php`, so future deployments can safely replace the entire published build.

## 4. Create the first owner

Visit `https://studio.cinematicflight.com/api/setup.html`. Enter the setup token from the private `config.php`, your email address, and a password of at least 12 characters.

The setup endpoint disables itself after the first owner is created. You may then delete `setup.html` from the server for additional housekeeping.

## 5. Sign in and verify

Open `https://studio.cinematicflight.com`. Sign in, update one test enquiry, refresh the page, and confirm the change remains. The sidebar should say **Cloud protected**.

Open an enquiry, attach a small test image, close and reopen the enquiry, and open the thumbnail at full size. Remove the test image when finished.

The PHP API uses same-origin, HTTP-only session cookies, CSRF protection, prepared database statements, password hashing, and owner-scoped queries. The frontend never receives the MariaDB password.

## Optional review-queue foundation — not enabled

The new server review queue uses the separate additive migration
`database/mysql-review-queue.sql`. Do not apply it or enable its private configuration
as part of an ordinary upload without an explicitly approved controlled test.
It remains disabled by default, accepts only the designated fictional test email,
and has no send or sent-mail synchronization operation. See
[server-review-queue.md](docs/server-review-queue.md) for the API contract, isolated
tests, current UI/ingestion limitations and rollout gates.
