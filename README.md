# PRIVÉ NIGHT 2.0 — Real Ticketing Platform

This is a real full-stack ticketing application, not a visual mockup.

## Includes
- Public event page
- Ticket selection and guest registration
- Manual OPay payment workflow
- Payment reference submission
- Organizer login
- Organizer dashboard
- Attendee management
- Payment verification / rejection
- Ticket inventory
- Revenue totals
- CSV export
- Event settings
- PostgreSQL persistence
- Secure environment variables

## Event
- Date: 15 October 2026
- Red carpet: 4:00 PM
- Main event: 5:00 PM
- Venue: Reverterton Hotel, GRA Lokoja, Kogi State

## Important before going live
1. Create a PostgreSQL database.
2. Set all environment variables from `.env.example`.
3. Use a strong random `JWT_SECRET`.
4. Replace the OPay account number with the organizer's real OPay account.
5. Change the organizer email/password.
6. Do not put secrets directly in HTML/JS.
7. After deployment, test a registration and payment verification from two separate devices.

## Local
npm install
npm start

Then open http://localhost:10000

## Render
Use the included render.yaml or create a Node Web Service:
Build: npm install
Start: npm start

Add the environment variables in Render. PostgreSQL is required for persistent production data.
