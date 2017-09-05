#!/bin/bash

pg_dump -ddays -t cities -t stations -t gsod_availability | xz > dump.sql.xz
