const SerialPort = require('serialport')
const Readline = require('@serialport/parser-readline')

// TODO: is this the correct port?
const port = new SerialPort('/dev/serial0')
const parser = port.pipe(new Readline({ delimeter: '\r\n' }))

parser.on('data', data => {
  console.log(data)
  // parse line and if contains flight stage change notification then call function
  // flight-stage-change: landed
  const controlPhrase = 'flight-stage-change:'
  if (data.indexOf(controlPhrase) > -1) {
    flightStageChanged(data.slice(flightStageChanged.length, flightStageChanged.length + 1))
  }
})

function flightStageChanged(stage) {
  console.log('flightStageChanged', stage)
}