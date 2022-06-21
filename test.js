#!/usr/bin/env node

import mqtt from 'async-mqtt';

// ###########################################################################
// Globals

let mqttClient;

// ###########################################################################
// Main (async)

(async() => {
  // #########################################################################
  // Init MQTT connection
  mqttClient = await mqtt.connectAsync('tcp://192.168.6.7:1883');

  await mqttClient.publish('mqtt/test/notification', JSON.stringify('ringer'));

  mqttClient.end();
})();
