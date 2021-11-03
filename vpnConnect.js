#!/usr/bin/env node

'use strict';

const childProcess = require('child_process');

const {connect}    = require('./vpn');
const logger       = require('./logger');

// ###########################################################################
// Main (async)

(async() => {
  const dialogProcess = childProcess.spawn('/usr/bin/kdialog', [
    '--title', 'VPN',
    '--inputbox', 'Enter token',
  ]);

  const token = await new Promise(resolve => {
    const handleData = function(data) {
      const dataString = data.toString().trim();

      dialogProcess.stdout.removeListener('data', handleData);

      return resolve(dataString);
    };

    dialogProcess.stdout.on('data', handleData);
  });

  if(!token) {
    logger.error('Token missing');

    process.exit(1);
  }

  let ip;
  let vpnProcess;

  try {
    ({ip, vpnProcess} = await connect({token}));
  } catch(err) {
    logger.error(`Failed to connect: ${err.message}`);

    process.exit(1);
  }

  logger.info(`Connected on ${ip}`);

  vpnProcess.on('close', (code, signal) => {
    logger.info(`VPN disconnect ${code}/${signal}`);
  });
})();
