package main

import (
	"archive/zip"
	"github.com/jackc/pgx"
	"io/ioutil"
	"log"
	"strings"
)

// http://download.geonames.org/export/dump/cities5000.zip
const CITIES_FILE = "data/cities5000.zip"

// http://download.geonames.org/export/dump/alternateNames.zip
const NAMES_FILE = "data/alternateNames.zip"

type AlternateNames struct {
	Name     string `json:"name"`
	Language string `json:"language"`
}

func readNames() (names map[string][]AlternateNames, links map[string][]string) {
	z, err := zip.OpenReader(NAMES_FILE)
	if err != nil {
		panic(err)
	}
	var f *zip.File
	for _, f = range z.File {
		if f.Name == "alternateNames.txt" {
			break
		}
	}
	reader, err := f.Open()
	if err != nil {
		panic(err)
	}
	namesData, err := ioutil.ReadAll(reader)
	if err != nil {
		panic(err)
	}
	lines := strings.Split(string(namesData), "\n")
	names = make(map[string][]AlternateNames)
	links = make(map[string][]string)
	for _, line := range lines {
		if line == "" {
			continue
		}
		fields := strings.Split(line, "\t")
		id := fields[1]
		language := fields[2]
		name := fields[3]
		if language == "link" {
			links[id] = append(links[id], name)
		} else {
			names[id] = append(names[id], AlternateNames{
				Name:     name,
				Language: language,
			})
		}
	}
	return
}
func main() {
	names, links := readNames()
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
	z, err := zip.OpenReader(CITIES_FILE)
	if err != nil {
		panic(err)
	}
	f, err := z.File[0].Open()
	if err != nil {
		panic(err)
	}
	log.Println(z.File[0].Name)
	citiesData, err := ioutil.ReadAll(f)
	if err != nil {
		panic(err)
	}
	lines := strings.Split(string(citiesData), "\n")
	for _, line := range lines {
		if line == "" {
			continue
		}
		fields := strings.Split(line, "\t")
		id := fields[0]
		name := fields[1]
		alternateNames := names[id]
		link := links[id]
		latitude := fields[4]
		longitude := fields[5]
		class := fields[6]
		country := fields[8]
		population := fields[14]
		elevation := fields[16]
		timezone := fields[17]
		if class != "P" {
			log.Println(class)
			log.Println(id, name, alternateNames, country)
			continue
		}
		insert(tx, id, name, latitude, longitude, country, population, elevation, timezone, alternateNames, link)
	}
	err = tx.Commit()
	if err != nil {
		panic(err)
	}
}
func insert(tx *pgx.Tx,
	id, name, latitude, longitude, country, population, elevation, timezone string,
	alternateNames []AlternateNames, link []string) {
	sql := "INSERT INTO cities (id, name, link, alternate_names, coordinate, elevation, " +
		"country, population, timezone) VALUES ($1, $2, $3, $4, point($5, $6), $7, $8, $9, $10)"
	_, err := tx.Exec(sql, id, name, link, alternateNames, latitude, longitude, elevation,
		country, population, timezone)
	if err != nil {
		log.Println(id, name, alternateNames, country)
		panic(err)
	}
}
