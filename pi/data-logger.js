/*****************

Reads lines from the USB port and writes them to a file. This allows us to log data from the Arduino

******************/

const fs = require('fs')
const log = require('simple-node-logger').createSimpleFileLogger(getArduinoLogFilename());

const { SerialPort } = require('serialport')
const { ReadlineParser } = require('@serialport/parser-readline');
const { info } = require('console');

const port = new SerialPort('/dev/ttyUSB0')
const parser = port.pipe(new ReadlineParser())

const ARDUINO_LOGS_FOLDER = '/home/pi/arduinologs'

if (!fs.existsSync(ARDUINO_LOGS_FOLDER))
{
  fs.mkdirSync(ARDUINO_LOGS_FOLDER)
}

function getArduinoLogFilename() {
    const files = fs.readdirSync(ARDUINO_LOGS_FOLDER)
    const sequences = files.map(f => {
      const start = f.lastIndexOf('-') + 1
      const end = f.indexOf('.')
      const text = f.slice(start, end)
      const num = parseInt(text, 10)
      return isNaN(num) ? null : num
    }).filter(n => n !== null).sort()
    return `${ARDUINO_LOGS_FOLDER}/arduino-${sequences.length > 0 ? sequences[sequences.length - 1] + 1 : 0}.log`
  }

  parser.on('data', data => {
    info.log(data)
  })