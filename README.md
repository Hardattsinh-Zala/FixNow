# WORK/LOCAL — worker service platform

This project has been reworked from a salon-booking application into a worker-first service platform.

## Core product flow

1. Customers browse service providers or send a live request.
2. A live request is broadcast to nearby online workers.
3. Workers can mark themselves **ready** for a request.
4. Multiple workers can be ready at the same time.
5. The **customer chooses** which worker gets the job.
6. The chosen worker's location continues to update through browser geolocation.
7. The worker/provider confirms the final price after arriving.
8. The customer pays the agreed amount through the app.
9. Persisted `TimeSlot` records are used for scheduled bookings and unavailable slots are disabled when a booking conflicts.

## Backend architecture

The Prisma domain names are now worker-platform concepts:

- `Provider` — service provider / cooperative account (mapped to legacy `Salon` table)
- `Worker` — service professional (mapped to legacy `Staff` table)
- `WorkerService` — service offering (mapped to legacy `Service` table)
- `Booking` — job booking
- `ServiceRequest` — live customer broadcast (mapped to legacy `BroadcastRequest`)
- `WorkerResponse` — worker response to a broadcast (mapped to legacy `BroadcastCandidate`)
- `TimeSlot` — persisted availability slot

Legacy database table names are preserved with Prisma `@@map` / `@map` so the rework does not require renaming the existing production tables.

### Broadcasting without Redis

Redis/BullMQ has been removed from the runtime path. A DB-backed polling loop checks `ServiceRequest.nextWaveAt` every five seconds. Because wave state lives in MySQL, a server restart does not lose an active request's state.

Socket.IO is used only for real-time UI events:

- `service-request`
- `worker-ready`
- `worker-location`
- `request-selected`
- `booking-confirmed`
- `worker-arrived`
- `broadcast-expired`

## Database migration

Run:

```bash
cd server
npm install
npm run prisma:generate
npm run prisma:migrate
npm start
```

The migration adds:

- worker skills/certifications
- provider verification status
- persisted time slots
- booking final-price fields
- booking arrival/pricing states
- broadcast requested date/time
- DB-backed broadcast wave state
- two-way worker response states

## Environment

The existing `.env` variables remain applicable. For online payments:

```env
RAZORPAY_KEY_ID=...
RAZORPAY_KEY_SECRET=...
```

For the frontend:

```env
VITE_API_URL=http://localhost:8080/api
```

The frontend no longer requires Mapbox/Turf, and the server no longer requires Redis/BullMQ.

## Design direction

The new interface uses an editorial, restrained visual system: generous whitespace, serif display typography, mono utility labels, thin rules, muted paper/ink tones, terracotta accents, and small motion cues. The intent is inspired by the clarity and refined minimalism of Mallard & Claret without reproducing their site.


## SIH 26089 implementation update

### Worker-owned dispatch
- Worker accounts use the `WORKER` role and are created/maintained by the cooperative.
- A worker receives live service-request events directly and can Accept/Pass from `/worker`.
- Worker online status and browser geolocation are controlled by the worker. Location is refreshed while online and while active jobs are being tracked.
- The cooperative dashboard is read-only for dispatch decisions: it monitors workers, requests, bookings and activity instead of accepting jobs for workers.

### Day-based booking
Time-slot inventory has been removed from the application flow. A booking stores a service `date`; the arrival window is coordinated after confirmation. The migration drops `TimeSlot` and the provider `slotInterval` field. `Booking.startTime` is retained as a nullable legacy column for safe migration of old records.

### Pay-on-arrival price handshake
1. Worker arrives and records the final scope price.
2. Booking becomes `AWAITING_PAYMENT` with pricing state `PROPOSED`.
3. Customer can Confirm price or Dispute price.
4. Razorpay payment can be created only after customer confirmation (`AGREED`).
5. Successful payment marks the booking paid/completed. This keeps the listed service price out of the transaction until the actual scope is known.

### Reviews
Only the authenticated customer attached to a completed booking can create its review. `Review.bookingId` is unique, enforcing one review per booking at the database level.

### Government-verification readiness
Worker profiles now have cooperative-managed e-Shram UAN and Skill India certificate fields plus a verification status. The system deliberately does **not** claim government verification without official credentials/API access. The cooperative can record evidence and later connect an authorised e-Shram/DigiLocker/Skill India integration.
