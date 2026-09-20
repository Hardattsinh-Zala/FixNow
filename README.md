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
