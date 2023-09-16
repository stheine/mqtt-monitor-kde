#!/bin/sh

# shellcheck disable=SC1091
# shellcheck disable=SC2009

CHECKPID=$(cat ~/.mqtt.pid 2>/dev/null)
if [ -n "${CHECKPID}" ]; then
  echo "mqtt.sh, checking ${CHECKPID}" >> ~/.mqtt.log
  if kill -0 "${CHECKPID}" 2>/dev/null; then
    PROCESS=$(ps -ef | grep -e " ${CHECKPID} .*mqtt.js" | grep -v grep)
    if [ -n "${PROCESS}" ]; then
      # Already running
      echo "mqtt.sh, already running ${CHECKPID}" >> ~/.mqtt.log
      exit 0
    fi
  fi
fi

NVM_DIR="$(realpath "$HOME"/.nvm)"
export NVM_DIR
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"  # This loads nvm

while true; do
  echo "mqtt.sh, (re)starting mqtt.js" >> ~/.mqtt.log
  "$(dirname "$0")/mqtt.js" </dev/null 2>&1 | tee -a ~/.mqtt.log
  sleep 1
done
