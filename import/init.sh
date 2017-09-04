#!/bin/bash

set -e

dropdb days
createdb days
psql -ddays -f init.sql
cd city
go run main.go
cd ../station
go run main.go
cd ../gsod
go run main.go
cd ..
psql -ddays -f index.sql

pg_dump -ddays -t cities -t stations -t gsod_availability | xz > dump.sql.xz
