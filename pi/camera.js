/*****************

Periodically takes photos/videos and saves them

******************/

const fs = require('fs')
const {StillCamera, StreamCamera, Codec} = require('pi-camera-connect')
const VIDEOS_FOLDER = './home/pi/balloons/videos'
const PHOTOS_FOLDER = './home/pi/balloons/photos'
const PHOTO_INTERVAL = 6000; // 6 seconds when in photo intervalometer mode
const VIDEO_DURATION = 1000 * 30; // 30 second videos
const VIDEO_INTERVAL = 1000 * 60 * 5; // video every 5 minutes

const INTERVALOMETER_COUNT = 50; // 

// make sure folders exist
if (!fs.existsSync(VIDEOS_FOLDER))
{
  fs.mkdirSync(VIDEOS_FOLDER)
}
if (!fs.existsSync(PHOTOS_FOLDER))
{
  fs.mkdirSync(PHOTOS_FOLDER)
}

let continueLoop = true; // give us a way to exit loop
async function RunLoop() {
    // loop indefinitely
    while (continueLoop) {
        await TakePhotos()
        await RecordVideo()
    }
}

async function RecordVideo() {
    await startVideo(getVideoFilename())
    await new Promise(resolve => setTimeout(() => resolve(), VIDEO_DURATION));
    await stopVideo()
}

async function TakePhotos() {
    for(let i = 0; i < 30; i++) {
        await takePhoto()
    }
}

let streamCamera = new StreamCamera({
    codec: Codec.H264
})

async function startVideo(filePath) {
    try {
        console.log('startVideo:', filePath)
        const videoStream = streamCamera.createStream()
        const writeStream = fs.createWriteStream(filePath)
        videoStream.pipe(writeStream)
        await streamCamera.startCapture()
    }
    catch(err) {
        console.log(err)
    }
}

async function stopVideo() {
    try {
        console.log('stopVideo')
        await streamCamera.stopCapture()
    }
    catch(err) {
        console.log(err)
    }
}


async function takePhoto() {
    try {
        const stillCamera = new StillCamera()
        let image = await stillCamera.takeImage()
        fs.writeFileSync(`${PHOTOS_FOLDER}/${Date.now().toString()}.jpg`, image)
    }
    catch(err) {
        console.log(err)
    }
}


let intervalometerActive = true;
function startIntervalometer() {
    if (intervalometerActive) {
        console.log('startIntervalometer')
        const stillCamera = new StillCamera()
        stillCamera.takeImage().then(image => {
        fs.writeFileSync(`${PHOTOS_FOLDER}/${Date.now().toString()}.jpg`, image)
        setTimeout(startIntervalometer, PHOTO_INTERVAL)
        })
        .catch(err => console.log(err))
    }
}

async function stopIntervalometer() {
    console.log('stopIntervalometer')
    intervalometerActive = false
}
  

function getVideoFilename() {
    const files = fs.readdirSync(VIDEOS_FOLDER)
    const sequences = files.map(f => {
        const start = f.lastIndexOf('-') + 1
        const end = f.indexOf('.')
        const text = f.slice(start, end)
        const num = parseInt(text, 10)
        return isNaN(num) ? null : num
    }).filter(n => n !== null).sort()
    return `video-${sequences.length > 0 ? sequences[sequences.length - 1] + 1 : 0}.h264`
}

await RunLoop()