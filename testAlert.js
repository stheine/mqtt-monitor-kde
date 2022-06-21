#!/usr/bin/env node

import mqtt from 'async-mqtt';

(async() => {
  const mqttClient = await mqtt.connectAsync('tcp://192.168.6.7:1883');

  await mqttClient.publish('Mqtt/cmnd/alert', JSON.stringify({alert: 'test', tone: process.argv[2]}));

  await mqttClient.end();
})();
