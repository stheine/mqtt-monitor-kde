#!/usr/bin/env node

// import childProcess from 'child_process';

import {connect}    from './vpn.js';
import logger       from './logger.js';
// import vpnConfig    from '/mnt/qnap_linux/data/vpn/config.js';

// ###########################################################################
// Main (async)

(async() => {
//  const dialogProcess = childProcess.spawn('/usr/bin/kdialog', [
//    '--title', 'VPN',
//    '--inputbox', `Enter ${vpnConfig.authgroup}`,
//  ]);
//
//  const token = await new Promise(resolve => {
//    const handleData = function(data) {
//      const dataString = data.toString().trim();
//
//      dialogProcess.stdout.removeListener('data', handleData);
//
//      return resolve(dataString);
//    };
//
//    dialogProcess.stdout.on('data', handleData);
//  });
//
//  if(!token) {
//    logger.error('Token missing');
//
//    process.exit(1);
//  }

  let ip;
  let vpnProcess;

  try {
    ({ip, vpnProcess} = await connect());
  } catch(err) {
    logger.error(`Failed to connect: ${err.message}`);

    process.exit(1);
  }

  logger.info(`Connected on ${ip}`);

  vpnProcess.on('close', (code, signal) => {
    logger.info(`VPN disconnect ${code}/${signal}`);
  });
})();
