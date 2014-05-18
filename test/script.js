var osmUrl='http://otile{s}.mqcdn.com/tiles/1.0.0/map/{z}/{x}/{y}.jpeg';
var osmAttrib='Map data © <a href="http://osm.org/copyright">OpenStreetMap</a> contributors';
var subDomains = '1234';
var osm = new L.TileLayer(osmUrl, {
        attribution: osmAttrib,
        subdomains: subDomains
});


var info = L.control();
info.added = false;
info.onAdd = function (map) {
    this._div = L.DomUtil.create('div', 'info'); // create a div with a class "info"
    this.update();
    return this._div;
};

info.update = function (props) {
 this._div.innerHTML = '<h4>Info</h4>' + 
 (props ? 'Center: '+props.center+'<br>'+'Box: '+props.box : '');

}

var map = new L.Map('map', {
    layers: [osm],
    center: [45.569, 9.178],
    zoom: 16,
	zoomControl: true
});

function coordToString(c,p) {
    p = typeof p !== 'undefined' ? p : 3;
    return c.lat.toFixed(p)+', '+c.lng.toFixed(p)
}

function displayBoundInformation() {
 var bounds=map.getBounds();
    var minll=bounds.getSouthWest();
    var maxll=bounds.getNorthEast();
    var center=map.getCenter();
    var o = Object;
    o.box= coordToString(minll)+' '+coordToString(maxll);  
    o.center = coordToString(center);
    info.update(o);

}
map.on('locationfound', function(e) { 
  if ( ! info.added ) {
    info.addTo(map);
    info.added=true;
    }
    displayBoundInformation();
    map.on('move', displayBoundInformation);
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
