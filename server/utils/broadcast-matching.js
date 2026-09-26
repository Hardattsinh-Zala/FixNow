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

      (6371 * acos(LEAST(1, GREATEST(-1,
        cos(radians(${latitude})) *
        cos(radians(w.latitude)) *
        cos(radians(w.longitude) - radians(${longitude})) +
        sin(radians(${latitude})) *
        sin(radians(w.latitude))
      )))) AS distanceKm

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
  if (!rows.length) return [];
  const workerIds = rows.map(r => Number(r.workerId));
  const now = Date.now();
  const since = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const earnings = await prisma.booking.groupBy({
    by: ["workerId"],
    where: {workerId:{in:workerIds},status:"COMPLETED",createdAt:{gte:since}},
    _sum: {agreedPrice:true}
  });
  const lastJobs = await prisma.booking.findMany({
    where:{workerId:{in:workerIds},status:{in:["COMPLETED","AWAITING_PAYMENT","IN_SERVICE","ARRIVED"]}},
    orderBy:{updatedAt:"desc"},
    distinct:["workerId"],
    select:{workerId:true,updatedAt:true}
  });
  const earnedMap = Object.fromEntries(earnings.map(x=>[Number(x.workerId),Number(x._sum.agreedPrice||0)]));
  const lastMap = Object.fromEntries(lastJobs.map(x=>[Number(x.workerId),x.updatedAt]));
  const targetWeekly = Number(process.env.WORKER_TARGET_WEEKLY_EARNINGS || 5600);

  return rows.map(r=>{
    const workerId=Number(r.workerId);
    const weeklyEarnings=earnedMap[workerId]||0;
    const earningsDeficit=Math.max(0,Math.min(1,(targetWeekly-weeklyEarnings)/targetWeekly));
    const last=lastMap[workerId];
    const idleHours=last?Math.max(0,(now-new Date(last).getTime())/3600000):168;
    const idleScore=Math.min(1,idleHours/72);
    const proximityScore=1-Math.min(Number(r.distanceKm)/Math.max(Number(radiusKm),0.1),1);
    const score=0.4*idleScore+0.4*earningsDeficit+0.2*proximityScore;
    return {...r,score,dispatch:{idleScore,earningsDeficit,proximityScore,weights:{idleTime:0.4,earningsDeficit:0.4,proximity:0.2}}};
  }).sort((a,b)=>b.score-a.score);
}

module.exports = {
  findNearbyWorkers,
  scoreWorkers,
  scoreCandidate
};