#!/usr/bin/env node

'use strict';

/* eslint-disable no-console */
/* eslint-disable no-constant-condition */

const readline   = require('readline');

const execa      = require('execa');
const fsExtra    = require('fs-extra');
const mqtt       = require('async-mqtt');
const moment     = require('moment');
const npid       = require('npid');
const untildify  = require('untildify');
const windowSize = require('window-size');

// ###########################################################################
// Globals

let mqttClient;

// ###########################################################################
// Logging

const logger = {
  info(msg, params) {
    if(params) {
      console.log(`${moment().format('YYYY-MM-DD HH:mm:ss')} INFO`, msg, params);
    } else {
      console.log(`${moment().format('YYYY-MM-DD HH:mm:ss')} INFO`, msg);
    }
  },
  warn(msg, params) {
    if(params) {
      console.log(`${moment().format('YYYY-MM-DD HH:mm:ss')} WARN`, msg, params);
    } else {
      console.log(`${moment().format('YYYY-MM-DD HH:mm:ss')} WARN`, msg);
    }
  },
  error(msg, params) {
    if(params) {
      console.log(`${moment().format('YYYY-MM-DD HH:mm:ss')} ERROR`, msg, params);
    } else {
      console.log(`${moment().format('YYYY-MM-DD HH:mm:ss')} ERROR`, msg);
    }
  },
};

// ###########################################################################
// Process handling

const stopProcess = async function() {
  if(mqttClient) {
    await mqttClient.end();
    mqttClient = undefined;
  }

  logger.info(`Shutdown -------------------------------------------------`);

  process.exit(0);
};

process.on('SIGTERM', () => stopProcess());

// ###########################################################################
// Notifications

const popup = async function(title, detail, icon) {
  const {exitCode, stderr} = await execa('/usr/bin/kdialog', [
    '--passivepopup', detail, 15,
    '--title', title,
    '--icon', `/home/stheine/js/mqtt/${icon}`,
  ]);

  if(exitCode) {
    logger.error('Error', stderr);
  }
};

const sound = async function(tone) {
  await fsExtra.appendFile('/home/stheine/.config/gmusicbrowser/gmusicbrowser.fifo', 'Pause');

  const ffmpegProcess = execa('/usr/bin/ffmpeg', ['-i', tone, '-f', 'wav', '-']);
  const aplayProcess  = execa('/usr/bin/aplay', ['-D', 'plughw:CARD=Device,DEV=0']);

  ffmpegProcess.stdout.pipe(aplayProcess.stdin);

  // ffmpeg -i /usr/share/sounds/Oxygen-Im-Phone-Ring.ogg -f wav - |
  // aplay -D plughw:CARD=Device,DEV=0

  const results = await Promise.all([ffmpegProcess, aplayProcess]);

  if(results[0].exitCode) {
    logger.error('ffmpeg Error', results[0].stderr);
  }
  if(results[1].exitCode) {
    logger.error('aplay Error', results[1].stderr);
  }
};

// ###########################################################################
// Main (async)

(async() => {
  // #########################################################################
  // PID file
  const pidFile = untildify('~/.mqtt.pid');
  const pidFileHandle = npid.create(pidFile);

  pidFileHandle.removeOnExit();

  // #########################################################################
  // Startup

  logger.info(`Startup --------------------------------------------------`);

  // #########################################################################
  // Handle shutdown
  process.on('SIGTERM', async() => {
    await stopProcess();
  });

  // #########################################################################
  // Init MQTT connection
  mqttClient = await mqtt.connectAsync('tcp://192.168.6.7:1883');

  mqttClient.on('message', async(topic, messageBuffer) => {
    const messageRaw = messageBuffer.toString();

    try {
      let message;

      try {
        message = JSON.parse(messageRaw);
      } catch(err) {
        // ignore
      }

      switch(topic) {
        case 'FritzBox/callMonitor/call':
        case 'FritzBox/callMonitor/hangUp':
        case 'FritzBox/callMonitor/pickUp':
        case 'FritzBox/tele/SENSOR':
        case 'jalousie/stat/dht22':
        case 'jalousie/stat/rain':
        case 'jalousie/stat/sun':
        case 'jalousie/stat/wind':
        case 'jalousie/stat/windAlarm':
        case 'Stromzaehler/tele/SENSOR':
        case 'tasmota/solar/cmnd/POWER':
        case 'tasmota/solar/stat/POWER':
        case 'tasmota/solar/stat/RESULT':
        case 'tasmota/solar/tele/LWT':
        case 'tasmota/solar/tele/SENSOR':
        case 'tasmota/solar/tele/STATE':
        case 'tasmota/spuelmaschine/cmnd/LedPower2':
        case 'tasmota/spuelmaschine/cmnd/POWER':
        case 'tasmota/spuelmaschine/stat/POWER':
        case 'tasmota/spuelmaschine/stat/RESULT':
        case 'tasmota/spuelmaschine/tele/LWT':
        case 'tasmota/spuelmaschine/tele/STATE':
        case 'tasmota/steckdose/tele/LWT':
        case 'tasmota/steckdose/tele/STATE':
        case 'tasmota/waschmaschine/cmnd/LedPower2':
        case 'tasmota/waschmaschine/cmnd/POWER':
        case 'tasmota/waschmaschine/stat/POWER':
        case 'tasmota/waschmaschine/stat/RESULT':
        case 'tasmota/waschmaschine/tele/LWT':
        case 'tasmota/waschmaschine/tele/STATE':
        case 'Vito/tele/SENSOR':
        case 'Wohnzimmer/tele/SENSOR':
        case 'Zigbee/bridge/config':
        case 'Zigbee/bridge/config/devices':
        case 'Zigbee/bridge/config/devices/get':
        case 'Zigbee/bridge/config/permit_join':
        case 'Zigbee/bridge/log':
        case 'Zigbee/bridge/networkmap':
        case 'Zigbee/bridge/networkmap/graphviz':
        case 'Zigbee/bridge/networkmap/raw':
        case 'Zigbee/bridge/state':
        case 'Zigbee/FensterSensor Büro':
        case 'Zigbee/FensterSensor Garage':
        case 'Zigbee/FensterSensor Toilette':
        case 'Zigbee/FensterSensor 1':
        case 'Zigbee/LuftSensor':
        case 'Zigbee/Repeater oben':
        case 'Zigbee/Repeater unten':
          // ignore
          break;

        case 'testNotify':
          await Promise.all([
            popup('Haustür Klingel', '', 'doorbell.png'),
            sound('/usr/share/sounds/Oxygen-Im-Phone-Ring.ogg'),
          ]);
          break;

        case 'Zigbee/Haustür Klingel': {
//          logger.info('Zigbee/Haustür Klingel', message);

          const contact = message.contact;

          if(!contact) {
            logger.info('klingelt');

            await Promise.all([
              popup('Haustür Klingel', '', 'doorbell.png'),
              sound('/usr/share/sounds/Oxygen-Im-Phone-Ring.ogg'),
            ]);
          }
          break;
        }

        case 'FritzBox/callMonitor/ring': {
          const {caller, callerName} = message;

          if(!caller) {
            logger.info('Anruf anonym');
          } else {
            logger.info(`Anruf ${caller}${callerName ? `/${callerName}` : ''}`);
          }

          let popupParam1;
          let popupParam2;

          if(caller && callerName) {
            popupParam1 = callerName;
            popupParam2 = caller;
          } else if(caller) {
            popupParam1 = caller;
            popupParam2 = '';
          } else {
            popupParam1 = 'anonym';
            popupParam2 = '';
          }

          await Promise.all([
            popup(popupParam1, popupParam2, 'ringer.png'),
            sound('/usr/share/sounds/Oxygen-Im-Phone-Ring.ogg'),
          ]);
          break;
        }

        default:
          logger.error(`Unhandled topic '${topic}'`, message);
          break;
      }
    } catch(err) {
      logger.error(`Failed mqtt handling for '${topic}': ${messageRaw}`, err);
    }
  });

  await mqttClient.subscribe('#');

  const line = readline.createInterface({
    input:  process.stdin,
    output: process.stdout,
  });

  while(true) {
    await new Promise(resolve => {
      line.question('', resolve);
    });

    for(let i = 0; i < windowSize.get().height; i++) {
      console.log('');
    }
  }
})();
