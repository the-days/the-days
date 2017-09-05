CREATE TABLE stations (
    id         TEXT PRIMARY KEY,
    name       TEXT,
    country    TEXT,
    icao       TEXT,
    coordinate POINT,
    elevation  REAL
);

CREATE TABLE cities (
    id              BIGINT PRIMARY KEY,
    station_id      TEXT,
    name            TEXT   NOT NULL,
    country         TEXT   NOT NULL,
    alternate_names JSONB  NOT NULL,
    link            JSONB  NOT NULL,
    coordinate      POINT,
    elevation       REAL   NOT NULL,
    population      BIGINT NOT NULL,
    timezone        TEXT   NOT NULL
);

CREATE TABLE gsod (
    station_id        TEXT NOT NULL,
    record_date       DATE NOT NULL,
    mean_temperature  REAL,
    max_temperature   REAL,
    min_temperature   REAL,
    mean_dew_point    REAL,
    mean_sea_pressure REAL,
    mean_pressure     REAL,
    mean_visibility   REAL,
    mean_wind_speed   REAL,
    precipitation     REAL
);

CREATE TABLE gsod_availability (
    station_id        TEXT     NOT NULL,
    year              SMALLINT NOT NULL,
    mean_temperature  SMALLINT,
    max_temperature   SMALLINT,
    min_temperature   SMALLINT,
    mean_dew_point    SMALLINT,
    mean_sea_pressure SMALLINT,
    mean_pressure     SMALLINT,
    mean_visibility   SMALLINT,
    mean_wind_speed   SMALLINT,
    precipitation     SMALLINT,
    count             SMALLINT,
    PRIMARY KEY (station_id, year)
);
