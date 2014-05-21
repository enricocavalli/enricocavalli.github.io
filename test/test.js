var pts = [];               // All the GPS points
var localStorageKey="io.github.enricocavalli.gps";
pts = JSON.parse(localStorage.getItem(localStorageKey));
var geojson={};

geojson.type="GeometryCollection";
geojson.geometries=[];

for (var p in pts) {
		position = new Object;
		position.type="Point";
		position.coordinates = [];
		position.coordinates.push(pts[p].coords.longitude);
		position.coordinates.push(pts[p].coords.latitude);
	geojson.geometries.push(position);
}

var osmUrl='http://otile{s}.mqcdn.com/tiles/1.0.0/map/{z}/{x}/{y}.jpeg';
var osmAttrib='Map data © <a href="http://osm.org/copyright">OpenStreetMap</a> contributors';
var subDomains = '1234';
var osm = new L.TileLayer(osmUrl, {
        attribution: osmAttrib,
        subdomains: subDomains
});

var map = new L.Map('map', {
    layers: [osm],
    center: [45.471, 9.178],
    zoom: 16,
	zoomControl: true
});

var markers=[];

for (var p in pts) {
 if (pts[p].coords.latitude !== null && pts[p].coords.longitude !== null ) 
	markers.push(L.marker([pts[p].coords.latitude,pts[p].coords.longitude]));

}

var group = new L.featureGroup(markers);

 map.fitBounds(group.getBounds());

 group.addTo(map);