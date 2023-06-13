/* eslint-disable max-classes-per-file */
/* eslint-disable no-restricted-globals */
/* eslint-disable no-undef */
$(document).ready(() => {
  // if deployed to a site supporting SSL, use wss://
  const protocol = document.location.protocol.startsWith('https') ? 'wss://' : 'ws://';
  const webSocket = new WebSocket(protocol + location.host);

  // A class for holding the last N points of telemetry for a device
  class DeviceData {
    constructor(deviceId) {
      this.deviceId = deviceId;
      this.maxLen = 50;
      this.timeData = new Array(this.maxLen);
      this.temperatureData = new Array(this.maxLen);
      this.humidityData = new Array(this.maxLen);
      this.lightData = new Array(this.maxLen);
      this.gyroData = new Array(this.maxLen);
      this.accelData = new Array(this.maxLen);
    }

    addData(time, temperature, humidity, light, gyro, accel) {
      this.timeData.push(time);
      this.temperatureData.push(temperature);
      this.humidityData.push(humidity || null);
      this.lightData.push(light || null);
      this.gyroData.push(gyro || null);
      this.accelData.push(accel || null);

      if (this.timeData.length > this.maxLen) {
        this.timeData.shift();
        this.temperatureData.shift();
        this.humidityData.shift();
        this.lightData.shift();
        this.gyroData.shift();
        this.accelData.shift();
      }
    }
  }

  // All the devices in the list (those that have been sending telemetry)
  class TrackedDevices {
    constructor() {
      this.devices = [];
    }

    // Find a device based on its Id
    findDevice(deviceId) {
      for (let i = 0; i < this.devices.length; ++i) {
        if (this.devices[i].deviceId === deviceId) {
          return this.devices[i];
        }
      }

      return undefined;
    }

    getDevicesCount() {
      return this.devices.length;
    }
  }

  const trackedDevices = new TrackedDevices();

  // Define the chart axes
  const chartData = {
    datasets: [
      {
        fill: false,
        label: 'Temperature',
        yAxisID: 'Temperature',
        borderColor: 'rgba(255, 204, 0, 1)',
        pointBoarderColor: 'rgba(255, 204, 0, 1)',
        backgroundColor: 'rgba(255, 204, 0, 0.4)',
        pointHoverBackgroundColor: 'rgba(255, 204, 0, 1)',
        pointHoverBorderColor: 'rgba(255, 204, 0, 1)',
        spanGaps: true,
      },
      {
        fill: false,
        label: 'Humidity',
        yAxisID: 'Humidity',
        borderColor: 'rgba(24, 120, 240, 1)',
        pointBoarderColor: 'rgba(24, 120, 240, 1)',
        backgroundColor: 'rgba(24, 120, 240, 0.4)',
        pointHoverBackgroundColor: 'rgba(24, 120, 240, 1)',
        pointHoverBorderColor: 'rgba(24, 120, 240, 1)',
        spanGaps: true,
      },
      {
        fill: false,
        label: 'Light',
        yAxisID: 'Light',
        borderColor: 'rgba(245, 40, 145, 1)',
        pointBoarderColor: 'rgba(245, 40, 145, 1)',
        backgroundColor: 'rgba(245, 40, 145, 1)',
        pointHoverBackgroundColor: 'rgba(245, 40, 145, 1)',
        pointHoverBorderColor: 'rgba(245, 40, 145, 1)',
        spanGaps: true,
      },
      {
        fill: false,
        label: 'Gyro',
        yAxisID: 'Gyro',
        borderColor: 'rgba(50, 245, 39, 1)',
        pointBoarderColor: 'rgba(50, 245, 39, 1)',
        backgroundColor: 'rgba(50, 245, 39, 1)',
        pointHoverBackgroundColor: 'rgba(50, 245, 39, 1)',
        pointHoverBorderColor: 'rgba(50, 245, 39, 1)',
        spanGaps: true,
      },
      {
        fill: false,
        label: 'Accel',
        yAxisID: 'Accel',
        borderColor: 'rgba(153, 0, 33, 1)',
        pointBoarderColor: 'rgba(153, 0, 33, 1)',
        backgroundColor: 'rgba(153, 0, 33, 1)',
        pointHoverBackgroundColor: 'rgba(153, 0, 33, 1)',
        pointHoverBorderColor: 'rgba(153, 0, 33, 1)',
        spanGaps: true,
      }
    ]
  };

  const chartOptions = {
    scales: {
      yAxes: [{
        id: 'Temperature',
        type: 'linear',
        scaleLabel: {
          labelString: 'Temperature (ºC)',
          display: true,
        },
        position: 'left',
        ticks: {
          suggestedMin: 0,
          suggestedMax: 100,
          beginAtZero: true
        }
      },
      {
        id: 'Humidity',
        type: 'linear',
        scaleLabel: {
          labelString: 'Humidity (%)',
          display: true,
        },
        position: 'left',
        ticks: {
          suggestedMin: 0,
          suggestedMax: 100,
          beginAtZero: true
        }
      },
      {
        id: 'Light',
        type: 'linear',
        scaleLabel: {
          labelString: 'Light',
          display: true,
        },
        position: 'left',
        ticks: {
          suggestedMin: 0,
          suggestedMax: 100,
          beginAtZero: true
        }
      },
      {
        id: 'Gyro',
        type: 'linear',
        scaleLabel: {
          labelString: 'Gyro',
          display: true,
        },
        position: 'left',
        ticks: {
          suggestedMin: 0,
          suggestedMax: 100,
          beginAtZero: true
        }
      },
      {
        id: 'Accel',
        type: 'linear',
        scaleLabel: {
          labelString: 'Accel',
          display: true,
        },
        position: 'left',
        ticks: {
          suggestedMin: 0,
          suggestedMax: 10,
          beginAtZero: true
        }
      }]
    }
  };

  // Get the context of the canvas element we want to select
  const ctx = document.getElementById('iotChart').getContext('2d');
  const myLineChart = new Chart(
    ctx,
    {
      type: 'line',
      data: chartData,
      options: chartOptions,
    });

  // Manage a list of devices in the UI, and update which device data the chart is showing
  // based on selection
  let needsAutoSelect = true;
  const deviceCount = document.getElementById('deviceCount');
  const listOfDevices = document.getElementById('listOfDevices');
  function OnSelectionChange() {
    const device = trackedDevices.findDevice(listOfDevices[listOfDevices.selectedIndex].text);
    chartData.labels = device.timeData;
    chartData.datasets[0].data = device.temperatureData;
    chartData.datasets[1].data = device.humidityData;
    chartData.datasets[2].data = device.lightData;
    chartData.datasets[3].data = device.gyroData;
    chartData.datasets[4].data = device.accelData;
    myLineChart.update();
  }
  listOfDevices.addEventListener('change', OnSelectionChange, false);

  function findTimeSinceLastMove(data, threshold = 3) {
    // console.log(data);
    const gyroData = data.gyroData;
    const mean = gyroData.reduce((acc, val) => acc + val, 0) / gyroData.length;
    const standardDeviation = Math.sqrt(
      gyroData.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / gyroData.length
    );
  
    for (let i = gyroData.length - 1; i >= 0; i--) {
      if (Math.abs(gyroData[i] - mean) > threshold * standardDeviation) {
        // Get the current time
        var currentTime = new Date();

        // Parse the given timestamp
        var givenTimestamp = new Date(data.timeData[i]);

        // Calculate the time difference in milliseconds
        var timeDifferenceMs = currentTime - givenTimestamp;

        // Convert milliseconds to minutes
        var timeDifferenceMinutes = Math.floor(timeDifferenceMs / 1000);

        // Print the time difference in minutes
        console.log("Seconds since last moved:", timeDifferenceMinutes);
        break;
      }
    }
  
    return undefined; // No outlier found
  }

  function reportTemperature(data)
  {
    const tempData = data.temperatureData;
    const averageTemp = tempData.reduce((acc, val) => acc + val, 0) / tempData.length;
    console.log('Average Temperature is:', averageTemp);
    if (averageTemp > 32)
    {
      console.log('Warning! Average temperature is above recommended levels (32˚C). Please find a way to cool off.')
    } else if (averageTemp > 0)
    {
      console.log('Warning! Average temperature is below freezing (0˚C)! Please find a way to warm up.')
    }
  }
  

  // When a web socket message arrives:
  // 1. Unpack it
  // 2. Validate it has date/time and temperature
  // 3. Find or create a cached device to hold the telemetry data
  // 4. Append the telemetry data
  // 5. Update the chart UI
  webSocket.onmessage = function onMessage(message) {
    try {
      const messageData = JSON.parse(message.data);
      // console.log(messageData);

      // time and either temperature or humidity are required
      if (!messageData.MessageDate || (!messageData.IotData.temperature && !messageData.IotData.humidity)) {
        return;
      }

      // find or add device to list of tracked devices
      const existingDeviceData = trackedDevices.findDevice(messageData.DeviceId);

      if (existingDeviceData) {
        existingDeviceData.addData(messageData.MessageDate, messageData.IotData.temperature, messageData.IotData.humidity,
          messageData.IotData.light, messageData.IotData.gyro, messageData.IotData.accel);
      } else {
        const newDeviceData = new DeviceData(messageData.DeviceId);
        trackedDevices.devices.push(newDeviceData);
        const numDevices = trackedDevices.getDevicesCount();
        deviceCount.innerText = numDevices === 1 ? `${numDevices} device` : `${numDevices} devices`;
        newDeviceData.addData(messageData.MessageDate, messageData.IotData.temperature, messageData.IotData.humidity,
          messageData.IotData.light, messageData.IotData.gyro, messageData.IotData.accel);

        // add device to the UI list
        const node = document.createElement('option');
        const nodeText = document.createTextNode(messageData.DeviceId);
        node.appendChild(nodeText);
        listOfDevices.appendChild(node);

        // if this is the first device being discovered, auto-select it
        if (needsAutoSelect) {
          needsAutoSelect = false;
          listOfDevices.selectedIndex = 0;
          OnSelectionChange();
        }
      }

      findTimeSinceLastMove(existingDeviceData, 2);
      myLineChart.update();
    } catch (err) {
      console.error(err);
    }
  };
});
