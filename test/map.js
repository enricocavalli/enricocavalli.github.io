var map = L.map('map');
var positionIndicator = Object;

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



// add an OpenStreetMap tile layer
//L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
L.tileLayer('http://otile{s}.mqcdn.com/tiles/1.0.0/map/{z}/{x}/{y}.jpeg', {
    subdomains: '1234',
    attribution: 'Tiles by <a href="http://www.mapquest.com/">MapQuest</a> &mdash; Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>'
}).addTo(map);

function onLocationFound(e) {
    var radius = e.accuracy / 2;

    if ( positionIndicator.circle !== undefined ) { 
        map.removeLayer(positionIndicator.circle);
        map.removeLayer(positionIndicator.marker);
    }
    positionIndicator.marker = new L.marker(e.latlng);
    positionIndicator.circle = new L.circle(e.latlng, radius, { weight: 1 });
    map.addLayer(positionIndicator.marker);
    map.addLayer(positionIndicator.circle);
    positionIndicator.marker.bindPopup(e.latlng.toString() + ", " + "Accuracy: " + radius + " meters");

    if ( ! info.added ) {
    info.addTo(map);
    info.added=true;
    }
    displayBoundInformation();
    map.on('move',displayBoundInformation);
}

map.on('locationfound', onLocationFound);


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

function trackMe() {
setTimeout(function() { var follow = document.URL.indexOf('#track') >0 ? true: false; map.locate({setView: true }); trackMe(); },5000);
}

map.locate({setView: true, maxZoom: 16});
trackMe();
