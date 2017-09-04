package main

import (
	"github.com/jackc/pgx"
	"io/ioutil"
	"log"
	"strings"
)

// ftp://ftp.ncdc.noaa.gov/pub/data/noaa/isd-history.txt
const STATIONS_FILE = "./isd-history.txt"

func main() {
	conn, err := pgx.Connect(pgx.ConnConfig{
		Database: "days",
	})
	if err != nil {
		panic(err)
	}
	defer conn.Close()
	tx, err := conn.Begin()
	if err != nil {
		panic(err)
	}
	data, err := ioutil.ReadFile(STATIONS_FILE)
	if err != nil {
		panic(err)
	}
	lines := strings.Split(string(data), "\n")
	for i := 0; i < len(lines); i++ {
		if strings.HasPrefix(lines[i], "USAF   WBAN") {
			lines = lines[i+1:]
			break
		}
	}
	for _, line := range lines {
		if line == "" {
			continue
		}
		id := line[0:6] + "-" + line[7:12]
		name := strings.TrimSpace(line[13:43])
		country := strings.TrimSpace(line[43:48])
		icao := strings.TrimSpace(line[51:57])
		latitude := strings.TrimSpace(line[57:65])
		longitude := strings.TrimSpace(line[65:74])
		elevation := strings.TrimSpace(line[74:82])
		insert(tx, id, name, country, icao, latitude, longitude, elevation)
	}
	err = tx.Commit()
	if err != nil {
		panic(err)
	}
}
func insert(tx *pgx.Tx, args ...interface{}) {
	sql := "INSERT INTO stations (id, name, country, icao, coordinate, elevation) " +
		"VALUES ($1, $2, $3, $4, point($5, $6), $7)"
	for i, v := range args {
		if value := v.(string); value == "" {
			args[i] = nil
		}
	}
	_, err := tx.Exec(sql, args...)
	if err != nil {
		log.Println(args[0], args[1])
		panic(err)
	}
}
