
/*****************

Reads lines from the USB port and writes them to a file. This allows us to log data from the Arduino

Periodically reads and logs data from the temp/pressure sensor

Periodically takes photos/videos and saves them

******************/

const fs = require('fs')
const process = require('process')
const shell = require('shelljs')

const BME280 = require('bme280-sensor')

const {StillCamera, StreamCamera, Codec} = require('pi-camera-connect')

const SerialPort = require('serialport')
const Readline = require('@serialport/parser-readline')

const port = new SerialPort('/dev/ttyACM0')
const parser = port.pipe(new Readline({ delimeter: '\r\n' }))

const arduinoFilename = getArduinoLogFilename()

parser.on('data', data => {
  console.log(data)
  fs.appendFileSync(`./arduino-logs/${arduinoFilename}`, data, 'utf-8')
  
  // parse line and if contains flight stage change notification then call function
  // flight-stage-change: landed
  const controlPhrase = 'flight-stage-change:'
  if (data.indexOf(controlPhrase) > -1) {
    flightStageChanged(data.slice(controlPhrase.length, controlPhrase.length + 1))
  }
})

flightStageChanged('0')

// //TODO: remove this test code
// setTimeout(flightStageChanged, 6000, '1')
// setTimeout(flightStageChanged, 9000, '2')
// setTimeout(flightStageChanged, 60000, '3')
// setTimeout(flightStageChanged, 65000, '4')
// setTimeout(flightStageChanged, 70000, '5')


//   pre_launch, - 0
//   low_ascent, - 1
//   high_ascent, - 2
//   high_descent, - 3
//   low_descent, -4
//   landed -5
async function flightStageChanged(stage) {
  // TODO: could do something cool if we want
  switch(stage) {
    case '0':
      console.log('Starting pre_launch')
      // pre_launch. setup video to record the launch after 15 minutes
      // TODO: don't forge to change this!
      setTimeout(startVideo, 900000, `./launch-videos/${getLaunchFilename()}`)
      //setTimeout(startVideo, 3000, `./launch-videos/${getLaunchFilename()}`)
      break;
    case '1':
      console.log('Starting low_ascent')
      // we are airborn! record another video
      break;
    case '2':
      console.log('Starting high_ascent')
      // high_ascent. let's alternate video and photos
      // turn off video and enable intervalometer
      stopVideo()
      startIntervalometer()
      break;
    case '3':
      console.log('Starting high_descent')
      // high_descent. probably just take photos
      break;
    case '4':
      console.log('Starting low_descent')
      // low_descent. let's record video of the landing!
      await stopIntervalometer()
      // add some delay here
      await new Promise(resolve => setTimeout(() => resolve(), 3000))
      startVideo(`./landing-videos/${getLandingFilename()}`)
      break;
    case '5':
      console.log('landed, shutting down')
      // landed. let's shutdown the raspberry pi
      stopVideo()
      shell.exec('sudo shutdown -h')
      // TODO: gracefully exit our node script somehow instead of just killing the process
      process.exit()
      break;
  }
}

function getArduinoLogFilename() {
  const files = fs.readdirSync('./arduino-logs')
  const sequences = files.map(f => {
    const start = f.lastIndexOf('-') + 1
    const end = f.indexOf('.')
    const text = f.slice(start, end)
    const num = parseInt(text, 10)
    return isNaN(num) ? null : num
  }).filter(n => n !== null).sort()
  return `arduino-${sequences.length > 0 ? sequences[sequences.length - 1] + 1 : 0}.txt`
}
function getBME280LogFilename() {
  const files = fs.readdirSync('./bme280-logs')
  const sequences = files.map(f => {
    const start = f.lastIndexOf('-') + 1
    const end = f.indexOf('.')
    const text = f.slice(start, end)
    const num = parseInt(text, 10)
    return isNaN(num) ? null : num
  }).filter(n => n !== null).sort()
  return `bme280-${sequences.length > 0 ? sequences[sequences.length - 1] + 1 : 0}.txt`
}
function getLaunchFilename() {
  const files = fs.readdirSync('./launch-videos')
  const sequences = files.map(f => {
    const start = f.lastIndexOf('-') + 1
    const end = f.indexOf('.')
    const text = f.slice(start, end)
    const num = parseInt(text, 10)
    return isNaN(num) ? null : num
  }).filter(n => n !== null).sort()
  return `launch-${sequences.length > 0 ? sequences[sequences.length - 1] + 1 : 0}.h264`
}
function getLandingFilename() {
  const files = fs.readdirSync('./landing-videos')
  const sequences = files.map(f => {
    const start = f.lastIndexOf('-') + 1
    const end = f.indexOf('.')
    const text = f.slice(start, end)
    const num = parseInt(text, 10)
    return isNaN(num) ? null : num
  }).filter(n => n !== null).sort()
  return `landing-${sequences.length > 0 ? sequences[sequences.length - 1] + 1 : 0}.h264`
}

const bme280Filename = getBME280LogFilename()

// BME280 sensor logging logic
const options = {
  i2cBusNo   : 1, // defaults to 1
  i2cAddress : BME280.BME280_DEFAULT_I2C_ADDRESS() // defaults to 0x77
}
const bme280 = new BME280(options)
// Read BME280 sensor data, repeat
//
const readSensorData = () => {
  bme280.readSensorData()
    .then((data) => {
      // temperature_C, pressure_hPa, and humidity are returned by default.
      // I'll also calculate some unit conversions for display purposes.
      //
      data.temperature_F = BME280.convertCelciusToFahrenheit(data.temperature_C);
      data.pressure_inHg = BME280.convertHectopascalToInchesOfMercury(data.pressure_hPa);
      data.timestamp = (new Date()).toJSON()

      //console.log(`data = ${JSON.stringify(data, null, 2)}`);

      fs.appendFileSync(`./bme280-logs/${bme280Filename}`, JSON.stringify(data, null, 2) + ',')

      setTimeout(readSensorData, 10000);
    })
    .catch((err) => {
      console.log(`BME280 read error: ${err}`);
      setTimeout(readSensorData, 10000);
    });
}

// Initialize the BME280 sensor
//
bme280.init()
  .then(() => {
    console.log('BME280 initialization succeeded');
    readSensorData();
  })
  .catch((err) => console.error(`BME280 initialization failed: ${err} `))


// camera logic

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

let intervalometerActive = true;
function startIntervalometer() {
  if (intervalometerActive) {
    console.log('startIntervalometer')
    const stillCamera = new StillCamera()
    stillCamera.takeImage().then(image => {
      fs.writeFileSync(`./photos/${Date.now().toString()}.jpg`, image)
      setTimeout(startIntervalometer, 15000)
    })
    .catch(err => console.log(err))
  }
}

async function stopIntervalometer() {
  console.log('stopIntervalometer')
  intervalometerActive = false
}


