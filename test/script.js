var L = require('leaflet');
L.Icon.Default.imagePath = 'node_modules/leaflet/dist/images/'; // adjiusted for browserify

var osmUrl='http://otile{s}.mqcdn.com/tiles/1.0.0/map/{z}/{x}/{y}.jpeg';
var osmAttrib='Map data © <a href="http://osm.org/copyright">OpenStreetMap</a> contributors';
var subDomains = '1234';
var osm = new L.TileLayer(osmUrl, {
        attribution: osmAttrib,
        subdomains: subDomains
});


var map = new L.Map('map', {
    layers: [osm],
    center: [10,0],
    zoom: 2,
	zoomControl: true
});

window.map=map;

$('#drawgeohash').click(function() {
//$('#menu').hide();
geodraw=require('./app/geohashdraw');
geodraw.showSubHash("");
});


$('#navigation').click(function() {
//$('#menu').hide();
require('./app/navigator');

});


