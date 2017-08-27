#!/usr/bin/env bash

echo "Preparing Data..."
cd gsod
wget ftp://ftp.ncdc.noaa.gov/pub/data/noaa/isd-history.txt
wget ftp://ftp.ncdc.noaa.gov//pub/data/gsod/country-list.txt
wget ftp://ftp.ncdc.noaa.gov//pub/data/gsod/readme.txt
#for year in `seq 1997 2016`;do wget ftp://ftp.ncdc.noaa.gov//pub/data/gsod/$year/gsod_$year.tar;done
for year in `seq 1997 2016`;do tar zxvf gsod_$year.tar;done