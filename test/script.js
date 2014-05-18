var osmUrl='http://otile{s}.mqcdn.com/tiles/1.0.0/map/{z}/{x}/{y}.jpeg';
var osmAttrib='Map data © <a href="http://osm.org/copyright">OpenStreetMap</a> contributors';
var subDomains = '1234';
var osm = new L.TileLayer(osmUrl, {
        attribution: osmAttrib,
        subdomains: subDomains
});

var map = new L.Map('map', {
    layers: [osm],
    center: [45, 9],
    zoom: 16,
	zoomControl: true
});

// add location control to global name space for testing only
// on a production site, omit the "lc = "!
lc = L.control.locate({
	follow: true,
	keepCurrentZoomLevel: true,
	onLocationError: function(err) { },
}).addTo(map);

map.on('startfollowing', function() {
    map.on('dragstart', lc.stopFollowing);
}).on('stopfollowing', function() {
    map.off('dragstart', lc.stopFollowing);
});
