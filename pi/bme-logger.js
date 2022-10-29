/*****************

Periodically reads and logs data from the temp/pressure sensor

******************/

const fs = require('fs')
const BME280 = require('bme280-sensor')
const BME_LOGS_FOLDER = './home/pi/balloons/bme280logs'
const BME_LOG_INTERVAL = 10000; // 10 seconds

if (!fs.existsSync(BME_LOGS_FOLDER))
{
  fs.mkdirSync(BME_LOGS_FOLDER)
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

      fs.appendFileSync(`${BME_LOGS_FOLDER}/${bme280Filename}`, JSON.stringify(data, null, 2) + ',')

      setTimeout(readSensorData, BME_LOG_INTERVAL);
    })
    .catch((err) => {
      console.log(`BME280 read error: ${err}`);
      setTimeout(readSensorData, BME_LOG_INTERVAL);
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


function getBME280LogFilename() {
    const files = fs.readdirSync(BME_LOGS_FOLDER)
    const sequences = files.map(f => {
      const start = f.lastIndexOf('-') + 1
      const end = f.indexOf('.')
      const text = f.slice(start, end)
      const num = parseInt(text, 10)
      return isNaN(num) ? null : num
    }).filter(n => n !== null).sort()
    return `bme280-${sequences.length > 0 ? sequences[sequences.length - 1] + 1 : 0}.txt`
  }