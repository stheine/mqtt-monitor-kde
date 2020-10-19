#!/bin/sh

CHECKPID=`cat ~/.mqtt.pid 2>/dev/null`
kill -0 $CHECKPID
if [ $? = 0 ]; then
  # Already running
  exit 0
fi


while [ true ]; do
  ~/js/mqtt/mqtt.js </dev/null | tee -a ~/.mqtt.log
  sleep 1
done
