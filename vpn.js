import _            from 'lodash';
import childProcess from 'child_process';

import logger       from './logger.js';

export const connect = async function() {
  let vpnConfig;

  try {
    vpnConfig = (await import('/mnt/qnap_linux/data/vpn/config.js')).default;
  } catch{
    throw new Error('Failed to load /mnt/qnap_linux/data/vpn/config.js');
  }

  let triedToken = false;


  const vpnProcess = childProcess.spawn('/usr/bin/sudo', [
    '/usr/sbin/openconnect',
    `--authgroup=${vpnConfig.authgroup}`,
    `--protocol=${vpnConfig.protocol}`,
    `--user=${vpnConfig.user}`,
    '--quiet',
    vpnConfig.server,
  ]);

  return new Promise((resolve, reject) => {
    vpnProcess.on('close', code => logger.info(`Process close ${code}`));
    vpnProcess.on('disconnect', code => logger.info(`Process disconnect ${code}`));
    vpnProcess.on('error', code => logger.info(`Process error ${code}`));
    vpnProcess.on('exit', code => logger.info(`Process exit ${code}`));
    vpnProcess.on('message', code => logger.info(`Process message ${code}`));
    vpnProcess.on('spawn', code => logger.info(`Process spawn ${code}`));

    const handleData = async function(data) {
      const dataString = data.toString().trim();
      const dataArray = _.map(dataString.split(/\n/), dataLine => dataLine.trim());

      for(const dataLine of dataArray) {
        if(!dataLine.startsWith('>')) {
          logger.debug(dataLine);
        }

//        if(dataLine === 'Domain ID:') {
//          logger.debug('# -> DOMAIN REQUEST, answer');
//          vpnProcess.stdin.write(`${vpnConfig.domain}\n`);
//        } else
        if(dataLine === 'Micro Focus Domain Password:') {
          logger.debug('# -> PASSWORD REQUEST, answer');
          vpnProcess.stdin.write(`${vpnConfig.password}\n`);
        } else if(dataLine === 'Please enter response:') {
          if(triedToken) {
  //          logger.debug('wrong token, stop trying');

            vpnProcess.kill();

            return reject(new Error('Invalid token'));
          }

          const dialogProcess = childProcess.spawn('/usr/bin/kdialog', [
            '--title', 'VPN',
            '--inputbox', `Enter ${vpnConfig.authgroup}`,
          ]);

          const token = await new Promise(resolveToken => {
            const handleTokenData = function(tokenData) {
              const dataTokenStrin = tokenData.toString().trim();

              dialogProcess.stdout.removeListener('data', handleTokenData);

              return resolveToken(dataTokenStrin);
            };

            dialogProcess.stdout.on('data', handleTokenData);
          });

          if(!token) {
            logger.error('Token missing');

            process.exit(1);
          }

          logger.debug('# -> TOKEN REQUEST, answer');
          vpnProcess.stdin.write(`${token}\n`);

          triedToken = true;
//        } else if(dataLine.endsWith('using SSL, with ESP in progress')) {
        } else if(dataLine.includes(`Enter 'yes' to accept`)) {
          vpnProcess.stdin.write('yes\n');
        } else if(dataLine.startsWith('Received internal Legacy IP address')) {
          const ip = dataLine.replace(/^Received internal Legacy IP address /, '');

          vpnProcess.stderr.removeListener('data', handleData);
          vpnProcess.stdout.removeListener('data', handleData);

          return resolve({ip, vpnProcess});
        }
      }
    };

    vpnProcess.stderr.on('data', handleData);
    vpnProcess.stdout.on('data', handleData);
  });
};
