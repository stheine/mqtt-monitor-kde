import childProcess from 'child_process';

import logger       from './logger.js';

export const connect = async function({token}) {
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
    vpnConfig.server,
  ]);

  return await new Promise((resolve, reject) => {
    const handleData = async function(data) {
      const dataString = data.toString().trim();

      logger.debug(dataString);

      if(dataString.endsWith('Domain ID:')) {
        logger.debug('  DOMAIN REQUEST, answer');
        vpnProcess.stdin.write(`${vpnConfig.domain}\n`);
      } else if(dataString.endsWith('Domain Password:')) {
        logger.debug('  PASSWORD REQUEST, answer');
        vpnProcess.stdin.write(`${vpnConfig.password}\n`);
      } else if(dataString.endsWith('Please enter response:')) {
        if(triedToken) {
          vpnProcess.kill();

          return reject(new Error('Invalid token'));
        }

        logger.debug('  TOKEN REQUEST, answer');
        vpnProcess.stdin.write(`${token}\n`);

        triedToken = true;
      } else if(dataString.endsWith('using SSL, with ESP in progress')) {
        const ip = dataString.replace(/^.*Connected as /, '').replace(/, using SSL.*$/, '');

        vpnProcess.stderr.removeListener('data', handleData);
        vpnProcess.stdout.removeListener('data', handleData);

        return resolve({ip, vpnProcess});
      }
    };

    vpnProcess.stderr.on('data', handleData);
    vpnProcess.stdout.on('data', handleData);
  });
};
