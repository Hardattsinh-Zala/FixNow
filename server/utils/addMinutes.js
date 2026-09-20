const addMinutes = (currentTime, interval) => {
    let timeArray = currentTime.split(":");
    let hours = parseInt(timeArray[0]);
    let minutes = parseInt(timeArray[1]) + interval;
    while(minutes >= 60) {
        hours++;
        minutes -= 60;
    }
    let endTime = String(hours).padStart(2, "0") + ":" + String(minutes).padStart(2, 0);
    return endTime;
}

const timeToMins = (time) => {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
}

module.exports = {addMinutes, timeToMins};