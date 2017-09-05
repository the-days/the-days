#!/bin/bash

set -e

cd `dirname $0`
cd ../data

wget http://download.geonames.org/export/dump/cities5000.zip
wget http://download.geonames.org/export/dump/alternateNames.zip
wget ftp://ftp.ncdc.noaa.gov/pub/data/noaa/isd-history.txt
for year in `seq 1997 2016`;do
    wget ftp://ftp.ncdc.noaa.gov/pub/data/gsod/$year/gsod_$year.tar
done
