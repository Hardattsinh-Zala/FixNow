const prisma = require("../middlewares/prisma-filter");

async function findNearbyWorkers({ latitude, longitude, radiusKm, category }) {
  return prisma.$queryRaw`
    SELECT
      w.id AS workerId,
      w.name AS workerName,
      w.title AS workerTitle,
      w.providerId AS providerId,
      w.latitude,
      w.longitude,
      p.name AS providerName,

      (6371 * acos(
        cos(radians(${latitude})) *
        cos(radians(w.latitude)) *
        cos(radians(w.longitude) - radians(${longitude})) +
        sin(radians(${latitude})) *
        sin(radians(w.latitude))
      )) AS distanceKm

    FROM Worker w

    INNER JOIN Provider p
      ON p.userId = w.providerId

    WHERE w.isActive = true
      AND w.isOnline = true
      AND w.latitude IS NOT NULL
      AND w.longitude IS NOT NULL
      AND p.isActive = true

      AND EXISTS (
        SELECT 1
        FROM WorkerService s
        WHERE s.providerId = w.providerId
          AND s.category = ${category}
          AND s.isActive = true
      )

    HAVING distanceKm <= ${radiusKm}
    ORDER BY distanceKm ASC
  `;
}

function scoreCandidate(distanceKm, radiusKm, rating = 0) {
  return (
    (1 - Math.min(distanceKm / radiusKm, 1)) * 0.65 +
    (rating / 5) * 0.35
  );
}

async function scoreWorkers(rows, radiusKm) {
  const providerIds = [
    ...new Set(rows.map((r) => Number(r.providerId)))
  ];

  const ratings = providerIds.length
    ? await prisma.review.groupBy({
        by: ["providerId"],
        where: {
          providerId: {
            in: providerIds
          }
        },
        _avg: {
          rating: true
        }
      })
    : [];

  const map = Object.fromEntries(
    ratings.map((r) => [
      r.providerId,
      r._avg.rating || 0
    ])
  );

  return rows.map((r) => ({
    ...r,
    score: scoreCandidate(
      Number(r.distanceKm),
      radiusKm,
      map[r.providerId] || 0
    ),
    avgRating: map[r.providerId] || 0
  }));
}

module.exports = {
  findNearbyWorkers,
  scoreWorkers,
  scoreCandidate
};