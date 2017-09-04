CREATE INDEX ON stations (icao);
CREATE INDEX ON stations (name);
CREATE INDEX ON stations USING GIST (coordinate);

CREATE INDEX ON cities (station_id);
CREATE INDEX ON cities (name);
CREATE INDEX ON cities USING GIN (alternate_names jsonb_path_ops);
CREATE INDEX ON cities USING GIST (coordinate);
