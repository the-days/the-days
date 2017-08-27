#!/usr/bin/env bash

echo "Preparing nginx configuration"
PWD=$(pwd)
sed "s#__ROOT__#$PWD#g" conf/nginx.conf.template > conf/nginx.conf