package main

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"github.com/jackc/pgx"
	"io"
	"io/ioutil"
	"log"
	"os"
	"path/filepath"
	"reflect"
	"regexp"
	"strconv"
	"strings"
	"sync"
)

// for year in `seq 1997 2016`;do wget ftp://ftp.ncdc.noaa.gov/pub/data/gsod/$year/gsod_$year.tar ; done
const DATA_DIR = "data"
const THREADS = 8

func init() {
	log.SetFlags(log.Ltime | log.Lshortfile)
}

var pgConn *pgx.ConnPool

func connect() *pgx.ConnPool {
	conn, err := pgx.NewConnPool(pgx.ConnPoolConfig{
		ConnConfig: pgx.ConnConfig{
			Database: "days",
		},
		MaxConnections: THREADS * 2,
	})
	if err != nil {
		panic(err)
	}
	return conn
}
func main() {
	pgConn = connect()
	defer pgConn.Close()

	var wg sync.WaitGroup
	filesChan := make(chan File, 128)

	for i := 0; i < THREADS; i++ {
		wg.Add(1)
		go worker(&wg, pgConn, filesChan)
	}
	getFiles(filesChan)
	close(filesChan)
	wg.Wait()
}
func getFiles(output chan File) {
	walk := func(path string, info os.FileInfo, err error) error {
		if err != nil {
			panic(err)
		}
		if strings.HasSuffix(path, ".tar") {
			tarFile, err := os.Open(path)
			if err != nil {
				panic(err)
			}
			defer tarFile.Close()
			tarReader := tar.NewReader(tarFile)
			var number int
			for {
				header, err := tarReader.Next()
				if err == io.EOF {
					break
				}
				if err != nil {
					panic(err)
				}
				if !strings.HasSuffix(header.Name, "gz") {
					continue
				}
				gzReader, err := gzip.NewReader(tarReader)
				if err != nil {
					panic(err)
				}
				data, err := ioutil.ReadAll(gzReader)
				if err != nil {
					panic(err)
				}
				number++
				log.Println(path, number)
				output <- File{
					name: header.Name,
					data: data,
				}
			}
		}
		return nil
	}
	err := filepath.Walk(DATA_DIR, walk)
	if err != nil {
		panic(err)
	}
}
func worker(wg *sync.WaitGroup, pool *pgx.ConnPool, files chan File) {
	tx, err := pool.Begin()
	if err != nil {
		panic(err)
	}
	defer func() {
		if err := recover(); err != nil {
			panic(err)
		}
		err = tx.Commit()
		if err != nil {
			panic(err)
		}
	}()
	for f := range files {
		process(tx, f)
	}
	wg.Done()
}

type Line struct {
	date            string
	MeanTemperature interface{}
	MeanDewPoint    interface{}
	MeanSeaPressure interface{}
	MeanPressure    interface{}
	MeanVisibility  interface{}
	MeanWindSpeed   interface{}
	MaxTemperature  interface{}
	MinTemperature  interface{}
	Precipitation   interface{}
}

func parseLine(lineStr []byte) *Line {
	var line Line
	line.date = string(lineStr[14:22])
	line.MeanTemperature = checkNullAndConvert(lineStr[24:30], "9999.9", Fahrenheit)
	line.MeanDewPoint = checkNullAndConvert(lineStr[35:41], "9999.9", Fahrenheit)
	line.MeanSeaPressure = checkNullAndConvert(lineStr[46:52], "9999.9", Millibar)
	line.MeanPressure = checkNullAndConvert(lineStr[57:63], "9999.9", Millibar)
	line.MeanVisibility = checkNullAndConvert(lineStr[68:73], "999.9", Mile)
	line.MeanWindSpeed = checkNullAndConvert(lineStr[78:83], "999.9", Knot)
	line.MaxTemperature = checkNullAndConvert(lineStr[102:108], "9999.9", Fahrenheit)
	line.MinTemperature = checkNullAndConvert(lineStr[110:116], "9999.9", Fahrenheit)
	line.Precipitation = checkNullAndConvert(lineStr[118:123], "99.99", Inch)
	return &line
}

const (
	Fahrenheit = iota
	Mile
	Knot
	Inch
	Millibar
)

func checkNullAndConvert(value []byte, nullValue string, unit byte) interface{} {
	str := strings.TrimSpace(string(value))
	if str == nullValue {
		return nil
	}
	v, err := strconv.ParseFloat(str, 64)
	if err != nil {
		panic(err)
	}
	switch unit {
	case Fahrenheit:
		return (v - 32) / 9 * 5
	case Mile:
		return v * 1609.34
	case Knot:
		return v * 0.514444
	case Inch:
		if v == 0 {
			return nil
		}
		return v * 25.4
	case Millibar:
		return v * 100
	}
	panic("wrong unit")
}

type File struct {
	name string
	data []byte
}

var re = regexp.MustCompile(`(\d{6}-\d{5})-(\d{4})\.op\.gz`)

func process(tx *pgx.Tx, file File) {
	match := re.FindStringSubmatch(file.name)
	stationId := match[1]
	lines := bytes.Split(file.data, []byte("\n"))
	records := make([]*Line, 0, 400)
	for _, line := range lines {
		if len(line) == 0 || bytes.HasPrefix(line, []byte("STN--- WBAN")) {
			continue
		}
		records = append(records, parseLine(line))
	}
	checkDataValid(tx, stationId, records)
	for _, record := range records {
		insert(tx, stationId, record)
	}
}

func checkDataValid(tx *pgx.Tx, stationId string, records []*Line) {
	total := int16(len(records))
	year := records[0].date[:4]
	nilCount := make(map[string]int16)
	lineType := reflect.TypeOf(*records[0])
	var fields []string
	for i := 0; i < lineType.NumField(); i++ {
		field := lineType.Field(i).Name
		if field == "date" {
			continue
		}
		fields = append(fields, field)
	}
	for _, record := range records {
		value := reflect.ValueOf(*record)
		for _, field := range fields {
			if value.FieldByName(field).IsNil() {
				nilCount[field]++
			}
		}
	}
	var availability Line
	availabilityValue := reflect.ValueOf(&availability)
	for _, field := range fields {
		availabilityValue.Elem().FieldByName(field).Set(reflect.ValueOf(total - nilCount[field]))
	}
	insertAvailability(tx, stationId, year, total, &availability)
}

func insert(tx *pgx.Tx, stationId string, line *Line) {
	sql := "INSERT INTO gsod (station_id, record_date, mean_temperature, " +
		"max_temperature, min_temperature, mean_dew_point, mean_sea_pressure, " +
		"mean_pressure, mean_visibility, mean_wind_speed, precipitation) " +
		"VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)"
	_, err := tx.Exec(sql, stationId, line.date, line.MeanTemperature, line.MaxTemperature,
		line.MinTemperature, line.MeanDewPoint, line.MeanSeaPressure, line.MeanPressure,
		line.MeanVisibility, line.MeanWindSpeed, line.Precipitation)
	if err != nil {
		log.Println(stationId, line.date)
		panic(err)
	}
}
func insertAvailability(tx *pgx.Tx, stationId string, year string, count int16, line *Line) {
	sql := "INSERT INTO gsod_availability (station_id, year, count, mean_temperature, " +
		"max_temperature, min_temperature, mean_dew_point, mean_sea_pressure, " +
		"mean_pressure, mean_visibility, mean_wind_speed, precipitation) " +
		"SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12"
	_, err := tx.Exec(sql, stationId, year, count, line.MeanTemperature, line.MaxTemperature,
		line.MinTemperature, line.MeanDewPoint, line.MeanSeaPressure, line.MeanPressure,
		line.MeanVisibility, line.MeanWindSpeed, line.Precipitation)
	if err != nil {
		panic(err)
	}
}
