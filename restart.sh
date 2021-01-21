#!/bin/bash

# kill `ps -ef | grep node.*mqtt | grep -v grep | awk '{print $2}'`

kill `cat ~/.mqtt.pid`
