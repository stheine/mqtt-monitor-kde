#!/bin/sh

CHECKPID=`cat ~/.mqtt.pid 2>/dev/null`
if [ -n "$CHECKPID" ]; then
  kill -0 $CHECKPID 2>/dev/null
  if [ $? = 0 ]; then
    PROCESS=`ps -ef | grep -e " $CHECKPID .*mqtt.js" | grep -v grep`
    if [ -n "$PROCESS" ]; then
      # Already running
      exit 0
    fi
  fi
fi


while [ true ]; do
  $(dirname $0)/mqtt.js </dev/null | tee -a ~/.mqtt.log
  sleep 1
done
