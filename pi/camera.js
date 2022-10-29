/*****************

Periodically takes photos/videos and saves them

******************/

const fs = require('fs')
const log = require('simple-node-logger').createSimpleFileLogger('/home/pi/cameralog.log');

const {StillCamera, StreamCamera, Codec} = require('pi-camera-connect')
const VIDEOS_FOLDER = '/home/pi/videos'
const PHOTOS_FOLDER = '/home/pi/photos'
const PHOTO_INTERVAL = 6000; // 6 seconds when in photo intervalometer mode
const VIDEO_DURATION = 1000 * 30; // 30 second videos
const VIDEO_INTERVAL = 1000 * 60 * 5; // video every 5 minutes

const INTERVALOMETER_COUNT = 50; // 

// make sure folders exist
if (!fs.existsSync(VIDEOS_FOLDER))
{
    log.info('Video folder does not exist. Creating', VIDEOS_FOLDER)
    fs.mkdirSync(VIDEOS_FOLDER)
}
if (!fs.existsSync(PHOTOS_FOLDER))
{
    log.info('Photos folder does not exist. Creating', PHOTOS_FOLDER)
    fs.mkdirSync(PHOTOS_FOLDER)
}

let continueLoop = true; // give us a way to exit loop
let loopCount = 0
async function RunLoop() {
    // loop indefinitely
    while (continueLoop) {
        log.info("Starting next loop:", loopCount)
        await TakePhotos()
        await RecordVideo()
        loopCount += loopCount
    }
}

async function RecordVideo() {
    log.info('Calling RecordVideo')
    await startVideo(getVideoFilename())
    await new Promise(resolve => setTimeout(() => resolve(), VIDEO_DURATION));
    await stopVideo()
}

async function TakePhotos() {
    log.info('Calling TakePhotos')
    for(let i = 0; i < 30; i++) {
        log.info("photo loop count:", i)
        await takePhoto() 
        await new Promise(resolve => setTimeout(() => resolve(), PHOTO_INTERVAL));
    }
}

let streamCamera = new StreamCamera({
    codec: Codec.H264
})

async function startVideo(filePath) {
    try {
        log.info('startVideo:', filePath)
        const videoStream = streamCamera.createStream()
        const writeStream = fs.createWriteStream(filePath)
        videoStream.pipe(writeStream)
        await streamCamera.startCapture()
    }
    catch(err) {
        log.error(err)
    }
}

async function stopVideo() {
    try {
        log.info('stopVideo called')
        await streamCamera.stopCapture()
    }
    catch(err) {
        log.error(err)
    }
}


async function takePhoto() {
    try {
        log.info("takePhoto called")
        const stillCamera = new StillCamera()
        let image = await stillCamera.takeImage()
        fs.writeFileSync(`${PHOTOS_FOLDER}/${Date.now().toString()}.jpg`, image)
    }
    catch(err) {
        log.error(err)
    }
}

function getVideoFilename() {
    log.info("getVideoFilename called")
    const files = fs.readdirSync(VIDEOS_FOLDER)
    const sequences = files.map(f => {
        const start = f.lastIndexOf('-') + 1
        const end = f.indexOf('.')
        const text = f.slice(start, end)
        const num = parseInt(text, 10)
        return isNaN(num) ? null : num
    }).filter(n => n !== null).sort()
    return `${VIDEOS_FOLDER}/video-${sequences.length > 0 ? sequences[sequences.length - 1] + 1 : 0}.h264`
}

RunLoop()