#!/usr/bin/env node

import {setTimeout as delay} from 'timers/promises';
import {fileURLToPath}       from 'url';
import path                  from 'path';
import readline              from 'readline';

import _            from 'lodash';
import {execa}      from 'execa';
import fsExtra      from 'fs-extra';
import imaps        from '@klenty/imap';
import mqtt         from 'async-mqtt';
import ms           from 'ms';
import npid         from 'npid';
import untildify    from 'untildify';
import windowSize   from 'window-size';

import {connect}    from './vpn.js';
import logger       from './logger.js';
import {sendMail}   from './mail.js';

import imapConfig   from '/mnt/qnap_linux/data/imap/config.js';

// ###########################################################################
// Globals

/* eslint-disable no-underscore-dangle */
const __dirname = path.dirname(fileURLToPath(import.meta.url));

let imapClient;
let mqttClient;
// let previousWasserValue;

// ###########################################################################
// Process handling

const stopProcess = async function() {
  if(imapClient) {
    imapClient.end();
    imapClient = undefined;
  }
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
    '--icon', path.join(__dirname, `icons/${icon}`),
  ]);

  if(exitCode) {
    logger.error('Error', stderr);
  }
};

const sound = async function(tone) {
  const status = (await fsExtra.readFile(untildify('~/.config/gmusicbrowser/playing'), {encoding: 'utf8'})).trim();

  // console.log({status});

  if(!['PAUSED', 'STOPPED'].includes(status)) {
    await fsExtra.appendFile(untildify('~/.config/gmusicbrowser/gmusicbrowser.fifo'), 'Pause');
    await delay(ms('0.2 seconds'));
  }

  // console.log({tone});
  await execa('/usr/bin/cvlc', ['--gain', '0.3', '--play-and-exit', path.join(__dirname, tone)]);

  if(!['PAUSED', 'STOPPED'].includes(status)) {
    await fsExtra.appendFile(untildify('~/.config/gmusicbrowser/gmusicbrowser.fifo'), 'Play');
  }
};

// ###########################################################################
// Main (async)

(async() => {
  // #########################################################################
  // PID file
  const pidFile = untildify('~/.mqtt.pid');

  if(await fsExtra.pathExists(pidFile)) {
    await fsExtra.remove(pidFile);
  }

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

  mqttClient.on('connect', () => logger.info('mqtt.connect'));
  mqttClient.on('reconnect', () => logger.info('mqtt.reconnect'));
  mqttClient.on('close', () => logger.info('mqtt.close'));
  mqttClient.on('disconnect', () => logger.info('mqtt.disconnect'));
  mqttClient.on('offline', () => logger.info('mqtt.offline'));
  mqttClient.on('error', error => logger.info('mqtt.error', error));
  mqttClient.on('end', () => logger.info('mqtt.end'));

  mqttClient.on('message', async(topic, messageBuffer) => {
    if(topic.startsWith('tasmota/discovery/')) {
      return;
    }

    const messageRaw = messageBuffer.toString();

    try {
      let message;

      try {
        message = JSON.parse(messageRaw);
      } catch {
        // ignore
      }

      switch(topic) {
        case 'control-io/brightness/STATE':
        case 'control-io/buttonUpper/STATE':
        case 'control-io/buttonLower/STATE':
        case 'control-io/cmnd/beep':
        case 'control-io/cmnd/brightness':
        case 'control-io/cmnd/display':
        case 'control-io/cmnd/ledRed':
        case 'control-io/cmnd/ledWhite':
        case 'control-io/display/STATE':
        case 'control-io/ledRed/STATE':
        case 'control-io/ledWhite/STATE':
        case 'control-ui/cmnd/dialog':
        case 'control-ui/cmnd/route':
        case 'esp32-wasser/zaehlerstand/changeabsolut':
        case 'esp32-wasser/zaehlerstand/connection':
        case 'esp32-wasser/zaehlerstand/CPUtemp':
        case 'esp32-wasser/zaehlerstand/freeMem':
        case 'esp32-wasser/zaehlerstand/json':
        case 'esp32-wasser/zaehlerstand/rate':
        case 'esp32-wasser/zaehlerstand/rate_per_digitalization_round':
        case 'esp32-wasser/zaehlerstand/rate_per_time_unit':
        case 'esp32-wasser/zaehlerstand/raw':
        case 'esp32-wasser/zaehlerstand/status':
        case 'esp32-wasser/zaehlerstand/timestamp':
        case 'esp32-wasser/zaehlerstand/uptime':
        case 'esp32-wasser/zaehlerstand/value':
        case 'esp32-wasser/zaehlerstand/wifiRSSI':
        case 'FritzBox/callMonitor/call':
        case 'FritzBox/callMonitor/hangUp':
        case 'FritzBox/callMonitor/pickUp':
        case 'FritzBox/speedtest/result':
        case 'FritzBox/tele/SENSOR':
        case 'Fronius/solar/cmnd':
        case 'Fronius/solar/tele/SENSOR':
        case 'Fronius/solar/tele/STATUS':
        case 'Jalousie/cmnd/full_down':
        case 'Jalousie/cmnd/full_up':
        case 'Jalousie/cmnd/shadow':
        case 'Jalousie/cmnd/stop':
        case 'Jalousie/cmnd/turn':
        case 'JalousieBackend/cmnd':
        case 'JalousieBackend/tele/SENSOR':
        case 'JalousieBackend/tele/STATUS':
        case 'JalousieBackend/tele/TIMES':
        case 'maxSun/INFO':
        case 'octoPrint/event/ClientClosed':
        case 'octoPrint/event/ClientOpened':
        case 'octoPrint/event/Connected':
        case 'octoPrint/event/Connecting':
        case 'octoPrint/event/Disconnected':
        case 'octoPrint/event/Disconnecting':
        case 'octoPrint/event/Error':
        case 'octoPrint/event/PrintCancelled':
        case 'octoPrint/event/PrintDone':
        case 'octoPrint/event/PrintFailed':
        case 'octoPrint/event/PrintPaused':
        case 'octoPrint/event/PrintResumed':
        case 'octoPrint/event/PrinterStateChanged':
        case 'octoPrint/event/PrintStarted':
        case 'octoPrint/event/Shutdown':
        case 'octoPrint/mqtt':
        case 'Regen/tele/SENSOR':
        case 'solcast/forecasts':
        case 'Sonne/tele/SENSOR':
        case 'strom/tele/SENSOR':
        case 'sunTimes/INFO':
        case 'tasmota/carport/cmnd/POWER':
        case 'tasmota/carport/stat/RESULT':
        case 'tasmota/carport/stat/POWER':
        case 'tasmota/carport/tele/INFO1':
        case 'tasmota/carport/tele/INFO2':
        case 'tasmota/carport/tele/INFO3':
        case 'tasmota/carport/tele/LWT':
        case 'tasmota/carport/tele/SENSOR':
        case 'tasmota/carport/tele/STATE':
        case 'tasmota/druckerkamera/cmnd/POWER':
        case 'tasmota/druckerkamera/stat/POWER':
        case 'tasmota/druckerkamera/stat/RESULT':
        case 'tasmota/druckerkamera/tele/INFO1':
        case 'tasmota/druckerkamera/tele/INFO2':
        case 'tasmota/druckerkamera/tele/INFO3':
        case 'tasmota/druckerkamera/tele/LWT':
        case 'tasmota/druckerkamera/tele/SENSOR':
        case 'tasmota/druckerkamera/tele/STATE':
        case 'tasmota/espco2/cmnd/POWER':
        case 'tasmota/espco2/tele/INFO1':
        case 'tasmota/espco2/tele/INFO2':
        case 'tasmota/espco2/tele/INFO3':
        case 'tasmota/espco2/tele/LWT':
        case 'tasmota/espco2/tele/STATE':
        case 'tasmota/espfeinstaub/cmnd/POWER':
        case 'tasmota/espfeinstaub/tele/INFO1':
        case 'tasmota/espfeinstaub/tele/INFO2':
        case 'tasmota/espfeinstaub/tele/INFO3':
        case 'tasmota/espfeinstaub/tele/LWT':
        case 'tasmota/espfeinstaub/tele/SENSOR':
        case 'tasmota/espfeinstaub/tele/STATE':
        case 'tasmota/espstrom/cmnd/LedPower1':
        case 'tasmota/espstrom/cmnd/POWER':
        case 'tasmota/espstrom/cmnd/TelePeriod':
        case 'tasmota/espstrom/stat/RESULT':
        case 'tasmota/espstrom/tele/INFO1':
        case 'tasmota/espstrom/tele/INFO2':
        case 'tasmota/espstrom/tele/INFO3':
        case 'tasmota/espstrom/tele/LWT':
        case 'tasmota/espstrom/tele/SENSOR':
        case 'tasmota/espstrom/tele/STATE':
        case 'tasmota/fahrradlader/cmnd/POWER':
        case 'tasmota/fahrradlader/stat/INFO1':
        case 'tasmota/fahrradlader/stat/INFO2':
        case 'tasmota/fahrradlader/stat/INFO3':
        case 'tasmota/fahrradlader/stat/POWER':
        case 'tasmota/fahrradlader/stat/RESULT':
        case 'tasmota/fahrradlader/tele/SENSOR':
        case 'tasmota/fahrradlader/tele/STATE':
        case 'tasmota/fahrradlader/tele/LWT':
        case 'tasmota/fenstermotor-heizungskeller/cmnd/Power1':
        case 'tasmota/fenstermotor-heizungskeller/cmnd/Power2':
        case 'tasmota/fenstermotor-heizungskeller/stat/POWER1':
        case 'tasmota/fenstermotor-heizungskeller/stat/POWER2':
        case 'tasmota/fenstermotor-heizungskeller/tele/LWT':
        case 'tasmota/fenstermotor-heizungskeller/tele/STATE':
        case 'tasmota/haustürklingel/cmnd/POWER':
        case 'tasmota/haustürklingel/stat/INFO1':
        case 'tasmota/haustürklingel/stat/INFO2':
        case 'tasmota/haustürklingel/stat/INFO3':
        case 'tasmota/haustürklingel/stat/POWER':
        case 'tasmota/haustürklingel/tele/SENSOR':
        case 'tasmota/haustürklingel/tele/STATE':
        case 'tasmota/haustürklingel/tele/LWT':
        case 'tasmota/heizstab/cmnd/POWER':
        case 'tasmota/heizstab/stat/POWER':
        case 'tasmota/heizstab/stat/RESULT':
        case 'tasmota/heizstab/tele/INFO1':
        case 'tasmota/heizstab/tele/INFO2':
        case 'tasmota/heizstab/tele/INFO3':
        case 'tasmota/heizstab/tele/LWT':
        case 'tasmota/heizstab/tele/SENSOR':
        case 'tasmota/heizstab/tele/STATE':
        case 'tasmota/infrarotheizung-buero/cmnd/Power':
        case 'tasmota/infrarotheizung-buero/cmnd/POWER':
        case 'tasmota/infrarotheizung-buero/cmnd/PulseTime':
        case 'tasmota/infrarotheizung-buero/stat/POWER':
        case 'tasmota/infrarotheizung-buero/stat/RESULT':
        case 'tasmota/infrarotheizung-buero/tele/INFO1':
        case 'tasmota/infrarotheizung-buero/tele/INFO2':
        case 'tasmota/infrarotheizung-buero/tele/INFO3':
        case 'tasmota/infrarotheizung-buero/tele/LWT':
        case 'tasmota/infrarotheizung-buero/tele/SENSOR':
        case 'tasmota/infrarotheizung-buero/tele/STATE':
        case 'tasmota/infrarotheizung-schlafzimmer/cmnd/Power':
        case 'tasmota/infrarotheizung-schlafzimmer/cmnd/PulseTime':
        case 'tasmota/infrarotheizung-schlafzimmer/stat/POWER':
        case 'tasmota/infrarotheizung-schlafzimmer/stat/RESULT':
        case 'tasmota/infrarotheizung-schlafzimmer/tele/INFO1':
        case 'tasmota/infrarotheizung-schlafzimmer/tele/INFO2':
        case 'tasmota/infrarotheizung-schlafzimmer/tele/INFO3':
        case 'tasmota/infrarotheizung-schlafzimmer/tele/LWT':
        case 'tasmota/infrarotheizung-schlafzimmer/tele/SENSOR':
        case 'tasmota/infrarotheizung-schlafzimmer/tele/STATE':
        case 'tasmota/jalousieBuero/cmnd/POWER':
        case 'tasmota/jalousieBuero/cmnd/Power1':
        case 'tasmota/jalousieBuero/cmnd/Power2':
        case 'tasmota/jalousieBuero/cmnd/PulseTime1':
        case 'tasmota/jalousieBuero/cmnd/PulseTime2':
        case 'tasmota/jalousieBuero/stat/POWER1':
        case 'tasmota/jalousieBuero/stat/POWER2':
        case 'tasmota/jalousieBuero/stat/RESULT':
        case 'tasmota/jalousieBuero/tele/LWT':
        case 'tasmota/jalousieBuero/tele/INFO1':
        case 'tasmota/jalousieBuero/tele/INFO2':
        case 'tasmota/jalousieBuero/tele/INFO3':
        case 'tasmota/jalousieBuero/tele/SENSOR':
        case 'tasmota/jalousieBuero/tele/STATE':
        case 'tasmota/spuelmaschine/cmnd/LedMask':
        case 'tasmota/spuelmaschine/cmnd/LedPower1':
        case 'tasmota/spuelmaschine/cmnd/LedPower2':
        case 'tasmota/spuelmaschine/cmnd/LedState':
        case 'tasmota/spuelmaschine/cmnd/POWER':
        case 'tasmota/spuelmaschine/cmnd/SetOption31':
        case 'tasmota/spuelmaschine/stat/POWER':
        case 'tasmota/spuelmaschine/stat/RESULT':
        case 'tasmota/spuelmaschine/tele/INFO1':
        case 'tasmota/spuelmaschine/tele/INFO2':
        case 'tasmota/spuelmaschine/tele/INFO3':
        case 'tasmota/spuelmaschine/tele/LWT':
        case 'tasmota/spuelmaschine/tele/STATE':
        case 'tasmota/steckdose/cmnd/POWER':
        case 'tasmota/steckdose/stat/POWER':
        case 'tasmota/steckdose/stat/RESULT':
        case 'tasmota/steckdose/tele/INFO1':
        case 'tasmota/steckdose/tele/INFO2':
        case 'tasmota/steckdose/tele/INFO3':
        case 'tasmota/steckdose/tele/LWT':
        case 'tasmota/steckdose/tele/STATE':
        case 'tasmota/waschmaschine/cmnd/LedMask':
        case 'tasmota/waschmaschine/cmnd/LedPower1':
        case 'tasmota/waschmaschine/cmnd/LedPower2':
        case 'tasmota/waschmaschine/cmnd/LedState':
        case 'tasmota/waschmaschine/cmnd/POWER':
        case 'tasmota/waschmaschine/cmnd/SetOption31':
        case 'tasmota/waschmaschine/stat/POWER':
        case 'tasmota/waschmaschine/stat/RESULT':
        case 'tasmota/waschmaschine/tele/INFO1':
        case 'tasmota/waschmaschine/tele/INFO2':
        case 'tasmota/waschmaschine/tele/INFO3':
        case 'tasmota/waschmaschine/tele/LWT':
        case 'tasmota/waschmaschine/tele/STATE':
        case 'valetudo/dreame-d9/$state':
        case 'valetudo/dreame-d9/MapData/segments':
        case 'valetudo/dreame-d9/FanSpeedControlCapability/preset':
        case 'valetudo/dreame-d9/CurrentStatisticsCapability/time':
        case 'valetudo/dreame-d9/CurrentStatisticsCapability/area':
        case 'valetudo/dreame-d9/ConsumableMonitoringCapability/brush-main':
        case 'valetudo/dreame-d9/ConsumableMonitoringCapability/brush-side_right':
        case 'valetudo/dreame-d9/ConsumableMonitoringCapability/filter-main':
        case 'valetudo/dreame-d9/AttachmentStateAttribute/dustbin':
        case 'valetudo/dreame-d9/AttachmentStateAttribute/watertank':
        case 'valetudo/dreame-d9/AttachmentStateAttribute/mop':
        case 'valetudo/dreame-d9/BasicControlCapability/operation':
        case 'valetudo/dreame-d9/BasicControlCapability/operation/set':
        case 'valetudo/dreame-d9/BatteryStateAttribute/level':
        case 'valetudo/dreame-d9/BatteryStateAttribute/status':
        case 'valetudo/dreame-d9/StatusStateAttribute/detail':
        case 'valetudo/dreame-d9/StatusStateAttribute/error':
        case 'valetudo/dreame-d9/StatusStateAttribute/error_description':
        case 'valetudo/dreame-d9/StatusStateAttribute/flag':
        case 'valetudo/dreame-d9/StatusStateAttribute/status':
        case 'valetudo/dreame-d9/WaterUsageControlCapability/preset':
        case 'valetudo/dreame-d9/WifiConfigurationCapability/frequency':
        case 'valetudo/dreame-d9/WifiConfigurationCapability/ips':
        case 'valetudo/dreame-d9/WifiConfigurationCapability/signal':
        case 'valetudo/dreame-d9/WifiConfigurationCapability/ssid':
        case 'valetudo/dreame-d9/ZoneCleaningCapability/presets':
        case 'vito/cmnd/setHK1BetriebsartSpar':
        case 'vito/tele/LWT':
        case 'vito/tele/SENSOR':
        case 'vito/tele/STATS':
        case 'volumio/stat/pushState':
        case 'volumio/cmnd/DLF':
        case 'volumio/cmnd/stop':
        case 'volumio/cmnd/pause':
        case 'volumio/cmnd/play':
        case 'volumio/cmnd/playPause':
        case 'volumio/cmnd/toggle':
        case 'volumio/cmnd/volume':
        case 'Wallbox/authentication/config':
        case 'Wallbox/charge_manager/available_current':
        case 'Wallbox/charge_manager/config':
        case 'Wallbox/charge_manager/config_modified':
        case 'Wallbox/charge_manager/state':
        case 'Wallbox/charge_tracker/config':
        case 'Wallbox/charge_tracker/config_modified':
        case 'Wallbox/charge_tracker/current_charge':
        case 'Wallbox/charge_tracker/last_charges':
        case 'Wallbox/charge_tracker/state':
        case 'Wallbox/ethernet/config':
        case 'Wallbox/ethernet/config_modified':
        case 'Wallbox/ethernet/state':
        case 'Wallbox/evse/auto_start_charging':
        case 'Wallbox/evse/button_configuration':
        case 'Wallbox/evse/button_state':
        case 'Wallbox/evse/control_pilot_configuration':
        case 'Wallbox/evse/control_pilot_connected':
        case 'Wallbox/evse/energy_meter_state':
        case 'Wallbox/evse/energy_meter_values':
        case 'Wallbox/evse/gpio_configuration':
        case 'Wallbox/evse/dc_fault_current_state':
        case 'Wallbox/evse/external_clear_on_disconnect':
        case 'Wallbox/evse/external_current':
        case 'Wallbox/evse/external_defaults':
        case 'Wallbox/evse/external_enabled':
        case 'Wallbox/evse/global_current':
        case 'Wallbox/evse/hardware_configuration':
        case 'Wallbox/evse/indicator_led':
        case 'Wallbox/evse/low_level_state':
        case 'Wallbox/evse/managed':
        case 'Wallbox/evse/management_current':
        case 'Wallbox/evse/management_enabled':
        case 'Wallbox/evse/max_charging_current':
        case 'Wallbox/evse/modbus_tcp_enabled':
        case 'Wallbox/evse/ocpp_enabled':
        case 'Wallbox/evse/slots':
        case 'Wallbox/evse/state':
        case 'Wallbox/evse/user_current':
        case 'Wallbox/evse/user_enabled':
        case 'Wallbox/info/display_name':
        case 'Wallbox/info/display_name_modified':
        case 'Wallbox/info/features':
        case 'Wallbox/info/last_boots':
        case 'Wallbox/info/modules':
        case 'Wallbox/info/name':
        case 'Wallbox/info/version':
        case 'Wallbox/meter/all_values':
        case 'Wallbox/meter/detailed_values':
        case 'Wallbox/meter/error_counters':
        case 'Wallbox/meter/last_reset':
        case 'Wallbox/meter/phases':
        case 'Wallbox/meter/state':
        case 'Wallbox/meter/values':
        case 'Wallbox/modbus_tcp/config':
        case 'Wallbox/modbus_tcp/config_modified':
        case 'Wallbox/modules':
        case 'Wallbox/mqtt/config':
        case 'Wallbox/mqtt/config_modified':
        case 'Wallbox/mqtt/state':
        case 'Wallbox/network/config':
        case 'Wallbox/network/config_modified':
        case 'Wallbox/nfc/config':
        case 'Wallbox/nfc/config_modified':
        case 'Wallbox/nfc/seen_tags':
        case 'Wallbox/ntp/config':
        case 'Wallbox/ntp/config_modified':
        case 'Wallbox/ntp/state':
        case 'Wallbox/users/config':
        case 'Wallbox/version':
        case 'Wallbox/wifi/ap_config':
        case 'Wallbox/wifi/ap_config_modified':
        case 'Wallbox/wifi/sta_config':
        case 'Wallbox/wifi/sta_config_modified':
        case 'Wallbox/wifi/state':
        case 'Wallbox/wireguard/config_modified':
        case 'Wallbox/wireguard/config':
        case 'Wallbox/wireguard/state':
        case 'wetter/dwd/INFO':
        case 'wetter/openweather/INFO':
        case 'Wind/tele/SENSOR':
        case 'Wohnzimmer/tele/SENSOR':
        case 'Zigbee/bridge/devices':
        case 'Zigbee/bridge/event':
        case 'Zigbee/bridge/extensions':
        case 'Zigbee/bridge/groups':
        case 'Zigbee/bridge/info':
        case 'Zigbee/bridge/log':
        case 'Zigbee/bridge/logging':
        case 'Zigbee/bridge/ota_update/check':
        case 'Zigbee/bridge/request/networkmap':
        case 'Zigbee/bridge/request/permit_join':
        case 'Zigbee/bridge/response/device/ota_update/check':
        case 'Zigbee/bridge/response/networkmap':
        case 'Zigbee/bridge/response/permit_join':
        case 'Zigbee/bridge/state':
        case 'Zigbee/Coordinator/availability':
        case 'Zigbee/FensterSensor Badezimmer':
        case 'Zigbee/FensterSensor Badezimmer/availability':
        case 'Zigbee/FensterSensor Büro':
        case 'Zigbee/FensterSensor Büro/availability':
        case 'Zigbee/FensterSensor Garage':
        case 'Zigbee/FensterSensor Garage/availability':
        case 'Zigbee/FensterSensor Kinderbad':
        case 'Zigbee/FensterSensor Kinderbad/availability':
        case 'Zigbee/FensterSensor Toilette':
        case 'Zigbee/FensterSensor Toilette/availability':
        case 'Zigbee/FensterSensor Sonoff 1':
        case 'Zigbee/FensterSensor Sonoff 1/availability':
        case 'Zigbee/LuftSensor Außen':
        case 'Zigbee/LuftSensor Außen/availability':
        case 'Zigbee/LuftSensor Büro':
        case 'Zigbee/LuftSensor Büro/availability':
        case 'Zigbee/LuftSensor Wohnzimmer':
        case 'Zigbee/LuftSensor Wohnzimmer/availability':
        case 'Zigbee/Repeater Büro':
        case 'Zigbee/Repeater Büro/availability':
        case 'Zigbee/Repeater EG':
        case 'Zigbee/Repeater EG/availability':
        case 'Zigbee/Repeater OG':
        case 'Zigbee/Repeater OG/availability':
          // ignore
          break;

        case 'valetudo/dreame-d9/MapData/map-data': // TODO
          // logger.info('valetudo/map-data', message);
          break;

//        case 'esp32-wasser/zaehlerstand/value': {
//          if(previousWasserValue !== message) {
//            if(previousWasserValue) {
//              logger.info('esp32-wasser', {value: message, diff: _.round(message - previousWasserValue, 4)});
//            } else {
//              logger.info('esp32-wasser', {value: message});
//            }
//
//            previousWasserValue = message;
//          } else {
//            logger.info('esp32-wasser', {value: message});
//          }
//          break;
//        }

        case 'esp32-wasser/zaehlerstand/error':
          if(message && message !== 'no error') {
            logger.info('esp32-wasser Fehler', message);
          }
          break;

        case 'tasmota/haustürklingel/stat/RESULT': {
//          logger.info('tasmota/Haustür Klingel', message);

          const contact = message.POWER;

          if(contact === 'ON') {
            logger.info('Haustür klingelt');

            await Promise.all([
              popup('Haustür Klingel', '', 'doorbell.png'),
              sound('sounds/doorbell.mp3'),
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
            sound('sounds/ringer.mp3'),
          ]);
          break;
        }

        case 'Mqtt/cmnd/alert':
          await Promise.all([
            popup(JSON.stringify(message), message.tone, 'ringer.png'),
            sound(`sounds/${message.tone || 'alert'}.mp3`),
          ]);
          break;

        case 'tasmota/espco2/tele/SENSOR':
          // logger.warn('ESP/CO2 sensor', message);
          if(Number(message.MHZ19B.CarbonDioxide) > 1000) {
            await Promise.all([
              popup('Hohe CO2 Konzentration - Lüften', message.MHZ19B.CarbonDioxide, 'air.png'),
            ]);
          }
          break;

        case 'mqtt/test/notification':
          logger.warn('test', message);
          await Promise.all([
            popup('test', message, 'alert.png'),
            sound(`sounds/${message || 'alert'}.mp3`),
          ]);
          break;

        default:
          logger.error(`Unhandled topic '${topic}'`, message || messageRaw);
          break;
      }
    } catch(err) {
      logger.error(`Failed mqtt handling for '${topic}': ${messageRaw}`, err);
    }
  });

  await mqttClient.subscribe('#');

  // #########################################################################
  // Connect to mail server to handle incoming mail
  const {host, password, port, user} = imapConfig;

  try {
    imapClient = await imaps.connect({
      imap: {
    //        debug:       console.log,
        user,
        password,
        host,
        port,
        tls:         true,
        authTimeout: 25000,
        connTimeout: 1000,
      },
      async onmail() {
        const mails = await imapClient.search(['UNSEEN'], {bodies: ['HEADER', 'TEXT'], markSeen: true});

        if(!mails.length) {
          return;
        }

        logger.debug('OnMail event');

      // logger.debug({mails});
        for(const mail of mails) {
          const {parts} = mail;
          const header = _.find(parts, {which: 'HEADER'}).body;
          const from = header.from.join(',');
          const subject = header.subject.join(',');
          const to = header.to.join(',');
          const token = _.find(parts, {which: 'TEXT'}).body.trim();

          logger.debug({from, to, subject, token});

          const {ip} = await connect({token});

          await sendMail({
            to:      from,
            subject: `VPN connected on ${ip}`,
            html:    `
              <p>VPN connected on ${ip}</p>
            `,
          });
        }
      },
    });

    await imapClient.openBox('INBOX');
  } catch(err) {
    logger.error('Failed to connect IMAP:', err.message);

    setTimeout(() => {
      logger.info('Stop to trigger IMAP reconnect');

      stopProcess();
    }, ms('1 hour'));
  }

  // #########################################################################
  // Blank screen on Enter
  const line = readline.createInterface({
    input:  process.stdin,
    output: process.stdout,
  });

  // eslint-disable-next-line no-constant-condition
  while(true) {
    await new Promise(resolve => {
      line.question('', resolve);
    });

    for(let i = 0; i < windowSize.get().height; i++) {
      // eslint-disable-next-line no-console
      console.log('');
    }
  }
})();
