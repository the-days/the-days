#!/bin/bash

set -e

cd `dirname $0`
cd ..

dropdb days || echo 'create database days'
createdb days
psql -ddays -f import/table.sql
go run import/city.go
go run import/station.go
go run import/gsod.go
psql -ddays -f import/index.sql
