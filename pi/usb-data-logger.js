
/*****************

Reads lines from the USB port and writes them to a file. This allows us to log data from the Arduino

Periodically reads and logs data from the temp/pressure sensor

Periodically takes photos/videos and saves them

******************/

const fs = require('fs')
const SerialPort = require('serialport')
const Readline = require('@serialport/parser-readline')

// TODO: is this the correct port?
const port = new SerialPort('/dev/tty-usbserial1')
const parser = port.pipe(new Readline({ delimeter: '\r\n' }))

const filename = getArduinoLogFilename()

parser.on('data', data => {
  console.log(data)
  fs.appendFileSync(filename, data, 'utf-8')
  
  // parse line and if contains flight stage change notification then call function
  // flight-stage-change: landed
  const controlPhrase = 'flight-stage-change:'
  if (data.indexOf(controlPhrase) > -1) {
    flightStageChanged(data.slice(flightStageChanged.length, flightStageChanged.length + 1))
  }
})

function flightStageChanged(stage) {
  // TODO: could do something cool if we want
  switch(stage) {
    case '1':
      break;
    case '2':
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
  return `arduino-${sequences.length > 0 ? sequences[sequences.length] : 0}`
}


