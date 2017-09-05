package main

import (
	"bytes"
	"encoding/json"
	"github.com/jackc/pgx"
	"log"
	"net/http"
	"strings"
	"time"
)

const CitySQL = `SELECT cities.name, cities.alternate_names AS names, cities.country, cities.link,
    cities.coordinate[0] AS latitude, cities.coordinate[1] AS longitude, cities.elevation,
    cities.population,
    jsonb_agg(jsonb_build_object('id', stations.id, 'name', stations.name, 'icao', stations.icao,
    'country', stations.country, 'latitude', stations.coordinate[0],
    'longitude', stations.coordinate[1], 'elevation', stations.elevation)) AS stations
FROM cities
    CROSS JOIN LATERAL (SELECT * FROM stations
            INNER JOIN gsod_availability ON stations.id = gsod_availability.station_id AND gsod_availability.year = $2
                 AND gsod_availability.max_temperature > 350 AND gsod_availability.min_temperature > 350 AND gsod_availability.precipitation > 0
        ORDER BY cities.coordinate <-> stations.coordinate LIMIT 8) stations
    WHERE cities.alternate_names @> ('[{"name": "' || $1 || '"}]')::JSONB
GROUP BY cities.id`

const StationSQL = `SELECT stations.id, stations.name, stations.icao, stations.country,
    stations.coordinate[0] AS latitude, stations.coordinate[1] AS longitude, stations.elevation,
    jsonb_agg(jsonb_build_object(
                  'name', cities.name, 'names', cities.alternate_names, 'country', cities.country,
                  'link', cities.link, 'latitude', cities.coordinate[0], 'longitude', cities.coordinate[1],
                  'elevation', cities.elevation, 'population', cities.population)) AS cities
FROM stations CROSS JOIN LATERAL (
    SELECT * FROM cities ORDER BY cities.coordinate <-> stations.coordinate LIMIT 8
) AS cities
WHERE stations.name = $1 OR stations.id = $1 OR stations.icao = $1
GROUP BY stations.id`

var pgConn *pgx.ConnPool

func makeSlice(fields []pgx.FieldDescription) (result []interface{}) {
	for _, field := range fields {
		switch field.DataTypeName {
		case "text":
			var v string
			result = append(result, &v)
		case "jsonb":
			var v interface{}
			result = append(result, &v)
		case "float4", "float8":
			var v float32
			result = append(result, &v)
		case "int8":
			var v int64
			result = append(result, &v)
		default:
			panic(field.DataTypeName)
		}
	}
	return
}
func queryDB(sql string, args ...interface{}) ([]byte, error) {
	rows, err := pgConn.Query(sql, args...)
	if err != nil {
		return nil, err
	}
	var result []map[string]interface{}
	fields := rows.FieldDescriptions()
	for rows.Next() {
		values := makeSlice(fields)
		err = rows.Scan(values...)
		if err != nil {
			return nil, err
		}
		row := make(map[string]interface{})
		for i, field := range fields {
			row[field.Name] = values[i]
		}
		result = append(result, row)
	}
	return json.Marshal(result)
}

func writeResponse(w http.ResponseWriter, data []byte, err error) {
	if err != nil {
		log.Println(err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if bytes.Equal(data, []byte("null")) {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	_, err = w.Write(data)
	if err != nil {
		log.Println(err)
	}
}
func cityHandler(w http.ResponseWriter, req *http.Request) {
	query := req.URL.Query()
	if len(query["year"]) != 1 || len(query["name"]) != 1 {
		http.Error(w, "invalid argument", http.StatusBadRequest)
		return
	}
	year := query["year"][0]
	name := query["name"][0]
	result, err := queryDB(CitySQL, name, year)
	writeResponse(w, result, err)
}
func stationHandler(w http.ResponseWriter, req *http.Request) {
	query := req.URL.Query()
	if len(query["name"]) != 1 {
		http.Error(w, "invalid argument", http.StatusBadRequest)
		return
	}
	name := query["name"][0]
	result, err := queryDB(StationSQL, name)
	writeResponse(w, result, err)
}

func Handler(w http.ResponseWriter, req *http.Request) {
	start := time.Now()
	defer func() {
		log.Println(req.URL, time.Since(start))
	}()
	path := strings.Trim(req.URL.Path, "/")
	w.Header().Add("Content-Type", "application/json")
	switch path {
	case "city":
		cityHandler(w, req)
	case "station":
		stationHandler(w, req)
	default:
		http.Error(w, "invalid path", http.StatusBadRequest)
	}
}
func connect() *pgx.ConnPool {
	conn, err := pgx.NewConnPool(pgx.ConnPoolConfig{
		ConnConfig: pgx.ConnConfig{
			Database: "days",
		},
		MaxConnections: 16,
	})
	if err != nil {
		panic(err)
	}
	return conn
}

func main() {
	pgConn = connect()
	http.HandleFunc("/", Handler)
	log.Fatal(http.ListenAndServe("127.0.0.1:3130", nil))
}
