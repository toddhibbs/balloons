
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
const stillCamera = new StillCamera()
const streamCamera = new StreamCamera({
  codec: Codec.H264
})

const SerialPort = require('serialport')
const Readline = require('@serialport/parser-readline')

// TODO: is this the correct port?
const port = new SerialPort('/dev/tty-AMA0')
const parser = port.pipe(new Readline({ delimeter: '\r\n' }))

const arduinoFilename = getArduinoLogFilename()
flightStageChanged('0')

parser.on('data', data => {
  console.log(data)
  fs.appendFileSync(`./arduino-logs/${arduinoFilename}`, data, 'utf-8')
  
  // parse line and if contains flight stage change notification then call function
  // flight-stage-change: landed
  const controlPhrase = 'flight-stage-change:'
  if (data.indexOf(controlPhrase) > -1) {
    flightStageChanged(data.slice(flightStageChanged.length, flightStageChanged.length + 1))
  }
})


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
      // pre_launch. setup video to record the launch after 15 minutes
      setTimeout(startVideo, 3000, `./launch-videos/${getLaunchFilename()}`)
      setTimeout(stopVideo, 10000)
      setTimeout(startIntervalometer, 12000)
      setTimeout(stopIntervalometer, 120000)
      setTimeout(startVideo, 121000, `./landing-videos/${getLandingFilename()}`)
      setTimeout(stopVideo, 125000)
      break;
    case '1':
      // we are airborn! record another video
      break;
    case '2':
      // high_ascent. let's alternate video and photos
      // turn off video and enable intervalometer
      stopVideo()
      startIntervalometer()
      break;
    case '3':
      // high_descent. probably just take photos
      break;
    case '4':
      // low_descent. let's record video of the landing!
      await stopIntervalometer()
      startVideo()
      break;
    case '5':
      // landed. let's shutdown the raspberry pi
      stopVideo(`./landing-videos/${getLandingFilename()}`)
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

async function startVideo(filePath) {
  console.log('startVideo:', filePath)
  const videoStream = streamCamera.createStream()
  const writeStream = fs.createWriteStream(filePath)
  videoStream.pipe(writeStream)
  await streamCamera.startCapture()
}

async function stopVideo() {
  console.log('stopVideo')
  await streamCamera.stopCapture()
}

let intervalometerActive = true;
function startIntervalometer() {
  console.log('startIntervalometer')
  if (intervalometerActive) {
    stillCamera.takeImage().then(image => {
      fs.writeFileSync(`./photos/${Date.now().toString()}.jpg`, image)
      setTimeout(startIntervalometer, 15000)
    })
  }
}

async function stopIntervalometer() {
  console.log('stopIntervalometer')
  intervalometerActive = false
}


